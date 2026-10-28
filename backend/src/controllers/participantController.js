import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { storage } from '../services/storageService.js';
import { cleanString } from '../services/nameNormalizer.js';
import { MATCH_STATUS } from '../config/constants.js';

function hashAccessCode(code = '') {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(clean).digest('hex');
}

export const participantController = {
  /**
   * Verify participant credentials and access code
   */
  async verifyAccess(req, res) {
    try {
      const { name, email, identifier, accessCode } = req.body;

      // Support either (name + email) OR (identifier + accessCode)
      const inputName = (name || identifier || '').trim();
      const inputEmail = (email || '').trim().toLowerCase();
      const inputCode = (accessCode || '').trim();

      if (!inputName || (!inputEmail && !inputCode)) {
        return res.status(400).json({
          success: false,
          error: 'Please provide both your Registered Full Name and Email Address.'
        });
      }

      const cleanInputName = cleanString(inputName);
      const inputCodeHash = inputCode ? hashAccessCode(inputCode) : null;

      // Search across events to find matching participant and published certificate
      const allEvents = await storage.events.findAll();
      let matchedParticipant = null;
      let matchedEvent = null;
      let matchedAllocation = null;

      for (const ev of allEvents) {
        const participants = await storage.participants.findByEventId(ev.id);
        const allocations = await storage.allocations.findByEventId(ev.id);

        for (const p of participants) {
          const participantCleanName = cleanString(p.participantName);
          const participantEmail = (p.email || '').toLowerCase().trim();
          const participantId = (p.participantId || '').toLowerCase().trim();

          let isMatch = false;

          // Primary credential check: Name + Email
          if (inputEmail) {
            const isNameMatch =
              participantCleanName === cleanInputName ||
              p.normalizedName === cleanInputName ||
              participantId === cleanInputName.toLowerCase();
            const isEmailMatch = participantEmail === inputEmail;

            if (isNameMatch && isEmailMatch) {
              isMatch = true;
            }
          } else if (inputCodeHash) {
            // Secondary fallback: Identifier + Access Code
            const isIdentMatch =
              participantCleanName === cleanInputName ||
              p.normalizedName === cleanInputName ||
              participantEmail === cleanInputName.toLowerCase() ||
              participantId === cleanInputName.toLowerCase();

            if (isIdentMatch) {
              const alloc = allocations.find(a => a.participantId === p.id);
              if (alloc && alloc.accessCodeHash === inputCodeHash) {
                isMatch = true;
              }
            }
          }

          if (isMatch) {
            const alloc = allocations.find(a => a.participantId === p.id);
            // Must have a matched certificate and not be revoked
            if (alloc && alloc.status === MATCH_STATUS.MATCHED && alloc.certificateId) {
              matchedParticipant = p;
              matchedEvent = ev;
              matchedAllocation = alloc;
              break;
            }
          }
        }
        if (matchedAllocation) break;
      }

      // If credentials do not match or certificate is not published/matched
      if (!matchedAllocation || !matchedParticipant || !matchedAllocation.certificateId) {
        return res.status(401).json({
          success: false,
          error: 'No active certificate found matching the provided Name and Email address. Please double-check your event registration details.'
        });
      }

      // Generate a single-session download ticket (15 min validity)
      const downloadTicket = jwt.sign(
        {
          allocationId: matchedAllocation.id,
          participantId: matchedParticipant.id,
          certificateId: matchedAllocation.certificateId,
          eventId: matchedEvent.id
        },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '15m' }
      );

      return res.json({
        success: true,
        participant: {
          name: matchedParticipant.participantName,
          email: matchedParticipant.email,
          participantId: matchedParticipant.participantId
        },
        event: {
          name: matchedEvent.name,
          date: matchedEvent.date
        },
        issuedAt: matchedAllocation.publishedAt,
        downloadTicket
      });
    } catch (err) {
      console.error('Portal verify error:', err);
      return res.status(500).json({
        success: false,
        error: 'An internal error occurred while verifying credentials.'
      });
    }
  },

  /**
   * Secure PDF Download
   */
  async downloadCertificate(req, res) {
    try {
      const { ticket } = req.params;

      let payload;
      try {
        payload = jwt.verify(ticket, process.env.JWT_SECRET || 'fallback_secret');
      } catch (jwtErr) {
        return res.status(401).json({
          success: false,
          error: 'Download session expired or invalid. Please verify your access code again.'
        });
      }

      const { certificateId, participantId, allocationId, eventId } = payload;

      const cert = await storage.certificates.findById(certificateId);
      const participant = await storage.participants.findById(participantId);

      if (!cert || (!cert.pdfData && (!cert.storedPath || !fs.existsSync(cert.storedPath)))) {
        return res.status(404).json({
          success: false,
          error: 'Certificate file not found on secure server.'
        });
      }

      // Increment download counter & record timestamp
      await storage.allocations.update(allocationId, {
        downloadCount: (cert.downloadCount || 0) + 1,
        lastDownloadedAt: new Date().toISOString()
      });

      // Audit log download
      await storage.auditLogs.log(
        eventId,
        'CERTIFICATE_DOWNLOADED',
        `Participant "${participant?.participantName || participantId}" downloaded certificate.`,
        req.ip
      );

      // Clean, meaningful download filename (e.g. Vinay_Gangurde_Certificate.pdf)
      const safeName = (participant?.participantName || 'Certificate')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_');
      const downloadFilename = `${safeName}_Certificate.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      if (cert.pdfData) {
        return res.end(Buffer.isBuffer(cert.pdfData) ? cert.pdfData : Buffer.from(cert.pdfData));
      }
      const stream = fs.createReadStream(cert.storedPath);
      stream.pipe(res);
    } catch (err) {
      console.error('Download error:', err);
      return res.status(500).json({ success: false, error: 'Failed to process certificate download.' });
    }
  },

  /**
   * In-Browser PDF Stream for Viewer Preview
   */
  async streamCertificate(req, res) {
    try {
      const { ticket } = req.params;

      let payload;
      try {
        payload = jwt.verify(ticket, process.env.JWT_SECRET || 'fallback_secret');
      } catch (jwtErr) {
        return res.status(401).json({
          success: false,
          error: 'View session expired or invalid.'
        });
      }

      const { certificateId } = payload;
      const cert = await storage.certificates.findById(certificateId);

      if (!cert || (!cert.pdfData && (!cert.storedPath || !fs.existsSync(cert.storedPath)))) {
        return res.status(404).json({ success: false, error: 'Certificate file not found.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="certificate_preview.pdf"');
      if (cert.pdfData) {
        return res.end(Buffer.isBuffer(cert.pdfData) ? cert.pdfData : Buffer.from(cert.pdfData));
      }
      const stream = fs.createReadStream(cert.storedPath);
      stream.pipe(res);
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to stream certificate.' });
    }
  }
};

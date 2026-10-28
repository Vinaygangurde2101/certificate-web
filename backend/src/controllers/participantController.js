import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { storage } from '../services/storageService.js';
import { cleanString, calculateFuzzyScore } from '../services/nameNormalizer.js';
import { MATCH_STATUS } from '../config/constants.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_smart_cert_allocation_portal_9988';

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
      const { name, email, identifier, accessCode } = req.body || {};

      const inputName = (name || identifier || '').trim();
      const inputEmail = (email || '').trim().toLowerCase();
      const inputCode = (accessCode || '').trim();

      if (!inputName && !inputEmail && !inputCode) {
        return res.status(400).json({
          success: false,
          error: 'Please enter your Full Name, registered Email Address, or Access Code.'
        });
      }

      const cleanInputName = cleanString(inputName);
      const inputCodeHash = inputCode ? hashAccessCode(inputCode) : null;
      const inputTokens = cleanInputName ? cleanInputName.split(/\s+/).filter(Boolean) : [];

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
          const partTokens = (p.normalizedName || participantCleanName).split(/\s+/).filter(Boolean);

          const isEmailMatch = inputEmail ? (participantEmail === inputEmail) : false;
          let isNameMatch = false;

          if (cleanInputName) {
            if (
              participantCleanName === cleanInputName ||
              p.normalizedName === cleanInputName ||
              participantId === cleanInputName.toLowerCase()
            ) {
              isNameMatch = true;
            } else if (inputTokens.length > 0 && partTokens.length > 0) {
              const fuzzyScore = calculateFuzzyScore(inputTokens, partTokens);
              if (fuzzyScore >= 0.8) {
                isNameMatch = true;
              }
            }
          }

          let isMatch = false;

          // Credential Check 1: Access Code Match
          if (inputCodeHash) {
            const alloc = allocations.find(a => a.participantId === p.id);
            if (alloc && alloc.accessCodeHash === inputCodeHash) {
              // Access code is correct! If email or name was also supplied, verify consistency
              if (inputEmail && !isEmailMatch) {
                // Email supplied but doesn't match this access code
                continue;
              }
              if (cleanInputName && !isNameMatch) {
                // Name supplied but doesn't match this access code
                continue;
              }
              isMatch = true;
            }
          }

          // Credential Check 2: Name + Email Match (Standard Participant Lookup)
          if (!isMatch && inputEmail && cleanInputName) {
            if (isNameMatch && isEmailMatch) {
              isMatch = true;
            }
          }

          if (isMatch) {
            const alloc = allocations.find(a => a.participantId === p.id);
            // Must have a valid matched certificate and not be revoked
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
          error: 'No active certificate found matching the provided credentials. Please double-check your Name, Email, or Access Code.'
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
        JWT_SECRET,
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
        payload = jwt.verify(ticket, JWT_SECRET);
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
        payload = jwt.verify(ticket, JWT_SECRET);
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

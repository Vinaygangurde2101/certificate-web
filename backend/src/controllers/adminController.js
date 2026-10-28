import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Papa from 'papaparse';
import * as XLSXModule from 'xlsx';
const XLSX = XLSXModule.default || XLSXModule;
import { storage } from '../services/storageService.js';
import { processZipCertificates } from '../services/zipService.js';
import { matchCertificatesToParticipants } from '../services/matchingService.js';
import { normalizeParticipantName } from '../services/nameNormalizer.js';
import { sendAccessCodeEmail } from '../services/emailService.js';
import { MATCH_STATUS, EVENT_STATUS, MATCH_METHOD, CERTIFICATES_DIR } from '../config/constants.js';

// Generate cryptographically secure access code (8-character alphanumeric e.g. A9K2-M7X4)
function generateSecureAccessCode() {
  const bytes = crypto.randomBytes(4);
  const code = bytes.toString('hex').toUpperCase();
  return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
}

// Compute SHA-256 hash of access code
function hashAccessCode(code) {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(clean).digest('hex');
}

/**
 * Normalize CSV/Excel column names
 */
function extractParticipantRow(row) {
  if (!row || typeof row !== 'object') return null;
  const keys = Object.keys(row);
  const findVal = (patterns) => {
    for (const pat of patterns) {
      const foundKey = keys.find(k => k.trim().toLowerCase().replace(/[-_\s]/g, '') === pat);
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  };

  const name = findVal([
    'participantname', 'name', 'fullname', 'studentname', 'student',
    'attendee', 'attendeename', 'participant', 'candidate', 'candidatename',
    'recipient', 'recipientname', 'user', 'username', 'member', 'person'
  ]);

  const email = findVal([
    'email', 'emailaddress', 'mail', 'emailid', 'e_mail', 'useremail',
    'participantemail', 'contactemail'
  ]);

  const id = findVal([
    'participantid', 'id', 'rollno', 'registrationid', 'registrationno',
    'regno', 'regid', 'code', 'ticketid', 'serial', 'srno', 'sno',
    'certid', 'studentid', 'empid'
  ]);

  if (!name && !email && !id) return null;

  const resolvedName = name || (email ? email.split('@')[0].replace(/[._]/g, ' ') : id);
  const { normalized } = normalizeParticipantName(resolvedName);

  return {
    participantName: resolvedName,
    email: email || '',
    participantId: id || '',
    normalizedName: normalized
  };
}

export const adminController = {
  // Admin Login
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const expectedUser = process.env.ADMIN_USERNAME || 'admin';
      const expectedPass = process.env.ADMIN_PASSWORD || 'Admin@SmartCert2026';

      if (username !== expectedUser || password !== expectedPass) {
        return res.status(401).json({
          success: false,
          error: 'Invalid admin username or password.'
        });
      }

      const token = jwt.sign(
        { username, role: 'admin' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        token,
        admin: { username }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Get current admin user
  async me(req, res) {
    return res.json({
      success: true,
      admin: { username: req.admin?.username || 'admin' },
      isDemoMode: process.env.DEMO_MODE === 'true',
      isUsingMongo: storage.isUsingMongo()
    });
  },

  // Events: List all
  async getEvents(req, res) {
    try {
      const events = await storage.events.findAll();
      const enriched = await Promise.all(
        events.map(async (ev) => {
          const participants = await storage.participants.findByEventId(ev.id);
          const allocations = await storage.allocations.findByEventId(ev.id);
          const certificates = await storage.certificates.findByEventId(ev.id);

          const matchedCount = allocations.filter(a => a.status === MATCH_STATUS.MATCHED).length;
          const needsReviewCount = allocations.filter(a => a.status === MATCH_STATUS.NEEDS_REVIEW).length;
          const unmatchedCount = allocations.filter(a => a.status === MATCH_STATUS.UNMATCHED).length;
          const duplicateCount = allocations.filter(a => a.status === MATCH_STATUS.DUPLICATE).length;

          return {
            ...ev,
            stats: {
              totalParticipants: participants.length,
              totalCertificates: certificates.length,
              matched: matchedCount,
              needsReview: needsReviewCount,
              unmatched: unmatchedCount,
              duplicates: duplicateCount
            }
          };
        })
      );
      return res.json({ success: true, events: enriched });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Events: Create
  async createEvent(req, res) {
    try {
      const { name, date, description } = req.body;
      if (!name || !date) {
        return res.status(400).json({
          success: false,
          error: 'Event name and date are required.'
        });
      }

      const event = await storage.events.create({ name, date, description });
      await storage.auditLogs.log(
        event.id,
        'EVENT_CREATED',
        `Event "${name}" scheduled for ${date} was created.`,
        req.ip
      );

      return res.status(201).json({ success: true, event });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Events: Details with full matching breakdown
  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const event = await storage.events.findById(id);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found.' });
      }

      const participants = await storage.participants.findByEventId(id);
      const certificates = await storage.certificates.findByEventId(id);
      const allocations = await storage.allocations.findByEventId(id);
      const auditLogs = await storage.auditLogs.findByEventId(id);

      // Join allocations with participant and certificate data
      const joinedAllocations = allocations.map(a => {
        const p = participants.find(part => part.id === a.participantId);
        const c = certificates.find(cert => cert.id === a.certificateId);
        return {
          id: a.id,
          participantId: a.participantId,
          participantName: p ? p.participantName : 'Unknown',
          email: p ? p.email : '',
          pCode: p ? p.participantId : '',
          certificateId: a.certificateId,
          certificateFilename: c ? c.originalFilename : null,
          status: a.status,
          confidenceScore: a.confidenceScore,
          matchMethod: a.matchMethod,
          notes: a.notes,
          suggestedMatches: a.suggestedMatches || [],
          accessCode: a.accessCodePlain, // Visible in demo/review
          publishedAt: a.publishedAt,
          downloadCount: a.downloadCount || 0,
          lastDownloadedAt: a.lastDownloadedAt
        };
      });

      // Stats summary
      const stats = {
        totalParticipants: participants.length,
        totalCertificates: certificates.length,
        matched: joinedAllocations.filter(a => a.status === MATCH_STATUS.MATCHED).length,
        needsReview: joinedAllocations.filter(a => a.status === MATCH_STATUS.NEEDS_REVIEW).length,
        unmatched: joinedAllocations.filter(a => a.status === MATCH_STATUS.UNMATCHED).length,
        duplicate: joinedAllocations.filter(a => a.status === MATCH_STATUS.DUPLICATE).length,
        published: joinedAllocations.filter(a => Boolean(a.publishedAt)).length
      };

      return res.json({
        success: true,
        event,
        stats,
        allocations: joinedAllocations,
        certificates: certificates.map(c => ({
          id: c.id,
          originalFilename: c.originalFilename,
          extractedName: c.extractedName,
          extractedId: c.extractedId,
          fileSize: c.fileSize,
          sha256Hash: c.sha256Hash
        })),
        auditLogs
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Upload ZIP & Participant List and execute matching
  async uploadAndProcess(req, res) {
    try {
      const { eventId } = req.params;
      const event = await storage.events.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found.' });
      }

      if (!req.files || !req.files.zipFile || !req.files.participantFile) {
        return res.status(400).json({
          success: false,
          error: 'Both ZIP file and Participant CSV/Excel file are required.'
        });
      }

      const zipFile = req.files.zipFile[0];
      const partFile = req.files.participantFile[0];

      // 1. Parse Participants file (CSV or Excel)
      const rawParticipants = [];
      const ext = path.extname(partFile.originalname).toLowerCase();

      if (ext === '.csv') {
        const fileContent = fs.readFileSync(partFile.path, 'utf8');
        const parsed = Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true
        });
        for (const row of parsed.data) {
          const item = extractParticipantRow(row);
          if (item) rawParticipants.push({ ...item, eventId });
        }
      } else if (ext === '.xlsx' || ext === '.xls') {
        const fileBuffer = fs.readFileSync(partFile.path);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        for (const row of rows) {
          const item = extractParticipantRow(row);
          if (item) rawParticipants.push({ ...item, eventId });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Participant list must be a .csv, .xlsx, or .xls file.'
        });
      }

      if (rawParticipants.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid participant records found in the uploaded file. Ensure column names include name, email, participant_id.'
        });
      }

      // 2. Extract ZIP Certificates securely
      const zipResult = await processZipCertificates(zipFile.path, eventId);
      if (zipResult.certificates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid PDF certificate documents could be extracted from the ZIP archive.'
        });
      }

      // Clean up uploaded temp files
      try {
        fs.unlinkSync(zipFile.path);
        fs.unlinkSync(partFile.path);
      } catch (cleanErr) {
        // non-blocking
      }

      // 3. Clear any existing draft data for this event to allow clean re-upload
      await storage.allocations.deleteByEventId(eventId);

      // Save participants & certificates
      const savedParticipants = await storage.participants.bulkInsert(rawParticipants);
      const savedCertificates = await storage.certificates.bulkInsert(
        zipResult.certificates.map(c => ({
          ...c,
          eventId
        }))
      );

      // 4. Run Smart Matching Engine
      const matchResults = await matchCertificatesToParticipants(savedParticipants, savedCertificates);

      // 5. Store Allocations in database
      const allocationsToSave = matchResults.allocations.map(a => ({
        eventId,
        participantId: a.participantId,
        certificateId: a.certificateId,
        status: a.status,
        confidenceScore: a.confidenceScore,
        matchMethod: a.matchMethod,
        suggestedMatches: a.suggestedMatches,
        notes: a.notes
      }));

      await storage.allocations.bulkInsert(allocationsToSave);

      // 6. Log audit event
      await storage.auditLogs.log(
        eventId,
        'DATA_PROCESSED',
        `Processed ${savedParticipants.length} participants and ${savedCertificates.length} certificates. Auto-matched: ${
          allocationsToSave.filter(a => a.status === MATCH_STATUS.MATCHED).length
        }, Needs Review: ${allocationsToSave.filter(a => a.status === MATCH_STATUS.NEEDS_REVIEW).length}`,
        req.ip
      );

      return res.json({
        success: true,
        message: 'Certificates and participant list processed successfully.',
        stats: {
          totalParticipants: savedParticipants.length,
          totalCertificates: savedCertificates.length,
          matched: allocationsToSave.filter(a => a.status === MATCH_STATUS.MATCHED).length,
          needsReview: allocationsToSave.filter(a => a.status === MATCH_STATUS.NEEDS_REVIEW).length,
          unmatched: allocationsToSave.filter(a => a.status === MATCH_STATUS.UNMATCHED).length,
          duplicates: allocationsToSave.filter(a => a.status === MATCH_STATUS.DUPLICATE).length
        },
        warnings: zipResult.errors
      });
    } catch (err) {
      console.error('Upload processing error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Manual Match Override
  async manualMatch(req, res) {
    try {
      const { allocationId } = req.params;
      const { certificateId, status, notes } = req.body;

      const allocation = await storage.allocations.findById(allocationId);
      if (!allocation) {
        return res.status(404).json({ success: false, error: 'Allocation record not found.' });
      }

      // If linking a certificate, verify it's not already linked to another participant
      if (certificateId && certificateId !== allocation.certificateId) {
        const existingAllocations = await storage.allocations.findByCertificateId(certificateId);
        const activeExisting = existingAllocations.filter(
          a => a.id !== allocationId && a.status === MATCH_STATUS.MATCHED
        );

        if (activeExisting.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'This certificate is already allocated to another participant. Revoke or unlink the other match first.'
          });
        }
      }

      const updates = {
        certificateId: certificateId || null,
        status: status || (certificateId ? MATCH_STATUS.MATCHED : MATCH_STATUS.UNMATCHED),
        confidenceScore: certificateId ? 1.0 : 0,
        matchMethod: MATCH_METHOD.MANUAL,
        notes: notes || 'Manually updated by admin.'
      };

      const updated = await storage.allocations.update(allocationId, updates);

      await storage.auditLogs.log(
        allocation.eventId,
        'MANUAL_OVERRIDE',
        `Admin manually changed allocation for participant ${allocation.participantId} to certificate ${certificateId || 'none'} (${updates.status})`,
        req.ip
      );

      return res.json({ success: true, allocation: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Publish Certificates
  async publishCertificates(req, res) {
    try {
      const { eventId } = req.params;
      const { sendEmails = false, forcePublish = false } = req.body;

      const event = await storage.events.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, error: 'Event not found.' });
      }

      const allocations = await storage.allocations.findByEventId(eventId);
      const participants = await storage.participants.findByEventId(eventId);

      // Check unresolved Needs Review items
      const unresolvedReview = allocations.filter(a => a.status === MATCH_STATUS.NEEDS_REVIEW);
      if (unresolvedReview.length > 0 && !forcePublish) {
        return res.status(400).json({
          success: false,
          error: `Cannot publish: There are ${unresolvedReview.length} unresolved matches that require review. Resolve them or check 'Publish despite pending reviews'.`,
          pendingReviewsCount: unresolvedReview.length
        });
      }

      const now = new Date().toISOString();
      const publishedAllocations = [];
      const emailDeliveries = [];

      for (const alloc of allocations) {
        // Only publish matched records with a valid certificate
        if (alloc.status === MATCH_STATUS.MATCHED && alloc.certificateId) {
          const plainCode = alloc.accessCodePlain || generateSecureAccessCode();
          const codeHash = hashAccessCode(plainCode);

          const updated = await storage.allocations.update(alloc.id, {
            accessCodeHash: codeHash,
            accessCodePlain: plainCode,
            publishedAt: now
          });

          publishedAllocations.push(updated);

          const participant = participants.find(p => p.id === alloc.participantId);
          if (participant && sendEmails) {
            const emailResult = await sendAccessCodeEmail({
              to: participant.email,
              participantName: participant.participantName,
              eventName: event.name,
              accessCode: plainCode,
              portalUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/portal`
            });
            emailDeliveries.push({
              email: participant.email,
              participantName: participant.participantName,
              accessCode: plainCode,
              ...emailResult
            });
          }
        }
      }

      // Update event status
      await storage.events.update(eventId, { status: EVENT_STATUS.PUBLISHED });

      await storage.auditLogs.log(
        eventId,
        'CERTIFICATES_PUBLISHED',
        `Published ${publishedAllocations.length} certificates. Emails triggered: ${sendEmails ? 'Yes' : 'No'}`,
        req.ip
      );

      return res.json({
        success: true,
        message: `Successfully published ${publishedAllocations.length} certificates!`,
        publishedCount: publishedAllocations.length,
        emailsSent: emailDeliveries.length,
        emailDeliveries
      });
    } catch (err) {
      console.error('Publish error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Revoke a participant's certificate
  async revokeCertificate(req, res) {
    try {
      const { allocationId } = req.params;
      const allocation = await storage.allocations.findById(allocationId);
      if (!allocation) {
        return res.status(404).json({ success: false, error: 'Allocation not found.' });
      }

      const updated = await storage.allocations.update(allocationId, {
        status: MATCH_STATUS.REVOKED,
        accessCodeHash: null,
        accessCodePlain: null,
        notes: 'Access revoked by admin.'
      });

      await storage.auditLogs.log(
        allocation.eventId,
        'CERTIFICATE_REVOKED',
        `Admin revoked access for participant ${allocation.participantId}`,
        req.ip
      );

      return res.json({ success: true, allocation: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Admin preview certificate PDF
  async previewCertificate(req, res) {
    try {
      const { certId } = req.params;
      const cert = await storage.certificates.findById(certId);
      if (!cert || (!cert.pdfData && (!cert.storedPath || !fs.existsSync(cert.storedPath)))) {
        return res.status(404).json({ success: false, error: 'Certificate file not found on storage.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(cert.originalFilename)}"`);
      if (cert.pdfData) {
        return res.end(Buffer.isBuffer(cert.pdfData) ? cert.pdfData : Buffer.from(cert.pdfData));
      }
      const fileStream = fs.createReadStream(cert.storedPath);
      fileStream.pipe(res);
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  },

  // Delete event
  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      await storage.events.delete(id);
      return res.json({ success: true, message: 'Event and associated records deleted.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

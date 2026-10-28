import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { storage } from '../services/storageService.js';
import { processZipCertificates } from '../services/zipService.js';
import { matchCertificatesToParticipants } from '../services/matchingService.js';
import { generateDemoArtifacts } from '../scripts/generateDemoData.js';
import { MATCH_STATUS, EVENT_STATUS } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.resolve(__dirname, '../../sample_data');

function hashAccessCode(code) {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return crypto.createHash('sha256').update(clean).digest('hex');
}

export const demoController = {
  // Download sample participants.csv
  async getSampleCsv(req, res) {
    const csvPath = path.resolve(SAMPLES_DIR, 'participants.csv');
    if (!fs.existsSync(csvPath)) {
      await generateDemoArtifacts();
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="participants_sample.csv"');
    fs.createReadStream(csvPath).pipe(res);
  },

  // Download sample certificates.zip
  async getSampleZip(req, res) {
    const zipPath = path.resolve(SAMPLES_DIR, 'certificates.zip');
    if (!fs.existsSync(zipPath)) {
      await generateDemoArtifacts();
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="certificates_sample.zip"');
    fs.createReadStream(zipPath).pipe(res);
  },

  // One-click quick seed
  async seedDemo(req, res) {
    try {
      const zipPath = path.resolve(SAMPLES_DIR, 'certificates.zip');
      const csvPath = path.resolve(SAMPLES_DIR, 'participants.csv');

      if (!fs.existsSync(zipPath) || !fs.existsSync(csvPath)) {
        await generateDemoArtifacts();
      }

      // 1. Create Demo Event
      const event = await storage.events.create({
        name: 'Smart Certificate Hackathon 2026 (Demo)',
        date: '2026-10-27',
        description: 'Auto-generated demo event showcasing exact matches, fuzzy matches, PDF text scans, and duplicates.'
      });

      // 2. Parse CSV
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
      const participants = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim());
        if (parts.length >= 3) {
          participants.push({
            eventId: event.id,
            participantName: parts[0],
            email: parts[1],
            participantId: parts[2]
          });
        }
      }

      const savedParticipants = await storage.participants.bulkInsert(participants);

      // 3. Extract ZIP
      const zipResult = await processZipCertificates(zipPath, event.id);
      const savedCertificates = await storage.certificates.bulkInsert(
        zipResult.certificates.map(c => ({
          ...c,
          eventId: event.id
        }))
      );

      // 4. Run Matching
      const matchResults = await matchCertificatesToParticipants(savedParticipants, savedCertificates);

      // 5. Store Allocations
      const allocationsToSave = matchResults.allocations.map(a => {
        // Pre-generate access code for matched participants
        const plainCode = `DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
        return {
          eventId: event.id,
          participantId: a.participantId,
          certificateId: a.certificateId,
          status: a.status,
          confidenceScore: a.confidenceScore,
          matchMethod: a.matchMethod,
          suggestedMatches: a.suggestedMatches,
          notes: a.notes,
          accessCodePlain: plainCode,
          accessCodeHash: hashAccessCode(plainCode)
        };
      });

      await storage.allocations.bulkInsert(allocationsToSave);

      await storage.auditLogs.log(
        event.id,
        'DEMO_DATA_INITIALIZED',
        `Initialized demo event with ${savedParticipants.length} participants and ${savedCertificates.length} certificates.`,
        req.ip
      );

      return res.json({
        success: true,
        message: 'Demo dataset loaded successfully!',
        eventId: event.id,
        summary: {
          participantsCount: savedParticipants.length,
          certificatesCount: savedCertificates.length,
          matched: allocationsToSave.filter(a => a.status === MATCH_STATUS.MATCHED).length,
          needsReview: allocationsToSave.filter(a => a.status === MATCH_STATUS.NEEDS_REVIEW).length,
          unmatched: allocationsToSave.filter(a => a.status === MATCH_STATUS.UNMATCHED).length,
          duplicate: allocationsToSave.filter(a => a.status === MATCH_STATUS.DUPLICATE).length
        }
      });
    } catch (err) {
      console.error('Seed demo error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }
};

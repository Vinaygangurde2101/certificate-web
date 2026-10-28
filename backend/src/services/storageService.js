import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { DATA_DIR, DB_FILE } from '../config/constants.js';
import {
  EventModel,
  ParticipantModel,
  CertificateModel,
  AllocationModel,
  AuditLogModel
} from '../models/schemas.js';

// Ensure data directory exists for offline fallback
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let isMongoConnected = false;

// Initialize file database structure if not present
function loadFileDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading db.json, reinitializing:', err.message);
  }
  const initial = {
    events: [],
    participants: [],
    certificates: [],
    allocations: [],
    auditLogs: []
  };
  saveFileDb(initial);
  return initial;
}

function saveFileDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err.message);
  }
}

// In-memory cache for fast file-backed operations
let memoryDb = loadFileDb();

function cleanDoc(doc) {
  if (!doc) return null;
  const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  delete obj._id;
  delete obj.__v;
  return obj;
}

// Sync local data to MongoDB if MongoDB is newly connected and empty
async function syncLocalToMongoIfEmpty() {
  try {
    const count = await EventModel.countDocuments();
    if (count === 0 && memoryDb.events.length > 0) {
      console.log('[Storage] Migrating existing local data into MongoDB Atlas...');
      if (memoryDb.events.length) await EventModel.insertMany(memoryDb.events);
      if (memoryDb.participants.length) await ParticipantModel.insertMany(memoryDb.participants);
      if (memoryDb.certificates.length) await CertificateModel.insertMany(memoryDb.certificates);
      if (memoryDb.allocations.length) await AllocationModel.insertMany(memoryDb.allocations);
      if (memoryDb.auditLogs.length) await AuditLogModel.insertMany(memoryDb.auditLogs);
      console.log('[Storage] Migration to MongoDB complete.');
    }
  } catch (syncErr) {
    console.warn('[Storage] Auto-sync to MongoDB skipped:', syncErr.message);
  }
}

// Attempt Mongo connection safely
export async function initStorage() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[Storage] No MONGODB_URI provided. Using persistent file DB:', DB_FILE);
    return;
  }

  // Prevent connecting if placeholder password is still present
  if (uri.includes('<') && uri.includes('>')) {
    console.warn('[Storage] MONGODB_URI contains an unreplaced password placeholder (e.g. <YOUR_PASSWORD>). Please replace it with your real password in backend/.env. Using local storage for now.');
    return;
  }

  try {
    // 3 second connect timeout to avoid blocking server boot if remote network is slow
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000
    });
    isMongoConnected = true;
    console.log('[Storage] Connected to MongoDB Atlas successfully. Real-time cloud persistence ACTIVE.');
    await syncLocalToMongoIfEmpty();
  } catch (err) {
    console.warn(`[Storage] MongoDB connection skipped (${err.message}). Defaulting to embedded persistent storage: ${DB_FILE}`);
    isMongoConnected = false;
  }
}

// Exported Storage API
export const storage = {
  isUsingMongo() {
    return isMongoConnected;
  },

  // Events
  events: {
    async create(eventData) {
      const record = {
        id: uuidv4(),
        name: eventData.name,
        date: eventData.date,
        description: eventData.description || '',
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isMongoConnected) {
        const doc = await EventModel.create(record);
        return cleanDoc(doc);
      }

      memoryDb.events.push(record);
      saveFileDb(memoryDb);
      return record;
    },

    async findAll() {
      if (isMongoConnected) {
        const docs = await EventModel.find().sort({ createdAt: -1 }).lean();
        return docs.map(cleanDoc);
      }
      return [...memoryDb.events].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async findById(id) {
      if (isMongoConnected) {
        const doc = await EventModel.findOne({ id }).lean();
        return cleanDoc(doc);
      }
      return memoryDb.events.find(e => e.id === id) || null;
    },

    async update(id, updates) {
      const updatedAt = new Date().toISOString();
      if (isMongoConnected) {
        const doc = await EventModel.findOneAndUpdate(
          { id },
          { ...updates, updatedAt },
          { new: true }
        ).lean();
        return cleanDoc(doc);
      }

      const idx = memoryDb.events.findIndex(e => e.id === id);
      if (idx === -1) return null;
      memoryDb.events[idx] = {
        ...memoryDb.events[idx],
        ...updates,
        updatedAt
      };
      saveFileDb(memoryDb);
      return memoryDb.events[idx];
    },

    async delete(id) {
      if (isMongoConnected) {
        await EventModel.deleteOne({ id });
        await ParticipantModel.deleteMany({ eventId: id });
        await CertificateModel.deleteMany({ eventId: id });
        await AllocationModel.deleteMany({ eventId: id });
        return true;
      }

      memoryDb.events = memoryDb.events.filter(e => e.id !== id);
      memoryDb.participants = memoryDb.participants.filter(p => p.eventId !== id);
      memoryDb.certificates = memoryDb.certificates.filter(c => c.eventId !== id);
      memoryDb.allocations = memoryDb.allocations.filter(a => a.eventId !== id);
      saveFileDb(memoryDb);
      return true;
    }
  },

  // Participants
  participants: {
    async bulkInsert(participants) {
      const records = participants.map(p => ({
        id: p.id || uuidv4(),
        eventId: p.eventId,
        participantName: p.participantName,
        email: p.email.toLowerCase().trim(),
        participantId: (p.participantId || '').toString().trim(),
        normalizedName: p.normalizedName || '',
        createdAt: new Date().toISOString()
      }));

      if (isMongoConnected) {
        const inserted = await ParticipantModel.insertMany(records);
        return inserted.map(cleanDoc);
      }

      memoryDb.participants.push(...records);
      saveFileDb(memoryDb);
      return records;
    },

    async findByEventId(eventId) {
      if (isMongoConnected) {
        const docs = await ParticipantModel.find({ eventId }).lean();
        return docs.map(cleanDoc);
      }
      return memoryDb.participants.filter(p => p.eventId === eventId);
    },

    async findById(id) {
      if (isMongoConnected) {
        const doc = await ParticipantModel.findOne({ id }).lean();
        return cleanDoc(doc);
      }
      return memoryDb.participants.find(p => p.id === id) || null;
    },

    async findByParticipantIdOrEmail(eventId, query) {
      const q = (query || '').toLowerCase().trim();
      if (isMongoConnected) {
        const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const doc = await ParticipantModel.findOne({
          eventId,
          $or: [
            { participantId: { $regex: new RegExp(`^${safeQ}$`, 'i') } },
            { email: q },
            { normalizedName: { $regex: new RegExp(`^${safeQ}$`, 'i') } }
          ]
        }).lean();
        return cleanDoc(doc);
      }

      return memoryDb.participants.find(p =>
        p.eventId === eventId && (
          p.participantId.toLowerCase() === q ||
          p.email.toLowerCase() === q ||
          p.normalizedName.toLowerCase() === q
        )
      ) || null;
    }
  },

  // Certificates
  certificates: {
    async bulkInsert(certs) {
      const records = certs.map(c => ({
        id: c.id || uuidv4(),
        eventId: c.eventId,
        originalFilename: c.originalFilename,
        storedPath: c.storedPath || '',
        fileSize: c.fileSize || 0,
        sha256Hash: c.sha256Hash || '',
        extractedName: c.extractedName || '',
        extractedId: c.extractedId || '',
        textSnippet: c.textSnippet || '',
        pdfData: c.pdfData || null, // Stores PDF buffer in MongoDB for cloud-resilience
        createdAt: new Date().toISOString()
      }));

      if (isMongoConnected) {
        const inserted = await CertificateModel.insertMany(records);
        return inserted.map(cleanDoc);
      }

      memoryDb.certificates.push(...records);
      saveFileDb(memoryDb);
      return records;
    },

    async findByEventId(eventId) {
      if (isMongoConnected) {
        const docs = await CertificateModel.find({ eventId }).lean();
        return docs.map(cleanDoc);
      }
      return memoryDb.certificates.filter(c => c.eventId === eventId);
    },

    async findById(id) {
      if (isMongoConnected) {
        const doc = await CertificateModel.findOne({ id }).lean();
        return cleanDoc(doc);
      }
      return memoryDb.certificates.find(c => c.id === id) || null;
    },

    async update(id, updates) {
      if (isMongoConnected) {
        const doc = await CertificateModel.findOneAndUpdate({ id }, updates, { new: true }).lean();
        return cleanDoc(doc);
      }

      const idx = memoryDb.certificates.findIndex(c => c.id === id);
      if (idx === -1) return null;
      memoryDb.certificates[idx] = {
        ...memoryDb.certificates[idx],
        ...updates
      };
      saveFileDb(memoryDb);
      return memoryDb.certificates[idx];
    }
  },

  // Allocations (Links Participant <-> Certificate)
  allocations: {
    async bulkInsert(allocations) {
      const records = allocations.map(a => ({
        id: a.id || uuidv4(),
        eventId: a.eventId,
        participantId: a.participantId,
        certificateId: a.certificateId || null,
        status: a.status, // MATCHED, NEEDS_REVIEW, UNMATCHED, DUPLICATE, REVOKED
        confidenceScore: a.confidenceScore || 0,
        matchMethod: a.matchMethod || null,
        suggestedMatches: a.suggestedMatches || [],
        notes: a.notes || '',
        accessCodeHash: a.accessCodeHash || null,
        accessCodePlain: a.accessCodePlain || null, // Stored for admin testing preview
        publishedAt: a.publishedAt || null,
        downloadCount: a.downloadCount || 0,
        lastDownloadedAt: a.lastDownloadedAt || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      if (isMongoConnected) {
        const inserted = await AllocationModel.insertMany(records);
        return inserted.map(cleanDoc);
      }

      memoryDb.allocations.push(...records);
      saveFileDb(memoryDb);
      return records;
    },

    async findByEventId(eventId) {
      if (isMongoConnected) {
        const docs = await AllocationModel.find({ eventId }).lean();
        return docs.map(cleanDoc);
      }
      return memoryDb.allocations.filter(a => a.eventId === eventId);
    },

    async findById(id) {
      if (isMongoConnected) {
        const doc = await AllocationModel.findOne({ id }).lean();
        return cleanDoc(doc);
      }
      return memoryDb.allocations.find(a => a.id === id) || null;
    },

    async update(id, updates) {
      const updatedAt = new Date().toISOString();
      if (isMongoConnected) {
        const doc = await AllocationModel.findOneAndUpdate(
          { id },
          { ...updates, updatedAt },
          { new: true }
        ).lean();
        return cleanDoc(doc);
      }

      const idx = memoryDb.allocations.findIndex(a => a.id === id);
      if (idx === -1) return null;
      memoryDb.allocations[idx] = {
        ...memoryDb.allocations[idx],
        ...updates,
        updatedAt
      };
      saveFileDb(memoryDb);
      return memoryDb.allocations[idx];
    },

    async deleteByEventId(eventId) {
      if (isMongoConnected) {
        await AllocationModel.deleteMany({ eventId });
        return;
      }
      memoryDb.allocations = memoryDb.allocations.filter(a => a.eventId !== eventId);
      saveFileDb(memoryDb);
    },

    async findByParticipantId(participantId) {
      if (isMongoConnected) {
        const doc = await AllocationModel.findOne({ participantId }).lean();
        return cleanDoc(doc);
      }
      return memoryDb.allocations.find(a => a.participantId === participantId) || null;
    },

    async findByCertificateId(certificateId) {
      if (isMongoConnected) {
        const docs = await AllocationModel.find({ certificateId }).lean();
        return docs.map(cleanDoc);
      }
      return memoryDb.allocations.filter(a => a.certificateId === certificateId);
    }
  },

  // Audit Logs
  auditLogs: {
    async log(eventId, action, details, ipAddress = '127.0.0.1') {
      const record = {
        id: uuidv4(),
        eventId,
        action,
        details,
        ipAddress,
        timestamp: new Date().toISOString()
      };

      if (isMongoConnected) {
        const doc = await AuditLogModel.create(record);
        return cleanDoc(doc);
      }

      memoryDb.auditLogs.unshift(record); // Most recent first
      if (memoryDb.auditLogs.length > 1000) {
        memoryDb.auditLogs = memoryDb.auditLogs.slice(0, 1000);
      }
      saveFileDb(memoryDb);
      return record;
    },

    async findByEventId(eventId) {
      if (isMongoConnected) {
        const query = eventId ? { eventId } : {};
        const docs = await AuditLogModel.find(query).sort({ timestamp: -1 }).limit(1000).lean();
        return docs.map(cleanDoc);
      }

      if (!eventId) return memoryDb.auditLogs;
      return memoryDb.auditLogs.filter(l => l.eventId === eventId);
    }
  }
};

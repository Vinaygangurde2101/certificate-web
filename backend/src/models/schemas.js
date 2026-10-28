import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  date: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, default: 'DRAFT' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
}, {
  versionKey: false,
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      return ret;
    }
  }
});

const ParticipantSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  eventId: { type: String, required: true, index: true },
  participantName: { type: String, required: true },
  email: { type: String, required: true, index: true, lowercase: true, trim: true },
  participantId: { type: String, default: '', index: true },
  normalizedName: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  versionKey: false,
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      return ret;
    }
  }
});

const CertificateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  eventId: { type: String, required: true, index: true },
  originalFilename: { type: String, required: true },
  storedPath: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  sha256Hash: { type: String, default: '', index: true },
  extractedName: { type: String, default: '' },
  extractedId: { type: String, default: '' },
  textSnippet: { type: String, default: '' },
  pdfData: { type: Buffer }, // Stores raw PDF bytes in MongoDB for cloud deployment
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  versionKey: false,
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      return ret;
    }
  }
});

const AllocationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  eventId: { type: String, required: true, index: true },
  participantId: { type: String, required: true, index: true },
  certificateId: { type: String, default: null, index: true },
  status: { type: String, default: 'UNMATCHED', index: true },
  confidenceScore: { type: Number, default: 0 },
  matchMethod: { type: String, default: null },
  suggestedMatches: { type: Array, default: [] },
  notes: { type: String, default: '' },
  accessCodeHash: { type: String, default: null, index: true },
  accessCodePlain: { type: String, default: null },
  publishedAt: { type: String, default: null },
  downloadCount: { type: Number, default: 0 },
  lastDownloadedAt: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
}, {
  versionKey: false,
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      return ret;
    }
  }
});

const AuditLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  eventId: { type: String, default: null, index: true },
  action: { type: String, required: true },
  details: { type: String, default: '' },
  ipAddress: { type: String, default: '127.0.0.1' },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, {
  versionKey: false,
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      return ret;
    }
  }
});

export const EventModel = mongoose.models.Event || mongoose.model('Event', EventSchema);
export const ParticipantModel = mongoose.models.Participant || mongoose.model('Participant', ParticipantSchema);
export const CertificateModel = mongoose.models.Certificate || mongoose.model('Certificate', CertificateSchema);
export const AllocationModel = mongoose.models.Allocation || mongoose.model('Allocation', AllocationSchema);
export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

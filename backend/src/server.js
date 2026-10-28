import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { initStorage } from './services/storageService.js';
import { adminController } from './controllers/adminController.js';
import { participantController } from './controllers/participantController.js';
import { demoController } from './controllers/demoController.js';
import { requireAdminAuth } from './middleware/authMiddleware.js';
import { portalVerifyLimiter, generalApiLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

// Enable CORS with full preflight and credentials support
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer upload config for temporary file staging
const upload = multer({
  dest: path.resolve(os.tmpdir(), 'cert_uploads'),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max per uploaded archive
  }
});

// Initialize database / storage
await initStorage();

// Service Root & Health Check
app.get('/', (req, res) => {
  res.json({
    service: 'certificate-portal-backend',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    demoMode: process.env.DEMO_MODE === 'true'
  });
});

// ==================== ADMIN ROUTES ====================
app.post('/api/admin/login', adminController.login);
app.get('/api/admin/me', requireAdminAuth, adminController.me);

app.get('/api/admin/events', requireAdminAuth, adminController.getEvents);
app.post('/api/admin/events', requireAdminAuth, adminController.createEvent);
app.get('/api/admin/events/:id', requireAdminAuth, adminController.getEventById);
app.delete('/api/admin/events/:id', requireAdminAuth, adminController.deleteEvent);

// Upload certificates ZIP and participant CSV/Excel
app.post(
  '/api/admin/events/:eventId/upload',
  requireAdminAuth,
  upload.fields([
    { name: 'zipFile', maxCount: 1 },
    { name: 'participantFile', maxCount: 1 }
  ]),
  adminController.uploadAndProcess
);

// Manual matching override & certificate actions
app.patch('/api/admin/allocations/:allocationId', requireAdminAuth, adminController.manualMatch);
app.post('/api/admin/allocations/:allocationId/revoke', requireAdminAuth, adminController.revokeCertificate);
app.post('/api/admin/events/:eventId/publish', requireAdminAuth, adminController.publishCertificates);
app.get('/api/admin/certificates/:certId/preview', requireAdminAuth, adminController.previewCertificate);

// ==================== PARTICIPANT PORTAL ROUTES ====================
app.post('/api/participant/verify', portalVerifyLimiter, participantController.verifyAccess);
app.get('/api/participant/download/:ticket', participantController.downloadCertificate);
app.get('/api/participant/stream/:ticket', participantController.streamCertificate);

// ==================== DEMO / SAMPLE DATA ROUTES ====================
app.get('/api/demo/sample-csv', demoController.getSampleCsv);
app.get('/api/demo/sample-zip', demoController.getSampleZip);
app.post('/api/demo/seed', demoController.seedDemo);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'An unexpected server error occurred.'
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Smart Certificate Portal Backend running on port ${PORT}`);
    console.log(`   Admin Default Login: ${process.env.ADMIN_USERNAME || 'admin'} / ${process.env.ADMIN_PASSWORD || 'Admin@SmartCert2026'}`);
    console.log(`   Demo Mode: ${process.env.DEMO_MODE === 'true' ? 'ACTIVE' : 'OFF'}`);
    console.log(`=======================================================`);
  });
}

export default app;
export { app };

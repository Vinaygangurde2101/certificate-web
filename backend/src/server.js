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

// Non-blocking storage boot initialization
initStorage().catch((err) => {
  console.warn('[Storage] Background storage init note:', err.message);
});

// Middleware to ensure storage is ready for requests
app.use(async (req, res, next) => {
  try {
    await initStorage();
  } catch (err) {
    // Non-blocking fallback
  }
  next();
});

const router = express.Router();

// Service Root & Health Check
router.get('/', (req, res) => {
  res.json({
    service: 'certificate-portal-backend',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    demoMode: process.env.DEMO_MODE === 'true'
  });
});

// ==================== ADMIN ROUTES ====================
router.post('/admin/login', adminController.login);
router.get('/admin/me', requireAdminAuth, adminController.me);

router.get('/admin/events', requireAdminAuth, adminController.getEvents);
router.post('/admin/events', requireAdminAuth, adminController.createEvent);
router.get('/admin/events/:id', requireAdminAuth, adminController.getEventById);
router.delete('/admin/events/:id', requireAdminAuth, adminController.deleteEvent);

// Upload certificates ZIP and participant CSV/Excel
router.post(
  '/admin/events/:eventId/upload',
  requireAdminAuth,
  upload.fields([
    { name: 'zipFile', maxCount: 1 },
    { name: 'participantFile', maxCount: 1 }
  ]),
  adminController.uploadAndProcess
);

// Manual matching override & certificate actions
router.patch('/admin/allocations/:allocationId', requireAdminAuth, adminController.manualMatch);
router.post('/admin/allocations/:allocationId/revoke', requireAdminAuth, adminController.revokeCertificate);
router.post('/admin/events/:eventId/publish', requireAdminAuth, adminController.publishCertificates);
router.get('/admin/certificates/:certId/preview', requireAdminAuth, adminController.previewCertificate);

// ==================== PARTICIPANT PORTAL ROUTES ====================
router.post('/participant/verify', portalVerifyLimiter, participantController.verifyAccess);
router.get('/participant/download/:ticket', participantController.downloadCertificate);
router.get('/participant/stream/:ticket', participantController.streamCertificate);

// ==================== DEMO / SAMPLE DATA ROUTES ====================
router.get('/demo/sample-csv', demoController.getSampleCsv);
router.get('/demo/sample-zip', demoController.getSampleZip);
router.post('/demo/seed', demoController.seedDemo);

// Mount router on both /api (standard) and / (if rewrites strip /api)
app.use('/api', router);
app.use('/', router);

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

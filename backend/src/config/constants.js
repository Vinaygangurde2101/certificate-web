import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In serverless environments (Vercel, AWS Lambda), write to os.tmpdir() to avoid read-only filesystem errors (EROFS)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);

export const BASE_DIR = isServerless 
  ? path.resolve(os.tmpdir(), 'cert_portal_runtime') 
  : path.resolve(__dirname, '../../');

export const STORAGE_DIR = path.resolve(BASE_DIR, 'storage');
export const CERTIFICATES_DIR = path.resolve(STORAGE_DIR, 'certificates');
export const DATA_DIR = path.resolve(BASE_DIR, '.data');
export const DB_FILE = path.resolve(DATA_DIR, 'db.json');

export const MATCH_STATUS = {
  MATCHED: 'MATCHED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  UNMATCHED: 'UNMATCHED',
  DUPLICATE: 'DUPLICATE',
  REVOKED: 'REVOKED'
};

export const MATCH_METHOD = {
  ID_EXACT: 'ID_EXACT',
  FILENAME_EXACT: 'FILENAME_EXACT',
  FILENAME_FUZZY: 'FILENAME_FUZZY',
  PDF_TEXT: 'PDF_TEXT',
  MANUAL: 'MANUAL'
};

export const EVENT_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED'
};

// Strict confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  AUTO_MATCH_MIN: 0.88,
  NEEDS_REVIEW_MIN: 0.50,
  AMBIGUITY_DELTA: 0.08 // If top 2 candidates have confidence difference < 0.08, flag as ambiguous
};

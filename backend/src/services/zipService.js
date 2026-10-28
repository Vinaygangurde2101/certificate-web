import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { CERTIFICATES_DIR } from '../config/constants.js';

// Maximum single file size allowed in ZIP (e.g. 20MB)
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
// Maximum total extracted files allowed
const MAX_TOTAL_FILES = 2000;

/**
 * Validates and safely extracts PDF certificates from a ZIP buffer or file path
 */
export async function processZipCertificates(zipFilePath, eventId) {
  if (!fs.existsSync(zipFilePath)) {
    throw new Error('ZIP file does not exist on server.');
  }

  const eventStorageDir = path.resolve(CERTIFICATES_DIR, eventId);
  if (!fs.existsSync(eventStorageDir)) {
    fs.mkdirSync(eventStorageDir, { recursive: true });
  }

  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();

  if (!zipEntries || zipEntries.length === 0) {
    throw new Error('The uploaded ZIP archive is empty.');
  }

  if (zipEntries.length > MAX_TOTAL_FILES) {
    throw new Error(`The ZIP archive exceeds the maximum limit of ${MAX_TOTAL_FILES} files.`);
  }

  const extractedCerts = [];
  const errors = [];
  const seenHashes = new Map(); // hash -> filename

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;

    // Defense against Zip Slip / Path Traversal
    if (entryName.includes('..') || path.isAbsolute(entryName)) {
      errors.push(`Suspicious entry path skipped: ${entryName}`);
      continue;
    }

    // Skip OS junk (Mac OS resource forks, Windows thumbnails)
    if (entryName.includes('__MACOSX') || entryName.endsWith('.DS_Store') || entryName.endsWith('Thumbs.db')) {
      continue;
    }

    // Verify PDF extension
    const ext = path.extname(entryName).toLowerCase();
    if (ext !== '.pdf') {
      errors.push(`Non-PDF entry ignored: ${entryName}`);
      continue;
    }

    // Check entry uncompressed size
    if (entry.header.size > MAX_PDF_SIZE_BYTES) {
      errors.push(`File too large (${(entry.header.size / (1024 * 1024)).toFixed(1)}MB): ${entryName}`);
      continue;
    }

    const buffer = entry.getData();

    // Verify magic bytes: PDF header starts with '%PDF-' (0x25 0x50 0x44 0x46 0x2D)
    if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
      errors.push(`File does not appear to be a valid PDF document: ${entryName}`);
      continue;
    }

    // Compute SHA-256 hash for duplicate PDF detection
    const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Extract original basename cleanly
    const originalBasename = path.basename(entryName);

    // Save with unique id-prefixed filename in private directory to prevent collisions
    const secureStorageFilename = `${uuidv4()}_${originalBasename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destinationPath = path.resolve(eventStorageDir, secureStorageFilename);

    // Double-check path traversal safety on resolved destination
    if (!destinationPath.startsWith(eventStorageDir)) {
      errors.push(`Path containment violation for entry: ${entryName}`);
      continue;
    }

    fs.writeFileSync(destinationPath, buffer);

    let isDuplicateOf = null;
    if (seenHashes.has(sha256Hash)) {
      isDuplicateOf = seenHashes.get(sha256Hash);
    } else {
      seenHashes.set(sha256Hash, originalBasename);
    }

    extractedCerts.push({
      originalFilename: originalBasename,
      storedPath: destinationPath,
      fileSize: buffer.length,
      sha256Hash,
      pdfData: buffer,
      isIdenticalDuplicate: Boolean(isDuplicateOf),
      duplicateOriginal: isDuplicateOf
    });
  }

  return {
    certificates: extractedCerts,
    errors
  };
}

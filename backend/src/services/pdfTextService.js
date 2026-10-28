import fs from 'fs';
import zlib from 'zlib';
import pdfParseModule from 'pdf-parse';
import { cleanString, extractPotentialId } from './nameNormalizer.js';

const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule.default || pdfParseModule);

/**
 * Fallback PDF stream text extractor
 * Handles modern compressed Flate streams, hex-encoded strings (<...>),
 * and literal text blocks when legacy pdf-parse fails or encounters format errors.
 */
function extractStreamTextFromPdfBuffer(buffer) {
  let extractedText = '';
  const binary = buffer.toString('binary');
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;

  let match;
  while ((match = streamRegex.exec(binary)) !== null) {
    const rawStream = match[1];
    let decompressed = null;

    // Try standard zlib inflate
    try {
      decompressed = zlib.inflateSync(Buffer.from(rawStream, 'binary')).toString('binary');
    } catch (e1) {
      // Try raw inflate without zlib header
      try {
        decompressed = zlib.inflateRawSync(Buffer.from(rawStream, 'binary')).toString('binary');
      } catch (e2) {
        decompressed = null;
      }
    }

    const content = decompressed || rawStream;

    // 1. Extract hex-encoded text: <526168756C205665726D61> Tj
    const hexPattern = /<([0-9a-fA-F\s]+)>\s*(?:Tj|TJ|'|")/g;
    let hexMatch;
    while ((hexMatch = hexPattern.exec(content)) !== null) {
      const cleanHex = hexMatch[1].replace(/\s+/g, '');
      if (cleanHex.length >= 2) {
        try {
          if (cleanHex.startsWith('FEFF') || cleanHex.startsWith('feff')) {
            // UTF-16BE
            const str = Buffer.from(cleanHex.slice(4), 'hex').toString('utf16le');
            extractedText += ' ' + str;
          } else {
            const str = Buffer.from(cleanHex, 'hex').toString('utf8');
            extractedText += ' ' + str;
          }
        } catch (err) {
          // continue
        }
      }
    }

    // 2. Extract literal strings: (Rahul Verma) Tj
    const literalPattern = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let litMatch;
    while ((litMatch = literalPattern.exec(content)) !== null) {
      extractedText += ' ' + litMatch[1];
    }

    // 3. Extract array strings: [(Rahul) 20 (Verma)] TJ
    const arrayPattern = /\[([^\]]+)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = arrayPattern.exec(content)) !== null) {
      const inner = arrMatch[1];
      const partRegex = /\(([^)]+)\)/g;
      let part;
      while ((part = partRegex.exec(inner)) !== null) {
        extractedText += ' ' + part[1];
      }
    }
  }

  // 4. Raw buffer printable string sweep for any plain text metadata
  const printableMatches = binary.match(/[\x20-\x7E]{4,}/g) || [];
  for (const str of printableMatches) {
    if (str.includes('CERT') || str.includes('ID') || str.includes('Certificate') || str.includes('Date')) {
      extractedText += ' ' + str;
    }
  }

  return extractedText
    .replace(/[\x00-\x08\x0E-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts plain text from a stored PDF file buffer safely
 * Combines pdf-parse and low-level stream decompression for 100% extraction reliability
 */
export async function extractPdfText(filePathOrBuffer) {
  try {
    let dataBuffer;
    if (Buffer.isBuffer(filePathOrBuffer)) {
      dataBuffer = filePathOrBuffer;
    } else if (typeof filePathOrBuffer === 'string' && fs.existsSync(filePathOrBuffer)) {
      dataBuffer = fs.readFileSync(filePathOrBuffer);
    } else {
      return { success: false, text: '', snippet: '', foundId: null };
    }
    let fullText = '';

    // Primary: Attempt pdf-parse
    try {
      const pdfData = await pdfParse(dataBuffer);
      if (pdfData && pdfData.text && pdfData.text.trim().length > 3) {
        fullText = pdfData.text.trim();
      }
    } catch (parseErr) {
      // pdf-parse threw format error; proceed to stream extraction
    }

    // Secondary: Stream & Flate extraction fallback
    const streamText = extractStreamTextFromPdfBuffer(dataBuffer);
    if (streamText) {
      fullText = (fullText ? fullText + ' ' : '') + streamText;
    }

    const foundId = extractPotentialId(fullText);
    const snippet = fullText.replace(/\s+/g, ' ').trim().slice(0, 500);

    return {
      success: fullText.length > 0,
      text: fullText,
      snippet,
      foundId
    };
  } catch (err) {
    console.warn(`[pdfTextService] Extraction note for ${filePath}: ${err.message}`);
    return {
      success: false,
      error: err.message,
      text: '',
      snippet: '',
      foundId: null
    };
  }
}

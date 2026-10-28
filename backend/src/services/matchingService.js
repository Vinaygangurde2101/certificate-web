import {
  extractNameFromFilename,
  normalizeParticipantName,
  calculateFuzzyScore,
  stringSimilarity,
  cleanString,
  extractPotentialId
} from './nameNormalizer.js';
import { extractPdfText } from './pdfTextService.js';
import { MATCH_STATUS, MATCH_METHOD, CONFIDENCE_THRESHOLDS } from '../config/constants.js';

/**
 * Executes multi-tier smart certificate matching
 */
export async function matchCertificatesToParticipants(participants, certificates) {
  // 1. Prepare normalized participant lookup
  const prepParticipants = participants.map(p => {
    const { normalized, tokens } = normalizeParticipantName(p.participantName);
    const cleanId = (p.participantId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return {
      ...p,
      normName: normalized,
      tokens,
      cleanId,
      emailLower: (p.email || '').toLowerCase().trim()
    };
  });

  // 2. Pre-process certificates from filenames
  const prepCerts = certificates.map(cert => {
    const fileInfo = extractNameFromFilename(cert.originalFilename);
    return {
      ...cert,
      extractedName: fileInfo.extractedName,
      tokens: fileInfo.tokens,
      extractedId: fileInfo.potentialId,
      pdfText: '',
      pdfSnippet: cert.textSnippet || '',
      pdfTextExtracted: false
    };
  });

  // 3. Score every certificate against every participant
  const certCandidateMap = new Map(); // certId -> sorted candidate list

  for (const cert of prepCerts) {
    const candidates = [];

    // Check if filename is empty or lacks clear person name
    const hasClearFilename = cert.tokens.length >= 2 && cert.extractedName.length >= 4;

    for (const p of prepParticipants) {
      let confidence = 0;
      let method = null;
      let matchReason = '';

      // Rule A: Exact participant ID match in filename
      if (p.cleanId && cert.extractedId && p.cleanId === cert.extractedId) {
        confidence = 1.0;
        method = MATCH_METHOD.ID_EXACT;
        matchReason = `Exact ID match in filename (${p.participantId})`;
      }

      // Rule B: Exact Normalized Name match in filename
      if (confidence < 1.0 && p.normName && cert.extractedName) {
        if (p.normName === cert.extractedName) {
          confidence = 1.0;
          method = MATCH_METHOD.FILENAME_EXACT;
          matchReason = 'Exact name match in filename';
        }
      }

      // Rule C: Token set similarity (order-independent, handles middle initials)
      if (confidence < 0.95 && p.tokens.length > 0 && cert.tokens.length > 0) {
        const tokenScore = calculateFuzzyScore(p.tokens, cert.tokens);
        const strScore = stringSimilarity(p.normName, cert.extractedName);
        const combinedScore = Math.max(tokenScore, strScore);

        if (combinedScore > confidence && combinedScore >= CONFIDENCE_THRESHOLDS.NEEDS_REVIEW_MIN) {
          confidence = parseFloat(combinedScore.toFixed(3));
          method = MATCH_METHOD.FILENAME_FUZZY;
          matchReason = `Fuzzy name match (${Math.round(confidence * 100)}%)`;
        }
      }

      // Rule D: Fallback PDF text extraction & matching
      // If filename didn't produce a high confidence match, parse PDF document text
      if (confidence < CONFIDENCE_THRESHOLDS.AUTO_MATCH_MIN) {
        if (!cert.pdfTextExtracted) {
          const pdfRes = await extractPdfText(cert.pdfData || cert.storedPath);
          cert.pdfText = pdfRes.text || '';
          cert.pdfSnippet = pdfRes.snippet || '';
          if (!cert.extractedId && pdfRes.foundId) {
            cert.extractedId = pdfRes.foundId;
          }
          cert.pdfTextExtracted = true;
        }

        if (cert.pdfText) {
          const textClean = cleanString(cert.pdfText);
          const textUpper = cert.pdfText.toUpperCase();

          if (p.cleanId && textUpper.includes(p.cleanId)) {
            // Participant ID found in PDF body text!
            if (1.0 > confidence) {
              confidence = 1.0;
              method = MATCH_METHOD.PDF_TEXT;
              matchReason = `Participant ID (${p.participantId}) found in PDF document text`;
            }
          } else if (p.normName && textClean.includes(p.normName)) {
            // Full name found in PDF body text!
            if (0.95 > confidence) {
              confidence = 0.95;
              method = MATCH_METHOD.PDF_TEXT;
              matchReason = 'Participant name found in PDF document text';
            }
          } else if (p.emailLower && textClean.includes(p.emailLower)) {
            // Email found in PDF body text!
            if (0.95 > confidence) {
              confidence = 0.95;
              method = MATCH_METHOD.PDF_TEXT;
              matchReason = 'Participant email found in PDF document text';
            }
          } else if (p.tokens.length >= 2 && p.tokens.every(t => textClean.includes(t))) {
            // All name tokens found in PDF body text!
            if (0.92 > confidence) {
              confidence = 0.92;
              method = MATCH_METHOD.PDF_TEXT;
              matchReason = 'Participant name tokens found in PDF document text';
            }
          }
        }
      }

      if (confidence >= CONFIDENCE_THRESHOLDS.NEEDS_REVIEW_MIN) {
        candidates.push({
          participantId: p.id,
          participantName: p.participantName,
          email: p.email,
          pCode: p.participantId,
          confidence,
          method,
          matchReason
        });
      }
    }

    // Sort candidates descending by confidence score
    candidates.sort((a, b) => b.confidence - a.confidence);
    certCandidateMap.set(cert.id, candidates);
  }

  // 4. Stable 1-to-1 Assignment & Conflict Detection
  const participantAssignedMap = new Map(); // participantId -> { cert, confidence, method, ... }
  const certAssignedMap = new Map(); // certId -> assigned participant
  const certStatusMap = new Map(); // certId -> status

  // Track identical duplicate PDFs first (SHA-256 identical match)
  for (const cert of prepCerts) {
    if (cert.isIdenticalDuplicate) {
      certStatusMap.set(cert.id, {
        status: MATCH_STATUS.DUPLICATE,
        notes: `Identical file duplicate of ${cert.duplicateOriginal || 'another certificate'}`
      });
    }
  }

  // Pass 1: High confidence auto-allocation
  for (const cert of prepCerts) {
    if (certStatusMap.has(cert.id)) continue;

    const candidates = certCandidateMap.get(cert.id) || [];
    if (!candidates.length) {
      certStatusMap.set(cert.id, {
        status: MATCH_STATUS.UNMATCHED,
        notes: 'No matching participant found with acceptable confidence'
      });
      continue;
    }

    const top = candidates[0];
    const second = candidates[1];

    // Check for ambiguity (e.g. "Vinay A. Sharma" vs "Vinay B. Sharma" with nearly identical score)
    const isAmbiguous = second && (top.confidence - second.confidence < CONFIDENCE_THRESHOLDS.AMBIGUITY_DELTA);

    if (isAmbiguous) {
      certStatusMap.set(cert.id, {
        status: MATCH_STATUS.NEEDS_REVIEW,
        notes: `Ambiguous match between "${top.participantName}" and "${second.participantName}"`,
        topCandidate: top,
        suggestedMatches: candidates.slice(0, 5)
      });
      continue;
    }

    if (top.confidence >= CONFIDENCE_THRESHOLDS.AUTO_MATCH_MIN) {
      // Check if participant is already claimed by another certificate
      if (participantAssignedMap.has(top.participantId)) {
        const existing = participantAssignedMap.get(top.participantId);
        // Duplicate certificate for the same participant!
        certStatusMap.set(cert.id, {
          status: MATCH_STATUS.DUPLICATE,
          notes: `Duplicate certificate for participant "${top.participantName}" (already matched with ${existing.cert.originalFilename})`,
          topCandidate: top,
          suggestedMatches: candidates.slice(0, 5)
        });
      } else {
        // Safe allocation!
        participantAssignedMap.set(top.participantId, {
          cert,
          confidence: top.confidence,
          method: top.method,
          matchReason: top.matchReason
        });
        certAssignedMap.set(cert.id, top.participantId);
        certStatusMap.set(cert.id, {
          status: MATCH_STATUS.MATCHED,
          notes: top.matchReason,
          topCandidate: top,
          suggestedMatches: candidates.slice(0, 5)
        });
      }
    } else {
      // Lower confidence: mark as Needs Review
      certStatusMap.set(cert.id, {
        status: MATCH_STATUS.NEEDS_REVIEW,
        notes: `Low confidence match (${Math.round(top.confidence * 100)}%) for "${top.participantName}"`,
        topCandidate: top,
        suggestedMatches: candidates.slice(0, 5)
      });
    }
  }

  // 5. Build Final Allocations table (Participant centric view for the admin)
  const allocations = [];

  for (const p of prepParticipants) {
    if (participantAssignedMap.has(p.id)) {
      const match = participantAssignedMap.get(p.id);
      allocations.push({
        participantId: p.id,
        participantName: p.participantName,
        email: p.email,
        pCode: p.participantId,
        certificateId: match.cert.id,
        certificateFilename: match.cert.originalFilename,
        status: MATCH_STATUS.MATCHED,
        confidenceScore: match.confidence,
        matchMethod: match.method,
        notes: match.matchReason,
        suggestedMatches: certCandidateMap.get(match.cert.id) || []
      });
    } else {
      // Participant is not auto-matched yet. Find if any cert has them as candidate:
      let bestCertMatch = null;
      for (const cert of prepCerts) {
        const candidates = certCandidateMap.get(cert.id) || [];
        const found = candidates.find(c => c.participantId === p.id);
        if (found) {
          if (!bestCertMatch || found.confidence > bestCertMatch.confidence) {
            bestCertMatch = { cert, candidate: found };
          }
        }
      }

      if (bestCertMatch) {
        allocations.push({
          participantId: p.id,
          participantName: p.participantName,
          email: p.email,
          pCode: p.participantId,
          certificateId: bestCertMatch.cert.id,
          certificateFilename: bestCertMatch.cert.originalFilename,
          status: MATCH_STATUS.NEEDS_REVIEW,
          confidenceScore: bestCertMatch.candidate.confidence,
          matchMethod: bestCertMatch.candidate.method,
          notes: `Suggested candidate: ${bestCertMatch.candidate.matchReason}`,
          suggestedMatches: [
            {
              certificateId: bestCertMatch.cert.id,
              filename: bestCertMatch.cert.originalFilename,
              confidence: bestCertMatch.candidate.confidence
            }
          ]
        });
      } else {
        // Completely unmatched participant (missing certificate)
        allocations.push({
          participantId: p.id,
          participantName: p.participantName,
          email: p.email,
          pCode: p.participantId,
          certificateId: null,
          certificateFilename: null,
          status: MATCH_STATUS.UNMATCHED,
          confidenceScore: 0,
          matchMethod: null,
          notes: 'No certificate found matching this participant',
          suggestedMatches: []
        });
      }
    }
  }

  // 6. Include any unallocated or duplicate certificates so admin can inspect them
  const unassignedCerts = prepCerts.filter(c => !certAssignedMap.has(c.id));
  const certificateSummaries = prepCerts.map(c => {
    const statusInfo = certStatusMap.get(c.id) || { status: MATCH_STATUS.UNMATCHED, notes: '' };
    return {
      id: c.id,
      originalFilename: c.originalFilename,
      extractedName: c.extractedName,
      extractedId: c.extractedId,
      status: statusInfo.status,
      notes: statusInfo.notes,
      assignedParticipantId: certAssignedMap.get(c.id) || null,
      topCandidate: statusInfo.topCandidate || null,
      candidates: certCandidateMap.get(c.id) || []
    };
  });

  return {
    allocations,
    certificateSummaries,
    unassignedCerts: unassignedCerts.map(c => ({
      id: c.id,
      originalFilename: c.originalFilename,
      extractedName: c.extractedName,
      status: certStatusMap.get(c.id)?.status || MATCH_STATUS.UNMATCHED,
      notes: certStatusMap.get(c.id)?.notes || ''
    }))
  };
}

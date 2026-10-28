/**
 * Comprehensive Name Normalizer & Cleaner
 * Handles diverse real-world filename formats:
 * - Vinay_Gangurde.pdf
 * - vinay-gangurde-certificate.pdf
 * - Certificate_Vinay_Gangurde_2026.pdf
 * - CERT_101_VinayGangurde.pdf
 * - Vinay_S_Gangurde_certificate_final(1).pdf
 */

const NOISE_WORDS = new Set([
  'certificate',
  'cert',
  'completion',
  'participation',
  'participate',
  'achievement',
  'award',
  'appreciation',
  'attendance',
  'final',
  'copy',
  'doc',
  'print',
  'page',
  'event',
  'summit',
  'hackathon',
  'workshop',
  'webinar',
  'diploma',
  'scan',
  'scanned',
  'img',
  'image',
  'photo',
  'picture',
  'document',
  'report',
  'file',
  'pdf',
  'output',
  'template',
  'blank',
  // Common titles
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sir'
]);

/**
 * Remove accents/diacritics, convert to lowercase, trim extra whitespace
 */
export function cleanString(str = '') {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .trim();
}

/**
 * Extract potential participant ID from string (e.g. CERT-101, P001, EMP-4231)
 */
export function extractPotentialId(str = '') {
  if (!str) return null;
  // Matches patterns like CERT-101, P-1001, EMP123, ID_4920, #042
  const match = str.match(/\b([a-zA-Z]{1,5}[-_]?[0-9]{1,8})\b/);
  return match ? match[1].replace(/[-_]/g, '').toUpperCase() : null;
}

/**
 * Normalizes a participant name from CSV or direct input:
 * "  Vinay   Gangurde  " -> "vinay gangurde"
 * Tokens: ['vinay', 'gangurde']
 */
export function normalizeParticipantName(rawName = '') {
  if (!rawName) return { normalized: '', tokens: [] };

  const cleaned = cleanString(rawName)
    .replace(/[^a-z0-9\s]/g, ' ') // replace symbols with space
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned
    .split(' ')
    .filter(t => t.length > 0 && !NOISE_WORDS.has(t));

  return {
    normalized: tokens.join(' '),
    tokens
  };
}

/**
 * Extracts normalized person name candidates from a PDF filename
 */
export function extractNameFromFilename(filename = '') {
  // Remove file extension
  let base = filename.replace(/\.[^/.]+$/, '');

  // Strip duplicate markers like (1), (2), _copy, - copy
  base = base.replace(/\(\d+\)/g, ' ').replace(/[-_]copy\d*/gi, ' ');

  // Look for potential embedded ID first (e.g. CERT-101 or P102)
  const potentialId = extractPotentialId(base);

  // Split CamelCase: "VinayGangurde" -> "Vinay Gangurde"
  base = base.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Replace underscores, hyphens, dots, and pluses with spaces
  base = base.replace(/[-_.+]/g, ' ');

  // Remove 4-digit years (e.g. 2020-2035)
  base = base.replace(/\b(20[2-3][0-9])\b/g, ' ');

  // Clean diacritics and symbols
  const cleaned = cleanString(base).replace(/[^a-z0-9\s]/g, ' ');

  // Tokenize and filter noise words and pure numbers
  const tokens = cleaned
    .split(/\s+/)
    .filter(token => {
      if (!token) return false;
      if (NOISE_WORDS.has(token)) return false;
      // Filter out short numbers (like page 1, 01) unless it's part of an ID
      if (/^\d+$/.test(token)) return false;
      return true;
    });

  const normalized = tokens.join(' ').trim();

  return {
    extractedName: normalized,
    tokens,
    potentialId
  };
}

/**
 * Token Set Similarity (Dice's Coefficient on token pairs & Jaccard on tokens)
 * Robust to word reordering ("Vinay Gangurde" vs "Gangurde Vinay")
 * and middle initials ("Vinay S Gangurde" vs "Vinay Gangurde")
 */
export function calculateFuzzyScore(tokensA = [], tokensB = []) {
  if (!tokensA.length || !tokensB.length) return 0;

  // Filter out single character initial tokens for set match comparison
  const fullA = tokensA.filter(t => t.length > 1);
  const fullB = tokensB.filter(t => t.length > 1);

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  // Exact set match (even if order reversed e.g. "Gangurde Vinay" vs "Vinay Gangurde")
  if (tokensA.length === tokensB.length && tokensA.every(t => setB.has(t))) {
    return 1.0;
  }

  // Check if all significant tokens of the shorter name are in the longer name
  // e.g. "Vinay Gangurde" in "Vinay S Gangurde"
  if (fullA.length >= 2 && fullB.length >= 2) {
    const isASubsetOfB = fullA.every(t => fullB.includes(t));
    const isBSubsetOfA = fullB.every(t => fullA.includes(t));
    if (isASubsetOfB || isBSubsetOfA) {
      return 0.93; // High confidence subset match
    }
  }

  // Token intersection count with edit distance tolerance for typos
  let matchCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      matchCount += 1;
    } else {
      // Check for 1-edit distance token match (e.g. "Vnay" vs "Vinay")
      for (const other of setB) {
        if (levenshteinDistance(token, other) <= 1 && Math.min(token.length, other.length) >= 4) {
          matchCount += 0.88;
          break;
        }
      }
    }
  }

  const totalTokens = Math.max(tokensA.length, tokensB.length);
  const score = matchCount / totalTokens;

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Standard Levenshtein distance calculation
 */
export function levenshteinDistance(a = '', b = '') {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Levenshtein string similarity (0.0 to 1.0)
 */
export function stringSimilarity(str1 = '', str2 = '') {
  const s1 = cleanString(str1);
  const s2 = cleanString(str2);
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return (maxLen - dist) / maxLen;
}

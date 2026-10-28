import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLES_DIR = path.resolve(__dirname, '../../sample_data');
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

// 1. Participant CSV test dataset
const sampleCsvContent = `participant_name,email,participant_id
Vinay Gangurde,vinay.gangurde@example.com,CERT-101
Priya Sharma,priya.sharma@example.com,CERT-102
Aarav Mehta,aarav.mehta@example.com,CERT-103
Ananya Patel,ananya.patel@example.com,CERT-104
Rahul Verma,rahul.verma@example.com,CERT-105
Rohan Gupta,rohan.gupta@example.com,CERT-106
Neha Kapoor,neha.kapoor@example.com,CERT-107
Aditya Roy,aditya.roy@example.com,CERT-108
`;

// Helper to generate a PDF certificate with customized styling & text
async function createSamplePdf(name, certId, eventName, date, subtitle = 'Certificate of Excellence') {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // A4 Landscape
  const { width, height } = page.getSize();

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // Background gradient-like border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: rgb(0.12, 0.25, 0.45),
    borderWidth: 4,
    color: rgb(0.98, 0.99, 1.0)
  });

  // Inner gold-like border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.85, 0.65, 0.13),
    borderWidth: 1.5
  });

  // Title
  page.drawText('SMART CERTIFICATE ALLOCATION', {
    x: 230,
    y: height - 90,
    size: 20,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.2, 0.4)
  });

  page.drawText(subtitle.toUpperCase(), {
    x: 320,
    y: height - 125,
    size: 14,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.55)
  });

  page.drawText('This is proudly presented to', {
    x: 330,
    y: height - 190,
    size: 15,
    font: fontHelvetica,
    color: rgb(0.3, 0.35, 0.4)
  });

  // Participant Name (Big, bold)
  const nameWidth = fontTimesBold.widthOfTextAtSize(name, 36);
  page.drawText(name, {
    x: (width - nameWidth) / 2,
    y: height - 250,
    size: 36,
    font: fontTimesBold,
    color: rgb(0.08, 0.18, 0.38)
  });

  // Line below name
  page.drawLine({
    start: { x: 200, y: height - 265 },
    end: { x: width - 200, y: height - 265 },
    thickness: 1.5,
    color: rgb(0.85, 0.65, 0.13)
  });

  // Event description
  const desc = `For outstanding participation and successful completion of "${eventName}"`;
  const descWidth = fontHelvetica.widthOfTextAtSize(desc, 14);
  page.drawText(desc, {
    x: (width - descWidth) / 2,
    y: height - 310,
    size: 14,
    font: fontHelvetica,
    color: rgb(0.25, 0.3, 0.35)
  });

  // Certificate ID & Date
  page.drawText(`Certificate ID: ${certId}`, {
    x: 70,
    y: 80,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.3, 0.4, 0.5)
  });

  page.drawText(`Date of Issue: ${date}`, {
    x: 70,
    y: 60,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5)
  });

  // Authorized signature stamp
  page.drawText('VERIFIED CREDENTIAL', {
    x: width - 240,
    y: 80,
    size: 12,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.45, 0.25)
  });

  page.drawText('Authorized Issuer & Antigravity Systems', {
    x: width - 260,
    y: 60,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.5)
  });

  return await pdfDoc.save();
}

export async function generateDemoArtifacts() {
  console.log('[DemoData] Generating sample CSV and PDF certificates...');

  // 1. Write CSV
  const csvPath = path.resolve(SAMPLES_DIR, 'participants.csv');
  fs.writeFileSync(csvPath, sampleCsvContent, 'utf-8');

  // 2. Prepare sample PDF certificate files
  const eventName = 'Cloud Architecture & AI Hackathon 2026';
  const eventDate = '2026-10-27';

  const certItems = [
    // Case 1: Exact underscore filename
    { filename: 'Vinay_Gangurde.pdf', name: 'Vinay Gangurde', id: 'CERT-101' },
    // Case 2: Hyphenated with suffix
    { filename: 'priya-sharma-certificate.pdf', name: 'Priya Sharma', id: 'CERT-102' },
    // Case 3: Year prefix and title prefix
    { filename: 'Certificate_Aarav_Mehta_2026.pdf', name: 'Aarav Mehta', id: 'CERT-103' },
    // Case 4: Middle initial variation (fuzzy match)
    { filename: 'Ananya_V_Patel.pdf', name: 'Ananya Patel', id: 'CERT-104' },
    // Case 5: Scanned / abstract filename, but text inside has participant name & ID
    { filename: 'Scanned_Doc_049281.pdf', name: 'Rahul Verma', id: 'CERT-105' },
    // Case 6: Duplicate PDFs for Rohan Gupta
    { filename: 'Rohan_Gupta.pdf', name: 'Rohan Gupta', id: 'CERT-106' },
    { filename: 'Rohan_Gupta_copy.pdf', name: 'Rohan Gupta', id: 'CERT-106' },
    // Case 7: Multiple possible matches (Neha Kapoor vs Neha Kapoor Jr)
    { filename: 'Neha_Kapoor_Jr.pdf', name: 'Neha Kapoor Jr', id: 'CERT-107B' },
    // Case 8: Extra certificate with no participant in CSV
    { filename: 'Carlos_Santana_Guest.pdf', name: 'Carlos Santana', id: 'GUEST-999' }
  ];

  // Create ZIP archive
  const zip = new AdmZip();

  for (const item of certItems) {
    const pdfBytes = await createSamplePdf(item.name, item.id, eventName, eventDate);
    zip.addFile(item.filename, Buffer.from(pdfBytes));
  }

  const zipPath = path.resolve(SAMPLES_DIR, 'certificates.zip');
  zip.writeZip(zipPath);

  console.log(`[DemoData] Successfully generated:`);
  console.log(` - CSV: ${csvPath}`);
  console.log(` - ZIP: ${zipPath} (${certItems.length} certificates)`);

  return {
    csvPath,
    zipPath,
    itemCount: certItems.length
  };
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('generateDemoData.js')) {
  generateDemoArtifacts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

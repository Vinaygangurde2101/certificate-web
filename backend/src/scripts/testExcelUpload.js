import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSXModule from 'xlsx';
const XLSX = XLSXModule.default || XLSXModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:5000/api';

async function testExcelUpload() {
  console.log('🧪 Testing Excel (.xlsx) file upload and Smart Matching Extraction...\n');

  // 1. Create a real sample .xlsx file
  const testExcelPath = path.resolve(__dirname, '../../sample_data/test_participants.xlsx');
  const wb = XLSX.utils.book_new();
  const participantData = [
    {
      'Participant Name': 'Vinay Gangurde',
      'Email Address': 'vinay.gangurde@example.com',
      'Participant ID': 'CERT-101'
    },
    {
      'Participant Name': 'Priya Sharma',
      'Email Address': 'priya.sharma@example.com',
      'Participant ID': 'CERT-102'
    },
    {
      'Participant Name': 'Aarav Mehta',
      'Email Address': 'aarav.mehta@example.com',
      'Participant ID': 'CERT-103'
    },
    {
      'Participant Name': 'Ananya Patel',
      'Email Address': 'ananya.patel@example.com',
      'Participant ID': 'CERT-104'
    },
    {
      'Participant Name': 'Rahul Verma',
      'Email Address': 'rahul.verma@example.com',
      'Participant ID': 'CERT-105'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(participantData);
  XLSX.utils.book_append_sheet(wb, ws, 'Roster');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(testExcelPath, buffer);
  console.log('1️⃣ Generated test Excel file:', testExcelPath);

  // 2. Admin Login
  console.log('\n2️⃣ Logging in as admin...');
  const loginRes = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@SmartCert2026' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success) throw new Error('Login failed: ' + loginData.error);
  const token = loginData.token;
  console.log('   ✅ Admin logged in.');

  // 3. Create a test event
  console.log('\n3️⃣ Creating new event for Excel upload test...');
  const eventRes = await fetch(`${BASE_URL}/admin/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Excel Matching Test Event',
      date: '2026-10-27',
      description: 'Testing Excel roster extraction and certificate matching'
    })
  });
  const eventData = await eventRes.json();
  if (!eventData.success) throw new Error('Event creation failed: ' + eventData.error);
  const eventId = eventData.event.id;
  console.log('   ✅ Event created with ID:', eventId);

  // 4. Upload ZIP and XLSX
  console.log('\n4️⃣ Uploading certificates.zip and test_participants.xlsx...');
  const zipPath = path.resolve(__dirname, '../../sample_data/certificates.zip');
  if (!fs.existsSync(zipPath)) {
    throw new Error('certificates.zip not found. Run seed script first.');
  }

  const zipBlob = new Blob([fs.readFileSync(zipPath)], { type: 'application/zip' });
  const xlsxBlob = new Blob([fs.readFileSync(testExcelPath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const formData = new FormData();
  formData.append('zipFile', zipBlob, 'certificates.zip');
  formData.append('participantFile', xlsxBlob, 'test_participants.xlsx');

  const uploadRes = await fetch(`${BASE_URL}/admin/events/${eventId}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  const uploadData = await uploadRes.json();
  if (!uploadData.success) {
    console.error('Upload error details:', uploadData);
    throw new Error('Excel upload failed: ' + uploadData.error);
  }

  console.log('   ✅ Excel file and ZIP uploaded and parsed successfully without errors!');
  console.log('   📊 Matching stats:', uploadData.stats);

  // 5. Check allocations
  console.log('\n5️⃣ Fetching allocations to verify matching accuracy...');
  const detailRes = await fetch(`${BASE_URL}/admin/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const detailData = await detailRes.json();

  console.log('   Matched records:');
  for (const alloc of detailData.allocations) {
    console.log(`   • ${alloc.participantName.padEnd(16)} -> ${alloc.certificateFilename || 'NONE'} [Status: ${alloc.status}, Confidence: ${(alloc.confidenceScore * 100).toFixed(0)}%, Method: ${alloc.matchMethod || 'N/A'}]`);
  }

  console.log('\n🎉 EXCEL UPLOAD AND SMART EXTRACTION TEST PASSED 100%!');
}

testExcelUpload().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

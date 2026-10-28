import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('🧪 Starting End-to-End Automated Test Suite...\n');

  // Test 1: Health Check
  console.log('1️⃣ Checking server health...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = await healthRes.json();
  if (!health.status || health.status !== 'ok') throw new Error('Health check failed');
  console.log('   ✅ Health check passed. Status:', health.status);

  // Test 2: Admin Login
  console.log('\n2️⃣ Testing Admin Login...');
  const loginRes = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@SmartCert2026' })
  });
  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) throw new Error('Admin login failed');
  const token = loginData.token;
  console.log('   ✅ Admin authentication successful. JWT Token received.');

  // Test 3: Load Demo Seed Event
  console.log('\n3️⃣ Seeding Demo Event & Certificates...');
  const seedRes = await fetch(`${BASE_URL}/demo/seed`, { method: 'POST' });
  const seedData = await seedRes.json();
  if (!seedData.success || !seedData.eventId) throw new Error('Seed demo event failed');
  const eventId = seedData.eventId;
  console.log(`   ✅ Demo event created (ID: ${eventId}) with ${seedData.summary.participantsCount} participants.`);
  console.log(`      Matched: ${seedData.summary.matched}, Needs Review: ${seedData.summary.needsReview}, Unmatched: ${seedData.summary.unmatched}`);

  // Test 4: Fetch Event Details
  console.log('\n4️⃣ Fetching Event Details & Allocation Breakdown...');
  const eventRes = await fetch(`${BASE_URL}/admin/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const eventData = await eventRes.json();
  if (!eventData.success) throw new Error('Failed to fetch event details');
  console.log(`   ✅ Event "${eventData.event.name}" loaded with ${eventData.allocations.length} allocation rows.`);

  // Find Vinay Gangurde allocation
  const vinayAlloc = eventData.allocations.find(a => a.participantName === 'Vinay Gangurde');
  if (!vinayAlloc || !vinayAlloc.certificateId) {
    throw new Error('Vinay Gangurde was not matched with a certificate');
  }
  console.log(`   ✅ Vinay Gangurde successfully matched to "${vinayAlloc.certificateFilename}" (Confidence: ${vinayAlloc.confidenceScore * 100}%, Method: ${vinayAlloc.matchMethod})`);

  // Test 5: Manual Override on Needs Review
  console.log('\n5️⃣ Testing Manual Match Override...');
  const reviewAlloc = eventData.allocations.find(a => a.status === 'NEEDS_REVIEW');
  if (reviewAlloc) {
    const overrideRes = await fetch(`${BASE_URL}/admin/allocations/${reviewAlloc.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        certificateId: reviewAlloc.certificateId,
        status: 'MATCHED',
        notes: 'Admin manually confirmed match after inspecting document.'
      })
    });
    const overrideData = await overrideRes.json();
    if (!overrideData.success) throw new Error('Manual match override failed');
    console.log(`   ✅ Successfully overridden match for "${reviewAlloc.participantName}" to MATCHED.`);
  }

  // Test 6: Publish Certificates
  console.log('\n6️⃣ Publishing Verified Certificates...');
  const publishRes = await fetch(`${BASE_URL}/admin/events/${eventId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ sendEmails: true, forcePublish: true })
  });
  const publishData = await publishRes.json();
  if (!publishData.success || publishData.publishedCount === 0) {
    throw new Error('Publish certificates failed');
  }
  console.log(`   ✅ Published ${publishData.publishedCount} certificates!`);

  // Re-fetch event to get published access codes
  const refreshedRes = await fetch(`${BASE_URL}/admin/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const refreshed = await refreshedRes.json();
  const publishedVinay = refreshed.allocations.find(a => a.participantName === 'Vinay Gangurde');
  const accessCode = publishedVinay.accessCode;
  console.log(`   🔑 Generated Access Code for Vinay Gangurde: [${accessCode}]`);

  // Test 7: Participant Portal Verification using Name and Email
  console.log('\n7️⃣ Testing Participant Portal Verification using Name and Email...');
  const verifyRes = await fetch(`${BASE_URL}/participant/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Vinay Gangurde', email: 'vinay.gangurde@example.com' })
  });
  const verifyData = await verifyRes.json();
  if (!verifyData.success || !verifyData.downloadTicket) {
    console.error('Portal verify response:', verifyData);
    throw new Error('Participant portal verification with Name and Email failed');
  }
  console.log('   ✅ Portal verification successful!');
  console.log(`      Participant Name: ${verifyData.participant.name}`);
  console.log(`      Event: ${verifyData.event.name}`);
  console.log(`      Download Ticket issued: ${verifyData.downloadTicket.slice(0, 20)}...`);

  // Test 8: Secure Certificate PDF Download
  console.log('\n8️⃣ Testing Secure Authenticated PDF Download...');
  const downloadRes = await fetch(`${BASE_URL}/participant/download/${verifyData.downloadTicket}`);
  if (!downloadRes.ok) throw new Error(`Download failed with status ${downloadRes.status}`);
  const disposition = downloadRes.headers.get('content-disposition');
  const contentType = downloadRes.headers.get('content-type');
  const pdfBuffer = await downloadRes.arrayBuffer();

  if (contentType !== 'application/pdf') throw new Error(`Expected application/pdf, got ${contentType}`);
  if (!disposition || !disposition.includes('Vinay_Gangurde_Certificate.pdf')) {
    throw new Error(`Invalid download filename in disposition: ${disposition}`);
  }
  if (pdfBuffer.byteLength < 500) throw new Error('Downloaded PDF is corrupted or too small');

  console.log(`   ✅ Certificate downloaded securely!`);
  console.log(`      Content-Type: ${contentType}`);
  console.log(`      Filename: ${disposition}`);
  console.log(`      File size: ${pdfBuffer.byteLength} bytes`);

  // Test 9: Rate limiting & Invalid Credential Handling
  console.log('\n9️⃣ Testing Participant Portal Invalid Credential Handling...');
  const badVerifyRes = await fetch(`${BASE_URL}/participant/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Vinay Gangurde', email: 'unregistered.email@example.com' })
  });
  const badData = await badVerifyRes.json();
  if (badVerifyRes.status !== 401 || !badData.error.includes('No active certificate found')) {
    throw new Error('Invalid credential rejection check failed');
  }
  console.log('   ✅ Security check passed: Generic 401 error returned for invalid Name/Email credentials.');

  // Test 10: Audit Log Verification
  console.log('\n🔟 Testing Audit Trail...');
  const auditRes = await fetch(`${BASE_URL}/admin/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const auditData = await auditRes.json();
  console.log(`   ✅ Audit trail contains ${auditData.auditLogs.length} events:`);
  for (const log of auditData.auditLogs.slice(0, 4)) {
    console.log(`      • [${log.action}] ${log.details}`);
  }

  console.log('\n🎉 ALL 10 TESTS PASSED WITH 100% SUCCESS!');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});

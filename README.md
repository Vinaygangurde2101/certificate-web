# Smart Certificate Allocation & Verification Portal 🎓

A modern, fast, secure **Smart Certificate Allocation Portal** built with **React, Vite, Tailwind CSS, Node.js, Express, and MongoDB**.

Designed for event organizers to upload bulk PDF certificates (in a ZIP file) alongside a participant list (CSV/Excel). The portal automatically normalizes names, extracts PDF text, performs deterministic & fuzzy matching, flags ambiguous cases, prevents double allocation, and publishes certificates behind unique, rate-limited participant access codes.

---

## 🌟 Key Features

### 1. 🛡️ Admin Dashboard & Event Management
- **Secure Authentication**: JWT-based admin session.
- **Event Lifecycle**: Create and manage events with dates and descriptions.
- **Dual Drag-and-Drop Uploader**:
  - ZIP archive containing hundreds of PDF certificates.
  - CSV/Excel roster (`participant_name`, `email`, `participant_id`).
- **Real-Time Upload Progress**: Live progress bars and status indicators during processing.

### 2. 🧠 Multi-Tier Smart Matching Engine
- **Filename Normalization**: Cleans prefixes (`Certificate_`, `Cert_`), suffixes (`_2026`, `-final`), camelCase (`VinayGangurde` → `Vinay Gangurde`), hyphens, underscores, extra spaces, and copy tags (`(1)`).
- **Exact & Token-Set Fuzzy Matching**:
  - Token order independence (matches *"Vinay Gangurde"* with *"Gangurde Vinay"*).
  - Handles middle initials (matches *"Ananya V Patel"* with *"Ananya Patel"*).
  - Levenshtein & Dice coefficient similarity scores.
- **Fallback PDF Text Extraction**: Reads document text using `pdf-parse` when filenames are non-descriptive (e.g. `Scanned_Doc_049281.pdf`).
- **Conflict & Ambiguity Defense**:
  - Automatically flags ambiguous matches (e.g. close name matches with delta < 0.08) as `NEEDS_REVIEW`.
  - Blocks accidental allocation of one certificate to multiple participants.
  - Identifies duplicate certificate files using SHA-256 hashes.
- **Manual Match Override**: Easily reassign, preview, unlink, or revoke any certificate directly in the UI.

### 3. 🚀 Review & Safe Publishing Flow
- **Review Table**: Real-time filters for `All`, `Matched`, `Needs Review`, `Unmatched`, `Duplicate`, and `Revoked`.
- **Publish Protection**: Blocks publishing if unresolved `NEEDS_REVIEW` matches exist unless explicitly approved by the admin.
- **Access Code Generation**: Creates cryptographically secure random codes (e.g. `DEMO-5240` or `A9K2-M7X4`) hashed with SHA-256 for zero-knowledge lookup.
- **Configurable SMTP Emailer**: Delivers codes directly to participant inboxes, with instant preview in Demo Mode.

### 4. 🎓 Public Participant Portal
- **Zero-Public Exposure**: Files are stored securely outside the public web root. Public URLs are never exposed.
- **Credentials Verification**: Participants authenticate using their Name / Email / ID + Unique Access Code.
- **Rate-Limited Verification**: 20 requests per 15-minute window per IP via `express-rate-limit` to prevent brute-force attacks.
- **Secure PDF Streaming**: In-browser PDF preview and single-click download with sanitized meaningful filenames (e.g., `Vinay_Gangurde_Certificate.pdf`).

### 5. 🗄️ Storage Engine (MongoDB + Embedded Zero-Config Fallback)
- **MongoDB Support**: Full Mongoose connectivity via `MONGODB_URI`.
- **Automatic Fallback Engine**: If MongoDB is not running locally, the system automatically falls back to an embedded JSON database (`.data/db.json`), ensuring **100% zero-config immediate testing** out of the box.
- **Zip Slip Defense**: Validates uncompressed file sizes, checks magic header bytes (`%PDF-`), and strictly blocks directory traversal attacks (`..`).
- **Audit Logs**: Records timestamps, IP addresses, downloads, manual overrides, and publication events.

---

## 📁 Repository Structure

```
certificate-interface/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── constants.js          # Match thresholds, paths, statuses
│   │   ├── controllers/
│   │   │   ├── adminController.js    # Events, upload, matching, publish
│   │   │   ├── participantController.js # Verification, download, streaming
│   │   │   └── demoController.js     # Demo seeding & sample downloads
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # Admin JWT guard
│   │   │   └── rateLimiter.js        # Brute force protection
│   │   ├── services/
│   │   │   ├── nameNormalizer.js     # Filename cleaner, token fuzzy scoring
│   │   │   ├── matchingService.js    # Multi-tier matching algorithm
│   │   │   ├── pdfTextService.js     # pdf-parse text extraction
│   │   │   ├── zipService.js         # Zip slip defense & safe extractor
│   │   │   ├── emailService.js       # Nodemailer + Demo logger
│   │   │   └── storageService.js     # Dual MongoDB / embedded JSON store
│   │   ├── scripts/
│   │   │   ├── generateDemoData.js   # Generates sample PDF certificates & CSV
│   │   │   └── testEndToEnd.js       # 10-step automated E2E integration test
│   │   └── server.js                 # Express server
│   ├── sample_data/                  # Generated demo certificates & CSV
│   ├── storage/certificates/         # Secure private certificate storage
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Header & mode switcher
│   │   │   ├── AdminDashboard.jsx    # Metric cards, events, review tabs
│   │   │   ├── UploadSection.jsx     # Dual drag-and-drop uploader
│   │   │   ├── MatchingReviewTable.jsx # Filterable allocations table
│   │   │   ├── ManualMatchModal.jsx  # Reassignment & conflict resolution
│   │   │   ├── CertificatePreviewModal.jsx # In-modal PDF viewer
│   │   │   ├── PublishModal.jsx      # Safe publishing & access code preview
│   │   │   ├── ParticipantPortal.jsx # Public credential verification & download
│   │   │   ├── LoginModal.jsx        # Admin authentication modal
│   │   │   ├── AuditLogsView.jsx     # Security audit trail
│   │   │   └── Toast.jsx             # Toast notification provider
│   │   ├── services/
│   │   │   └── api.js                # API client
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
└── package.json                      # Root orchestration scripts
```

---

## 🚀 Quick Start Guide

### ⚡ One-Click Windows Launcher (Recommended)
Simply double-click:
```
run.bat
```
This batch script will automatically:
1. Verify Node.js is installed.
2. Install any missing dependencies in `backend` and `frontend`.
3. Generate sample test certificates and participant CSV if not already present.
4. Launch the **Backend Server (port 5000)** and **Frontend Server (port 5173)** in separate titled windows.
5. Automatically open [http://localhost:5173](http://localhost:5173) in your default web browser!

To stop all servers at once, double-click:
```
stop.bat
```

---

### Manual Terminal Launch
```bash
# In the root directory:
npm run install:all
npm run dev
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000/api/health](http://localhost:5000/api/health)


---

## 🔑 Default Credentials & Demo Mode

### Default Admin Login
- **Username**: `admin`
- **Password**: `Admin@SmartCert2026`
*(Pre-filled in development with one-click "Fill" button in the Login modal)*

### ⚡ 1-Click Demo Testing
1. Log in to the Admin Dashboard.
2. Click **"Load Demo Event"** in the top banner.
3. The system automatically provisions sample participants and certificates testing:
   - **Exact filename match**: `Vinay_Gangurde.pdf` → `Vinay Gangurde` (100% confidence)
   - **Prefix & Year normalization**: `Certificate_Aarav_Mehta_2026.pdf` → `Aarav Mehta`
   - **Hyphen & suffix cleaning**: `priya-sharma-certificate.pdf` → `Priya Sharma`
   - **Middle initial fuzzy match**: `Ananya_V_Patel.pdf` → `Ananya Patel`
   - **PDF text scan fallback**: `Scanned_Doc_049281.pdf` (No name in filename; body text contains "Rahul Verma" and "CERT-105")
   - **Duplicate handling**: `Rohan_Gupta.pdf` and `Rohan_Gupta_copy.pdf`
   - **Unmatched participant**: `Aditya Roy` (in CSV without a PDF)
   - **Unmatched certificate**: `Carlos_Santana_Guest.pdf` (in ZIP without CSV participant)
4. Click **Publish Certificates** to generate unique access codes.
5. Switch to **Participant Portal** in the top navbar and verify using:
   - Identifier: `Vinay Gangurde`
   - Access Code: (the code displayed in the publish screen or review table)
6. Preview and click **Download PDF** to verify the clean output filename `Vinay_Gangurde_Certificate.pdf`!

---

## 🧪 Automated Testing

Run the automated 10-step integration test:
```bash
cd backend
node src/scripts/testEndToEnd.js
```

---

## 🌐 Production Deployment

### 1. Backend (Render / Railway / Fly.io / AWS EC2)
- Set Environment Variables:
  - `PORT=5000`
  - `NODE_ENV=production`
  - `ADMIN_USERNAME=...`
  - `ADMIN_PASSWORD=...` (strong password)
  - `JWT_SECRET=...` (random 32+ char secret)
  - `MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/cert_portal`
  - `CLIENT_URL=https://your-frontend-domain.com`
  - *(Optional)* SMTP settings for live email sending (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`).
- Start command: `node src/server.js`

### 2. Frontend (Vercel / Netlify / Cloudflare Pages)
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL` or use reverse proxy rewrite:
  ```json
  {
    "rewrites": [{ "source": "/api/(.*)", "destination": "https://your-backend-api.com/api/$1" }]
  }
  ```

import React, { useState } from 'react';
import {
  Award,
  KeyRound,
  User,
  ShieldCheck,
  Download,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

export default function ParticipantPortal() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifiedData, setVerifiedData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const toast = useToast();

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setErrorMsg('Please enter both your Full Name and registered Email Address.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const data = await api.participant.verify({
        name: name.trim(),
        email: email.trim(),
        accessCode: accessCode.trim()
      });
      setVerifiedData(data);
      toast.success('Certificate credentials successfully verified!');
    } catch (err) {
      setErrorMsg(err.message || 'No active certificate found matching the provided Name and Email address.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (demoName, demoEmail) => {
    setName(demoName);
    setEmail(demoEmail);
    setErrorMsg('');
    toast.info(`Filled credentials for ${demoName}`);
  };

  const handleReset = () => {
    setVerifiedData(null);
    setName('');
    setEmail('');
    setAccessCode('');
    setErrorMsg('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16 space-y-8 animate-in fade-in duration-300">
      {/* Portal Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Participant Credential Verification</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Claim & Download Your Certificate
        </h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
          Enter your registered <strong>Full Name</strong> and <strong>Email Address</strong> to verify and securely retrieve your certificate.
        </p>
      </div>

      {!verifiedData ? (
        /* Verification Form Card */
        <div className="glass-panel max-w-lg mx-auto rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Participant Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vinay Gangurde"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Registered Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-slate-500 text-sm">@</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. vinay.gangurde@example.com"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            {/* Optional Access Code toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAccessCode(!showAccessCode)}
                className="text-xs text-slate-400 hover:text-brand-400 flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{showAccessCode ? 'Hide Access Code (optional)' : 'Have an Access Code? (Optional)'}</span>
              </button>

              {showAccessCode && (
                <div className="mt-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DEMO-101 or A9K2-M7X4"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 font-mono tracking-wider uppercase placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>

            {/* Demo autofill helpers */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-1.5">
              <span className="text-slate-400 font-medium block text-[11px]">Quick Demo Test Credentials:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleFillDemo('Vinay Gangurde', 'vinay.gangurde@example.com')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-brand-300 text-[11px] font-medium transition-colors"
                >
                  Vinay Gangurde
                </button>
                <button
                  type="button"
                  onClick={() => handleFillDemo('Priya Sharma', 'priya.sharma@example.com')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-indigo-300 text-[11px] font-medium transition-colors"
                >
                  Priya Sharma
                </button>
                <button
                  type="button"
                  onClick={() => handleFillDemo('Aarav Mehta', 'aarav.mehta@example.com')}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-emerald-300 text-[11px] font-medium transition-colors"
                >
                  Aarav Mehta
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-brand-600/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Find & Download Certificate</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Privacy & Security Note */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500">
              🔒 End-to-end encrypted verification. Rate-limited to prevent brute-force attacks.
            </p>
          </div>
        </div>
      ) : (
        /* Verified Certificate Display */
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
          {/* Success Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-white">Certificate Verified</h3>
                <p className="text-xs text-emerald-300/80">
                  Issued to <strong className="text-white">{verifiedData.participant.name}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={api.participant.getDownloadUrl(verifiedData.downloadTicket)}
                download
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </a>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Verify Another
              </button>
            </div>
          </div>

          {/* Event & Credential Meta Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Event Name</span>
              <span className="font-semibold text-white truncate block">{verifiedData.event.name}</span>
            </div>
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Event Date</span>
              <span className="font-semibold text-white block">{verifiedData.event.date}</span>
            </div>
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Participant ID</span>
              <span className="font-mono font-semibold text-brand-400 block">{verifiedData.participant.participantId || 'N/A'}</span>
            </div>
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Security Status</span>
              <span className="font-semibold text-emerald-400 block">Digitally Authenticated</span>
            </div>
          </div>

          {/* Certificate Viewer Preview */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              In-Browser Certificate Preview
            </span>
            <div className="w-full h-[520px] rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner flex items-center justify-center">
              <iframe
                src={api.participant.getStreamUrl(verifiedData.downloadTicket)}
                title="Participant Certificate Preview"
                className="w-full h-full rounded-2xl border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

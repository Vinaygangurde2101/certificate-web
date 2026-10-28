import React, { useState } from 'react';
import { Send, AlertTriangle, CheckCircle2, ShieldCheck, Mail, Copy, Check, ExternalLink, X } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

export default function PublishModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  matchedCount = 0,
  needsReviewCount = 0,
  onPublished
}) {
  const [sendEmails, setSendEmails] = useState(true);
  const [forcePublish, setForcePublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const toast = useToast();

  if (!isOpen) return null;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await api.matching.publish(eventId, {
        sendEmails,
        forcePublish
      });
      toast.success(res.message || 'Certificates published successfully!');
      setPublishResult(res);
      onPublished();
    } catch (err) {
      toast.error(err.message || 'Failed to publish certificates');
    } finally {
      setPublishing(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.info(`Copied access code: ${text}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-white">Publish Certificates</h3>
              <p className="text-xs text-slate-400">{eventName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {publishResult ? (
          /* Success Screen with generated Access Codes for instant testing */
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-400" />
              <div>
                <p className="font-bold text-sm">Certificates Published Securely!</p>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  {publishResult.publishedCount} participants can now claim and download their credentials using their unique access codes.
                </p>
              </div>
            </div>

            {/* Generated Codes list (super handy for Demo mode!) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Participant Access Codes (Test Preview)
                </span>
                <span className="text-[11px] text-brand-400">Click code to copy</span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 p-2 rounded-xl border border-slate-800 bg-slate-950/60">
                {publishResult.emailDeliveries?.length > 0 ? (
                  publishResult.emailDeliveries.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-white">{item.participantName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{item.email}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.accessCode, idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 font-mono font-bold transition-all border border-slate-700"
                      >
                        <span>{item.accessCode}</span>
                        {copiedCode === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Access codes generated. You can view them on the main review table.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation Screen */
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between text-slate-300">
                <span>Matched Certificates to Publish:</span>
                <span className="font-bold text-emerald-400">{matchedCount}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Unresolved Matches:</span>
                <span className={`font-bold ${needsReviewCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {needsReviewCount}
                </span>
              </div>
            </div>

            {/* Warning if unresolved matches exist */}
            {needsReviewCount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Unresolved Matches Alert</span>
                </div>
                <p className="text-amber-300/80 leading-relaxed">
                  There are <strong>{needsReviewCount}</strong> matches currently marked as "Needs Review". Automatic publishing of uncertain matches is blocked by default to prevent incorrect certificate allocation.
                </p>
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forcePublish}
                    onChange={(e) => setForcePublish(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0"
                  />
                  <span className="text-white font-medium">Publish verified matches anyway and leave reviews pending</span>
                </label>
              </div>
            )}

            {/* Options */}
            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer hover:bg-slate-950/70 transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmails}
                  onChange={(e) => setSendEmails(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-brand-600 focus:ring-0 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-brand-400" />
                    Deliver Access Codes via Email
                  </span>
                  <p className="text-slate-400 mt-0.5">
                    Sends unique access codes to participant emails (simulated in Demo Mode, live via SMTP when configured).
                  </p>
                </div>
              </label>
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || (needsReviewCount > 0 && !forcePublish) || matchedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Publishing & Encrypting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirm & Publish Certificates</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

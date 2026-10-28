import React from 'react';
import { FileText, Download, X, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

export default function CertificatePreviewModal({ isOpen, onClose, certId, filename }) {
  if (!isOpen || !certId) return null;

  const previewUrl = api.certificates.getPreviewUrl(certId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2.5 truncate">
            <div className="p-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="font-heading text-sm font-bold text-white truncate">
                {filename || 'Certificate Preview'}
              </h3>
              <p className="text-[11px] text-slate-400">Secure Document Viewer</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Tab</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Frame */}
        <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
          <iframe
            src={previewUrl}
            title="PDF Preview"
            className="w-full h-full rounded-xl border border-slate-800 bg-white shadow-inner"
          />
        </div>
      </div>
    </div>
  );
}

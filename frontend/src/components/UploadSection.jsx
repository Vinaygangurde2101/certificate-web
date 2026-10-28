import React, { useState } from 'react';
import { UploadCloud, FileArchive, FileSpreadsheet, Check, AlertCircle, ArrowRight, Download, Sparkles, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

export default function UploadSection({ eventId, onUploadComplete }) {
  const [zipFile, setZipFile] = useState(null);
  const [participantFile, setParticipantFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const toast = useToast();

  const handleZipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast.error('Certificates archive must be a .zip file');
        return;
      }
      setZipFile(file);
    }
  };

  const handleParticipantChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
        toast.error('Participant list must be a .csv or .xlsx file');
        return;
      }
      setParticipantFile(file);
    }
  };

  const handleProcessUpload = async () => {
    if (!zipFile || !participantFile) {
      toast.error('Please select both the ZIP archive and the Participant list.');
      return;
    }

    setUploading(true);
    setProgress(5);
    setStatusText('Uploading archive and participant roster...');

    try {
      const result = await api.upload.uploadFiles(
        eventId,
        zipFile,
        participantFile,
        (percent) => {
          setProgress(Math.min(90, Math.max(10, percent)));
          if (percent === 100) {
            setStatusText('Analyzing filenames, extracting PDF text, and running matching engine...');
          }
        }
      );

      setProgress(100);
      setStatusText('Matching complete!');
      toast.success(result.message || 'Certificates successfully analyzed and matched!');
      setZipFile(null);
      setParticipantFile(null);
      onUploadComplete(result);
    } catch (err) {
      toast.error(err.message || 'Failed to process certificates');
    } finally {
      setUploading(false);
      setProgress(0);
      setStatusText('');
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <h2 className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-brand-400" />
            Upload Certificates & Participant Roster
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload certificates ZIP and participant CSV/Excel. The smart engine will extract names, normalize variations, and perform fuzzy matching.
          </p>
        </div>

        {/* Quick sample file downloads */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={api.demo.getSampleCsvUrl()}
            download="participants_sample.csv"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-brand-400" />
            <span>Sample CSV</span>
          </a>
          <a
            href={api.demo.getSampleZipUrl()}
            download="certificates_sample.zip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Sample ZIP</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Dropzone 1: Certificates ZIP */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
            zipFile
              ? 'border-brand-500/60 bg-brand-500/5'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
          }`}
        >
          <input
            type="file"
            id="zip-upload"
            accept=".zip"
            disabled={uploading}
            onChange={handleZipChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
            <FileArchive className="w-6 h-6" />
          </div>
          {zipFile ? (
            <div className="space-y-1">
              <span className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                {zipFile.name}
              </span>
              <p className="text-xs text-slate-400">
                {(zipFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZipFile(null);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 underline pt-1 relative z-10"
              >
                Change archive
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-200">
                Drop Certificates ZIP here, or <span className="text-brand-400">browse</span>
              </p>
              <p className="text-xs text-slate-500">
                Contains PDF certificates (e.g. Vinay_Gangurde.pdf, Certificate_Priya.pdf)
              </p>
            </div>
          )}
        </div>

        {/* Dropzone 2: Participant CSV/Excel */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
            participantFile
              ? 'border-brand-500/60 bg-brand-500/5'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
          }`}
        >
          <input
            type="file"
            id="csv-upload"
            accept=".csv, .xlsx, .xls"
            disabled={uploading}
            onChange={handleParticipantChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          {participantFile ? (
            <div className="space-y-1">
              <span className="text-sm font-semibold text-white flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" />
                {participantFile.name}
              </span>
              <p className="text-xs text-slate-400">
                {(participantFile.size / 1024).toFixed(1)} KB • Ready to parse
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setParticipantFile(null);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 underline pt-1 relative z-10"
              >
                Change roster
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-200">
                Drop Participant Roster here, or <span className="text-emerald-400">browse</span>
              </p>
              <p className="text-xs text-slate-500">
                CSV or Excel with columns: participant_name, email, participant_id
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress & Processing Indicator */}
      {uploading && (
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
              {statusText}
            </span>
            <span className="font-bold text-brand-400">{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <AlertCircle className="w-4 h-4 text-slate-500" />
          <span>Existing draft matching data for this event will be updated.</span>
        </div>

        <button
          type="button"
          onClick={handleProcessUpload}
          disabled={!zipFile || !participantFile || uploading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing & Matching...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-brand-200" />
              <span>Start Smart Matching</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

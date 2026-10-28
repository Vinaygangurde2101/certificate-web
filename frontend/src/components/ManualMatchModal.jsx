import React, { useState, useMemo } from 'react';
import { Edit3, Check, X, FileText, Search, AlertCircle, Eye } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';

export default function ManualMatchModal({
  isOpen,
  onClose,
  allocation,
  allCertificates = [],
  allAllocations = [],
  onUpdated,
  onPreviewCertificate
}) {
  const [selectedCertId, setSelectedCertId] = useState('');
  const [searchCert, setSearchCert] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  React.useEffect(() => {
    if (allocation) {
      setSelectedCertId(allocation.certificateId || '');
      setNotes(allocation.notes || '');
      setSearchCert('');
    }
  }, [allocation]);

  if (!isOpen || !allocation) return null;

  // Filter available certificates
  const filteredCerts = allCertificates.filter((c) => {
    if (!searchCert.trim()) return true;
    const q = searchCert.toLowerCase().trim();
    return c.originalFilename.toLowerCase().includes(q) || (c.extractedName && c.extractedName.toLowerCase().includes(q));
  });

  // Check if selected certificate is already assigned to another participant
  const conflictingAssignment = allAllocations.find(
    (a) => a.certificateId === selectedCertId && a.id !== allocation.id && a.status === 'MATCHED'
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.matching.manualMatch(allocation.id, {
        certificateId: selectedCertId || null,
        status: selectedCertId ? 'MATCHED' : 'UNMATCHED',
        notes: notes.trim() || 'Manual match override by administrator.'
      });
      toast.success(`Updated matching for ${allocation.participantName}`);
      onUpdated(updated);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update allocation');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSelectedCertId('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-white">Manual Match Correction</h3>
              <p className="text-xs text-slate-400">
                Override allocation for <strong className="text-white">{allocation.participantName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Participant Summary */}
        <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Participant ID: </span>
            <span className="text-white font-mono font-semibold">{allocation.pCode || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-400">Email: </span>
            <span className="text-white font-mono">{allocation.email}</span>
          </div>
          <div>
            <span className="text-slate-400">Current Status: </span>
            <span className="text-brand-400 font-semibold">{allocation.status}</span>
          </div>
        </div>

        {/* Certificate Selection */}
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Assign Certificate File
            </label>
            {selectedCertId && (
              <button
                type="button"
                onClick={handleUnlink}
                className="text-xs text-rose-400 hover:text-rose-300 underline"
              >
                Unlink Certificate
              </button>
            )}
          </div>

          {/* Search certificates */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchCert}
              onChange={(e) => setSearchCert(e.target.value)}
              placeholder="Search filename or extracted name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Certificate list selector */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-slate-800 bg-slate-950/40">
            {filteredCerts.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500">No certificates match your query</p>
            ) : (
              filteredCerts.map((cert) => {
                const isSelected = selectedCertId === cert.id;
                const assignedTo = allAllocations.find(
                  (a) => a.certificateId === cert.id && a.id !== allocation.id && a.status === 'MATCHED'
                );

                return (
                  <div
                    key={cert.id}
                    onClick={() => setSelectedCertId(cert.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-brand-500/10 border-brand-500 text-white'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-brand-400' : 'text-slate-500'}`} />
                      <div className="truncate">
                        <p className="font-mono truncate">{cert.originalFilename}</p>
                        {cert.extractedName && (
                          <p className="text-[10px] text-slate-500">Extracted: {cert.extractedName}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {assignedTo && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Assigned to: {assignedTo.participantName}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewCertificate(cert.id, cert.originalFilename);
                        }}
                        title="Preview PDF"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Conflict warning */}
          {conflictingAssignment && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> This certificate is already allocated to{' '}
                <strong className="underline">{conflictingAssignment.participantName}</strong>. If you reassign it here, the system requires you to resolve the double allocation.
              </span>
            </div>
          )}

          {/* Override Reason / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Admin Notes / Reason
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Manually confirmed via identity proof..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Allocation'}
          </button>
        </div>
      </div>
    </div>
  );
}

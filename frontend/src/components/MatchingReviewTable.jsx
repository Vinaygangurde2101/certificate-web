import React, { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  Eye,
  Edit3,
  ShieldAlert,
  FileCheck,
  Slash,
  Sparkles,
  Info
} from 'lucide-react';

export default function MatchingReviewTable({
  allocations = [],
  onPreviewCertificate,
  onOpenManualMatch,
  onRevokeCertificate
}) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Counts
  const counts = useMemo(() => {
    return {
      all: allocations.length,
      matched: allocations.filter((a) => a.status === 'MATCHED').length,
      needsReview: allocations.filter((a) => a.status === 'NEEDS_REVIEW').length,
      unmatched: allocations.filter((a) => a.status === 'UNMATCHED').length,
      duplicate: allocations.filter((a) => a.status === 'DUPLICATE').length,
      revoked: allocations.filter((a) => a.status === 'REVOKED').length
    };
  }, [allocations]);

  // Filtered & Searched data
  const filteredData = useMemo(() => {
    return allocations.filter((item) => {
      // Status filter
      if (filter !== 'ALL' && item.status !== filter) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = item.participantName?.toLowerCase().includes(q);
        const matchesEmail = item.email?.toLowerCase().includes(q);
        const matchesCode = item.pCode?.toLowerCase().includes(q);
        const matchesCert = item.certificateFilename?.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesCode || matchesCert;
      }
      return true;
    });
  }, [allocations, filter, search]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'MATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Matched
          </span>
        );
      case 'NEEDS_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Needs Review
          </span>
        );
      case 'UNMATCHED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
            Unmatched
          </span>
        );
      case 'DUPLICATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Copy className="w-3.5 h-3.5 text-purple-400" />
            Duplicate
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <Slash className="w-3.5 h-3.5" />
            Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-400">
            {status}
          </span>
        );
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'ID_EXACT':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">ID Exact</span>;
      case 'FILENAME_EXACT':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Exact Name</span>;
      case 'FILENAME_FUZZY':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Fuzzy Match</span>;
      case 'PDF_TEXT':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">PDF Text Scan</span>;
      case 'MANUAL':
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Manual Override</span>;
      default:
        return null;
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            All ({counts.all})
          </button>

          <button
            onClick={() => setFilter('MATCHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === 'MATCHED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/5'
            }`}
          >
            Matched ({counts.matched})
          </button>

          <button
            onClick={() => setFilter('NEEDS_REVIEW')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === 'NEEDS_REVIEW'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-amber-300 hover:bg-amber-500/5'
            }`}
          >
            Needs Review ({counts.needsReview})
          </button>

          <button
            onClick={() => setFilter('UNMATCHED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === 'UNMATCHED'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-rose-300 hover:bg-rose-500/5'
            }`}
          >
            Unmatched ({counts.unmatched})
          </button>

          <button
            onClick={() => setFilter('DUPLICATE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === 'DUPLICATE'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-purple-300 hover:bg-purple-500/5'
            }`}
          >
            Duplicates ({counts.duplicate})
          </button>
        </div>

        {/* Live Search */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, ID, or file..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4">Participant</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Certificate Document</th>
              <th className="py-3 px-4">Match & Confidence</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Notes / Suggested</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 text-xs text-slate-300">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileCheck className="w-8 h-8 text-slate-600" />
                    <span>No matching participant records found for this filter.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((item) => {
                const confPercent = Math.round((item.confidenceScore || 0) * 100);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    {/* Participant Name & ID */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        <span>{item.participantName}</span>
                      </div>
                      {item.pCode && (
                        <span className="inline-block text-[10px] font-mono font-medium text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 mt-0.5">
                          {item.pCode}
                        </span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {item.email || '—'}
                    </td>

                    {/* Certificate Filename */}
                    <td className="py-3.5 px-4">
                      {item.certificateFilename ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200 truncate max-w-[220px]" title={item.certificateFilename}>
                            {item.certificateFilename}
                          </span>
                        </div>
                      ) : (
                        <span className="text-rose-400/80 italic">No certificate linked</span>
                      )}
                    </td>

                    {/* Method & Confidence */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getMethodBadge(item.matchMethod)}
                          {item.confidenceScore > 0 && (
                            <span className="text-xs font-semibold text-slate-200">
                              {confPercent}%
                            </span>
                          )}
                        </div>
                        {item.confidenceScore > 0 && (
                          <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                confPercent >= 88
                                  ? 'bg-emerald-500'
                                  : confPercent >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${confPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Notes & Suggestions */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <span className="text-slate-400 text-[11px] line-clamp-2" title={item.notes}>
                        {item.notes || '—'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.certificateId && (
                          <button
                            type="button"
                            onClick={() => onPreviewCertificate(item.certificateId, item.certificateFilename)}
                            title="Preview PDF Certificate"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-brand-300 hover:border-brand-500/30 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenManualMatch(item)}
                          title="Manual Match / Override"
                          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-300 hover:border-amber-500/30 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {item.certificateId && item.status !== 'REVOKED' && (
                          <button
                            type="button"
                            onClick={() => onRevokeCertificate(item.id, item.participantName)}
                            title="Revoke Certificate"
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                          >
                            <Slash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

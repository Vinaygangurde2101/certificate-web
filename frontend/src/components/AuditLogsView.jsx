import React from 'react';
import { History, Shield, Clock, Terminal } from 'lucide-react';

export default function AuditLogsView({ logs = [] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 border border-slate-800 text-center text-slate-500 text-xs">
        No audit activity recorded yet for this event.
      </div>
    );
  }

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'CERTIFICATES_PUBLISHED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'MANUAL_OVERRIDE':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'CERTIFICATE_REVOKED':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'CERTIFICATE_DOWNLOADED':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default:
        return 'text-slate-300 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center gap-2.5">
        <History className="w-5 h-5 text-brand-400" />
        <h3 className="font-heading text-sm font-bold text-white">Event Audit & Security Trail</h3>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="p-4 hover:bg-slate-900/40 transition-colors flex items-start justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${getActionBadgeColor(log.action)}`}>
                  {log.action}
                </span>
                <span className="text-slate-500 text-[11px] font-mono">IP: {log.ipAddress}</span>
              </div>
              <p className="text-slate-200 font-medium">{log.details}</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

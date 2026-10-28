import React, { useState, useEffect } from 'react';
import {
  Plus,
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Copy,
  Send,
  Trash2,
  RefreshCw,
  ExternalLink,
  History,
  FileCheck
} from 'lucide-react';
import { api } from '../services/api';
import { useToast } from './Toast';
import UploadSection from './UploadSection';
import MatchingReviewTable from './MatchingReviewTable';
import ManualMatchModal from './ManualMatchModal';
import CertificatePreviewModal from './CertificatePreviewModal';
import PublishModal from './PublishModal';
import EventCreationModal from './EventCreationModal';
import AuditLogsView from './AuditLogsView';

export default function AdminDashboard({ onSwitchToPortal }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [currentEventData, setCurrentEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('matching'); // 'matching' | 'audit'

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [previewCert, setPreviewCert] = useState({ isOpen: false, certId: null, filename: '' });
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  const toast = useToast();

  // Load events list
  const loadEvents = async (selectFirst = false) => {
    try {
      const list = await api.events.getAll();
      setEvents(list);
      if (list.length > 0) {
        if (selectFirst || !selectedEventId || !list.some((e) => e.id === selectedEventId)) {
          setSelectedEventId(list[0].id);
        }
      } else {
        setSelectedEventId('');
        setCurrentEventData(null);
      }
    } catch (err) {
      toast.error('Failed to load events list');
    } finally {
      setLoading(false);
    }
  };

  // Load event details whenever selectedEventId changes
  const loadEventDetails = async (id) => {
    if (!id) return;
    try {
      const data = await api.events.getById(id);
      setCurrentEventData(data);
    } catch (err) {
      toast.error('Failed to load event details');
    }
  };

  useEffect(() => {
    loadEvents(true);
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadEventDetails(selectedEventId);
    }
  }, [selectedEventId]);

  // Handle Demo Mode Quick Seed
  const handleQuickSeedDemo = async () => {
    setLoading(true);
    try {
      const res = await api.demo.seed();
      toast.success('Demo event loaded with 8 sample participants & certificates!');
      await loadEvents();
      setSelectedEventId(res.eventId);
    } catch (err) {
      toast.error(err.message || 'Failed to seed demo dataset');
    } finally {
      setLoading(false);
    }
  };

  // Open Preview Modal
  const handlePreviewCertificate = (certId, filename) => {
    setPreviewCert({ isOpen: true, certId, filename });
  };

  // Open Manual Match Modal
  const handleOpenManualMatch = (allocation) => {
    setSelectedAllocation(allocation);
    setIsManualModalOpen(true);
  };

  // Revoke Certificate
  const handleRevokeCertificate = async (allocationId, name) => {
    if (window.confirm(`Are you sure you want to revoke the certificate for "${name}"?`)) {
      try {
        await api.matching.revoke(allocationId);
        toast.info(`Certificate for ${name} has been revoked.`);
        loadEventDetails(selectedEventId);
      } catch (err) {
        toast.error(err.message || 'Failed to revoke certificate');
      }
    }
  };

  // Delete current event
  const handleDeleteEvent = async () => {
    if (!selectedEventId || !currentEventData) return;
    if (window.confirm(`Delete event "${currentEventData.event.name}" and all associated files?`)) {
      try {
        await api.events.delete(selectedEventId);
        toast.info('Event deleted.');
        loadEvents(true);
      } catch (err) {
        toast.error(err.message || 'Failed to delete event');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner with Demo Mode & Quick Actions */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-brand-500/20 border border-amber-500/30 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-white text-sm">Demo Mode Active</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Out-of-the-box Ready
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Test exact matching, fuzzy tokens, duplicate detection, and PDF text extraction with one click.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleQuickSeedDemo}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold text-xs shadow-lg shadow-amber-600/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Demo Event</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* Events Selector Dropdown / Bar */}
      {events.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Select Active Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-brand-500"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.date}) • {ev.status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadEventDetails(selectedEventId)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
              title="Refresh Event Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDeleteEvent}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 text-xs transition-colors"
              title="Delete Event"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Active Event Overview */}
      {currentEventData ? (
        <div className="space-y-6">
          {/* Event Header Card */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {currentEventData.event.name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    currentEventData.event.status === 'PUBLISHED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {currentEventData.event.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {currentEventData.event.date}
                </span>
                {currentEventData.event.description && (
                  <span>• {currentEventData.event.description}</span>
                )}
              </div>
            </div>

            {/* Main Action: Publish Certificates */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(true)}
                disabled={currentEventData.stats.matched === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-xl shadow-emerald-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>
                  {currentEventData.event.status === 'PUBLISHED'
                    ? 'Publish Updates'
                    : 'Publish Certificates'}
                </span>
              </button>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            {/* Total Participants */}
            <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Total Roster</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <p className="font-heading text-2xl font-bold text-white">
                {currentEventData.stats.totalParticipants}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {currentEventData.stats.totalCertificates} PDF files
              </p>
            </div>

            {/* Matched */}
            <div className="glass-card rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
                <span>Matched</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="font-heading text-2xl font-bold text-emerald-300">
                {currentEventData.stats.matched}
              </p>
              <p className="text-[11px] text-emerald-400/70 mt-0.5">High confidence</p>
            </div>

            {/* Needs Review */}
            <div className={`glass-card rounded-2xl p-4 border transition-all ${
              currentEventData.stats.needsReview > 0
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between text-amber-400 text-xs mb-1">
                <span>Needs Review</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <p className="font-heading text-2xl font-bold text-amber-300">
                {currentEventData.stats.needsReview}
              </p>
              <p className="text-[11px] text-amber-400/70 mt-0.5">Ambiguous / fuzzy</p>
            </div>

            {/* Unmatched */}
            <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
              <div className="flex items-center justify-between text-rose-400 text-xs mb-1">
                <span>Unmatched</span>
                <HelpCircle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="font-heading text-2xl font-bold text-rose-300">
                {currentEventData.stats.unmatched}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Missing PDF cert</p>
            </div>

            {/* Duplicates */}
            <div className="glass-card rounded-2xl p-4 border border-slate-800/80">
              <div className="flex items-center justify-between text-purple-400 text-xs mb-1">
                <span>Duplicates</span>
                <Copy className="w-4 h-4 text-purple-400" />
              </div>
              <p className="font-heading text-2xl font-bold text-purple-300">
                {currentEventData.stats.duplicate}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Duplicate files/names</p>
            </div>
          </div>

          {/* Tab Navigation: Matching Review vs Audit Trail */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('matching')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'matching'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Matching & Allocation Review</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'audit'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Audit Trail & Security Logs</span>
            </button>
          </div>

          {activeTab === 'matching' ? (
            <div className="space-y-6">
              {/* File Upload Section */}
              <UploadSection
                eventId={selectedEventId}
                onUploadComplete={() => loadEventDetails(selectedEventId)}
              />

              {/* Review Table */}
              <MatchingReviewTable
                allocations={currentEventData.allocations}
                onPreviewCertificate={handlePreviewCertificate}
                onOpenManualMatch={handleOpenManualMatch}
                onRevokeCertificate={handleRevokeCertificate}
              />
            </div>
          ) : (
            <AuditLogsView logs={currentEventData.auditLogs} />
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-panel rounded-3xl p-12 text-center border border-slate-800 space-y-4 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-white">No Event Selected</h3>
            <p className="text-xs text-slate-400 mt-1">
              Create a new event or load the instant demo event to explore the smart certificate matching engine.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleQuickSeedDemo}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg shadow-amber-600/20"
            >
              Load Demo Dataset
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/20"
            >
              Create New Event
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <EventCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newEvent) => {
          loadEvents();
          setSelectedEventId(newEvent.id);
        }}
      />

      <ManualMatchModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        allocation={selectedAllocation}
        allCertificates={currentEventData?.certificates || []}
        allAllocations={currentEventData?.allocations || []}
        onUpdated={() => loadEventDetails(selectedEventId)}
        onPreviewCertificate={handlePreviewCertificate}
      />

      <CertificatePreviewModal
        isOpen={previewCert.isOpen}
        onClose={() => setPreviewCert({ isOpen: false, certId: null, filename: '' })}
        certId={previewCert.certId}
        filename={previewCert.filename}
      />

      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        eventId={selectedEventId}
        eventName={currentEventData?.event?.name}
        matchedCount={currentEventData?.stats?.matched || 0}
        needsReviewCount={currentEventData?.stats?.needsReview || 0}
        onPublished={() => loadEventDetails(selectedEventId)}
      />
    </div>
  );
}

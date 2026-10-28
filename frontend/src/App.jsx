import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AdminDashboard from './components/AdminDashboard';
import ParticipantPortal from './components/ParticipantPortal';
import LoginModal from './components/LoginModal';
import { ToastProvider } from './components/Toast';
import { api } from './services/api';

export default function App() {
  const [activeView, setActiveView] = useState(() => {
    // If URL has /portal, open portal view directly
    if (window.location.pathname.includes('/portal') || window.location.hash.includes('portal')) {
      return 'portal';
    }
    return 'admin';
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);

  // Check auth session
  useEffect(() => {
    const checkAuth = async () => {
      if (api.auth.isAuthenticated()) {
        try {
          const data = await api.auth.getMe();
          setIsAuthenticated(true);
          setServerInfo(data);
        } catch (e) {
          api.auth.logout();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    api.auth.logout();
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
        {/* Navigation Bar */}
        <Navbar
          activeView={activeView}
          setActiveView={setActiveView}
          isAuthenticated={isAuthenticated}
          onLogout={handleLogout}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          serverInfo={serverInfo}
        />

        {/* Main Content Area */}
        <main className="flex-1 pb-16">
          {activeView === 'admin' ? (
            isAuthenticated ? (
              <AdminDashboard onSwitchToPortal={() => setActiveView('portal')} />
            ) : (
              <div className="max-w-md mx-auto mt-20 p-8 glass-panel rounded-3xl border border-slate-800 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
                  <span className="text-2xl">🔐</span>
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold text-white">Administrator Access</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Sign in to access certificate matching, roster uploads, and secure publishing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/30 transition-all"
                >
                  Sign In to Admin Portal
                </button>
              </div>
            )
          ) : (
            <ParticipantPortal />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>
              Smart Certificate Allocation & Verification Portal • Built with React, Tailwind CSS, Node.js & MongoDB
            </p>
            <p className="text-[11px] text-slate-600">
              Deterministic & Fuzzy Matching • Zip Slip Protected • Rate Limited
            </p>
          </div>
        </footer>

        {/* Login Modal */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    </ToastProvider>
  );
}

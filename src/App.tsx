import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { POSView } from './components/POSView';
import { ProductsView } from './components/ProductsView';
import { StockView } from './components/StockView';
import { ReportsView } from './components/ReportsView';
import { UsersView } from './components/UsersView';
import { SalesListView } from './components/SalesListView';
import { AuthView } from './components/AuthView';
import { ExpensesView } from './components/ExpensesView';
import { dbService } from './dbService';
import { supabase } from './supabaseClient';
import { useNotificationStore } from './store';
import { RefreshCw, LogOut, User, Menu } from 'lucide-react';
import { isRestrictedStaffRole, formatRoleName } from './roleUtils';

function App() {
  const { toasts, removeToast, modal, closeModal } = useNotificationStore();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('cashier');
  const [lowStockCount, setLowStockCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const handleAuthSuccess = (activeSession: any) => {
    setSession(activeSession);
    refreshStats();
  };

  const handleLogout = async () => {
    localStorage.removeItem('sb-mock-session');
    await supabase.auth.signOut();
    setSession(null);
    setUserRole('cashier');
  };

  // Sync userRole from session metadata and users table
  useEffect(() => {
    if (!session?.user) {
      setUserRole('');
      return;
    }
    const initialRole = 
      session.user.user_metadata?.role || 
      (session.user.email === 'admin@gmail.com' ? 'admin' : 'cashier');
    setUserRole(initialRole);

    if (session.user.id) {
      dbService.getUserRole(session.user.id, initialRole).then(resolved => {
        if (resolved) setUserRole(resolved);
      });
    }
  }, [session]);

  const refreshStats = async () => {
    try {
      const count = await dbService.getLowStockCount();
      setLowStockCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Check existing session
    const loadSession = async () => {
      const mockSessionStr = localStorage.getItem('sb-mock-session');
      if (mockSessionStr) {
        try {
          const mockSession = JSON.parse(mockSessionStr);
          setSession(mockSession);
          setAuthLoading(false);
          refreshStats();
          return;
        } catch (e) {
          console.error('Failed to parse mock session', e);
        }
      }
      
      const { data: { session: sbSession } } = await supabase.auth.getSession();
      if (sbSession) {
        setSession(sbSession);
      }
      setAuthLoading(false);
      refreshStats();
    };

    loadSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // If we signed out of supabase auth, make sure to clear the mock session
      if (!newSession) {
        localStorage.removeItem('sb-mock-session');
      }
      setSession(newSession || (localStorage.getItem('sb-mock-session') ? JSON.parse(localStorage.getItem('sb-mock-session')!) : null));
      refreshStats();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f8fafc', color: '#4f46e5', fontWeight: 600 }}>
        Loading POS Terminal...
      </div>
    );
  }

  // Force authentication
  if (!session) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  const getPageTitle = () => {
    const path = location.pathname.toLowerCase();
    if (path.startsWith('/products')) return 'Product Catalog';
    if (path.startsWith('/stock')) return 'Inventory Stock Levels';
    if (path.startsWith('/sales')) return 'Completed Invoices Ledger';
    if (path.startsWith('/expenses')) return 'Operating Expense Ledger';
    if (path.startsWith('/users')) return 'Staff & Terminal Profiles';
    if (path.startsWith('/reports')) return 'Business Analytics';
    return 'POS Checkout';
  };

  const userEmail = session?.user?.email || 'Cashier';
  const isRestricted = isRestrictedStaffRole(userRole);

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <Sidebar 
        lowStockCount={lowStockCount} 
        isOpen={isMobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        userRole={userRole}
      />

      {/* Dim Overlay Backdrop for Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setMobileMenuOpen(false)} 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.4)', 
            zIndex: 1090 
          }} 
        />
      )}

      {/* Main Panel */}
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setMobileMenuOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                padding: '4px',
                display: 'none',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="header-title" style={{ margin: 0 }}>{getPageTitle()}</h1>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              fontSize: '11px',
              fontWeight: 700,
              color: '#047857'
            }} className="header-live-pill">
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              Live POS Terminal
            </div>
          </div>
          <div className="header-actions">
            {/* Store Tag */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11.5px',
              fontWeight: 800,
              color: 'var(--color-primary)',
              background: 'var(--color-primary-light)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(11, 37, 69, 0.1)',
              letterSpacing: '0.6px',
              textTransform: 'uppercase'
            }} className="header-store-pill">
              <span>🏛️</span> RAJMAHAL
            </div>

            {/* User Profile */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              background: 'var(--bg-primary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)'
            }}>
              <User size={13} style={{ color: 'var(--color-primary)' }} />
              <span className="user-email">{userEmail}</span>
              {userRole && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  background: isRestricted ? '#e0f2fe' : '#ede9fe',
                  color: isRestricted ? '#0369a1' : '#6d28d9',
                  letterSpacing: '0.4px',
                  marginLeft: '2px'
                }}>
                  {formatRoleName(userRole)}
                </span>
              )}
            </div>

            {/* Refresh stats manually */}
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={refreshStats}
              title="Refresh inventory counts"
              style={{ width: '32px', height: '32px', padding: 0 }}
            >
              <RefreshCw size={14} />
            </button>

            {/* Logout */}
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ width: '32px', height: '32px', padding: 0, border: '1px solid #fecaca', color: '#ef4444', background: '#fef2f2' }} 
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>

          </div>
        </header>

        <main className="page-container">
          <Routes>
            <Route path="/" element={<Navigate to="/pos" replace />} />
            <Route path="/pos" element={<POSView onRefreshStats={refreshStats} />} />
            <Route path="/sales" element={<SalesListView isRestricted={isRestricted} />} />
            <Route path="/products" element={isRestricted ? <Navigate to="/pos" replace /> : <ProductsView onRefreshStats={refreshStats} />} />
            <Route path="/stock" element={isRestricted ? <Navigate to="/pos" replace /> : <StockView onRefreshStats={refreshStats} />} />
            <Route path="/expenses" element={isRestricted ? <Navigate to="/pos" replace /> : <ExpensesView onRefreshStats={refreshStats} />} />
            <Route path="/users" element={isRestricted ? <Navigate to="/pos" replace /> : <UsersView />} />
            <Route path="/reports" element={isRestricted ? <Navigate to="/pos" replace /> : <ReportsView />} />
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Routes>
        </main>
      </div>

      {/* CSS Keyframes for custom notifications */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes modalScaleUp {
          from {
            transform: scale(0.9) translateY(20px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Toast notifications overlay */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '360px',
        width: 'calc(100% - 48px)'
      }}>
        {toasts.map((toast) => {
          const typeColors = {
            success: { bg: 'rgba(16, 185, 129, 0.95)', border: '#047857', color: '#ffffff', icon: '✅' },
            error: { bg: 'rgba(244, 63, 94, 0.95)', border: '#be123c', color: '#ffffff', icon: '❌' },
            warning: { bg: 'rgba(245, 158, 11, 0.95)', border: '#b45309', color: '#ffffff', icon: '⚠️' },
            info: { bg: 'rgba(14, 165, 233, 0.95)', border: '#0369a1', color: '#ffffff', icon: 'ℹ️' }
          };
          const colors = typeColors[toast.type] || typeColors.info;
          return (
            <div 
              key={toast.id} 
              style={{
                background: colors.bg,
                borderLeft: `6px solid ${colors.border}`,
                color: colors.color,
                padding: '14px 18px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                animation: 'toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>{colors.icon}</span>
                <span>{toast.message}</span>
              </div>
              <button 
                onClick={() => removeToast(toast.id)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', fontWeight: 'bold', fontSize: '14px', padding: '0 4px', opacity: 0.8 }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation custom dialog modal overlay */}
      {modal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.35)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '420px',
            padding: '30px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            animation: 'modalScaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {modal.title}
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {modal.message}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {modal.type === 'confirm' && (
                <button 
                  className="btn btn-secondary" 
                  style={{ borderRadius: '10px', padding: '8px 16px', fontSize: '13px', fontWeight: 600 }}
                  onClick={() => {
                    if (modal.onCancel) modal.onCancel();
                    closeModal();
                  }}
                >
                  Cancel
                </button>
              )}
              <button 
                className="btn btn-primary" 
                style={{
                  borderRadius: '10px', 
                  padding: '8px 16px', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  backgroundColor: modal.title.toLowerCase().includes('delete') || modal.title.toLowerCase().includes('remove') ? 'var(--color-danger)' : 'var(--color-primary)',
                  borderColor: modal.title.toLowerCase().includes('delete') || modal.title.toLowerCase().includes('remove') ? 'var(--color-danger)' : 'var(--color-primary)',
                  boxShadow: 'none'
                }}
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
                  closeModal();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

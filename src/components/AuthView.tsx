import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import logoImg from '../assets/logo.jpg';

interface AuthViewProps {
  onAuthSuccess: (session: any) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Quick test accounts fallback
    if (email === 'admin@gmail.com' && password === '123') {
      const mockSession = {
        user: {
          id: '84787c16-4295-4b8f-bc8c-49a01fd12d77',
          email: 'admin@gmail.com',
          user_metadata: {
            full_name: 'Rajmahal Admin',
            role: 'admin'
          }
        }
      };
      localStorage.setItem('sb-mock-session', JSON.stringify(mockSession));
      onAuthSuccess(mockSession);
      setLoading(false);
      return;
    }

    if (email === 'cashier@gmail.com' && password === '123') {
      const mockSession = {
        user: {
          id: 'mock-cashier-id-123',
          email: 'cashier@gmail.com',
          user_metadata: {
            full_name: 'Shop Cashier',
            role: 'cashier'
          }
        }
      };
      localStorage.setItem('sb-mock-session', JSON.stringify(mockSession));
      onAuthSuccess(mockSession);
      setLoading(false);
      return;
    }

    if (email === 'sales@gmail.com' && password === '123') {
      const mockSession = {
        user: {
          id: 'mock-sales-exec-id-123',
          email: 'sales@gmail.com',
          user_metadata: {
            full_name: 'Sales Executive Staff',
            role: 'sales_executive'
          }
        }
      };
      localStorage.setItem('sb-mock-session', JSON.stringify(mockSession));
      onAuthSuccess(mockSession);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data.session) {
        onAuthSuccess(data.session);
      }
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Email not confirmed. Please turn off "Confirm email" in Supabase Auth Settings.');
      } else {
        setErrorMsg(err.message || 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#f8fafc',
      background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
      padding: '20px'
    }}>
      <style>{`
        .auth-card {
          width: 100%;
          max-width: 380px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 32px 28px;
          box-shadow: 0 10px 25px -5px rgba(11, 37, 69, 0.08), 0 8px 10px -6px rgba(11, 37, 69, 0.04);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .auth-input:focus {
          border-color: #0b2545 !important;
          box-shadow: 0 0 0 3px rgba(11, 37, 69, 0.12) !important;
        }
        .auth-submit-btn {
          background-color: #0b2545 !important;
          color: #ffffff !important;
          border: none;
          height: 42px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s ease;
          box-shadow: 0 2px 8px rgba(11, 37, 69, 0.25);
        }
        .auth-submit-btn:hover {
          background-color: #06172d !important;
          box-shadow: 0 4px 12px rgba(11, 37, 69, 0.35);
          transform: translateY(-1px);
        }
        .auth-submit-btn:active {
          transform: translateY(0);
        }
      `}</style>

      <div className="auth-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <img 
            src={logoImg} 
            alt="Rajmahal Logo" 
            style={{ 
              width: '68px', 
              height: '68px', 
              objectFit: 'contain', 
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '2px',
              backgroundColor: '#ffffff'
            }} 
          />
          <div>
            <h2 style={{
              fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '2.5px',
              color: '#0b2545',
              textTransform: 'uppercase',
              margin: 0
            }}>
              RAJMAHAL
            </h2>
            <p style={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              color: '#64748b',
              textTransform: 'uppercase',
              margin: '2px 0 0 0'
            }}>
              Elegance — Mens Wear
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#ef4444',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#475569', fontWeight: 600, fontSize: '12px' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="email"
                className="form-control auth-input"
                style={{
                  paddingLeft: '36px',
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
                placeholder="admin@gmail.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#475569', fontWeight: 600, fontSize: '12px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                className="form-control auth-input"
                style={{
                  paddingLeft: '36px',
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  width: '100%',
                  height: '38px',
                  borderRadius: '8px',
                  fontSize: '13px'
                }}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            style={{ marginTop: '4px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : (
              <>
                Sign In <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Minimal Subtle Footer */}
        <div style={{
          textAlign: 'center',
          fontSize: '11px',
          color: '#94a3b8',
          borderTop: '1px solid #f1f5f9',
          paddingTop: '12px',
          marginTop: '2px'
        }}>
          ZenPOS Terminal • Rajmahal Fashion
        </div>
      </div>
    </div>
  );
};

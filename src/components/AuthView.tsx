import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Mail, AlertCircle } from 'lucide-react';
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

    // Local override for dev testing
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
      setErrorMsg(err.message || 'An error occurred during authentication');
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
      backgroundColor: '#f1f5f9',
      background: 'radial-gradient(circle at 10% 20%, rgba(212, 163, 89, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(180, 130, 60, 0.06) 0%, transparent 40%), #f8fafc',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px'
    }}>
      {/* Self-contained CSS for Mobile Responsiveness & Theme styling */}
      <style>{`
        .login-title {
          font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 5px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #d4a359 0%, #b4823c 100%);
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          color: transparent !important;
          display: inline-block;
          margin-bottom: 2px;
        }
        @media (max-width: 480px) {
          .login-card {
            padding: 24px !important;
            border-radius: 16px !important;
            gap: 20px !important;
          }
          .login-logo {
            width: 76px !important;
            height: 76px !important;
          }
          .login-title {
            font-size: 18px !important;
            letter-spacing: 3px !important;
          }
        }
        .login-btn {
          background-color: #d4a359 !important;
          border-color: #d4a359 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(212, 163, 89, 0.35) !important;
          transition: all 0.2s ease-in-out !important;
        }
        .login-btn:hover {
          background-color: #c29247 !important;
          border-color: #c29247 !important;
          box-shadow: 0 6px 20px rgba(212, 163, 89, 0.45) !important;
          transform: translateY(-1px);
        }
        .login-btn:active {
          transform: translateY(0);
        }
        .login-input:focus {
          border-color: #d4a359 !important;
          box-shadow: 0 0 0 3px rgba(212, 163, 89, 0.15) !important;
        }
      `}</style>

      {/* Decorative Background Blur Blobs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '25%',
        width: '300px',
        height: '300px',
        background: 'rgba(212, 163, 89, 0.12)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '25%',
        width: '350px',
        height: '350px',
        background: 'rgba(180, 130, 60, 0.08)',
        filter: 'blur(120px)',
        borderRadius: '50%',
        zIndex: 0
      }} />

      {/* Login Card (Glassmorphic & Responsive) */}
      <div className="card login-card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        borderRadius: '24px',
        zIndex: 1
      }}>
        
        {/* Header Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
            <div style={{
              position: 'absolute',
              inset: '-4px',
              background: 'linear-gradient(135deg, #d4a359, #b4823c)',
              borderRadius: '20px',
              filter: 'blur(8px)',
              opacity: 0.25
            }} />
            <img 
              src={logoImg} 
              alt="ZenPOS Logo" 
              className="login-logo"
              style={{ 
                width: '88px', 
                height: '88px', 
                objectFit: 'contain', 
                borderRadius: '18px',
                border: '3px solid #fff',
                position: 'relative',
                boxShadow: 'var(--shadow-md)'
              }} 
            />
          </div>
          <div>
            <span className="login-title">
              RAJMAHAL
            </span>
          </div>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#ef4444',
            padding: '12px',
            borderRadius: '12px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          <div className="form-group">
            <label className="form-label" style={{ color: '#475569', fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="email"
                className="form-control login-input"
                style={{
                  paddingLeft: '40px',
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                placeholder="owner@clothingstore.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: '#475569', fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="password"
                className="form-control login-input"
                style={{
                  paddingLeft: '40px',
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#1e293b',
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  transition: 'all 0.2s'
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
            className="btn btn-primary login-btn"
            style={{ 
              width: '100%', 
              padding: '14px', 
              marginTop: '8px', 
              fontSize: '15px', 
              fontWeight: 700,
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(212, 163, 89, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            disabled={loading}
          >
            {loading ? 'Verifying account...' : 'Sign In to Terminal'}
          </button>
        </form>

        {/* Developer Footer */}
        <div style={{ 
          borderTop: '1px solid #e2e8f0', 
          paddingTop: '20px', 
          marginTop: '4px', 
          textAlign: 'center', 
          fontSize: '11px', 
          color: '#64748b',
          lineHeight: '1.6'
        }}>
          <div style={{ 
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800, 
            color: '#b4823c', 
            letterSpacing: '2px', 
            fontSize: '12px',
            marginBottom: '6px' 
          }}>
            ZenPOS V1
          </div>
          Developed By: <span style={{ fontWeight: 600, color: '#334155' }}>MD Arif Uddin</span>
          <br />
          Contact:{' '}
          <a 
            href="https://wa.me/8801825334505" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: '#b4823c', 
              fontWeight: 700, 
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            💬 01825334505
          </a>
        </div>

      </div>
    </div>
  );
};

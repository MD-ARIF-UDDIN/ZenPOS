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
      backgroundColor: '#0a0d16',
      background: 'radial-gradient(circle at 10% 20%, rgba(212, 175, 55, 0.15) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(191, 149, 63, 0.1) 0%, transparent 45%), #0a0d16',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px'
    }}>
      {/* Self-contained CSS for Mobile Responsiveness & Gold Theme overrides */}
      <style>{`
        .login-card .form-control:focus {
          border-color: rgba(212, 175, 55, 0.8) !important;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.18) !important;
          outline: none !important;
        }
        .login-btn {
          transition: all 0.25s ease !important;
        }
        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4) !important;
          opacity: 0.95;
        }
        .login-btn:active {
          transform: translateY(0);
        }
        @media (max-width: 480px) {
          .login-card {
            padding: 28px 24px !important;
            border-radius: 20px !important;
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
      `}</style>

      {/* Decorative Background Blur Blobs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '20%',
        width: '320px',
        height: '320px',
        background: 'rgba(212, 175, 55, 0.14)',
        filter: 'blur(100px)',
        borderRadius: '50%',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '20%',
        width: '380px',
        height: '380px',
        background: 'rgba(191, 149, 63, 0.08)',
        filter: 'blur(120px)',
        borderRadius: '50%',
        zIndex: 0
      }} />

      {/* Login Card (Glassmorphic & Responsive) */}
      <div className="card login-card" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '40px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(212, 175, 55, 0.22)',
        boxShadow: '0 20px 50px -15px rgba(0, 0, 0, 0.5), 0 0 40px rgba(212, 175, 55, 0.06)',
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
              inset: '-6px',
              background: 'linear-gradient(135deg, #d4af37, #aa771c)',
              borderRadius: '20px',
              filter: 'blur(10px)',
              opacity: 0.35
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
                border: '3px solid rgba(212, 175, 55, 0.35)',
                position: 'relative',
                boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
              }} 
            />
          </div>
          <div>
            <span className="login-title" style={{ 
              fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
              fontSize: '24px', 
              fontWeight: 900, 
              letterSpacing: '5px', 
              textTransform: 'uppercase', 
              background: 'linear-gradient(135deg, #bf953f 0%, #fcf6ba 25%, #b38728 50%, #fbf5b7 75%, #aa771c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
              marginBottom: '2px'
            }}>
              RAJMAHAL
            </span>
            <div style={{ 
              fontSize: '13px', 
              fontWeight: 600, 
              color: '#d4af37', 
              marginTop: '4px',
              fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
              letterSpacing: '0.8px'
            }}>
              Owner: Sakib Hasan
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
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
            <label className="form-label" style={{ color: '#94a3b8', fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Email Address *</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(212, 175, 55, 0.6)' }} />
              <input
                type="email"
                className="form-control"
                style={{
                  paddingLeft: '40px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  borderColor: 'rgba(212, 175, 55, 0.2)',
                  color: '#f8fafc',
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
            <label className="form-label" style={{ color: '#94a3b8', fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(212, 175, 55, 0.6)' }} />
              <input
                type="password"
                className="form-control"
                style={{
                  paddingLeft: '40px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  borderColor: 'rgba(212, 175, 55, 0.2)',
                  color: '#f8fafc',
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
              background: 'linear-gradient(135deg, #d4af37 0%, #b38728 50%, #aa771c 100%)',
              borderColor: '#b38728',
              color: '#ffffff',
              boxShadow: '0 4px 16px rgba(170, 119, 28, 0.35)',
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
          borderTop: '1px solid rgba(212, 175, 55, 0.15)', 
          paddingTop: '20px', 
          marginTop: '4px', 
          textAlign: 'center', 
          fontSize: '11px', 
          color: '#94a3b8',
          lineHeight: '1.6'
        }}>
          <div style={{ 
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800, 
            color: '#d4af37', 
            letterSpacing: '2px', 
            fontSize: '12px',
            marginBottom: '6px' 
          }}>
            ZenPOS V1
          </div>
          Developed By: <span style={{ fontWeight: 600, color: '#f8fafc' }}>MD Arif Uddin</span>
          <br />
          Contact:{' '}
          <a 
            href="https://wa.me/8801825334505" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: '#d4af37', 
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

import React from 'react';
import { Sprout, Search, Home } from 'lucide-react';

interface NotFoundProps {
  onNavigateHome: () => void;
  onOpenCommandMenu: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigateHome, onOpenCommandMenu }) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      background: '#080C05',
      color: '#FFFFFF',
      textAlign: 'center',
      position: 'relative'
    }}>
      <div className="dynamic-bg" aria-hidden="true"></div>
      <div className="dynamic-overlay" aria-hidden="true"></div>

      <div className="glass-card" style={{ maxWidth: '580px', width: '100%', padding: 'clamp(32px, 6vw, 56px)', position: 'relative', zIndex: 10 }}>
        <div style={{
          width: '72px',
          height: '72px',
          background: 'rgba(200, 232, 55, 0.12)',
          border: '1px solid rgba(200, 232, 55, 0.3)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto'
        }}>
          <Sprout style={{ width: '36px', height: '36px', color: 'var(--nukrop-accent)' }} />
        </div>

        <span style={{ fontSize: '13px', color: 'var(--nukrop-accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
          ERROR 404
        </span>

        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, marginBottom: '14px', lineHeight: 1.2 }}>
          Agricultural Parcel Not Found
        </h1>

        <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '15px', lineHeight: 1.6, marginBottom: '32px' }}>
          The path you entered does not exist or may have been re-plowed. Use our quick actions search or return to the main dashboard.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onNavigateHome}
            className="nukrop-btn"
            style={{ padding: '12px 24px', fontSize: '14px' }}
          >
            <Home style={{ width: '16px', height: '16px' }} />
            <span>Return to NuKropAI Home</span>
          </button>

          <button
            onClick={onOpenCommandMenu}
            className="nukrop-btn nukrop-btn-secondary"
            style={{ padding: '12px 20px', fontSize: '14px' }}
          >
            <Search style={{ width: '16px', height: '16px' }} />
            <span>Search Actions (Ctrl+K)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

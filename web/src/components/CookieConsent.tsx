import React, { useState, useEffect } from 'react';
import { Cookie, Check } from 'lucide-react';

interface CookieConsentProps {
  onOpenPolicy: () => void;
}

export const CookieConsent: React.FC<CookieConsentProps> = ({ onOpenPolicy }) => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nk_consent');
    if (!saved) {
      // Delay display slightly to prevent abrupt layout shift on initial load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  // Listen for reopen requests from the footer
  useEffect(() => {
    const handleReopen = () => {
      setVisible(true);
      setShowDetails(true);
    };
    window.addEventListener('open-cookie-preferences', handleReopen);
    return () => window.removeEventListener('open-cookie-preferences', handleReopen);
  }, []);

  const handleChoice = (level: 'essential' | 'all') => {
    localStorage.setItem('nk_consent', JSON.stringify({
      level,
      timestamp: new Date().toISOString()
    }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div 
      className="cookie-consent-bar"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{
          padding: '6px',
          background: 'rgba(200, 232, 55, 0.15)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Cookie style={{ width: '18px', height: '18px', color: 'var(--nukrop-accent)' }} />
        </div>
        <h3 id="cookie-consent-title" style={{ fontSize: '15.5px', color: '#FFFFFF', fontWeight: 700 }}>
          Privacy &amp; Data Storage
        </h3>
      </div>

      <p id="cookie-consent-desc" style={{ fontSize: '13px', color: 'var(--nukrop-text-dim)', lineHeight: 1.5, marginBottom: '14px' }}>
        NuKropAI uses minimal local browser storage to keep you logged in, preserve your vernacular language dialect, and cache offline Mandi prices. We never use third-party tracking or advertising cookies.
      </p>

      {showDetails && (
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '12px',
          color: 'var(--nukrop-text-dim)',
          marginBottom: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFFFFF' }}>
            <Check style={{ width: '14px', height: '14px', color: '#22C55E' }} />
            <span><strong>Essential Storage:</strong> Authentication tokens &amp; consent preference</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFFFFF' }}>
            <Check style={{ width: '14px', height: '14px', color: '#22C55E' }} />
            <span><strong>Agronomic Cache:</strong> Vernacular language &amp; last queried APMC market</span>
          </div>
          <button
            onClick={onOpenPolicy}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--nukrop-accent)',
              fontSize: '11.5px',
              textAlign: 'left',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            Read detailed storage key specifications →
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handleChoice('all')}
          className="nukrop-btn"
          style={{ flex: 1, padding: '8px 16px', fontSize: '12.5px', borderRadius: '10px' }}
        >
          Accept All
        </button>

        <button
          onClick={() => handleChoice('essential')}
          className="nukrop-btn nukrop-btn-secondary"
          style={{ flex: 1, padding: '8px 14px', fontSize: '12.5px', borderRadius: '10px' }}
        >
          Essential Only
        </button>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="touch-target"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--nukrop-text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '4px 8px',
            textDecoration: 'underline'
          }}
        >
          {showDetails ? 'Hide Details' : 'Preferences'}
        </button>
      </div>
    </div>
  );
};

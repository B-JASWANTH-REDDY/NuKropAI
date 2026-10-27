import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, FileText, Cookie, AlertCircle } from 'lucide-react';

export type LegalTab = 'privacy' | 'terms' | 'cookies';

interface LegalModalProps {
  isOpen: boolean;
  activeTab: LegalTab;
  onClose: () => void;
  onSelectTab: (tab: LegalTab) => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  activeTab,
  onClose,
  onSelectTab
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="cmd-menu-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div
        ref={modalRef}
        className="glass-card"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(10, 15, 6, 0.98)',
          border: '1px solid rgba(200, 232, 55, 0.3)',
          borderRadius: '20px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header & Tabs */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onSelectTab('privacy')}
              className="touch-target"
              style={{
                background: activeTab === 'privacy' ? 'rgba(200, 232, 55, 0.15)' : 'transparent',
                border: `1px solid ${activeTab === 'privacy' ? 'rgba(200, 232, 55, 0.35)' : 'transparent'}`,
                color: activeTab === 'privacy' ? 'var(--nukrop-accent)' : 'var(--nukrop-text-dim)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck style={{ width: '15px', height: '15px' }} />
              Privacy Policy
            </button>

            <button
              onClick={() => onSelectTab('terms')}
              className="touch-target"
              style={{
                background: activeTab === 'terms' ? 'rgba(200, 232, 55, 0.15)' : 'transparent',
                border: `1px solid ${activeTab === 'terms' ? 'rgba(200, 232, 55, 0.35)' : 'transparent'}`,
                color: activeTab === 'terms' ? 'var(--nukrop-accent)' : 'var(--nukrop-text-dim)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText style={{ width: '15px', height: '15px' }} />
              Terms of Service
            </button>

            <button
              onClick={() => onSelectTab('cookies')}
              className="touch-target"
              style={{
                background: activeTab === 'cookies' ? 'rgba(200, 232, 55, 0.15)' : 'transparent',
                border: `1px solid ${activeTab === 'cookies' ? 'rgba(200, 232, 55, 0.35)' : 'transparent'}`,
                color: activeTab === 'cookies' ? 'var(--nukrop-accent)' : 'var(--nukrop-text-dim)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Cookie style={{ width: '15px', height: '15px' }} />
              Cookie &amp; Storage
            </button>
          </div>

          <button
            onClick={onClose}
            className="touch-target"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--nukrop-text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px'
            }}
            aria-label="Close legal information dialog"
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{
          padding: '28px',
          overflowY: 'auto',
          lineHeight: 1.7,
          fontSize: '14.5px',
          color: 'var(--nukrop-text-dim)'
        }}>
          {activeTab === 'privacy' && (
            <div>
              <h2 id="legal-modal-title" style={{ fontSize: '24px', color: '#FFFFFF', marginBottom: '16px' }}>
                NuKropAI Privacy Policy
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--nukrop-accent)', marginBottom: '20px' }}>
                Effective Date: October 2026 · Aligned with India Digital Personal Data Protection Act (DPDP Act 2023)
              </p>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                1. Sovereign Data Minimization Principle
              </h3>
              <p>
                NuKropAI is built to protect the autonomy and privacy of Indian agricultural producers. We only collect data strictly necessary to deliver agronomic diagnosis and fair market rates. We never sell, lease, or monetize your agricultural photos, land records, or personal telemetry to commercial third parties, ad networks, or predatory commodity traders.
              </p>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                2. Information We Process
              </h3>
              <ul style={{ paddingLeft: '20px' }}>
                <li><strong>Crop Foliar Images:</strong> Photographs submitted to the Disease Scanner are processed on-device (via embedded offline neural weights) or via our protected AI inference endpoint. Images are analyzed solely to detect pathogens and calculate ICAR chemical and organic spray recipes.</li>
                <li><strong>Hyperlocal Geographic Coordinates:</strong> If enabled, GPS coordinates are used exclusively to query the nearest Government of India Agmarknet APMC yard and provide micro-climate radar alerts. Coordinates are never tracked continuously in the background.</li>
                <li><strong>Account Credentials &amp; Profiles:</strong> If you create a verified farmer account via Supabase Auth, your email, phone number, and encrypted session tokens are maintained securely with Row Level Security (RLS) enforcement.</li>
              </ul>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                3. Your Rights under the DPDP Act 2023
              </h3>
              <p>
                As a data principal under Indian law, you hold the right to:
              </p>
              <ul style={{ paddingLeft: '20px' }}>
                <li>Access a summary of your personal data and processing activities.</li>
                <li>Request rectification of inaccurate crop or profile records.</li>
                <li>Request permanent erasure of your account and diagnostic history.</li>
                <li>Nominate an individual to exercise rights in event of death or incapacity.</li>
              </ul>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                4. Data Protection &amp; Grievance Redressal
              </h3>
              <p>
                For questions regarding data handling or to submit an erasure request, contact the NuKropAI Sovereign Engineering Team:
                <br />
                <strong>Lead Architect &amp; Maintainer:</strong> B. Jaswanth Reddy
                <br />
                <strong>Email:</strong> grievance@nukrop.ai (Owner configuration placeholder)
                <br />
                <strong>Repository:</strong> https://github.com/B-JASWANTH-REDDY/NuKropAI
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h2 id="legal-modal-title" style={{ fontSize: '24px', color: '#FFFFFF', marginBottom: '16px' }}>
                NuKropAI Terms of Service
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--nukrop-accent)', marginBottom: '20px' }}>
                Effective Date: October 2026 · Agricultural Operating System Terms
              </p>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                1. Agronomic Advisory Disclaimer
              </h3>
              <p>
                NuKropAI provides automated foliar disease identification, dosage calculations, and weather advisories based on models calibrated against public datasets from the Indian Council of Agricultural Research (ICAR). These advisories are intended for informational guidance. Field conditions vary significantly; farmers are advised to cross-reference recommendations with certified local Krishi Vigyan Kendra (KVK) agronomists before applying potent agrochemicals.
              </p>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                2. Market Price Attribution (Agmarknet APMC)
              </h3>
              <p>
                Mandi rates displayed on the web dashboard and mobile app are ingested directly from Government of India public trading records (Directorate of Marketing &amp; Inspection / Agmarknet). NuKropAI does not fix, broker, or guarantee settlement prices at physical APMC yards. Physical quality grades, moisture content, and auction dynamics dictate actual transaction values.
              </p>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                3. Non-Commercial &amp; Free Sovereign Software
              </h3>
              <p>
                NuKropAI is provided 100% free of charge for Indian smallholders and agricultural communities. There are zero subscriptions, paywalls, or hidden transaction fees.
              </p>

              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(200, 232, 55, 0.08)',
                border: '1px solid rgba(200, 232, 55, 0.25)',
                borderRadius: '12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}>
                <AlertCircle style={{ color: 'var(--nukrop-accent)', width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '13px' }}>
                  <strong style={{ color: '#FFFFFF', display: 'block', marginBottom: '4px' }}>Notice on Refund Policy</strong>
                  Because NuKropAI is a completely free public agricultural tool and does not process payments, commercial subscriptions, or sales of goods, a monetary refund policy is not applicable.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cookies' && (
            <div>
              <h2 id="legal-modal-title" style={{ fontSize: '24px', color: '#FFFFFF', marginBottom: '16px' }}>
                Cookie &amp; Local Storage Policy
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--nukrop-accent)', marginBottom: '20px' }}>
                Transparent Storage Disclosures
              </p>

              <p>
                NuKropAI uses modern browser storage (Local Storage and Session Storage) exclusively to provide core application features. We do not use third-party tracking cookies or behavioral marketing beacons.
              </p>

              <h3 style={{ color: '#FFFFFF', fontSize: '17px', marginTop: '20px', marginBottom: '8px' }}>
                Storage Keys &amp; Purposes
              </h3>
              <div style={{ overflowX: 'auto', marginTop: '12px', marginBottom: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }}>
                      <th style={{ padding: '8px 12px' }}>Storage Key</th>
                      <th style={{ padding: '8px 12px' }}>Type</th>
                      <th style={{ padding: '8px 12px' }}>Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--nukrop-accent)' }}>nk_consent</td>
                      <td style={{ padding: '8px 12px' }}>Essential</td>
                      <td style={{ padding: '8px 12px' }}>Remembers your cookie &amp; telemetry consent choices</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--nukrop-accent)' }}>nk_token</td>
                      <td style={{ padding: '8px 12px' }}>Essential</td>
                      <td style={{ padding: '8px 12px' }}>Maintains secure authenticated session token</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--nukrop-accent)' }}>nk_lang</td>
                      <td style={{ padding: '8px 12px' }}>Functional</td>
                      <td style={{ padding: '8px 12px' }}>Stores your selected vernacular language dialect</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--nukrop-accent)' }}>nk_mandi_cache</td>
                      <td style={{ padding: '8px 12px' }}>Functional</td>
                      <td style={{ padding: '8px 12px' }}>Caches last verified APMC rate queries for fast offline rendering</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '13px' }}>
                You may clear these keys at any time via your browser settings or by resetting preferences using our Cookie Settings button in the footer.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(5, 8, 3, 0.9)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            className="nukrop-btn"
            style={{ padding: '8px 24px', fontSize: '13.5px', borderRadius: '10px' }}
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};

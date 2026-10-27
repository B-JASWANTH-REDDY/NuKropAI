import React from 'react';
import { ShieldCheck, FileText, Cookie, AlertCircle, ArrowLeft, Download, Sprout } from 'lucide-react';

interface LegalPageProps {
  page: 'privacy' | 'terms' | 'cookies' | 'refund';
  onNavigateHome: () => void;
  onOpenOtherLegal: (page: 'privacy' | 'terms' | 'cookies' | 'refund') => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ page, onNavigateHome, onOpenOtherLegal }) => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#080C05', color: '#F8FAFC' }}>
      {/* Header */}
      <header className="safe-area-top" style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(14, 20, 8, 0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <button
            onClick={onNavigateHome}
            className="touch-target"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#FFFFFF',
              borderRadius: '10px',
              padding: '8px 16px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            aria-label="Return to NuKropAI Homepage"
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            <span>Back to Home</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sprout style={{ color: 'var(--nukrop-accent)', width: '20px', height: '20px' }} />
            <span style={{ fontSize: '18px', fontFamily: 'Outfit', fontWeight: 800 }}>
              NuKrop<span style={{ color: 'var(--nukrop-accent)' }}>AI</span> Legal
            </span>
          </div>

          <a
            href="/NuKropAI.apk"
            download="NuKropAI.apk"
            className="nukrop-btn"
            style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '100px' }}
          >
            <Download style={{ width: '14px', height: '14px' }} />
            <span>Get App</span>
          </a>
        </div>
      </header>

      {/* Main Legal Content Container */}
      <main style={{ flex: 1, padding: '48px 20px', maxWidth: '920px', width: '100%', margin: '0 auto', lineHeight: 1.75 }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {[
            { id: 'privacy', label: 'Privacy Policy', icon: <ShieldCheck style={{ width: '15px', height: '15px' }} /> },
            { id: 'terms', label: 'Terms of Service', icon: <FileText style={{ width: '15px', height: '15px' }} /> },
            { id: 'cookies', label: 'Cookie & Storage', icon: <Cookie style={{ width: '15px', height: '15px' }} /> },
            { id: 'refund', label: 'Refund Policy', icon: <AlertCircle style={{ width: '15px', height: '15px' }} /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onOpenOtherLegal(tab.id as any)}
              className="touch-target"
              style={{
                background: page === tab.id ? 'rgba(200, 232, 55, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${page === tab.id ? 'rgba(200, 232, 55, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                color: page === tab.id ? 'var(--nukrop-accent)' : 'var(--nukrop-text-dim)',
                padding: '8px 18px',
                borderRadius: '10px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 1. PRIVACY POLICY */}
        {page === 'privacy' && (
          <article className="glass-card" style={{ padding: 'clamp(24px, 5vw, 44px)' }}>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: '#FFFFFF', marginBottom: '12px' }}>
              Privacy Policy
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--nukrop-accent)', marginBottom: '28px', fontWeight: 600 }}>
              Compliance: Digital Personal Data Protection Act (DPDP Act 2023, India) · Effective October 2026
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              1. Sovereign Data Minimization Principle
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              NuKropAI is an independent, non-commercial agrarian intelligence operating system developed to eliminate agricultural exploitation. We adhere strictly to the principle of purpose specification and data minimization: we collect only data that is technically essential to compute foliar diagnoses and deliver unmanipulated APMC market prices.
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              2. Data We Process &amp; How It Is Used
            </h2>
            <ul style={{ color: 'var(--nukrop-text-dim)', paddingLeft: '20px' }}>
              <li><strong>Crop Foliar Images:</strong> Photos uploaded to the Disease Scanner are processed via our secure inference engine or offline on-device neural weights to detect pathogens. Images are never used to train commercial advertising models or sold to chemical conglomerates.</li>
              <li><strong>Approximate Location:</strong> Queried on-demand only to identify the nearest APMC Mandi yard and supply local precipitation alerts. Continuous background GPS tracking is strictly forbidden.</li>
              <li><strong>Authentication Data:</strong> When farmers register an account via Supabase Auth, credentials (mobile number or email) are stored with cryptographic bcrypt hashing and Row-Level Security (RLS) policies.</li>
            </ul>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              3. Third-Party Embeds &amp; Tracking Audits
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              NuKropAI contains <strong>zero third-party behavioral trackers</strong>, zero Facebook Pixel tags, and zero commercial ad-network SDKs. Data requests are directed exclusively to:
            </p>
            <ul style={{ color: 'var(--nukrop-text-dim)', paddingLeft: '20px' }}>
              <li><strong>Ministry of Agriculture &amp; Farmers Welfare (data.gov.in):</strong> Public Agmarknet daily price journals.</li>
              <li><strong>Supabase Cloud:</strong> Encrypted PostgreSQL persistence hosted with Row-Level Security.</li>
            </ul>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              4. Data Principal Rights Under DPDP Act 2023
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              You retain sovereign rights to access, review, correct, or permanently delete your crop diagnostic history and account records. To exercise any data right, use the Contact &amp; Grievance Desk or email our Data Protection Officer below.
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              5. Operator &amp; Grievance Redressal Officer
            </h2>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--nukrop-text)' }}>
              <strong>Project:</strong> NuKropAI Sovereign Open Source Agrarian Intelligence Initiative<br />
              <strong>Lead Architect:</strong> B. Jaswanth Reddy<br />
              <strong>Jurisdiction:</strong> Republic of India<br />
              <strong>Grievance Email:</strong> <code style={{ color: 'var(--nukrop-accent)' }}>grievance@nukrop.ai</code><br />
              <strong>GitHub:</strong> https://github.com/B-JASWANTH-REDDY/NuKropAI
            </div>
          </article>
        )}

        {/* 2. TERMS OF SERVICE */}
        {page === 'terms' && (
          <article className="glass-card" style={{ padding: 'clamp(24px, 5vw, 44px)' }}>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: '#FFFFFF', marginBottom: '12px' }}>
              Terms of Service
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--nukrop-accent)', marginBottom: '28px', fontWeight: 600 }}>
              Agricultural Operating System Agreement · Effective October 2026
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              1. Non-Commercial Sovereign Utility
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              NuKropAI is provided completely free of charge to Indian farmers, agricultural extension workers, and rural communities. We do not charge software license fees, brokerage cuts, or subscription dues.
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              2. Agronomic &amp; Chemical Advisory Disclaimer
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              Pathology diagnoses and tank mixing dosages are generated using machine learning models calibrated against public datasets from the Indian Council of Agricultural Research (ICAR). While these models achieve high diagnostic accuracy, field microclimates, soil moisture, and crop variety affect efficacy. Farmers must exercise prudence and consult local Krishi Vigyan Kendra (KVK) agronomy officers before spraying toxic agrochemicals.
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              3. Mandi Price Provenance &amp; Volatility
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              All APMC mandi quotes are synchronized from official Government of India daily trade records (DMI / Agmarknet). NuKropAI acts strictly as an informational relay. We do not broker trades or guarantee that physical APMC auction bids will match quoted modal prices. Physical grade, moisture percentage, and arrival volume dictate physical market settlements.
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              4. Image Copyright &amp; Attribution
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              Agricultural reference images and diagnostic symptom catalogs are derived from public domain research publications of ICAR, IARI, and PJTSAU, or CC-BY licensed agronomy documentation. All trademarks belong to their respective government entities.
            </p>
          </article>
        )}

        {/* 3. COOKIES & LOCAL STORAGE POLICY */}
        {page === 'cookies' && (
          <article className="glass-card" style={{ padding: 'clamp(24px, 5vw, 44px)' }}>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: '#FFFFFF', marginBottom: '12px' }}>
              Cookie &amp; Local Storage Policy
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--nukrop-accent)', marginBottom: '28px', fontWeight: 600 }}>
              Transparent Browser Storage Audit · Zero Third-Party Advertising Cookies
            </p>

            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              NuKropAI uses client-side Web Storage (Local Storage) strictly for functional state management. We do not set third-party cross-site advertising cookies.
            </p>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              Active Storage Inventory
            </h2>
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', color: '#FFFFFF' }}>
                    <th style={{ padding: '10px' }}>Key</th>
                    <th style={{ padding: '10px' }}>Type</th>
                    <th style={{ padding: '10px' }}>Duration</th>
                    <th style={{ padding: '10px' }}>Purpose</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'var(--nukrop-text-dim)' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px', color: 'var(--nukrop-accent)', fontFamily: 'monospace' }}>nk_consent</td>
                    <td style={{ padding: '10px' }}>Essential</td>
                    <td style={{ padding: '10px' }}>Persistent</td>
                    <td style={{ padding: '10px' }}>Remembers your cookie &amp; telemetry consent level</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px', color: 'var(--nukrop-accent)', fontFamily: 'monospace' }}>nk_token</td>
                    <td style={{ padding: '10px' }}>Essential</td>
                    <td style={{ padding: '10px' }}>Session / Refresh</td>
                    <td style={{ padding: '10px' }}>Maintains authenticated session if farmer logs into account</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px', color: 'var(--nukrop-accent)', fontFamily: 'monospace' }}>nk_lang</td>
                    <td style={{ padding: '10px' }}>Functional</td>
                    <td style={{ padding: '10px' }}>Persistent</td>
                    <td style={{ padding: '10px' }}>Remembers vernacular language (Telugu, Hindi, Tamil, etc.)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px', color: 'var(--nukrop-accent)', fontFamily: 'monospace' }}>nk_mandi_*</td>
                    <td style={{ padding: '10px' }}>Functional</td>
                    <td style={{ padding: '10px' }}>Persistent</td>
                    <td style={{ padding: '10px' }}>Caches verified Agmarknet APMC rates for instant offline rendering</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px' }}>
              You may wipe these records anytime via browser settings or by resetting preferences using our footer cookie controls.
            </p>
          </article>
        )}

        {/* 4. REFUND POLICY */}
        {page === 'refund' && (
          <article className="glass-card" style={{ padding: 'clamp(24px, 5vw, 44px)' }}>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: '#FFFFFF', marginBottom: '12px' }}>
              Refund Policy Notice
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--nukrop-accent)', marginBottom: '28px', fontWeight: 600 }}>
              Notice Regarding Monetary Refunds &amp; Free Public Service
            </p>

            <div style={{
              padding: '20px',
              background: 'rgba(200, 232, 55, 0.08)',
              border: '1px solid rgba(200, 232, 55, 0.25)',
              borderRadius: '14px',
              marginBottom: '24px',
              display: 'flex',
              gap: '14px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle style={{ color: 'var(--nukrop-accent)', width: '24px', height: '24px', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#FFFFFF', fontSize: '16px', display: 'block', marginBottom: '6px' }}>
                  NuKropAI Is 100% Free For Indian Smallholders
                </strong>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
                  Because NuKropAI does not sell commercial software subscriptions, digital credits, hardware devices, or physical agricultural produce, <strong>a monetary refund policy is not applicable</strong>. We do not accept or process consumer payments.
                </p>
              </div>
            </div>

            <h2 style={{ fontSize: '20px', color: '#FFFFFF', marginTop: '24px', marginBottom: '10px' }}>
              Consumer Fraud Advisory
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)' }}>
              NuKropAI will never solicit payments, UPI transfers, OTPs, or bank account credentials for disease diagnoses or Mandi rates. If any intermediary or unauthorized website demands payment claiming to represent NuKropAI, report it immediately to our Grievance Desk at <code style={{ color: 'var(--nukrop-accent)' }}>grievance@nukrop.ai</code>.
            </p>
          </article>
        )}

      </main>
    </div>
  );
};

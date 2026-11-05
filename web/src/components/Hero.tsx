import { Smartphone, Download, Activity } from 'lucide-react';

export default function Hero() {
  return (
    <section style={{ 
      minHeight: '80vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div className="site-container" style={{ textAlign: 'center', maxWidth: '850px' }}>
        <div style={{ display: 'inline-flex', padding: '6px 16px', background: 'rgba(200, 232, 55, 0.08)', border: '1px solid rgba(200, 232, 55, 0.25)', borderRadius: '100px', marginBottom: '24px' }}>
          <span className="live-pulse"></span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.04em', color: 'var(--nukrop-accent)', marginLeft: '8px' }}>
            NuKropAI v2.0 IS LIVE
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(32px, 5.5vw, 64px)', lineHeight: 1.15, marginBottom: '20px', color: '#FFFFFF' }}>
          Agrarian Intelligence, <br/>
          <span style={{ 
            background: 'linear-gradient(135deg, var(--nukrop-accent) 0%, #D4F040 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Now in your pocket.
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(15px, 2vw, 19px)', color: 'var(--nukrop-text-dim)', maxWidth: '680px', margin: '0 auto 36px', lineHeight: 1.6 }}>
          A complete operating system engineered to eliminate crop loss, optimize fertilizer dosages, and secure fair APMC market pricing through edge AI and live government data.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/NuKropAI_preview_debug.apk" download="NuKropAI_preview_debug.apk" className="nukrop-btn" style={{ padding: '14px 28px', fontSize: '15px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(202, 138, 4, 0.45) 100%)', border: '1px solid rgba(234, 179, 8, 0.6)' }}>
            <Download style={{ width: '18px', height: '18px' }} />
            <span>Download Preview APK (Debug-Signed)</span>
          </a>
          <a href="#tools" className="nukrop-btn nukrop-btn-secondary" style={{ padding: '14px 24px', fontSize: '15px', borderRadius: '12px' }}>
            <Activity style={{ width: '18px', height: '18px' }} />
            <span>Test Web Tools</span>
          </a>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#EAB308', fontSize: '12px', fontWeight: 600 }}>
          <span>⚠️ DEBUG SIGNED / NOT FOR PRODUCTION — Internal Preview Testing Only</span>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--nukrop-text-muted)', fontSize: '12px' }}>
          <Smartphone style={{ width: '14px', height: '14px' }} />
          <span>Android 7.0+ · Preview Sideload · Production Signing Pending</span>
        </div>
      </div>
    </section>
  );
}

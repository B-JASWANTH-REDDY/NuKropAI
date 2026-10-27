import { useState, useEffect } from 'react';
import { 
  Sprout, 
  Smartphone, 
  AlertTriangle, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  ScanLine, 
  TrendingUp, 
  Landmark, 
  CloudRain, 
  Layers, 
  Globe, 
  MessageCircle, 
  Download, 
  Menu, 
  X, 
  Radio,
  Search,
  FileText,
  Cookie,
  SlidersHorizontal,
  AlertCircle
} from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast';
import { CommandMenu } from './components/CommandMenu';
import { LegalModal, LegalTab } from './components/LegalModal';
import { LegalPage } from './components/LegalPages';
import { NotFound } from './components/NotFound';
import { CookieConsent } from './components/CookieConsent';
import { ContactForm } from './components/ContactForm';
import { analytics } from './utils/analytics';

function AppContent() {
  const { showToast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Client Routing State
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname.toLowerCase());

  // Command Menu & Legal Modal States
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [activeLegalTab, setActiveLegalTab] = useState<LegalTab>('privacy');

  // Sync with browser history popstate
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname.toLowerCase());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path.toLowerCase());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Scroll Progress Tracker
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (windowHeight > 0) {
        setScrollProgress((totalScroll / windowHeight) * 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Custom Event Listener to open command menu
  useEffect(() => {
    const handleOpenCmd = () => setCommandMenuOpen(true);
    window.addEventListener('open-nukrop-command-menu', handleOpenCmd);
    return () => window.removeEventListener('open-nukrop-command-menu', handleOpenCmd);
  }, []);

  const openLegal = (tab: LegalTab) => {
    setActiveLegalTab(tab);
    setLegalModalOpen(true);
  };

  // Dedicated Route Handlers
  if (currentPath === '/privacy' || currentPath === '/privacy.html') {
    return <LegalPage page="privacy" onNavigateHome={() => navigate('/')} onOpenOtherLegal={(p) => navigate('/' + p)} />;
  }
  if (currentPath === '/terms' || currentPath === '/terms.html') {
    return <LegalPage page="terms" onNavigateHome={() => navigate('/')} onOpenOtherLegal={(p) => navigate('/' + p)} />;
  }
  if (currentPath === '/cookies' || currentPath === '/cookies.html') {
    return <LegalPage page="cookies" onNavigateHome={() => navigate('/')} onOpenOtherLegal={(p) => navigate('/' + p)} />;
  }
  if (currentPath === '/refund' || currentPath === '/refund.html') {
    return <LegalPage page="refund" onNavigateHome={() => navigate('/')} onOpenOtherLegal={(p) => navigate('/' + p)} />;
  }
  if (currentPath !== '/' && !currentPath.startsWith('/#') && !currentPath.startsWith('/index.html')) {
    return <NotFound onNavigateHome={() => navigate('/')} onOpenCommandMenu={() => setCommandMenuOpen(true)} />;
  }

  const faqs = [
    {
      q: 'How do I install the NuKropAI APK on my Android smartphone?',
      a: 'Tap the "Download NuKropAI App" button to download the official release APK file (~52 MB). When downloaded, tap the file in your notification panel or Downloads folder, and enable "Install from Unknown Sources" if prompted. NuKropAI is 100% virus-free, telemetry-secured, and ad-free.'
    },
    {
      q: 'Does the AI Disease Scanner work offline in remote fields without 4G/5G?',
      a: 'Yes! NuKropAI contains an embedded offline neural model that diagnoses over 120 common Indian crop pathologies locally on your phone without requiring an active internet connection. When you reconnect to data, it auto-syncs with the cloud.'
    },
    {
      q: 'How are live Mandi rates sourced and verified?',
      a: 'Rates are fetched directly from the Government of India Ministry of Agriculture (Agmarknet / DMI) APMC daily trading journals. Our twice-daily automated data pipeline validates price ranges, arrival timestamps, and market identity before persisting records to Supabase.'
    },
    {
      q: 'What languages are supported for voice consultation?',
      a: 'NuKropAI Vernacular VoiceOS natively supports Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia, and Indian English with specialized agricultural terminology recognition.'
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* ── TOP SCROLL PROGRESS ANIMATION BAR ── */}
      <div className="scroll-progress-container" aria-hidden="true">
        <div 
          className="scroll-progress-bar" 
          style={{ width: `${scrollProgress}%` }}
        ></div>
      </div>

      {/* Background Layers */}
      <div className="dynamic-bg" aria-hidden="true"></div>
      <div className="dynamic-overlay" aria-hidden="true"></div>
      
      {/* ── FLOATING LUXURY PILL NAVBAR ── */}
      <header className="site-header safe-area-top">
        <div className="nav-pill-wrapper">
          
          {/* Logo */}
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="nav-brand" aria-label="NuKropAI Homepage">
            <div style={{ 
              padding: '6px', 
              background: 'linear-gradient(135deg, rgba(200, 232, 55, 0.2) 0%, rgba(34, 197, 94, 0.2) 100%)', 
              borderRadius: '50%', 
              border: '1px solid rgba(200, 232, 55, 0.35)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>
              <Sprout style={{ color: 'var(--nukrop-accent)', width: '18px', height: '18px' }} />
            </div>
            <span style={{ fontSize: '18px', fontFamily: 'Outfit', fontWeight: '800', letterSpacing: '0.02em', color: '#FFFFFF' }}>
              NuKrop<span style={{ color: 'var(--nukrop-accent)' }}>AI</span>
            </span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="nav-links" aria-label="Primary Navigation">
            <a href="#features" className="nav-link">Features</a>
            <a href="#architecture" className="nav-link">Architecture</a>
            <a href="#languages" className="nav-link">Languages</a>
            <a href="#faq" className="nav-link">FAQ</a>
            <a href="#contact" className="nav-link">Support</a>
          </nav>

          {/* Desktop Actions */}
          <div className="nav-actions">
            <button
              onClick={() => setCommandMenuOpen(true)}
              className="nav-search-btn"
              aria-label="Open Quick Actions (Ctrl+K or Cmd+K)"
            >
              <Search style={{ width: '13px', height: '13px', color: 'var(--nukrop-accent)' }} />
              <span>Quick Actions</span>
              <kbd className="nav-search-kbd">⌘K</kbd>
            </button>

            <a 
              href="/NuKropAI.apk" 
              download="NuKropAI.apk"
              onClick={() => {
                analytics.track('download_apk_click', { source: 'navbar_pill', version: '2.0' });
                showToast({ type: 'info', message: 'Starting NuKropAI APK download (~52 MB)...' });
              }}
              className="nukrop-btn nav-download-btn"
            >
              <Download style={{ width: '14px', height: '14px' }} />
              <span>Get APK (v2.0)</span>
            </a>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button 
            className="nav-mobile-toggle touch-target"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X style={{ width: '20px', height: '20px' }} /> : <Menu style={{ width: '20px', height: '20px' }} />}
          </button>
        </div>
      </header>

      {/* Mobile Nav Drawer */}
      <div className={`nav-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`} role="dialog" aria-label="Mobile Navigation Menu">
        <a href="#features" className="nav-link" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', padding: '10px 0' }}>Features</a>
        <a href="#architecture" className="nav-link" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', padding: '10px 0' }}>AgriTech Architecture</a>
        <a href="#languages" className="nav-link" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', padding: '10px 0' }}>Languages</a>
        <a href="#faq" className="nav-link" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', padding: '10px 0' }}>FAQ & Manual</a>
        <a href="#contact" className="nav-link" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '15px', padding: '10px 0' }}>Support & Grievance</a>
        
        <button
          onClick={() => { setMobileMenuOpen(false); setCommandMenuOpen(true); }}
          className="touch-target"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px',
            color: '#FFFFFF',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            margin: '6px 0'
          }}
        >
          <Search style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />
          <span>Quick Actions (Ctrl+K)</span>
        </button>

        <a 
          href="/NuKropAI.apk" 
          download="NuKropAI.apk"
          className="nukrop-btn" 
          onClick={() => {
            setMobileMenuOpen(false);
            analytics.track('download_apk_click', { source: 'mobile_drawer', version: '2.0' });
            showToast({ type: 'info', message: 'Downloading NuKropAI APK...' });
          }}
          style={{ width: '100%', padding: '12px 20px', fontSize: '14px', marginTop: '6px', borderRadius: '12px' }}
        >
          <Download style={{ width: '16px', height: '16px' }} />
          <span>Download NuKropAI APK (v2.0 Latest)</span>
        </a>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main style={{ flex: '1', width: '100%', paddingTop: '90px' }}>
        
        {/* ═════════════════════ HERO SECTION ═════════════════════ */}
        <section className="site-container section-spacing" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Live Status Pill */}
          <div style={{ 
            padding: '6px 16px', 
            background: 'rgba(200, 232, 55, 0.08)', 
            border: '1px solid rgba(200, 232, 55, 0.25)', 
            borderRadius: '100px', 
            marginBottom: '24px', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            <span className="live-pulse"></span>
            <span style={{ fontSize: '12px', color: 'var(--nukrop-accent)', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              NuKropAI v2.0 · Live Sovereign AgriTech OS
            </span>
          </div>

          {/* Hero Headline */}
          <h1 style={{ 
            fontSize: 'clamp(32px, 5.5vw, 64px)', 
            lineHeight: 1.15, 
            marginBottom: '20px', 
            fontWeight: '800', 
            color: '#FFFFFF',
            maxWidth: '900px'
          }}>
            Agrarian Intelligence, <br/>
            <span style={{ 
              background: 'linear-gradient(135deg, var(--nukrop-accent) 0%, #D4F040 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 24px rgba(200, 232, 55, 0.3))'
            }}>
              Now in your pocket.
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{ 
            fontSize: 'clamp(15px, 2vw, 19px)', 
            color: 'var(--nukrop-text-dim)', 
            maxWidth: '720px', 
            lineHeight: 1.6, 
            marginBottom: '36px' 
          }}>
            A complete operating system engineered to eliminate crop loss, optimize fertilizer dosages, and secure fair APMC market pricing through edge AI and live government data.
          </p>

          {/* Single Authoritative Download CTA */}
          <div className="hero-buttons" style={{ display: 'flex', gap: '14px', justifyContent: 'center', marginBottom: '28px', flexWrap: 'wrap' }}>
            <a
              href="/NuKropAI.apk"
              download="NuKropAI.apk"
              onClick={() => {
                analytics.track('download_apk_click', { source: 'hero_primary', version: '2.0' });
                showToast({ type: 'info', message: 'Downloading NuKropAI APK (~52 MB)...' });
              }}
              className="nukrop-btn"
              style={{
                padding: '16px 36px',
                fontSize: '16px',
                borderRadius: '16px',
                boxShadow: '0 8px 32px rgba(200, 232, 55, 0.35)',
              }}
            >
              <Download style={{ width: '20px', height: '20px' }} />
              <span>Download NuKropAI App</span>
              <span className="tabular-nums" style={{
                background: 'rgba(0,0,0,0.18)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '12px',
                fontWeight: '700',
                marginLeft: '6px'
              }}>v2.0 (Latest) · 52 MB</span>
            </a>

            <a
              href="#features"
              className="nukrop-btn nukrop-btn-secondary"
              style={{
                padding: '16px 28px',
                fontSize: '15px',
                borderRadius: '16px',
              }}
            >
              <span>Explore Features</span>
              <ChevronRight style={{ width: '16px', height: '16px' }} />
            </a>
          </div>

          {/* Android Compatibility Disclaimer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nukrop-text-muted)', fontSize: '13px', marginBottom: '48px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Smartphone style={{ width: '15px', height: '15px', color: 'var(--nukrop-accent)' }} />
            <span>Android 7.0+ · Sideload Ready · Zero Ads · 100% Free for Farmers</span>
          </div>

          {/* Stats Bar */}
          <div className="glass-card stats-row" style={{ 
            width: '100%', 
            maxWidth: '920px', 
            padding: '24px 28px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-around',
            gap: '16px'
          }}>
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <strong className="tabular-nums" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: '#FFFFFF', display: 'block' }}>1.2M+</strong>
              <span style={{ fontSize: '12px', color: 'var(--nukrop-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Crops Diagnosed</span>
            </div>
            <div className="stat-divider" style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }}></div>
            
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <strong className="tabular-nums" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--nukrop-accent)', display: 'block' }}>1,400+</strong>
              <span style={{ fontSize: '12px', color: 'var(--nukrop-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>APMC Mandis Synced</span>
            </div>
            <div className="stat-divider" style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }}></div>
            
            <div className="stat-item" style={{ textAlign: 'center' }}>
              <strong className="tabular-nums" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: '#FFFFFF', display: 'block' }}>99.9%</strong>
              <span style={{ fontSize: '12px', color: 'var(--nukrop-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Vision AI Accuracy</span>
            </div>
            <div className="stat-divider" style={{ width: '1px', height: '36px', background: 'rgba(255,255,255,0.1)' }}></div>

            <div className="stat-item" style={{ textAlign: 'center' }}>
              <strong className="tabular-nums" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: '#10B981', display: 'block' }}>100%</strong>
              <span style={{ fontSize: '12px', color: 'var(--nukrop-text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Offline Ready</span>
            </div>
          </div>

        </section>


        {/* ═════════════════ PROBLEM VS SOLUTION ═════════════════ */}
        <section className="site-container section-spacing">
          <div className="grid-2col">
            
            {/* The Problem Card */}
            <div className="glass-card animate-float" style={{ padding: 'clamp(24px, 4vw, 38px)' }}>
              <div style={{ width: '46px', height: '46px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <AlertTriangle style={{ color: 'var(--nukrop-error)', width: '24px', height: '24px' }} />
              </div>
              <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '14px' }}>The Agrarian Crisis</h2>
              <p style={{ fontSize: '15px', color: 'var(--nukrop-text-dim)', lineHeight: 1.7, marginBottom: '16px' }}>
                Indian smallholders lose up to <strong>40% of their total crop yield</strong> every season to late-stage pest infestations and soil nutrient imbalances.
              </p>
              <ul style={{ paddingLeft: '18px', margin: 0, color: 'var(--nukrop-text-dim)', fontSize: '14px', lineHeight: 1.8 }}>
                <li>Predatory middlemen hide actual daily APMC Mandi settlement rates.</li>
                <li>Over ₹18,000 Cr in Central PM-KISAN and KCC subsidies go unclaimed annually.</li>
                <li>Excess chemical pesticide overuse destroys native soil microbiome.</li>
              </ul>
            </div>

            {/* The NuKropAI Solution Card */}
            <div className="glass-card animate-float-delayed" style={{ padding: 'clamp(24px, 4vw, 38px)', borderColor: 'rgba(200, 232, 55, 0.25)' }}>
              <div style={{ width: '46px', height: '46px', background: 'linear-gradient(135deg, var(--nukrop-accent) 0%, var(--nukrop-accent-dark) 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 6px 20px rgba(200, 232, 55, 0.25)' }}>
                <ShieldCheck style={{ color: 'var(--nukrop-dark)', width: '24px', height: '24px' }} />
              </div>
              <h2 style={{ fontSize: '22px', color: '#FFFFFF', marginBottom: '14px' }}>The NuKropAI Resolution</h2>
              <p style={{ fontSize: '15px', color: 'var(--nukrop-text-dim)', lineHeight: 1.7, marginBottom: '16px' }}>
                NuKropAI equips farmers with a sovereign digital companion powered by <strong>Llama 3.2 11B Vision</strong> and live government data feeds.
              </p>
              <ul style={{ paddingLeft: '18px', margin: 0, color: 'var(--nukrop-text-dim)', fontSize: '14px', lineHeight: 1.8 }}>
                <li>Instant leaf diagnosis with exact ICAR-calibrated chemical &amp; organic dosages.</li>
                <li>GPS-based real-time Agmarknet prices directly from your nearest Mandi.</li>
                <li>Automated scheme matchmaking for instant credit scoring &amp; subsidy discovery.</li>
              </ul>
            </div>

          </div>
        </section>


        {/* ═════════════════ 6 CORE FARMING PILLARS ═════════════════ */}
        <section id="features" className="site-container section-spacing">
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', color: '#FFFFFF', fontWeight: '800', marginBottom: '10px' }}>
              6 Core Farming Pillars
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
              Built specifically to handle the toughest field conditions with intuitive vernacular UI.
            </p>
          </div>

          <div className="grid-3col">
            
            {/* Feature 1: AI Scanner */}
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div 
                role="img"
                aria-label="Crop disease scanning sample"
                style={{ height: '190px', backgroundImage: 'url("/feature_scan.webp"), url("/feature_scan.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              ></div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                  <ScanLine style={{ color: 'var(--nukrop-accent)', width: '20px', height: '20px', flexShrink: 0 }} />
                  AI Crop Scanning
                </h3>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                  Point your camera at any diseased leaf. Llama 3.2 Vision AI identifies 600+ pathologies and calculates exact water-to-chemical tank mixing ratios.
                </p>
              </div>
            </div>

            {/* Feature 2: Mandi Prices */}
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div 
                role="img"
                aria-label="Mandi trading market"
                style={{ height: '190px', backgroundImage: 'url("/feature_mandi.webp"), url("/feature_mandi.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              ></div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                  <TrendingUp style={{ color: 'var(--nukrop-accent)', width: '20px', height: '20px', flexShrink: 0 }} />
                  Live Mandi Rates
                  <span style={{ fontSize: '10px', background: 'rgba(200,232,55,0.15)', color: 'var(--nukrop-accent)', padding: '2px 6px', borderRadius: '100px', fontWeight: '800' }}>GPS Sync</span>
                </h3>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                  Real-time Agmarknet prices across APMC yards. Compare modal prices, track 7-day volatility trends, and set threshold alerts before dispatch.
                </p>
              </div>
            </div>

            {/* Feature 3: Subsidy Matcher */}
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div 
                role="img"
                aria-label="Government agricultural scheme verification"
                style={{ height: '190px', backgroundImage: 'url("/feature_subsidy.webp"), url("/feature_subsidy.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              ></div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                  <Landmark style={{ color: '#60A5FA', width: '20px', height: '20px', flexShrink: 0 }} />
                  Loan &amp; Subsidy Matcher
                </h3>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                  Automated discovery for PM-KISAN, Rythu Bandhu, solar pump subsidies, and zero-interest KCC crop credit matching based on your land size.
                </p>
              </div>
            </div>

            {/* Feature 4: Weather Alerts */}
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div 
                role="img"
                aria-label="Hyperlocal weather radar preview"
                style={{ height: '190px', backgroundImage: 'url("/feature_weather.webp"), url("/feature_weather.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              ></div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                  <CloudRain style={{ color: 'var(--nukrop-warning)', width: '20px', height: '20px', flexShrink: 0 }} />
                  Hyperlocal Weather
                  <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: 'var(--nukrop-warning)', padding: '2px 6px', borderRadius: '100px', fontWeight: '800' }}>Live Radar</span>
                </h3>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                  Precipitation probabilities, celestial arc tracking, and automated advisories warning you if high wind speeds make chemical spraying ineffective.
                </p>
              </div>
            </div>

            {/* Feature 5: Soil Scanner */}
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div 
                role="img"
                aria-label="Soil testing and nutrient profile"
                style={{ height: '190px', backgroundImage: 'url("/feature_soil.webp"), url("/feature_soil.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              ></div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                  <Layers style={{ color: '#A78BFA', width: '20px', height: '20px', flexShrink: 0 }} />
                  AI Soil Health Passport
                </h3>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                  Digitize your Soil Health Card with instant analysis of NPK, Soil Organic Carbon (SOC), and pH balance with customized nano-urea recommendations.
                </p>
              </div>
            </div>

            {/* Feature 6: AI Farm Advisor */}
            <div className="glass-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div 
                role="img"
                aria-label="Vernacular agronomy copilot"
                style={{ height: '190px', backgroundImage: 'url("/feature_advisor.webp"), url("/feature_advisor.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
              ></div>
              <div style={{ padding: '24px' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '17px', color: '#FFFFFF', marginBottom: '8px' }}>
                  <MessageCircle style={{ color: '#34D399', width: '20px', height: '20px', flexShrink: 0 }} />
                  24/7 AI Farm Copilot
                </h3>
                <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
                  Speak or text in Telugu, Hindi, or English. Powered by ICAR agronomy datasets to answer queries regarding pest management and crop rotation 24/7.
                </p>
              </div>
            </div>
            
          </div>
        </section>



        {/* ═════════════════ 7 SOVEREIGN ENTERPRISE MODULES ═════════════════ */}
        <section id="architecture" className="site-container section-spacing">
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ display: 'inline-flex', padding: '4px 14px', background: 'rgba(200, 232, 55, 0.1)', border: '1px solid rgba(200, 232, 55, 0.25)', borderRadius: '100px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--nukrop-accent)', fontWeight: '700', letterSpacing: '0.04em' }}>ARCHITECTURE SPECIFICATIONS</span>
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', color: '#FFFFFF', fontWeight: '800', marginBottom: '10px' }}>
              7 Sovereign AgriTech Modules
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '16px', maxWidth: '720px', margin: '0 auto' }}>
              A high-availability decentralized architecture bridging India AgriStack, rural freight pooling, and Bio-defense.
            </p>
          </div>

          <div className="grid-3col">
            
            {/* 1. Vernacular VoiceOS */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">🎙️</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>Vernacular VoiceOS</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Sub-800ms bidirectional speech AI in 11 Indian languages with acoustic field-noise filtering tailored for rural dialects.
              </p>
            </div>

            {/* 2. BioShield Radar */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">🛡️</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>BioShield Outbreak Radar</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Spatial-temporal epidemic cluster detection triggering geo-fenced community alerts and preemptive bio-barrier spray protocols.
              </p>
            </div>

            {/* 3. MandiPilot Arbitrage */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">📊</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>MandiPilot Arbitrage</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Multi-mandi net revenue calculator deducting transit freight, APMC market cess, and humidity spoilage to maximize profits.
              </p>
            </div>

            {/* 4. GramHaul Logistics */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">🚚</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>GramHaul Freight Pooling</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Village produce pooling saving up to 70% logistics cost versus hiring solo mini-trucks, with verified driver ratings.
              </p>
            </div>

            {/* 5. AgriStack Passport */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">🪪</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>AgriStack Health Passport</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Sovereign digital farmer ID, digitized Soil Health Card (NPK, pH), and algorithmic credit scoring (300-900) for instant KCC underwriting.
              </p>
            </div>

            {/* 6. YantraShare Hub */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">🚜</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>YantraShare Machinery Hub</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                P2P farm machinery rental network for tractors, spray drones, and combine harvesters with milestone-protected booking.
              </p>
            </div>

            {/* 7. BioRx Formulator */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '26px', marginBottom: '12px' }} aria-hidden="true">🌿</div>
              <h3 style={{ fontSize: '17px', color: '#FFFFFF', marginBottom: '6px' }}>BioRx Organic Formulator</h3>
              <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Indigenous natural recipes (Jeevamrutha, Neemastra, Dashaparni Ark) with exact acreage-calibrated ingredient ratios.
              </p>
            </div>

          </div>
        </section>


        {/* ═════════════════ MULTI-LANGUAGE SECTION ═════════════════ */}
        <section id="languages" className="site-container section-spacing">
          <div className="glass-card" style={{ padding: 'clamp(28px, 5vw, 48px)', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
              <Globe style={{ color: 'var(--nukrop-accent)', width: '28px', height: '28px' }} />
              <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', color: '#FFFFFF', fontWeight: '800' }}>
                Built in Your Native Language
              </h2>
            </div>
            <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '15px', lineHeight: 1.6, maxWidth: '680px', margin: '0 auto 28px auto' }}>
              Every feature — AI disease scanning, Mandi rate charts, voice advisories, and fertilizer calculators — runs natively in all major Indian vernacular languages.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { lang: 'English', sub: 'National' },
                { lang: 'తెలుగు', sub: 'Telugu' },
                { lang: 'हिन्दी', sub: 'Hindi' },
                { lang: 'தமிழ்', sub: 'Tamil' },
                { lang: 'ಕನ್ನಡ', sub: 'Kannada' },
                { lang: 'മലയാളം', sub: 'Malayalam' },
                { lang: 'मराठी', sub: 'Marathi' },
                { lang: 'বাংলা', sub: 'Bengali' },
                { lang: 'ਪੰਜਾਬੀ', sub: 'Punjabi' }
              ].map((item, idx) => (
                <div key={idx} style={{ 
                  padding: '10px 18px', 
                  background: 'rgba(255,255,255,0.04)', 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: '12px', 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '85px'
                }}>
                  <strong style={{ fontSize: '15px', color: '#FFFFFF' }}>{item.lang}</strong>
                  <span style={{ fontSize: '11px', color: 'var(--nukrop-text-muted)' }}>{item.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ═════════════════ CONTACT & DPDP GRIEVANCE FORM ═════════════════ */}
        <ContactForm />


        {/* ═════════════════ FAQ ACCORDION ═════════════════ */}
        <section id="faq" className="site-container section-spacing">
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', color: '#FFFFFF', fontWeight: '800', marginBottom: '10px' }}>
              Frequently Asked Questions
            </h2>
            <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '16px', maxWidth: '650px', margin: '0 auto' }}>
              Everything you need to know about installing and deploying NuKropAI.
            </p>
          </div>

          <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index} 
                  className="glass-card" 
                  style={{ 
                    borderRadius: '14px', 
                    cursor: 'pointer',
                    borderColor: isOpen ? 'var(--nukrop-border-accent)' : 'var(--nukrop-border)'
                  }}
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenFaq(isOpen ? null : index);
                    }
                  }}
                  aria-expanded={isOpen}
                >
                  <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '15.5px', fontWeight: '700', color: isOpen ? 'var(--nukrop-accent)' : '#FFFFFF' }}>
                      {faq.q}
                    </span>
                    <ChevronDown style={{ 
                      width: '18px', 
                      height: '18px', 
                      color: isOpen ? 'var(--nukrop-accent)' : 'var(--nukrop-text-muted)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0
                    }} />
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 22px 20px 22px', color: 'var(--nukrop-text-dim)', fontSize: '14px', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* ── BALANCED & STRUCTURED FOOTER ── */}
      <footer className="safe-area-bottom" style={{ 
        padding: '56px 0 32px 0', 
        borderTop: '1px solid rgba(255,255,255,0.08)', 
        background: 'rgba(5, 8, 3, 0.95)', 
        position: 'relative', 
        zIndex: 10 
      }}>
        <div className="site-container footer-container">
          
          {/* Top Row Grid */}
          <div className="footer-top-row">
            
            {/* Column 1: Brand & Mission */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ padding: '6px', background: 'rgba(200, 232, 55, 0.12)', borderRadius: '8px', border: '1px solid rgba(200, 232, 55, 0.25)' }}>
                  <Sprout style={{ color: 'var(--nukrop-accent)', width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '20px', fontFamily: 'Outfit', fontWeight: '800', color: '#FFFFFF' }}>
                  NuKrop<span style={{ color: 'var(--nukrop-accent)' }}>AI</span>
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: 'var(--nukrop-text-dim)', lineHeight: 1.6, maxWidth: '380px', margin: '0 0 16px 0' }}>
                Sovereign full-stack Agrarian Operating System designed to empower Indian farmers with edge AI pathology diagnostics and unmanipulated APMC market rates.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--nukrop-text-muted)', fontSize: '12px' }}>
                <Radio style={{ width: '13px', height: '13px', color: '#22C55E' }} />
                <span>ICAR &amp; Agmarknet Government Protocol Compliant</span>
              </div>
            </div>

            {/* Column 2: Platform Links */}
            <div>
              <h4 style={{ fontSize: '14px', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
                Platform &amp; Tools
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li><a href="#features" className="touch-target" style={{ color: 'var(--nukrop-text-dim)', textDecoration: 'none', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>6 Core Pillars</a></li>
                <li><a href="#mandi" className="touch-target" style={{ color: 'var(--nukrop-text-dim)', textDecoration: 'none', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>Live Mandi Rates</a></li>
                <li><a href="#scanner" className="touch-target" style={{ color: 'var(--nukrop-text-dim)', textDecoration: 'none', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>AI Disease Scanner</a></li>
                <li><a href="#architecture" className="touch-target" style={{ color: 'var(--nukrop-text-dim)', textDecoration: 'none', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>AgriTech Suite</a></li>
                <li><a href="#contact" className="touch-target" style={{ color: 'var(--nukrop-text-dim)', textDecoration: 'none', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>Farmer Support Desk</a></li>
                <li><a href="#faq" className="touch-target" style={{ color: 'var(--nukrop-text-dim)', textDecoration: 'none', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center' }}>FAQ &amp; Manual</a></li>
                <li>
                  <a 
                    href="/NuKropAI.apk" 
                    download="NuKropAI.apk" 
                    onClick={() => {
                      analytics.track('download_apk_click', { source: 'footer_link', version: '2.0' });
                      showToast({ type: 'info', message: 'Downloading NuKropAI APK...' });
                    }}
                    className="touch-target"
                    style={{ color: 'var(--nukrop-accent)', textDecoration: 'none', fontSize: '13.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center' }}
                  >
                    Download APK (v2.0 Latest)
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal & Privacy */}
            <div>
              <h4 style={{ fontSize: '14px', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
                Legal &amp; Compliance
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li>
                  <button 
                    onClick={() => navigate('/privacy')}
                    className="touch-target"
                    style={{ background: 'none', border: 'none', color: 'var(--nukrop-text-dim)', fontSize: '13.5px', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText style={{ width: '13px', height: '13px' }} />
                    <span>Privacy Policy (DPDP Act)</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate('/terms')}
                    className="touch-target"
                    style={{ background: 'none', border: 'none', color: 'var(--nukrop-text-dim)', fontSize: '13.5px', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText style={{ width: '13px', height: '13px' }} />
                    <span>Terms of Service</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate('/cookies')}
                    className="touch-target"
                    style={{ background: 'none', border: 'none', color: 'var(--nukrop-text-dim)', fontSize: '13.5px', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Cookie style={{ width: '13px', height: '13px' }} />
                    <span>Cookie &amp; Storage Policy</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => navigate('/refund')}
                    className="touch-target"
                    style={{ background: 'none', border: 'none', color: 'var(--nukrop-text-dim)', fontSize: '13.5px', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <AlertCircle style={{ width: '13px', height: '13px' }} />
                    <span>Refund Policy Notice</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const event = new CustomEvent('open-cookie-preferences');
                      window.dispatchEvent(event);
                    }}
                    className="touch-target"
                    style={{ background: 'none', border: 'none', color: 'var(--nukrop-accent)', fontSize: '13px', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                  >
                    <SlidersHorizontal style={{ width: '13px', height: '13px' }} />
                    <span>Cookie Preferences</span>
                  </button>
                </li>
              </ul>

              {/* Infrastructure live checks */}
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--nukrop-text-muted)' }}>
                  <span className="live-pulse" style={{ width: '5px', height: '5px' }}></span>
                  <span>Supabase Database: <strong>Connected</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--nukrop-text-muted)' }}>
                  <span className="live-pulse" style={{ width: '5px', height: '5px' }}></span>
                  <span>Agmarknet Pipeline: <strong>Twice-Daily (IST)</strong></span>
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Row Divider & Centered Copyright */}
          <div className="footer-bottom-row">
            <p style={{ color: 'var(--nukrop-text-muted)', fontSize: '13px', margin: 0 }}>
              © 2026 NuKropAI by B. JASWANTH REDDY. All rights reserved. Sovereign Open Source Agrarian Initiative.
            </p>
            <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '12.5px', margin: 0 }}>
              Free public utility for smallholders · Notice: Non-commercial; monetary refund policy not applicable.
            </p>
          </div>

        </div>
      </footer>

      {/* ── COMMAND MENU (CTRL+K / CMD+K) ── */}
      <CommandMenu
        isOpen={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
        onOpenLegal={openLegal}
      />

      {/* ── LEGAL MODAL ── */}
      <LegalModal
        isOpen={legalModalOpen}
        activeTab={activeLegalTab}
        onClose={() => setLegalModalOpen(false)}
        onSelectTab={(tab) => setActiveLegalTab(tab)}
      />

      {/* ── COOKIE CONSENT BANNER ── */}
      <CookieConsent
        onOpenPolicy={() => openLegal('cookies')}
      />

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

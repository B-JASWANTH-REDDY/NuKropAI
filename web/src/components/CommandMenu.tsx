import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Download, 
  TrendingUp, 
  ScanLine, 
  ShieldCheck, 
  Globe, 
  HelpCircle, 
  FileText, 
  Cookie, 
  Activity, 
  ArrowRight,
  X
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Market Data' | 'Legal & Compliance' | 'Diagnostics';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLegal: (tab: 'privacy' | 'terms' | 'cookies' | 'refund') => void;
  onSelectMarketShortcut?: (state: string, district: string, commodity: string) => void;
}

export const CommandMenu: React.FC<CommandMenuProps> = ({
  isOpen,
  onClose,
  onOpenLegal,
  onSelectMarketShortcut
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previously focused element to return focus on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen]);

  // Handle global keyboard shortcut Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open in parent
          const event = new CustomEvent('open-nukrop-command-menu');
          window.dispatchEvent(event);
        }
      }

      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const commands: CommandItem[] = [
    {
      id: 'download-apk',
      title: 'Download NuKropAI Android APK (v2.0 Latest)',
      category: 'Navigation',
      icon: <Download style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />,
      shortcut: 'APK',
      action: () => {
        onClose();
        const a = document.createElement('a');
        a.href = '/NuKropAI.apk';
        a.download = 'NuKropAI.apk';
        a.click();
      }
    },
    {
      id: 'nav-mandi',
      title: 'Live Mandi Prices & APMC Quotes',
      category: 'Navigation',
      icon: <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />,
      action: () => {
        onClose();
        document.getElementById('mandi')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'nav-scanner',
      title: 'AI Crop Disease Scanner (Vision Diagnostic)',
      category: 'Navigation',
      icon: <ScanLine style={{ width: '16px', height: '16px', color: '#60A5FA' }} />,
      action: () => {
        onClose();
        document.getElementById('scanner')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'nav-features',
      title: '6 Core Farming Pillars',
      category: 'Navigation',
      icon: <ShieldCheck style={{ width: '16px', height: '16px', color: '#10B981' }} />,
      action: () => {
        onClose();
        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'nav-architecture',
      title: '7 Sovereign AgriTech Enterprise Modules',
      category: 'Navigation',
      icon: <Activity style={{ width: '16px', height: '16px', color: '#A78BFA' }} />,
      action: () => {
        onClose();
        document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'nav-languages',
      title: 'Vernacular Dialects (11 Languages)',
      category: 'Navigation',
      icon: <Globe style={{ width: '16px', height: '16px', color: '#F59E0B' }} />,
      action: () => {
        onClose();
        document.getElementById('languages')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'nav-faq',
      title: 'Frequently Asked Questions (FAQ)',
      category: 'Navigation',
      icon: <HelpCircle style={{ width: '16px', height: '16px', color: 'var(--nukrop-text-dim)' }} />,
      action: () => {
        onClose();
        document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'market-agra-potato',
      title: 'Agra APMC: Live Potato Trading Rates',
      category: 'Market Data',
      icon: <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />,
      action: () => {
        onClose();
        onSelectMarketShortcut?.('Uttar Pradesh', 'Agra', 'Potato');
        document.getElementById('mandi')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'market-agra-wheat',
      title: 'Agra APMC: Live Wheat Trading Rates',
      category: 'Market Data',
      icon: <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />,
      action: () => {
        onClose();
        onSelectMarketShortcut?.('Uttar Pradesh', 'Agra', 'Wheat');
        document.getElementById('mandi')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'market-nashik-onion',
      title: 'Nashik APMC: Live Onion Rates',
      category: 'Market Data',
      icon: <TrendingUp style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />,
      action: () => {
        onClose();
        onSelectMarketShortcut?.('Maharashtra', 'Nashik', 'Onion');
        document.getElementById('mandi')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'nav-contact',
      title: 'Farmer Support & Data Rights Desk',
      category: 'Navigation',
      icon: <HelpCircle style={{ width: '16px', height: '16px', color: '#10B981' }} />,
      action: () => {
        onClose();
        document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'legal-privacy',
      title: 'Privacy Policy (DPDP Act 2023 Compliant)',
      category: 'Legal & Compliance',
      icon: <FileText style={{ width: '16px', height: '16px', color: '#38BDF8' }} />,
      action: () => {
        onClose();
        onOpenLegal('privacy');
      }
    },
    {
      id: 'legal-terms',
      title: 'Terms of Service & Agronomic Advisory Terms',
      category: 'Legal & Compliance',
      icon: <FileText style={{ width: '16px', height: '16px', color: '#38BDF8' }} />,
      action: () => {
        onClose();
        onOpenLegal('terms');
      }
    },
    {
      id: 'legal-cookies',
      title: 'Cookie & Local Storage Policy',
      category: 'Legal & Compliance',
      icon: <Cookie style={{ width: '16px', height: '16px', color: '#FB923C' }} />,
      action: () => {
        onClose();
        onOpenLegal('cookies');
      }
    },
    {
      id: 'legal-refund',
      title: 'Refund Policy & Free Service Notice',
      category: 'Legal & Compliance',
      icon: <FileText style={{ width: '16px', height: '16px', color: 'var(--nukrop-accent)' }} />,
      action: () => {
        onClose();
        onOpenLegal('refund');
      }
    }
  ];

  const filteredCommands = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  // Keyboard navigation within the filtered items
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="cmd-menu-backdrop" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="NuKropAI Command Menu"
    >
      <div 
        ref={containerRef}
        className="cmd-menu-card" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cmd-menu-input-wrapper">
          <Search style={{ width: '18px', height: '18px', color: 'var(--nukrop-accent)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="cmd-menu-input"
            placeholder="Type a command or search NuKropAI... (e.g. Mandi, Scanner, APK, Privacy)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            aria-autocomplete="list"
            aria-controls="cmd-menu-list"
          />
          <button
            onClick={onClose}
            className="touch-target"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--nukrop-text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px'
            }}
            aria-label="Close command menu"
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        <div 
          id="cmd-menu-list"
          role="listbox" 
          style={{ maxHeight: '380px', overflowY: 'auto', padding: '8px 0' }}
        >
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--nukrop-text-muted)', fontSize: '14px' }}>
              No NuKropAI actions found matching &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`cmd-menu-item ${isSelected ? 'active' : ''}`}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      padding: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {cmd.icon}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: '#FFFFFF', display: 'block' }}>{cmd.title}</span>
                      <span style={{ fontSize: '11px', color: 'var(--nukrop-text-muted)' }}>{cmd.category}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cmd.shortcut && (
                      <span style={{
                        fontSize: '11px',
                        background: 'rgba(200, 232, 55, 0.15)',
                        color: 'var(--nukrop-accent)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700
                      }}>
                        {cmd.shortcut}
                      </span>
                    )}
                    <ArrowRight style={{ width: '14px', height: '14px', opacity: isSelected ? 1 : 0.4 }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{
          padding: '10px 18px',
          background: 'rgba(5, 8, 3, 0.9)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11.5px',
          color: 'var(--nukrop-text-muted)'
        }}>
          <div style={{ display: 'flex', gap: '14px' }}>
            <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>↑↓</kbd> Navigate</span>
            <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>Enter</kbd> Select</span>
            <span><kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '3px' }}>Esc</kbd> Close</span>
          </div>
          <span>NuKropAI Sovereign Navigation</span>
        </div>
      </div>
    </div>
  );
};

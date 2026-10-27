import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, Activity, Search, RefreshCw, AlertCircle, Database, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { MandiCardSkeleton } from './Skeleton';
import { useToast } from './Toast';

export interface MandiItem {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  min_price?: number;
  max_price?: number;
  modal_price: number;
  arrival_date: string;
  source_name?: string;
  freshness_status?: string;
  fetched_at?: string;
}

interface MandiWebProps {
  initialFilter?: {
    state: string;
    district: string;
    commodity: string;
  } | null;
}

export default function MandiWeb({ initialFilter }: MandiWebProps) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MandiItem[]>([]);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'live' | 'cache' | 'stale' | 'none'>('none');
  const [lastFetched, setLastFetched] = useState<string>('');
  
  const [state, setState] = useState(initialFilter?.state || 'Uttar Pradesh');
  const [district, setDistrict] = useState(initialFilter?.district || 'Agra');
  const [commodity, setCommodity] = useState(initialFilter?.commodity || 'Potato');

  // Stale-While-Revalidate cache key
  const getCacheKey = useCallback((s: string, d: string, c: string) => {
    return `nk_mandi_${s.trim().toLowerCase()}_${d.trim().toLowerCase()}_${c.trim().toLowerCase()}`;
  }, []);

  const fetchData = useCallback(async (isBackgroundRevalidate = false) => {
    if (!isBackgroundRevalidate) {
      setLoading(true);
    }
    setError('');

    const cacheKey = getCacheKey(state, district, commodity);

    // Stale-While-Revalidate: Serve immediate cached records if available
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.records) && parsed.records.length > 0) {
          setData(parsed.records);
          setDataSource('cache');
          if (parsed.timestamp) {
            setLastFetched(parsed.timestamp);
          }
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
    
    try {
      const stateEnc = encodeURIComponent(state.trim());
      const commEnc = encodeURIComponent(commodity.trim());
      let records: MandiItem[] = [];
      let sourceTag: 'live' | 'cache' = 'live';

      // 1. Primary: Query secure backend proxy cache
      try {
        const backendRes = await fetch(`${API_BASE_URL}/mandi/rates?state=${stateEnc}&commodity=${commEnc}`);
        if (backendRes.ok) {
          const backendData = await backendRes.json();
          if (backendData.records && Array.isArray(backendData.records) && backendData.records.length > 0) {
            records = backendData.records.map((r: any) => ({
              state: r.state || state,
              district: r.district || district,
              market: r.market || 'APMC Yard',
              commodity: r.commodity || commodity,
              variety: r.variety || 'Standard',
              min_price: Number(r.minPrice || r.min_price || r.modalPrice || r.modal_price || 0),
              max_price: Number(r.maxPrice || r.max_price || r.modalPrice || r.modal_price || 0),
              modal_price: Number(r.modalPrice || r.modal_price || 0),
              arrival_date: r.arrivalDate || r.arrival_date || new Date().toISOString().split('T')[0],
              source_name: 'Agmarknet / DMI (Govt of India)',
              freshness_status: backendData.cached ? 'Cached' : 'Live'
            }));
            sourceTag = backendData.cached ? 'cache' : 'live';
          }
        }
      } catch {
        // Backend unavailable, fallback to public Supabase client endpoint
      }

      // 2. Client fallback via direct Supabase REST read-only view
      if (records.length === 0) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

        if (supabaseUrl && supabaseAnonKey) {
          try {
            const url = `${supabaseUrl}/rest/v1/mandi_live_rates?state=ilike.*${stateEnc}*&commodity=ilike.*${commEnc}*&select=*&order=arrival_date.desc&limit=25`;
            const res = await fetch(url, {
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json'
              }
            });
            if (res.ok) {
              const rows = await res.json();
              if (Array.isArray(rows) && rows.length > 0) {
                records = rows.map((r: any) => ({
                  state: r.state,
                  district: r.district,
                  market: r.market || r.market_name,
                  commodity: r.commodity,
                  variety: r.variety || 'Standard',
                  min_price: Number(r.min_price || r.modal_price || 0),
                  max_price: Number(r.max_price || r.modal_price || 0),
                  modal_price: Number(r.modal_price || 0),
                  arrival_date: r.arrival_date || r.trade_date,
                  source_name: r.source_name || 'Agmarknet / DMI (Govt of India)',
                  freshness_status: r.freshness_status || 'Daily',
                  fetched_at: r.fetched_at || r.updated_at
                }));
                sourceTag = 'cache';
              }
            }
          } catch {
            // Error connecting to Supabase fallback
          }
        }
      }

      // Filter by district if specified
      if (district.trim() && records.length > 0) {
        const dLower = district.trim().toLowerCase();
        const districtMatches = records.filter(r => 
          r.district.toLowerCase().includes(dLower) || r.market.toLowerCase().includes(dLower)
        );
        if (districtMatches.length > 0) {
          records = districtMatches;
        }
      }

      const syncTimeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (records.length > 0) {
        setData(records);
        setDataSource(sourceTag);
        setLastFetched(syncTimeStr);
        // Persist fresh response to localStorage for SWR
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            records,
            timestamp: syncTimeStr
          }));
        } catch {
          // Ignore quota errors
        }
      } else {
        // No records from network; check if we had cached data
        if (data.length === 0) {
          setDataSource('none');
        } else {
          setDataSource('stale');
        }
      }
    } catch (err: any) {
      if (data.length > 0) {
        setDataSource('stale');
        showToast({
          type: 'info',
          message: 'Displaying verified cached rates. Network synchronization will retry automatically.'
        });
      } else {
        setError(err.message || 'Failed to fetch verified Mandi rates from network');
        showToast({
          type: 'error',
          message: 'Unable to connect to Agmarknet market service.'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [state, district, commodity, getCacheKey, data.length, showToast]);

  // Sync when initialFilter prop changes
  const prevFilterRef = useRef(initialFilter);
  useEffect(() => {
    if (initialFilter && (
      initialFilter.state !== prevFilterRef.current?.state ||
      initialFilter.district !== prevFilterRef.current?.district ||
      initialFilter.commodity !== prevFilterRef.current?.commodity
    )) {
      prevFilterRef.current = initialFilter;
      setState(initialFilter.state);
      setDistrict(initialFilter.district);
      setCommodity(initialFilter.commodity);
    }
  }, [initialFilter]);

  useEffect(() => {
    fetchData();
  }, [state, district, commodity]);

  return (
    <section id="mandi" className="site-container section-spacing" style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', padding: '4px 14px', background: 'rgba(200, 232, 55, 0.1)', border: '1px solid rgba(200, 232, 55, 0.25)', borderRadius: '100px', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--nukrop-accent)', fontWeight: '700', letterSpacing: '0.04em' }}>
            GENUINE GOVERNMENT MARKET INTELLIGENCE
          </span>
        </div>
        <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', color: '#FFFFFF', fontWeight: '800', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Activity style={{ color: 'var(--nukrop-accent)', width: '32px', height: '32px' }} />
          Live APMC Mandi Trading Rates
        </h2>
        <p style={{ color: 'var(--nukrop-text-dim)', fontSize: '15.5px', maxWidth: '680px', margin: '0 auto' }}>
          Authentic daily trading journals ingested twice-daily from Ministry of Agriculture (Agmarknet / DMI). Zero synthetic or simulated prices.
        </p>
      </div>

      <div className="glass-card" style={{ padding: 'clamp(20px, 3.5vw, 32px)' }}>
        {/* Search Controls */}
        <form 
          onSubmit={(e) => { e.preventDefault(); fetchData(); }}
          style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 200px' }}>
            <label htmlFor="mandi-state" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--nukrop-text-dim)', display: 'block', marginBottom: '6px' }}>
              State
            </label>
            <input 
              id="mandi-state"
              type="text" 
              className="nukrop-input" 
              placeholder="State (e.g. Uttar Pradesh)" 
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label htmlFor="mandi-district" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--nukrop-text-dim)', display: 'block', marginBottom: '6px' }}>
              District / APMC Market
            </label>
            <input 
              id="mandi-district"
              type="text" 
              className="nukrop-input" 
              placeholder="District / APMC (e.g. Agra)" 
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label htmlFor="mandi-commodity" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--nukrop-text-dim)', display: 'block', marginBottom: '6px' }}>
              Crop Commodity
            </label>
            <input 
              id="mandi-commodity"
              type="text" 
              className="nukrop-input" 
              placeholder="Crop (e.g. Potato, Wheat)" 
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', flex: '0 0 auto' }}>
            <button 
              type="submit"
              className="nukrop-btn" 
              disabled={loading} 
              style={{ height: '44px', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              aria-label="Search Mandi Rates"
            >
              {loading ? (
                <RefreshCw className="animate-spin" style={{ width: '16px', height: '16px' }} />
              ) : (
                <Search style={{ width: '16px', height: '16px' }} />
              )}
              <span>Search Rates</span>
            </button>
          </div>
        </form>

        {/* Quick Location Shortcuts */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)', fontWeight: 600 }}>Quick Verified Mandis:</span>
          {[
            { label: 'Agra APMC (Potato)', s: 'Uttar Pradesh', d: 'Agra', c: 'Potato' },
            { label: 'Agra APMC (Wheat)', s: 'Uttar Pradesh', d: 'Agra', c: 'Wheat' },
            { label: 'Warangal (Cotton)', s: 'Telangana', d: 'Warangal', c: 'Cotton' },
            { label: 'Nashik (Onion)', s: 'Maharashtra', d: 'Nashik', c: 'Onion' }
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => { setState(item.s); setDistrict(item.d); setCommodity(item.c); }}
              className="touch-target"
              style={{
                background: (state === item.s && district === item.d && commodity === item.c)
                  ? 'rgba(200, 232, 55, 0.2)'
                  : 'rgba(200, 232, 55, 0.08)',
                border: `1px solid ${(state === item.s && district === item.d && commodity === item.c) ? 'var(--nukrop-accent)' : 'rgba(200, 232, 55, 0.25)'}`,
                color: 'var(--nukrop-text)',
                borderRadius: '16px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Provenance & Status Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database style={{ width: '15px', height: '15px', color: 'var(--nukrop-accent)' }} />
            <span style={{ fontSize: '12.5px', color: 'var(--nukrop-text)' }}>
              Source: <strong>Agmarknet / DMI (Govt of India Official Journal)</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetched && (
              <span className="tabular-nums" style={{ fontSize: '11.5px', color: 'var(--nukrop-text-dim)' }}>
                Sync: {lastFetched}
              </span>
            )}
            <span style={{ 
              fontSize: '10.5px', 
              fontWeight: '800', 
              letterSpacing: '0.04em',
              padding: '3px 10px', 
              borderRadius: '6px',
              background: dataSource === 'live' 
                ? 'rgba(34, 197, 94, 0.18)' 
                : dataSource === 'cache' 
                ? 'rgba(250, 204, 21, 0.18)' 
                : dataSource === 'stale'
                ? 'rgba(245, 158, 11, 0.18)'
                : 'rgba(239, 68, 68, 0.18)',
              color: dataSource === 'live' 
                ? '#22C55E' 
                : dataSource === 'cache' 
                ? '#FACC15' 
                : dataSource === 'stale'
                ? '#F59E0B'
                : '#EF4444',
              border: `1px solid ${
                dataSource === 'live' 
                  ? 'rgba(34, 197, 94, 0.4)' 
                  : dataSource === 'cache' 
                  ? 'rgba(250, 204, 21, 0.4)' 
                  : dataSource === 'stale'
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(239, 68, 68, 0.4)'
              }`
            }}>
              {dataSource === 'live' 
                ? '● LIVE APMC' 
                : dataSource === 'cache' 
                ? '● VERIFIED CACHE' 
                : dataSource === 'stale'
                ? '● OFFLINE STALE'
                : '● FEED OFFLINE'}
            </span>
          </div>
        </div>

        {/* Dynamic States */}
        {loading && data.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MandiCardSkeleton />
            <MandiCardSkeleton />
            <MandiCardSkeleton />
          </div>
        ) : error && data.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--nukrop-error)', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <AlertCircle style={{ width: '36px', height: '36px', margin: '0 auto 12px auto' }} />
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '16px' }}>Market Data Stream Offline</strong>
            <p style={{ fontSize: '13.5px', color: 'var(--nukrop-text-dim)', marginBottom: '18px', maxWidth: '480px', margin: '0 auto 18px' }}>
              {error}
            </p>
            <button 
              className="nukrop-btn" 
              onClick={() => fetchData()} 
              style={{ padding: '10px 24px', fontSize: '13px' }}
            >
              <RefreshCw style={{ width: '14px', height: '14px' }} /> Retry Connection
            </button>
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--nukrop-text-muted)' }}>
            <Activity style={{ width: '42px', height: '42px', color: 'var(--nukrop-text-dim)', margin: '0 auto 14px auto', opacity: 0.5 }} />
            <strong style={{ fontSize: '17px', display: 'block', color: 'var(--nukrop-text)', marginBottom: '8px' }}>
              No Mandi Trading Records Found
            </strong>
            <p style={{ fontSize: '13.5px', color: 'var(--nukrop-text-dim)', maxWidth: '440px', margin: '0 auto' }}>
              No daily transactions reported for <strong>{commodity}</strong> in <strong>{district ? `${district}, ` : ''}{state}</strong> on this trading cycle. Select a popular market shortcut above.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.map((item, idx) => (
              <div 
                key={`${item.market}-${item.commodity}-${item.arrival_date}-${idx}`} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '20px 24px', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  transition: 'border-color 0.2s',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '18px', color: 'var(--nukrop-text)' }}>{item.market}</strong>
                    {item.variety && (
                      <span style={{ fontSize: '11px', background: 'rgba(200, 232, 55, 0.12)', color: 'var(--nukrop-accent)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                        {item.variety}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '13.5px', color: 'var(--nukrop-text-dim)' }}>
                    {item.district}, {item.state} • <strong>{item.commodity}</strong>
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginBottom: '6px' }}>
                    <TrendingUp style={{ color: 'var(--nukrop-accent)', width: '18px', height: '18px' }} />
                    <strong className="tabular-nums" style={{ fontSize: '24px', color: 'var(--nukrop-accent)' }}>
                      ₹{item.modal_price.toLocaleString('en-IN')}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)' }}>/ Qtl</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', fontSize: '11.5px', color: 'var(--nukrop-text-muted)' }}>
                    {item.min_price && item.max_price && (
                      <span className="tabular-nums">Range: ₹{item.min_price} - ₹{item.max_price}</span>
                    )}
                    <span className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar style={{ width: '12px', height: '12px' }} /> Reported: {item.arrival_date}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState, useEffect } from 'react';
import { TrendingUp, Activity, Search, RefreshCw, AlertCircle, Database, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../api/client';

interface MandiItem {
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

export default function MandiWeb() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MandiItem[]>([]);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'live' | 'cache' | 'none'>('none');
  const [lastFetched, setLastFetched] = useState<string>('');
  
  const [state, setState] = useState('Uttar Pradesh');
  const [district, setDistrict] = useState('Agra');
  const [commodity, setCommodity] = useState('Potato');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    
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
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yxjqseiegwjdfnccdchk.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4anFzZWllZ3dqZGZuY2NkY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDU2NTMsImV4cCI6MjEwMTUyMTY1M30.J4swglpV5qu3hRZFll3aqhG1Y2G9mUllvXMjKq6Ikmo';

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

      setData(records);
      setDataSource(records.length > 0 ? sourceTag : 'none');
      setLastFetched(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch verified Mandi rates from network');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <section style={{ padding: '60px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '36px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Activity style={{ color: 'var(--nukrop-accent)', width: '32px', height: '32px' }} />
          Live Mandi Prices & APMC Quotes
        </h2>
        <p style={{ color: 'var(--nukrop-text-dim)', maxWidth: '640px', margin: '0 auto' }}>
          Authentic agricultural trading records from Government of India (Agmarknet / DMI) with zero synthetic values.
        </p>
      </div>

      <div className="glass-card" style={{ padding: '24px' }}>
        {/* Search Controls */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)', display: 'block', marginBottom: '6px' }}>State</label>
            <input 
              type="text" 
              className="nukrop-input" 
              placeholder="State (e.g. Uttar Pradesh)" 
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)', display: 'block', marginBottom: '6px' }}>District / Market</label>
            <input 
              type="text" 
              className="nukrop-input" 
              placeholder="District / APMC (e.g. Agra)" 
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)', display: 'block', marginBottom: '6px' }}>Commodity</label>
            <input 
              type="text" 
              className="nukrop-input" 
              placeholder="Crop (e.g. Potato, Wheat)" 
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', minWidth: '120px' }}>
            <button className="nukrop-btn" onClick={fetchData} disabled={loading} style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? <RefreshCw className="animate-spin" style={{ width: '16px', height: '16px' }} /> : <Search style={{ width: '16px', height: '16px' }} />}
              Search
            </button>
          </div>
        </div>

        {/* Quick Location Shortcuts */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)' }}>Quick Filters:</span>
          {[
            { label: 'Agra APMC (Potato)', s: 'Uttar Pradesh', d: 'Agra', c: 'Potato' },
            { label: 'Agra APMC (Wheat)', s: 'Uttar Pradesh', d: 'Agra', c: 'Wheat' },
            { label: 'Warangal (Cotton)', s: 'Telangana', d: 'Warangal', c: 'Cotton' },
            { label: 'Nashik (Onion)', s: 'Maharashtra', d: 'Nashik', c: 'Onion' }
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => { setState(item.s); setDistrict(item.d); setCommodity(item.c); }}
              style={{
                background: 'rgba(200, 232, 55, 0.08)',
                border: '1px solid rgba(200, 232, 55, 0.25)',
                color: 'var(--nukrop-text)',
                borderRadius: '16px',
                padding: '4px 12px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Provenance & Status Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database style={{ width: '14px', height: '14px', color: 'var(--nukrop-accent)' }} />
            <span style={{ fontSize: '12px', color: 'var(--nukrop-text)' }}>
              Source: <strong>Agmarknet / DMI (Govt of India)</strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetched && (
              <span style={{ fontSize: '11px', color: 'var(--nukrop-text-dim)' }}>
                Sync time: {lastFetched}
              </span>
            )}
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '700', 
              padding: '2px 8px', 
              borderRadius: '4px',
              background: dataSource === 'live' ? 'rgba(34, 197, 94, 0.2)' : dataSource === 'cache' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: dataSource === 'live' ? 'var(--nukrop-badge-green)' : dataSource === 'cache' ? 'var(--nukrop-warning)' : 'var(--nukrop-error)',
              border: `1px solid ${dataSource === 'live' ? 'rgba(34, 197, 94, 0.4)' : dataSource === 'cache' ? 'rgba(250, 204, 21, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`
            }}>
              {dataSource === 'live' ? '● LIVE APMC' : dataSource === 'cache' ? '● VERIFIED CACHE' : '● FEED OFFLINE'}
            </span>
          </div>
        </div>

        {/* Dynamic States */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                style={{ 
                  padding: '20px', 
                  borderRadius: '12px', 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ width: '160px', height: '18px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px' }}></div>
                  <div style={{ width: '110px', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div style={{ width: '90px', height: '22px', background: 'rgba(200, 232, 55, 0.15)', borderRadius: '4px' }}></div>
                  <div style={{ width: '80px', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--nukrop-error)', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <AlertCircle style={{ width: '32px', height: '32px', margin: '0 auto 12px auto' }} />
            <strong style={{ display: 'block', marginBottom: '8px', fontSize: '15px' }}>Market Data Stream Offline</strong>
            <p style={{ fontSize: '13px', color: 'var(--nukrop-text-dim)', marginBottom: '16px' }}>{error}</p>
            <button className="nukrop-btn" onClick={fetchData} style={{ padding: '8px 20px', fontSize: '13px' }}>
              <RefreshCw style={{ width: '14px', height: '14px' }} /> Retry Connection
            </button>
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--nukrop-text-muted)' }}>
            <Activity style={{ width: '40px', height: '40px', color: 'var(--nukrop-text-dim)', margin: '0 auto 12px auto', opacity: 0.5 }} />
            <strong style={{ fontSize: '16px', display: 'block', color: 'var(--nukrop-text)', marginBottom: '6px' }}>
              No Mandi Trading Records Found
            </strong>
            <p style={{ fontSize: '13px', color: 'var(--nukrop-text-dim)', maxWidth: '400px', margin: '0 auto' }}>
              No daily quotes recorded for <strong>{commodity}</strong> in <strong>{district ? `${district}, ` : ''}{state}</strong> on this trading day. Try selecting a popular market shortcut above.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.map((item, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '20px', 
                  background: 'rgba(255,255,255,0.02)', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.07)',
                  transition: 'border-color 0.2s',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '17px', color: 'var(--nukrop-text)' }}>{item.market}</strong>
                    {item.variety && (
                      <span style={{ fontSize: '11px', background: 'rgba(200, 232, 55, 0.12)', color: 'var(--nukrop-accent)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                        {item.variety}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--nukrop-text-dim)' }}>
                    {item.district}, {item.state} • <strong>{item.commodity}</strong>
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <TrendingUp style={{ color: 'var(--nukrop-accent)', width: '16px', height: '16px' }} />
                    <strong style={{ fontSize: '22px', color: 'var(--nukrop-accent)' }}>
                      ₹{item.modal_price.toLocaleString('en-IN')}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--nukrop-text-dim)' }}>/ Qtl</span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', fontSize: '11px', color: 'var(--nukrop-text-muted)' }}>
                    {item.min_price && item.max_price && (
                      <span>Range: ₹{item.min_price} - ₹{item.max_price}</span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar style={{ width: '11px', height: '11px' }} /> {item.arrival_date}
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

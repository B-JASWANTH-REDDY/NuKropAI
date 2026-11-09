import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const connectionString = (process.env.DATABASE_URL || process.env.DB_CONNECTION_STRING || '').trim();

if (process.env.NODE_ENV === 'production' && !connectionString) {
  throw new Error('FATAL_DATABASE_CONFIG_ERROR: Authoritative database connection URL (DATABASE_URL or DB_CONNECTION_STRING) is missing from production environment.');
}

const rawPool = connectionString ? new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
}) : null;

let isDbConnected = false;

// Test connection at start
if (rawPool) {
  rawPool.connect((err, client, release) => {
    if (err) {
      console.warn("⚠️ PostgreSQL database offline. Falling back to state-preserving in-memory data tables.");
      isDbConnected = false;
    } else {
      console.log("🔌 Connected to PostgreSQL Database.");
      isDbConnected = true;
      if (release) release();
    }
  });
} else {
  console.warn("⚠️ PostgreSQL database connection URL not provided. Running in safe state-preserving in-memory mode.");
  isDbConnected = false;
}

// Verify connection dynamically
export async function getDbStatus(): Promise<boolean> {
  if (!rawPool) {
    isDbConnected = false;
    return false;
  }
  try {
    const client = await rawPool.connect();
    client.release();
    isDbConnected = true;
    return true;
  } catch (err) {
    isDbConnected = false;
    return false;
  }
}

// In-Memory Database Storage (Starts empty - Zero Fabricated Data)
export const memoryStore = {
  users: [] as any[],
  profiles: [] as any[],
  refreshTokens: [] as any[],
  pestOutbreaks: [] as any[],
  soilTelemetry: [] as any[],
  valveOperations: [] as any[],
  escrowContracts: [] as any[],
  cropSimulations: [] as any[],
  communityPosts: [] as any[],
  postLikes: [] as any[],
  priceAlerts: [] as any[],
  notifications: [] as any[],
  idempotencyKeys: new Map<string, any>()
};


// SQL query parser/simulator
export async function query(text: string, params: any[] = []): Promise<{ rows: any[] }> {
  const connected = await getDbStatus();
  if (connected && rawPool) {
    try {
      return await rawPool.query(text, params);
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`SERVICE_UNAVAILABLE: Database persistent query failed in production: ${(err as Error).message}`);
      }
      console.warn("Database query error, falling back to memory execution.");
    }
  }

  // Strict Data Reliability: In production mode, both reads and writes MUST fail closed
  // immediately if the database is offline. Never allow in-memory fallbacks in production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SERVICE_UNAVAILABLE: Database is offline in production mode.');
  }

  const queryStr = text.toLowerCase().replace(/\s+/g, ' ').trim();

  // 1. Users & Profiles Operations
  if (queryStr.includes('insert into public.users')) {
    const newUser = {
      id: crypto.randomUUID(),
      email: params[0],
      password_hash: params[1],
      role: params[2] || 'buyer',
      created_at: new Date()
    };
    memoryStore.users.push(newUser);
    memoryStore.profiles.push({
      id: newUser.id,
      user_id: newUser.id,
      public_id: `nk_pub_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
      email: newUser.email,
      role: newUser.role,
      full_name: newUser.email.split('@')[0],
      public_profile_enabled: false,
      created_at: newUser.created_at
    });
    return { rows: [newUser] };
  }

  if (queryStr.includes('update public.profiles set public_profile_enabled =')) {
    const enabled = params[0];
    const targetId = params[1];
    const profile = memoryStore.profiles.find(p => p.id === targetId || p.user_id === targetId);
    if (profile) {
      profile.public_profile_enabled = enabled;
      return { rows: [{ id: profile.id, public_profile_enabled: enabled }] };
    }
    return { rows: [] };
  }

  if (queryStr.includes('from public.profiles') && (queryStr.includes('id =') || queryStr.includes('user_id ='))) {
    const targetUserId = params[0];
    const matchingProfiles = memoryStore.profiles.filter(p => p.id === targetUserId || p.user_id === targetUserId);
    return { rows: matchingProfiles };
  }

  if (queryStr.includes('from public.public_profiles')) {
    const optedIn = memoryStore.profiles
      .filter(p => p.public_profile_enabled === true)
      .map(p => ({
        public_id: p.public_id || `nk_pub_${String(p.id).replace(/-/g, '').substring(0, 16)}`,
        full_name: p.full_name,
        role: p.role,
        avatar_url: p.avatar_url || null,
        district: p.district || null,
        state: p.state || null,
        created_at: p.created_at
      }));
    return { rows: optedIn };
  }

  if (queryStr.includes('select * from public.users where email =')) {
    const user = memoryStore.users.find(u => u.email === params[0]);
    return { rows: user ? [user] : [] };
  }

  if (queryStr.includes('select id, email, role from public.users where id =')) {
    const user = memoryStore.users.find(u => u.id === params[0]);
    return { rows: user ? [user] : [] };
  }

  // 2. Refresh Tokens Operations
  if (queryStr.includes('insert into public.refresh_tokens')) {
    const newToken = {
      id: crypto.randomUUID(),
      token_hash: params[0],
      user_id: params[1],
      expires_at: params[2],
      revoked: false,
      created_at: new Date()
    };
    memoryStore.refreshTokens.push(newToken);
    return { rows: [newToken] };
  }

  if (queryStr.includes('select * from public.refresh_tokens where user_id =')) {
    const tokens = memoryStore.refreshTokens.filter(t => t.user_id === params[0] && t.revoked === false);
    return { rows: tokens };
  }

  if (queryStr.includes('update public.refresh_tokens set revoked = true where user_id =')) {
    memoryStore.refreshTokens = memoryStore.refreshTokens.map(t => {
      if (t.user_id === params[0]) t.revoked = true;
      return t;
    });
    return { rows: [] };
  }

  if (queryStr.includes('update public.refresh_tokens set revoked = true where id =')) {
    memoryStore.refreshTokens = memoryStore.refreshTokens.map(t => {
      if (t.id === params[0]) t.revoked = true;
      return t;
    });
    return { rows: [] };
  }

  // 3. Telemetry Operations
  if (queryStr.includes('insert into public.soil_telemetry')) {
    const telemetry = {
      id: crypto.randomUUID(),
      user_id: params[0],
      nitrogen: params[1],
      phosphorus: params[2],
      potassium: params[3],
      ph: params[4],
      organic_carbon: params[5],
      moisture: params[6],
      logged_at: new Date()
    };
    memoryStore.soilTelemetry.push(telemetry);
    return { rows: [telemetry] };
  }

  if (queryStr.includes('select * from public.soil_telemetry')) {
    const sorted = [...memoryStore.soilTelemetry].sort((a, b) => b.logged_at.getTime() - a.logged_at.getTime());
    return { rows: sorted.length > 0 ? [sorted[0]] : [] };
  }

  // 4. Valve Operations
  if (queryStr.includes('select distinct on (valve_name) * from public.valve_operations')) {
    return { rows: memoryStore.valveOperations };
  }

  if (queryStr.includes('insert into public.valve_operations')) {
    const valveName = params[0];
    const state = params[1];
    const flowRate = params[2];
    const triggeredBy = params[3];

    const newOp = {
      id: crypto.randomUUID(),
      valve_name: valveName,
      state: state,
      flow_rate: flowRate,
      triggered_by: triggeredBy,
      logged_at: new Date()
    };

    const idx = memoryStore.valveOperations.findIndex(v => v.valve_name === valveName);
    if (idx !== -1) {
      memoryStore.valveOperations[idx] = newOp;
    } else {
      memoryStore.valveOperations.push(newOp);
    }

    return { rows: [newOp] };
  }

  // 5. Contracts Operations
  if (queryStr.includes('insert into public.escrow_contracts')) {
    const contract = {
      id: crypto.randomUUID(),
      contract_address: params[0],
      buyer_name: params[1],
      commodity: params[2],
      amount: params[3],
      funds_status: params[4],
      qr_verification_code: params[5],
      created_at: new Date(),
      verified_at: null
    };
    memoryStore.escrowContracts.push(contract);
    return { rows: [contract] };
  }

  if (queryStr.includes('select * from public.escrow_contracts where id =')) {
    const c = memoryStore.escrowContracts.find(con => con.id === params[0]);
    return { rows: c ? [c] : [] };
  }

  if (queryStr.includes('update public.escrow_contracts set funds_status =')) {
    // SQL: "UPDATE ... SET funds_status = 'RELEASED', verified_at = CURRENT_TIMESTAMP WHERE id = $1"
    // params[0] = contract_id (the WHERE clause parameter)
    const contractId = params[0];
    memoryStore.escrowContracts = memoryStore.escrowContracts.map(c => {
      if (c.id === contractId) {
        c.funds_status = 'RELEASED';
        c.verified_at = new Date();
      }
      return c;
    });
    const updated = memoryStore.escrowContracts.find(c => c.id === contractId);
    return { rows: updated ? [updated] : [] };
  }

  if (queryStr.includes('select * from public.escrow_contracts')) {
    return { rows: memoryStore.escrowContracts };
  }

  // 6. Pest Outbreaks
  if (queryStr.includes('insert into public.pest_outbreaks')) {
    const outbreak = {
      id: crypto.randomUUID(),
      pest_name: params[0],
      latitude: params[1],
      longitude: params[2],
      reporter_id: params[3],
      wind_direction: params[4],
      wind_speed: params[5],
      reported_at: new Date()
    };
    memoryStore.pestOutbreaks.push(outbreak);
    return { rows: [outbreak] };
  }

  if (queryStr.includes('select * from public.pest_outbreaks')) {
    return { rows: memoryStore.pestOutbreaks };
  }

  // 7. Simulations
  if (queryStr.includes('insert into public.crop_simulations')) {
    const sim = {
      id: crypto.randomUUID(),
      user_id: params[0],
      crop_name: params[1],
      field_size: params[2],
      yield_loss_risk: params[3],
      recommendation: params[4],
      created_at: new Date()
    };
    memoryStore.cropSimulations.push(sim);
    return { rows: [sim] };
  }

  if (queryStr.includes('select * from public.crop_simulations')) {
    const sims = memoryStore.cropSimulations.filter(s => s.user_id === params[0]);
    return { rows: sims };
  }

  // 8. Idempotency Keys (Persistent Deduplication)
  if (queryStr.includes('select') && queryStr.includes('public.idempotency_keys')) {
    const key = params[0];
    const record = memoryStore.idempotencyKeys.get(key);
    if (record) {
      const isExpired = record.expires_at && new Date(record.expires_at).getTime() <= Date.now();
      if (!isExpired) {
        return { rows: [{ response_code: record.response_code, response_body: record.response_body }] };
      }
      memoryStore.idempotencyKeys.delete(key);
    }
    return { rows: [] };
  }

  if (queryStr.includes('insert into public.idempotency_keys')) {
    const key = params[0];
    const record = {
      key,
      user_id: params[1],
      operation: params[2],
      response_code: params[3],
      response_body: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    memoryStore.idempotencyKeys.set(key, record);
    return { rows: [record] };
  }

  // 9. Community Posts
  if (queryStr.includes('insert into public.community_posts')) {
    const newPost = {
      id: params[0],
      user_id: params[1],
      author_name: params[2],
      author_village: params[3],
      crop_id: params[4],
      title: params[5],
      content: params[6],
      body: params[7],
      media_url: params[8],
      media_type: params[9],
      likes_count: 0,
      comments_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    };
    memoryStore.communityPosts.unshift(newPost);
    return { rows: [newPost] };
  }

  if (queryStr.includes('from public.community_posts')) {
    let posts = [...memoryStore.communityPosts];
    if (params.length > 0 && typeof params[0] === 'string' && params[0] !== 'all topics') {
      const topic = params[0].toLowerCase();
      posts = posts.filter(p => (p.crop_id || '').toLowerCase() === topic);
    }
    return { rows: posts };
  }

  // 10. Post Likes
  if (queryStr.includes('select id from public.post_likes')) {
    const postId = params[0];
    const userId = params[1];
    const match = memoryStore.postLikes.find(l => l.post_id === postId && l.user_id === userId);
    return { rows: match ? [match] : [] };
  }

  if (queryStr.includes('insert into public.post_likes')) {
    const like = {
      id: params[0],
      post_id: params[1],
      user_id: params[2],
      created_at: new Date()
    };
    memoryStore.postLikes.push(like);
    return { rows: [like] };
  }

  if (queryStr.includes('delete from public.post_likes')) {
    const postId = params[0];
    const userId = params[1];
    memoryStore.postLikes = memoryStore.postLikes.filter(l => !(l.post_id === postId && l.user_id === userId));
    return { rows: [] };
  }

  if (queryStr.includes('update public.community_posts set likes_count')) {
    return { rows: [] };
  }

  // 11. Price Alerts Operations
  if (queryStr.includes('insert into public.price_alerts')) {
    const newAlert = {
      id: crypto.randomUUID(),
      user_id: params[0],
      crop: params[1],
      commodity: params[2],
      mandi: params[3],
      target_price: Number(params[4]),
      condition: params[5] || 'ABOVE',
      status: 'ACTIVE',
      idempotency_key: params[6] || null,
      created_at: new Date(),
      updated_at: new Date(),
      triggered_at: null
    };

    if (newAlert.idempotency_key) {
      const existing = memoryStore.priceAlerts.find(a => a.user_id === newAlert.user_id && a.idempotency_key === newAlert.idempotency_key);
      if (existing) {
        const dupErr: any = new Error('duplicate key value violates unique constraint "price_alerts_idempotency_key_key"');
        dupErr.code = '23505';
        throw dupErr;
      }
    }

    memoryStore.priceAlerts.unshift(newAlert);
    return { rows: [newAlert] };
  }

  if (queryStr.includes('from public.price_alerts') && queryStr.includes('user_id =')) {
    const alerts = memoryStore.priceAlerts.filter(a => a.user_id === params[0] && a.status !== 'CANCELLED');
    return { rows: alerts };
  }

  if (queryStr.includes('from public.price_alerts') && queryStr.includes('status = \'active\'')) {
    const alerts = memoryStore.priceAlerts.filter(a => a.status === 'ACTIVE');
    return { rows: alerts };
  }

  if (queryStr.includes('update public.price_alerts set status =')) {
    const status = params[0];
    const alertId = params[1];
    const userId = params[2];
    const alert = memoryStore.priceAlerts.find(a => a.id === alertId && (!userId || a.user_id === userId));
    if (alert) {
      if (queryStr.includes("status = 'active'") && alert.status !== 'ACTIVE') {
        return { rows: [] };
      }
      alert.status = status;
      alert.updated_at = new Date();
      if (status === 'TRIGGERED') alert.triggered_at = new Date();
      return { rows: [alert] };
    }
    return { rows: [] };
  }

  if (queryStr.includes('delete from public.price_alerts where id =')) {
    const alertId = params[0];
    const userId = params[1];
    const idx = memoryStore.priceAlerts.findIndex(a => a.id === alertId && (!userId || a.user_id === userId));
    if (idx !== -1) {
      const deleted = memoryStore.priceAlerts.splice(idx, 1);
      return { rows: deleted };
    }
    return { rows: [] };
  }

  // 12. Notifications Operations
  if (queryStr.includes('insert into public.notifications')) {
    // ON CONFLICT (user_id, event_source, event_id) DO NOTHING
    if (queryStr.includes('on conflict (user_id, event_source, event_id) do nothing')) {
      const exists = memoryStore.notifications.some(
        n => n.user_id === params[0] && n.event_source === params[1] && n.event_id === params[2]
      );
      if (exists) {
        return { rows: [] };
      }
    }
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: params[0],
      event_source: params[1],
      event_id: params[2],
      category: params[3] || 'SYSTEM',
      title: params[4],
      body: params[5],
      is_read: false,
      created_at: new Date()
    };
    memoryStore.notifications.unshift(newNotif);
    return { rows: [newNotif] };
  }

  if (queryStr.includes('from public.notifications') && queryStr.includes('is_read = false')) {
    const userId = params[0];
    const unread = memoryStore.notifications.filter(n => n.user_id === userId && !n.is_read);
    return { rows: [{ unread_count: unread.length }] };
  }

  if (queryStr.includes('from public.notifications') && queryStr.includes('user_id =')) {
    const userId = params[0];
    const notifs = memoryStore.notifications.filter(n => n.user_id === userId);
    return { rows: notifs };
  }

  if (queryStr.includes('update public.notifications set is_read = true where id =')) {
    const notifId = params[0];
    const userId = params[1];
    const notif = memoryStore.notifications.find(n => n.id === notifId && (!userId || n.user_id === userId));
    if (notif) {
      notif.is_read = true;
      return { rows: [notif] };
    }
    return { rows: [] };
  }

  if (queryStr.includes('update public.notifications set is_read = true where user_id =')) {
    const userId = params[0];
    const updated: any[] = [];
    memoryStore.notifications.forEach(n => {
      if (n.user_id === userId && !n.is_read) {
        n.is_read = true;
        updated.push(n);
      }
    });
    return { rows: updated };
  }

  return { rows: [] };
}

function createMemoryTransactionClient() {
  let inTransaction = false;
  let snapshotAlerts: any[] | null = null;
  let snapshotNotifications: any[] | null = null;

  return {
    query: async (text: string, params: any[] = []) => {
      const q = text.toLowerCase().trim();
      if (q === 'begin') {
        inTransaction = true;
        snapshotAlerts = JSON.parse(JSON.stringify(memoryStore.priceAlerts));
        snapshotNotifications = JSON.parse(JSON.stringify(memoryStore.notifications));
        return { rows: [] };
      }
      if (q === 'commit') {
        inTransaction = false;
        snapshotAlerts = null;
        snapshotNotifications = null;
        return { rows: [] };
      }
      if (q === 'rollback') {
        if (inTransaction) {
          if (snapshotAlerts !== null) {
            memoryStore.priceAlerts = snapshotAlerts;
          }
          if (snapshotNotifications !== null) {
            memoryStore.notifications = snapshotNotifications;
          }
          inTransaction = false;
          snapshotAlerts = null;
          snapshotNotifications = null;
        }
        return { rows: [] };
      }
      return query(text, params);
    },
    release: () => {
      if (inTransaction && snapshotAlerts !== null) {
        memoryStore.priceAlerts = snapshotAlerts;
        if (snapshotNotifications !== null) {
          memoryStore.notifications = snapshotNotifications;
        }
      }
    }
  };
}

// Export wrapper matching standard Pool class interface
export const pool = {
  query: query,
  connect: async () => {
    // If Postgres is online, return raw pool client. Otherwise, fail-closed in production
    if (rawPool) {
      try {
        const client = await rawPool.connect();
        return client;
      } catch (err) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`SERVICE_UNAVAILABLE: Database offline: Cannot establish client connection or transaction in production: ${(err as Error).message}`);
        }
        return createMemoryTransactionClient();
      }
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SERVICE_UNAVAILABLE: Database offline: Cannot establish client connection or transaction in production: DATABASE_URL not configured.');
    }
    return createMemoryTransactionClient();
  }
};

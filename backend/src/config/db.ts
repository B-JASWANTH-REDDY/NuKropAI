import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';

dotenv.config();

const connectionString = process.env.DB_CONNECTION_STRING || 'postgresql://enterprise_ai:securepassword123@localhost:5432/ai_os_db';

const rawPool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 2000,
});

let isDbConnected = false;

// Test connection at start
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

// Verify connection dynamically
export async function getDbStatus(): Promise<boolean> {
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
  refreshTokens: [] as any[],
  pestOutbreaks: [] as any[],
  soilTelemetry: [] as any[],
  valveOperations: [] as any[],
  escrowContracts: [] as any[],
  cropSimulations: [] as any[]
};


// SQL query parser/simulator
export async function query(text: string, params: any[] = []): Promise<{ rows: any[] }> {
  const connected = await getDbStatus();
  if (connected) {
    try {
      return await rawPool.query(text, params);
    } catch (err) {
      console.warn("Database query error, falling back to memory execution.");
    }
  }

  // Standard Normalized SQL simulation
  const queryStr = text.toLowerCase();

  // 1. Users Operations
  if (queryStr.includes('insert into public.users')) {
    const newUser = {
      id: crypto.randomUUID(),
      email: params[0],
      password_hash: params[1],
      role: params[2] || 'buyer',
      created_at: new Date()
    };
    memoryStore.users.push(newUser);
    return { rows: [newUser] };
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

  return { rows: [] };
}

// Export wrapper matching standard Pool class interface
export const pool = {
  query: query,
  connect: async () => {
    // If Postgres is online, return raw pool client. Otherwise, return fake client
    try {
      const client = await rawPool.connect();
      return client;
    } catch (err) {
      return {
        query: query,
        release: () => {}
      };
    }
  }
};

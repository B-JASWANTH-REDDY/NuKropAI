import { query } from '../config/db';
import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Process-local L1 fast cache
const l1Cache = new Map<string, { statusCode: number; responseBody: any; expiresAt: number }>();

export class IdempotencyService {
  /**
   * Check for an existing idempotency key across L1 cache, PostgreSQL database, and Supabase.
   */
  static async check(key: string): Promise<{ statusCode: number; responseBody: any } | null> {
    if (!key || typeof key !== 'string') return null;
    const cleanKey = key.trim();
    if (!cleanKey) return null;

    // 1. Check L1 memory cache
    const l1 = l1Cache.get(cleanKey);
    if (l1) {
      if (Date.now() < l1.expiresAt) {
        return { statusCode: l1.statusCode, responseBody: l1.responseBody };
      }
      l1Cache.delete(cleanKey);
    }

    // 2. Query persistent PostgreSQL table
    try {
      const res = await query(
        'SELECT response_code, response_body, expires_at FROM public.idempotency_keys WHERE key = $1 AND (expires_at IS NULL OR expires_at > NOW())',
        [cleanKey]
      );
      if (res && res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        const record = {
          statusCode: row.response_code,
          responseBody: typeof row.response_body === 'string' ? JSON.parse(row.response_body) : row.response_body
        };
        // Populate L1 cache
        l1Cache.set(cleanKey, { ...record, expiresAt: Date.now() + 60000 });
        return record;
      }
    } catch (dbErr) {
      // Continue to Supabase REST fallback
    }

    // 3. Query Supabase REST if configured
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const resp = await axios.get(
          `${SUPABASE_URL}/rest/v1/idempotency_keys?key=eq.${encodeURIComponent(cleanKey)}&select=response_code,response_body,expires_at`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            timeout: 2000
          }
        );
        if (resp.data && resp.data.length > 0) {
          const row = resp.data[0];
          const record = {
            statusCode: row.response_code,
            responseBody: typeof row.response_body === 'string' ? JSON.parse(row.response_body) : row.response_body
          };
          l1Cache.set(cleanKey, { ...record, expiresAt: Date.now() + 60000 });
          return record;
        }
      } catch (sbErr) {
        // Fallback exhausted
      }
    }

    return null;
  }

  /**
   * Persistently record an operation's response against an idempotency key.
   */
  static async record(
    key: string,
    userId: string | undefined,
    operation: string,
    statusCode: number,
    responseBody: any
  ): Promise<void> {
    if (!key || typeof key !== 'string') return;
    const cleanKey = key.trim();
    if (!cleanKey) return;

    // 1. Populate L1 cache immediately
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    l1Cache.set(cleanKey, { statusCode, responseBody, expiresAt });

    // 2. Persist to PostgreSQL database
    try {
      await query(
        `INSERT INTO public.idempotency_keys (key, user_id, operation, response_code, response_body, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '24 hours')
         ON CONFLICT (key) DO NOTHING`,
        [cleanKey, userId || null, operation, statusCode, JSON.stringify(responseBody)]
      );
    } catch (dbErr) {
      // Non-blocking in dev/test fallback
    }

    // 3. Persist to Supabase REST if configured
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        await axios.post(
          `${SUPABASE_URL}/rest/v1/idempotency_keys`,
          {
            key: cleanKey,
            user_id: userId || null,
            operation,
            response_code: statusCode,
            response_body: responseBody
          },
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Prefer': 'resolution=ignore-duplicates'
            },
            timeout: 2500
          }
        );
      } catch (sbErr) {
        // Handled silently
      }
    }
  }

  /**
   * Clear in-memory L1 cache (useful for tests or simulated restarts).
   */
  static clearL1(): void {
    l1Cache.clear();
  }
}


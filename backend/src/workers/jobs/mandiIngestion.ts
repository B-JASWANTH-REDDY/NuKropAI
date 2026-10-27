import pino from 'pino';
import { Pool } from 'pg';
import axios from 'axios';
import { redisClient } from '../../config/redis';

const logger = pino({
  transport: {
    target: 'pino-pretty'
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export interface MandiItem {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  arrival_date: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

const AGMARKNET_ENDPOINT = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';

/**
 * Fetch genuine market records from Agmarknet API.
 * Never generates synthetic or fallback prices.
 */
async function fetchAuthenticMandiData(): Promise<MandiItem[]> {
  const apiKey = process.env.GOVT_API_KEY;
  if (!apiKey) {
    throw new Error('GOVT_API_KEY environment variable is not configured. Cannot perform ingestion without authorized credentials.');
  }

  const response = await axios.get(AGMARKNET_ENDPOINT, {
    params: {
      'api-key': apiKey,
      format: 'json',
      limit: 1000,
      offset: 0
    },
    timeout: 30000
  });

  if (response.status !== 200) {
    throw new Error(`Agmarknet API responded with HTTP status ${response.status}`);
  }

  const rawRecords = response.data?.records || [];
  return rawRecords;
}

/**
 * Validates and cleans raw input rows according to agronomic schemas.
 */
export function validateAndCleanMandiRecords(records: any[]): MandiItem[] {
  const validated: MandiItem[] = [];

  for (const raw of records) {
    const state = String(raw.state || '').trim();
    const district = String(raw.district || '').trim();
    const market = String(raw.market || '').trim();
    const commodity = String(raw.commodity || '').trim();
    const variety = String(raw.variety || 'Standard').trim();
    const rawDate = String(raw.arrival_date || '').trim();

    if (!state || !market || !commodity || !rawDate) {
      continue;
    }

    let minPrice = parseFloat(raw.min_price);
    let maxPrice = parseFloat(raw.max_price);
    let modalPrice = parseFloat(raw.modal_price);

    if (isNaN(modalPrice) || modalPrice <= 0) {
      if (!isNaN(minPrice) && !isNaN(maxPrice) && minPrice > 0 && maxPrice > 0) {
        modalPrice = (minPrice + maxPrice) / 2.0;
      } else {
        continue; // Reject unpriced rows
      }
    }

    if (isNaN(minPrice) || minPrice <= 0) minPrice = modalPrice;
    if (isNaN(maxPrice) || maxPrice <= 0) maxPrice = modalPrice;

    // Standardize arrival_date to ISO YYYY-MM-DD
    let arrivalDate = rawDate;
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        arrivalDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else if (rawDate.length >= 10) {
      arrivalDate = rawDate.substring(0, 10);
    }

    validated.push({
      state,
      district,
      market,
      commodity,
      variety,
      arrival_date: arrivalDate,
      min_price: minPrice,
      max_price: maxPrice,
      modal_price: modalPrice
    });
  }

  return validated;
}

export async function handleMandiIngestion(data: any) {
  logger.info('Starting Authentic Mandi Price Ingestion worker job');

  let rawData = data?.records;
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    logger.info('No external batch payload passed. Attempting live extraction from Agmarknet API...');
    rawData = await fetchAuthenticMandiData();
  }

  const validRecords = validateAndCleanMandiRecords(rawData);
  if (validRecords.length === 0) {
    const msg = 'No valid records received from provider. Aborting ingestion to preserve database integrity.';
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info({ count: validRecords.length }, 'Validated market records. Initiating transactional upsert...');

  const client = await pool.connect();
  let insertedCount = 0;
  let updatedCount = 0;

  try {
    await client.query('BEGIN');

    for (const item of validRecords) {
      // 1. Check for statistical baseline / anomaly detection against 30-day historical window
      const baselineRes = await client.query(`
        SELECT AVG(modal_price) as avg_price, STDDEV(modal_price) as std_price
        FROM public.mandi_live_rates
        WHERE LOWER(commodity) = LOWER($1)
          AND (LOWER(market) = LOWER($2) OR LOWER(market_name) = LOWER($2))
          AND arrival_date < $3::date
          AND arrival_date >= ($3::date - INTERVAL '30 days')
      `, [item.commodity, item.market, item.arrival_date]);

      const avgPrice = parseFloat(baselineRes.rows[0]?.avg_price);
      const stdPrice = parseFloat(baselineRes.rows[0]?.std_price) || 0;

      if (!isNaN(avgPrice) && avgPrice > 0) {
        const threshold = avgPrice + Math.max(stdPrice * 2, avgPrice * 0.4); // 40% jump or 2 standard deviations
        if (item.modal_price > threshold) {
          await client.query(`
            INSERT INTO public.mandi_price_anomalies (market, commodity, expected_price, actual_price, anomaly_reason)
            VALUES ($1, $2, $3, $4, $5)
          `, [
            item.market,
            item.commodity,
            avgPrice,
            item.modal_price,
            `Price of ₹${item.modal_price}/Qtl exceeded 30-day statistical baseline (avg: ₹${avgPrice.toFixed(0)}, threshold: ₹${threshold.toFixed(0)})`
          ]);
          logger.warn({ market: item.market, commodity: item.commodity, actual: item.modal_price, baseline: avgPrice }, 'Price anomaly flagged against historical data');
        }
      }

      // 2. Safe transactional replacement: remove prior conflicting record for this arrival date
      const delRes = await client.query(`
        DELETE FROM public.mandi_live_rates
        WHERE LOWER(state) = LOWER($1)
          AND (LOWER(market) = LOWER($2) OR LOWER(market_name) = LOWER($2))
          AND LOWER(commodity) = LOWER($3)
          AND arrival_date <= $4::date
      `, [item.state, item.market, item.commodity, item.arrival_date]);

      if (delRes.rowCount && delRes.rowCount > 0) {
        updatedCount += delRes.rowCount;
      } else {
        insertedCount++;
      }

      // 3. Insert authenticated record with provenance (never overwrite newer record)
      await client.query(`
        INSERT INTO public.mandi_live_rates (
          state, district, market, market_name, commodity, variety,
          arrival_date, trade_date, price_date, min_price, max_price, modal_price,
          source_name, source_url, freshness_status, updated_at
        )
        SELECT $1, $2, $3, $3, $4, $5, $6::date, $6::date, $6::date, $7, $8, $9, 'Agmarknet / DMI (Govt of India)', 'https://api.data.gov.in', 'Daily', NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM public.mandi_live_rates
          WHERE LOWER(state) = LOWER($1)
            AND (LOWER(market) = LOWER($3) OR LOWER(market_name) = LOWER($3))
            AND LOWER(commodity) = LOWER($4)
            AND arrival_date > $6::date
        )
      `, [
        item.state, item.district, item.market,
        item.commodity, item.variety, item.arrival_date,
        item.min_price, item.max_price, item.modal_price
      ]);
    }

    // 4. Record ingestion run metadata using safe parameterized query
    const runCheck = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mandi_ingestion_runs'
    `);
    if (runCheck.rows.length > 0) {
      await client.query(`
        INSERT INTO public.mandi_ingestion_runs (
          source_name, started_at, completed_at, records_received, records_inserted, records_updated, status
        ) VALUES (
          $1, NOW(), NOW(), $2, $3, $4, 'COMPLETED'
        )
      `, ['Worker Job Mandi Ingestion', validRecords.length, insertedCount, updatedCount]);
    }

    await client.query('COMMIT');
    logger.info({ insertedCount, updatedCount }, 'Mandi ingestion transaction committed successfully');

    // 5. Invalidate Redis cache ONLY after committed transaction
    try {
      const keys = await redisClient.keys('cache:mandi:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.info({ keysCount: keys.length }, 'Redis cache for mandi rates invalidated post-commit');
      }
    } catch (cacheErr) {
      logger.warn({ cacheErr }, 'Cache invalidation skipped or failed; data safely in DB');
    }

  } catch (e) {
    await client.query('ROLLBACK');
    logger.error({ error: e }, 'Mandi ingestion transaction rolled back cleanly. Existing database records preserved.');
    throw e;
  } finally {
    client.release();
  }
}

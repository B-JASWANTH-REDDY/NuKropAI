import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { pool } from '../config/db';

// District to default coordinates lookup for agricultural centers in Telangana and AP
export const DISTRICT_METADATA: Record<string, { lat: number; lon: number; state: string }> = {
  warangal: { lat: 17.9689, lon: 79.5941, state: 'Telangana' },
  hanamkonda: { lat: 18.0073, lon: 79.5593, state: 'Telangana' },
  khammam: { lat: 17.2473, lon: 80.1514, state: 'Telangana' },
  karimnagar: { lat: 18.4386, lon: 79.1288, state: 'Telangana' },
  nizamabad: { lat: 18.6725, lon: 78.0941, state: 'Telangana' },
  guntur: { lat: 16.3067, lon: 80.4365, state: 'Andhra Pradesh' },
  kurnool: { lat: 15.8281, lon: 78.0373, state: 'Andhra Pradesh' },
  markapur: { lat: 15.7351, lon: 79.2709, state: 'Andhra Pradesh' },
  nandyal: { lat: 15.4886, lon: 78.4836, state: 'Andhra Pradesh' }
};

export const DISTRICT_COORDINATES: Record<string, { lat: number; lon: number }> = Object.fromEntries(
  Object.entries(DISTRICT_METADATA).map(([k, v]) => [k, { lat: v.lat, lon: v.lon }])
);

/**
 * P0.1: Derives authenticated user ID strictly from verified JWT token.
 * Never trusts client headers (e.g. x-user-id) and never uses fallback default identities.
 */
function getAuthenticatedUserId(request: FastifyRequest): string {
  const reqUser = (request as any).user;
  if (!reqUser || !reqUser.id) {
    throw {
      statusCode: 401,
      name: 'UnauthorizedError',
      message: 'Authentication required: Valid JWT bearer token missing or expired'
    };
  }
  return String(reqUser.id);
}

/**
 * P0.4: Truthful, source-backed weather with strict location validation
 * and conservative agronomic foliar spray advisory.
 */
export async function getCurrentWeather(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as any;

  let lat = parseFloat(query.lat);
  let lon = parseFloat(query.lon);
  const districtRaw = typeof query.district === 'string' ? query.district.trim() : '';
  const stateRaw = typeof query.state === 'string' ? query.state.trim() : '';

  // Resolve state truthfully: never default arbitrary coordinates to 'Telangana'
  const resolvedState = stateRaw || (districtRaw && DISTRICT_METADATA[districtRaw.toLowerCase()] ? DISTRICT_METADATA[districtRaw.toLowerCase()].state : null);

  // Strict location requirement: do not silently default to Warangal if user provided no location
  if (isNaN(lat) || isNaN(lon)) {
    if (districtRaw && DISTRICT_COORDINATES[districtRaw.toLowerCase()]) {
      const coords = DISTRICT_COORDINATES[districtRaw.toLowerCase()];
      lat = coords.lat;
      lon = coords.lon;
    } else {
      return reply.status(400).send({
        error: 'MISSING_LOCATION',
        message: 'Valid geographical coordinates (lat, lon) or a recognized agricultural district name are required to fetch weather telemetry.'
      });
    }
  } else {
    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return reply.status(400).send({
        error: 'INVALID_COORDINATES',
        message: 'Latitude must be between -90 and 90, and longitude between -180 and 180.'
      });
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,weather_code&hourly=temperature_2m&timezone=auto`;
    const res = await axios.get(url, { timeout: 5000 });
    const current = res.data?.current;

    if (!current) {
      return reply.status(503).send({
        status: 'UNAVAILABLE',
        error: 'WEATHER_DATA_EMPTY',
        message: 'No current meteorological observations returned by provider'
      });
    }

    const temp = current.temperature_2m !== undefined ? current.temperature_2m : null;
    const humidity = current.relative_humidity_2m !== undefined ? current.relative_humidity_2m : null;
    const windSpeed = current.wind_speed_10m !== undefined ? current.wind_speed_10m : null;
    const windGusts = current.wind_gusts_10m !== undefined ? current.wind_gusts_10m : null;
    // Never convert missing precipitation into zero! Represent null if unobserved
    const precipitation = current.precipitation !== undefined ? current.precipitation : null;
    const code = current.weather_code !== undefined ? current.weather_code : null;
    const providerTime = current.time || null;

    // Telemetry completeness and validation checks for conservative foliar spray advisory
    const missingOrInvalidFields: string[] = [];

    if (temp === null || typeof temp !== 'number' || isNaN(temp)) {
      missingOrInvalidFields.push('temperature (missing)');
    } else if (temp < -20 || temp > 60) {
      missingOrInvalidFields.push(`temperature out of plausible range (${temp}°C)`);
    }

    if (humidity === null || typeof humidity !== 'number' || isNaN(humidity)) {
      missingOrInvalidFields.push('humidity (missing)');
    } else if (humidity < 0 || humidity > 100) {
      missingOrInvalidFields.push(`humidity out of range (${humidity}%)`);
    }

    if (windSpeed === null || typeof windSpeed !== 'number' || isNaN(windSpeed)) {
      missingOrInvalidFields.push('windSpeed (missing)');
    } else if (windSpeed < 0 || windSpeed > 150) {
      missingOrInvalidFields.push(`windSpeed out of plausible range (${windSpeed} km/h)`);
    }

    if (windGusts === null || typeof windGusts !== 'number' || isNaN(windGusts)) {
      missingOrInvalidFields.push('windGusts (missing)');
    } else if (windGusts < 0 || windGusts > 250) {
      missingOrInvalidFields.push(`windGusts out of plausible range (${windGusts} km/h)`);
    } else if (typeof windSpeed === 'number' && windGusts < windSpeed) {
      missingOrInvalidFields.push(`windGusts (${windGusts} km/h) lower than sustained windSpeed (${windSpeed} km/h)`);
    }

    if (precipitation === null || typeof precipitation !== 'number' || isNaN(precipitation)) {
      missingOrInvalidFields.push('precipitation (missing)');
    } else if (precipitation < 0 || precipitation > 500) {
      missingOrInvalidFields.push(`precipitation out of plausible range (${precipitation} mm)`);
    }

    if (code === null || typeof code !== 'number' || isNaN(code)) {
      missingOrInvalidFields.push('weatherCode (missing)');
    } else if (code < 0 || code > 99) {
      missingOrInvalidFields.push(`weatherCode out of range (${code})`);
    }

    if (!providerTime || isNaN(new Date(providerTime).getTime())) {
      missingOrInvalidFields.push('provider observation/model timestamp (missing or malformed)');
    } else {
      const modelTimestamp = new Date(providerTime).getTime();
      const now = Date.now();
      if (modelTimestamp > now + (2 * 3600 * 1000)) {
        missingOrInvalidFields.push('provider timestamp claims future model horizon (>2h)');
      } else if (modelTimestamp < now - (24 * 3600 * 1000)) {
        missingOrInvalidFields.push('provider telemetry is stale (>24h old)');
      }
    }

    // Interpret WMO Weather Code
    let condition = 'Unknown';
    if (code !== null) {
      if (code === 0) condition = 'Clear Sky';
      else if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
      else if (code >= 45 && code <= 48) condition = 'Foggy';
      else if (code >= 51 && code <= 67) condition = 'Rain / Drizzle';
      else if (code >= 80 && code <= 82) condition = 'Rain Showers';
      else if (code >= 95) condition = 'Thunderstorm';
    }

    // Conservative foliar spray suitability evaluation based on agronomic standards:
    // Safe foliar envelope: Temp 15-32°C, Sustained Wind 3-15 km/h, Wind Gusts <= 20 km/h, Humidity 40-80%, Precipitation 0 mm, Weather Code < 51
    let isSpraySafe = false;
    let advisoryStatus = 'ADVISORY_UNAVAILABLE';
    let advisoryReason = '';
    let sprayWindow = 'Unavailable';

    if (missingOrInvalidFields.length > 0) {
      isSpraySafe = false;
      advisoryStatus = 'ADVISORY_UNAVAILABLE';
      advisoryReason = `ADVISORY_UNAVAILABLE: Incomplete or invalid meteorological telemetry (${missingOrInvalidFields.join(', ')}); foliar application safety envelope cannot be established`;
      sprayWindow = 'Unavailable';
    } else if ((code !== null && code >= 51) || (precipitation !== null && precipitation > 0)) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = 'UNSAFE: Active precipitation or rain wash-off risk';
      sprayWindow = 'Postponed until crop canopy dries completely';
    } else if (windSpeed! > 15) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: High sustained wind velocity (${windSpeed} km/h > 15 km/h) causes excessive droplet drift`;
      sprayWindow = 'Postponed until sustained wind falls below 15 km/h';
    } else if (windGusts! > 20) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: High wind gust velocity (${windGusts} km/h > 20 km/h) causes spray drift hazard`;
      sprayWindow = 'Postponed until wind gusts subside below 20 km/h';
    } else if (windSpeed! < 3) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: Near-calm wind (${windSpeed} km/h < 3 km/h) creates surface temperature inversion risk`;
      sprayWindow = 'Postponed until active atmospheric mixing (>3 km/h)';
    } else if (temp! > 32) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: High ambient temperature (${temp}°C > 32°C) causes rapid droplet evaporation and phytotoxicity`;
      sprayWindow = 'Postponed until ambient temperature drops below 32°C';
    } else if (temp! < 15) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: Low ambient temperature (${temp}°C < 15°C) impedes foliar absorption`;
      sprayWindow = 'Postponed until ambient temperature exceeds 15°C';
    } else if (humidity! > 80) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: High relative humidity (${humidity}% > 80%) impairs droplet drying and promotes fungal spore germination`;
      sprayWindow = 'Postponed until relative humidity drops below 80%';
    } else if (humidity! < 40) {
      isSpraySafe = false;
      advisoryStatus = 'UNSAFE';
      advisoryReason = `UNSAFE: Low relative humidity (${humidity}% < 40%) induces rapid droplet vaporization before leaf uptake`;
      sprayWindow = 'Postponed until relative humidity exceeds 40%';
    } else {
      isSpraySafe = true;
      advisoryStatus = 'AVAILABLE';
      advisoryReason = 'OPTIMAL: Atmospheric parameters are within foliar spray safety margins';
      sprayWindow = 'Condition-dependent: apply while parameters remain within safe ranges';
    }

    return reply.status(200).send({
      status: 'AVAILABLE',
      source: 'Open-Meteo Weather API (NWP Numerical Forecast Model)',
      provider: 'Open-Meteo',
      location: {
        district: districtRaw || 'Agricultural Coordinates',
        state: resolvedState,
        latitude: lat,
        longitude: lon
      },
      retrievedAt: new Date().toISOString(),
      modelTime: providerTime ? new Date(providerTime).toISOString() : null,
      observationTime: null, // Open-Meteo is an NWP numerical forecast model; physical weather station observation is not provided
      units: {
        temperature: '°C',
        humidity: '%',
        windSpeed: 'km/h',
        windGusts: 'km/h',
        precipitation: 'mm'
      },
      weather: {
        temperature: temp,
        humidity,
        windSpeed,
        windGusts,
        precipitation,
        condition,
        weatherCode: code
      },
      sprayAdvisory: {
        isSafe: isSpraySafe,
        status: advisoryStatus,
        reason: advisoryReason,
        window: sprayWindow,
        missingTelemetry: missingOrInvalidFields.length > 0 ? missingOrInvalidFields : undefined
      }
    });
  } catch (err: any) {
    return reply.status(503).send({
      status: 'UNAVAILABLE',
      error: 'WEATHER_SERVICE_OFFLINE',
      message: 'Meteorological provider telemetry is temporarily offline or unreachable'
    });
  }
}

/**
 * P0.5: Truly idempotent and transactional price alert creation.
 * Scoped strictly to authenticated JWT user with required idempotency key.
 */
export async function createPriceAlert(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  const body = request.body as any;
  const crop = body?.crop ? String(body.crop).trim() : '';
  const commodity = body?.commodity ? String(body.commodity).trim() : crop;
  const targetPrice = parseFloat(body?.targetPrice ?? body?.target_price);
  const mandi = body?.mandi ? String(body.mandi).trim() : '';
  const condition = (body?.condition || 'ABOVE').toUpperCase();
  const idempotencyKey = ((request.headers['x-idempotency-key'] as string) || body?.idempotency_key || '').trim();

  // Validate required idempotency key
  if (!idempotencyKey) {
    return reply.status(400).send({
      error: 'MISSING_IDEMPOTENCY_KEY',
      message: 'A valid X-Idempotency-Key header or idempotency_key parameter is required to prevent duplicate alerts'
    });
  }

  // Validate crop & target price
  if (!crop || isNaN(targetPrice) || targetPrice <= 0) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Crop and a positive target price are required to create a price alert'
    });
  }

  // Do not silently substitute generic mandi
  if (!mandi) {
    return reply.status(400).send({
      error: 'MISSING_MANDI',
      message: 'Target Mandi (e.g. Warangal, Enumamula, Khammam) is required'
    });
  }

  if (condition !== 'ABOVE' && condition !== 'BELOW') {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Condition must be either ABOVE or BELOW'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.price_alerts (user_id, crop, commodity, mandi, target_price, condition, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, crop, commodity, mandi, target_price, condition, status, idempotency_key, created_at`,
      [userId, crop, commodity, mandi, targetPrice, condition, idempotencyKey]
    );

    const alert = result.rows[0];
    return reply.status(201).send({
      success: true,
      alertId: alert.id,
      alert,
      crop,
      targetPrice,
      mandi,
      condition,
      status: alert.status,
      message: `Price alert activated for ${crop} when price goes ${condition} ₹${targetPrice.toLocaleString('en-IN')}/Qtl at ${mandi}`,
      createdAt: alert.created_at
    });
  } catch (err: any) {
    if (err.code === '23505' || err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
      return reply.status(409).send({
        error: 'DUPLICATE_ALERT',
        message: 'A price alert with this idempotency key already exists for your account'
      });
    }
    request.log.error(err);
    return reply.status(500).send({
      error: 'DATABASE_ERROR',
      message: 'Failed to persist price alert to database'
    });
  }
}

export async function getPriceAlerts(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM public.price_alerts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return reply.status(200).send({
      success: true,
      alerts: result.rows
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'DATABASE_ERROR', message: 'Failed to retrieve price alerts' });
  }
}

export async function cancelPriceAlert(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  const { id } = request.params as any;
  if (!id) {
    return reply.status(400).send({ error: 'INVALID_ID', message: 'Price alert ID is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.price_alerts SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      ['CANCELLED', id, userId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Price alert not found or not owned by user' });
    }
    return reply.status(200).send({
      success: true,
      message: 'Price alert cancelled',
      alert: result.rows[0]
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'DATABASE_ERROR', message: 'Failed to cancel price alert' });
  }
}

/**
 * P0.2: Atomically evaluate active price alerts against validated market observations.
 * Transitioning an alert from ACTIVE to TRIGGERED and inserting notification occurs within
 * a single atomic transaction. If notification insertion fails, the alert transition rolls back.
 */
export async function evaluatePriceAlerts(
  commodity: string,
  mandi: string,
  currentPrice: number,
  observation?: { source?: string; timestamp?: string }
) {
  // Validate market observation telemetry before evaluating
  if (!commodity || typeof commodity !== 'string' || !mandi || typeof mandi !== 'string' || isNaN(currentPrice) || currentPrice <= 0) {
    console.warn('Rejected invalid market observation during alert evaluation');
    return { triggeredCount: 0 };
  }

  if (observation?.timestamp) {
    const obsTime = new Date(observation.timestamp).getTime();
    const now = Date.now();
    // Reject observations claiming future timestamps or older than 48 hours
    if (isNaN(obsTime) || obsTime > now + 60000 || obsTime < now - (48 * 3600 * 1000)) {
      console.warn(`Rejected stale or unverified market observation timestamp: ${observation.timestamp}`);
      return { triggeredCount: 0 };
    }
  }

  let triggeredCount = 0;
  try {
    const result = await pool.query(
      `SELECT * FROM public.price_alerts WHERE status = 'ACTIVE'`,
      []
    );
    const activeAlerts = result.rows.filter(a => {
      const matchCrop = (a.crop || '').toLowerCase() === commodity.toLowerCase() ||
                        (a.commodity || '').toLowerCase() === commodity.toLowerCase();
      const matchMandi = (a.mandi || '').toLowerCase() === mandi.toLowerCase();
      return matchCrop && matchMandi;
    });

    for (const alert of activeAlerts) {
      const target = Number(alert.target_price);
      const isAboveMet = alert.condition === 'ABOVE' && currentPrice >= target;
      const isBelowMet = alert.condition === 'BELOW' && currentPrice <= target;

      if (!isAboveMet && !isBelowMet) {
        continue;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Atomic status transition with status = 'ACTIVE' lock guard:
        // Only updates if still ACTIVE, preventing concurrent double-trigger
        const updateRes = await client.query(
          `UPDATE public.price_alerts SET status = $1, triggered_at = NOW(), updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND status = 'ACTIVE'
           RETURNING id, user_id, crop, mandi, target_price, condition`,
          ['TRIGGERED', alert.id, alert.user_id]
        );

        if (updateRes.rows.length > 0) {
          // Alert transition succeeded: insert persistent notification in the SAME transaction
          await client.query(
            `INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, event_source, event_id) DO NOTHING`,
            [
              alert.user_id,
              'PRICE_ALERT_ENGINE',
              alert.id,
              'PRICE_ALERT',
              `${alert.crop} Price Alert Triggered`,
              `${alert.crop} at ${mandi} has reached ₹${currentPrice.toLocaleString('en-IN')}/Qtl (Target: ${alert.condition} ₹${target.toLocaleString('en-IN')}/Qtl).`
            ]
          );

          await client.query('COMMIT');
          triggeredCount++;
        } else {
          // Another concurrent worker claimed/triggered this alert already
          await client.query('ROLLBACK');
        }
      } catch (txErr) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        console.error(`Transaction failed for alert ${alert.id}, rolled back:`, txErr);
      } finally {
        client.release();
      }
    }
    return { triggeredCount };
  } catch (err) {
    console.error('Error evaluating price alerts:', err);
    return { triggeredCount: 0 };
  }
}

/**
 * P0.6: Genuine Notifications API with owner-only isolation and strict database error reporting.
 */
export async function getNotifications(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM public.notifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return reply.status(200).send({
      success: true,
      notifications: result.rows
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(503).send({ error: 'SERVICE_UNAVAILABLE', message: 'Failed to retrieve notifications from database' });
  }
}

export async function getUnreadNotificationsCount(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int as unread_count FROM public.notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    const unreadCount = Number(result.rows[0]?.unread_count ?? 0);
    return reply.status(200).send({
      unreadCount,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    request.log.error(err);
    // P0.6: Never return zero on database failure. Return authentic 503 error.
    return reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Failed to retrieve unread notification count: database unavailable'
    });
  }
}

export async function markNotificationRead(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  const { id } = request.params as any;
  if (!id) {
    return reply.status(400).send({ error: 'INVALID_ID', message: 'Notification ID is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE public.notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Notification not found or not owned by user' });
    }
    return reply.status(200).send({
      success: true,
      notification: result.rows[0]
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'DATABASE_ERROR', message: 'Failed to update notification state' });
  }
}

export async function markAllNotificationsRead(request: FastifyRequest, reply: FastifyReply) {
  let userId: string;
  try {
    userId = getAuthenticatedUserId(request);
  } catch (authErr: any) {
    return reply.status(authErr.statusCode || 401).send({ error: authErr.message });
  }

  try {
    const result = await pool.query(
      `UPDATE public.notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING id`,
      [userId]
    );
    return reply.status(200).send({
      success: true,
      updatedCount: result.rows.length
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'DATABASE_ERROR', message: 'Failed to update notifications' });
  }
}

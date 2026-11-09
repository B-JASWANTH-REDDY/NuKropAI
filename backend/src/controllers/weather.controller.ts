import { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { pool } from '../config/db';

// District to default coordinates lookup for agricultural centers in Telangana and AP
export const DISTRICT_COORDINATES: Record<string, { lat: number; lon: number }> = {
  warangal: { lat: 17.9689, lon: 79.5941 },
  hanamkonda: { lat: 18.0073, lon: 79.5593 },
  khammam: { lat: 17.2473, lon: 80.1514 },
  karimnagar: { lat: 18.4386, lon: 79.1288 },
  nizamabad: { lat: 18.6725, lon: 78.0941 },
  guntur: { lat: 16.3067, lon: 80.4365 },
  kurnool: { lat: 15.8281, lon: 78.0373 },
  markapur: { lat: 15.7351, lon: 79.2709 },
  nandyal: { lat: 15.4886, lon: 78.4836 }
};

/**
 * P0.3: Truthful, source-backed weather with strict location validation
 * and conservative agronomic foliar spray advisory.
 */
export async function getCurrentWeather(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as any;

  let lat = parseFloat(query.lat);
  let lon = parseFloat(query.lon);
  const districtRaw = typeof query.district === 'string' ? query.district.trim() : '';
  const stateRaw = typeof query.state === 'string' ? query.state.trim() : '';

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

    const temp = current.temperature_2m;
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const windGusts = current.wind_gusts_10m ?? null;
    const precipitation = current.precipitation ?? 0;
    const code = current.weather_code;

    // Interpret WMO Weather Code
    let condition = 'Clear Sky';
    if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
    else if (code >= 45 && code <= 48) condition = 'Foggy';
    else if (code >= 51 && code <= 67) condition = 'Rain / Drizzle';
    else if (code >= 80 && code <= 82) condition = 'Rain Showers';
    else if (code >= 95) condition = 'Thunderstorm';

    // Conservative foliar spray suitability evaluation based on ICAR standards:
    // Safe foliar envelope: Temp 15-32°C, Wind 3-15 km/h, Humidity 40-80%, Precipitation 0 mm
    let isSpraySafe = true;
    let advisoryReason = 'OPTIMAL: Atmospheric parameters are within ICAR foliar spray safety margins';
    let sprayWindow = 'Condition-dependent: apply while parameters remain within safe ranges';

    if (temp === undefined || temp === null || humidity === undefined || humidity === null || windSpeed === undefined || windSpeed === null) {
      isSpraySafe = false;
      advisoryReason = 'Advisory unavailable: Incomplete meteorological telemetry';
      sprayWindow = 'Unavailable';
    } else if (code >= 51 || precipitation > 0) {
      isSpraySafe = false;
      advisoryReason = 'UNSAFE: Active precipitation or rain wash-off risk';
      sprayWindow = 'Postponed until crop canopy dries completely';
    } else if (windSpeed > 15) {
      isSpraySafe = false;
      advisoryReason = `UNSAFE: High wind velocity (${windSpeed} km/h > 15 km/h) causes excessive droplet drift`;
      sprayWindow = 'Postponed until sustained wind falls below 15 km/h';
    } else if (windSpeed < 3) {
      isSpraySafe = false;
      advisoryReason = `UNSAFE: Near-calm wind (${windSpeed} km/h < 3 km/h) creates surface temperature inversion risk`;
      sprayWindow = 'Postponed until active atmospheric mixing (>3 km/h)';
    } else if (temp > 32) {
      isSpraySafe = false;
      advisoryReason = `UNSAFE: High ambient temperature (${temp}°C > 32°C) causes rapid droplet evaporation and phytotoxicity`;
      sprayWindow = 'Postponed until ambient temperature drops below 32°C';
    } else if (temp < 15) {
      isSpraySafe = false;
      advisoryReason = `UNSAFE: Low ambient temperature (${temp}°C < 15°C) impedes foliar absorption`;
      sprayWindow = 'Postponed until ambient temperature exceeds 15°C';
    } else if (humidity > 80) {
      isSpraySafe = false;
      advisoryReason = `UNSAFE: High relative humidity (${humidity}% > 80%) impairs droplet drying and promotes fungal spore germination`;
      sprayWindow = 'Postponed until relative humidity drops below 80%';
    } else if (humidity < 40) {
      isSpraySafe = false;
      advisoryReason = `UNSAFE: Low relative humidity (${humidity}% < 40%) induces rapid droplet vaporization before leaf uptake`;
      sprayWindow = 'Postponed until relative humidity exceeds 40%';
    }

    return reply.status(200).send({
      status: 'AVAILABLE',
      source: 'Open-Meteo Weather API (NWP Forecast Model)',
      provider: 'Open-Meteo',
      location: {
        district: districtRaw || 'Agricultural Field Coordinates',
        state: stateRaw || 'Telangana',
        latitude: lat,
        longitude: lon
      },
      retrievedAt: new Date().toISOString(),
      observationTime: current.time || new Date().toISOString(),
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
        status: advisoryReason,
        window: sprayWindow
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
 * Helper to extract authenticated user id from request or headers
 */
function getAuthenticatedUserId(request: FastifyRequest): string {
  const reqUser = (request as any).user;
  if (reqUser && reqUser.id) return reqUser.id;
  const headerUserId = request.headers['x-user-id'] as string;
  if (headerUserId) return headerUserId;
  return '00000000-0000-0000-0000-000000000001';
}

/**
 * P0.4: Genuine Persistent Price Alerts API
 */
export async function createPriceAlert(request: FastifyRequest, reply: FastifyReply) {
  const userId = getAuthenticatedUserId(request);
  const body = request.body as any;
  const crop = body?.crop ? String(body.crop).trim() : '';
  const commodity = body?.commodity ? String(body.commodity).trim() : crop;
  const targetPrice = parseFloat(body?.targetPrice ?? body?.target_price);
  const mandi = body?.mandi ? String(body.mandi).trim() : 'APMC Yard';
  const condition = (body?.condition || 'ABOVE').toUpperCase();
  const idempotencyKey = (request.headers['x-idempotency-key'] as string) || body?.idempotency_key || null;

  if (!crop || isNaN(targetPrice) || targetPrice <= 0) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Crop and a positive target price are required to create a price alert'
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
        message: 'A price alert with this idempotency key already exists'
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
  const userId = getAuthenticatedUserId(request);
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
  const userId = getAuthenticatedUserId(request);
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
 * P0.4: Evaluate active price alerts and trigger genuine notifications
 */
export async function evaluatePriceAlerts(commodity: string, mandi: string, currentPrice: number) {
  try {
    const result = await pool.query(
      `SELECT * FROM public.price_alerts WHERE status = 'ACTIVE'`,
      []
    );
    const activeAlerts = result.rows.filter(a => {
      const matchCrop = (a.crop || '').toLowerCase() === commodity.toLowerCase() ||
                        (a.commodity || '').toLowerCase() === commodity.toLowerCase();
      const matchMandi = !a.mandi || a.mandi === 'APMC Yard' || mandi === 'APMC Yard' ||
                         a.mandi.toLowerCase() === mandi.toLowerCase();
      return matchCrop && matchMandi;
    });

    for (const alert of activeAlerts) {
      const target = Number(alert.target_price);
      const isAboveMet = alert.condition === 'ABOVE' && currentPrice >= target;
      const isBelowMet = alert.condition === 'BELOW' && currentPrice <= target;

      if (isAboveMet || isBelowMet) {
        // Mark alert TRIGGERED
        await pool.query(
          `UPDATE public.price_alerts SET status = $1 WHERE id = $2 AND user_id = $3`,
          ['TRIGGERED', alert.id, alert.user_id]
        );

        // Insert genuine notification
        await pool.query(
          `INSERT INTO public.notifications (user_id, event_source, event_id, category, title, body)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            alert.user_id,
            'PRICE_ALERT_ENGINE',
            alert.id,
            'PRICE_ALERT',
            `${alert.crop} Price Alert Triggered`,
            `${alert.crop} at ${mandi} has reached ₹${currentPrice.toLocaleString('en-IN')}/Qtl (Target: ${alert.condition} ₹${target.toLocaleString('en-IN')}/Qtl).`
          ]
        );
      }
    }
  } catch (err) {
    console.error('Error evaluating price alerts:', err);
  }
}

/**
 * P0.5: Genuine Notifications API
 */
export async function getNotifications(request: FastifyRequest, reply: FastifyReply) {
  const userId = getAuthenticatedUserId(request);
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
    return reply.status(500).send({ error: 'DATABASE_ERROR', message: 'Failed to retrieve notifications' });
  }
}

export async function getUnreadNotificationsCount(request: FastifyRequest, reply: FastifyReply) {
  const userId = getAuthenticatedUserId(request);
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
    return reply.status(200).send({
      unreadCount: 0,
      timestamp: new Date().toISOString()
    });
  }
}

export async function markNotificationRead(request: FastifyRequest, reply: FastifyReply) {
  const userId = getAuthenticatedUserId(request);
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
  const userId = getAuthenticatedUserId(request);
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

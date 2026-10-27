import { FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../config/db';

export const logTelemetry = async (request: FastifyRequest, reply: FastifyReply) => {
  const { nitrogen, phosphorus, potassium, ph, organic_carbon, moisture } = request.body as any;
  const userId = request.user?.id;

  if (nitrogen === undefined || phosphorus === undefined || potassium === undefined || ph === undefined || organic_carbon === undefined || moisture === undefined) {
    return reply.status(400).send({ error: 'All soil telemetry fields (NPK, pH, organic carbon, moisture) are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO public.soil_telemetry (user_id, nitrogen, phosphorus, potassium, ph, organic_carbon, moisture) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, nitrogen, phosphorus, potassium, ph, organic_carbon, moisture]
    );
    return reply.status(201).send(result.rows[0]);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ error: 'Failed to record subsoil telemetry data' });
  }
};

export const getLatestTelemetry = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  try {
    const result = await pool.query(
      'SELECT * FROM public.soil_telemetry WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) {
      return reply.status(200).send({
        status: 'no_data',
        message: 'No subsoil telemetry recorded for this user. Connect an authorized IoT probe or upload a verified soil health card.',
        data: null
      });
    }

    return reply.send(result.rows[0]);
  } catch (err) {
    console.error(err);
    return reply.status(500).send({ error: 'Failed to query subsoil telemetry' });
  }
};

import { FastifyRequest, FastifyReply } from 'fastify';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { pool } from '../config/db';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('AUTH_CONFIGURATION_ERROR: JWT secret is not configured');
  }
  return secret.trim();
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error('AUTH_CONFIGURATION_ERROR: Dedicated JWT refresh secret (JWT_REFRESH_SECRET) is not configured');
  }
  return secret.trim();
};

export const register = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password, role } = request.body as any;

  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password are required' });
  }

  if (password.length < 8) {
    return reply.status(400).send({ error: 'Password must be at least 8 characters long' });
  }

  // SECURITY: Prevent privilege escalation via public self-registration.
  // Administrative roles cannot be claimed by arbitrary callers during signup.
  if (role === 'admin') {
    return reply.status(403).send({ error: 'Forbidden: Self-registration for administrative roles is prohibited' });
  }

  const validPublicRoles = ['farmer', 'buyer', 'driver'];
  const userRole = role ? role.toLowerCase() : 'farmer';
  if (!validPublicRoles.includes(userRole)) {
    return reply.status(400).send({ error: 'Invalid user role specified. Permitted roles: farmer, buyer, driver' });
  }

  try {
    const jwtSecret = getJwtSecret();
    const refreshSecret = getRefreshSecret();

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO public.users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hash, userRole]
    );

    const user = result.rows[0];
    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '15m', algorithm: 'HS256' });
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d', algorithm: 'HS256' });

    const refreshHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await pool.query(
      'INSERT INTO public.refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [refreshHash, user.id, expiresAt]
    );

    return reply.status(201).send({ accessToken, refreshToken, user });
  } catch (err: any) {
    if (err.message?.includes('AUTH_CONFIGURATION_ERROR')) {
      request.log.error(err.message);
      return reply.status(500).send({ error: 'Internal server error: Authentication service is misconfigured' });
    }
    if (err.code === '23505') {
      return reply.status(409).send({ error: 'Email address is already registered' });
    }
    request.log.error(err);
    return reply.status(500).send({ error: 'Internal server registration error' });
  }
};

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  const { email, password } = request.body as any;

  if (!email || !password) {
    return reply.status(400).send({ error: 'Email and password are required' });
  }

  try {
    const jwtSecret = getJwtSecret();
    const refreshSecret = getRefreshSecret();

    const result = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return reply.status(401).send({ error: 'Invalid email or password credentials' });
    }

    const accessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '15m', algorithm: 'HS256' });
    const refreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d', algorithm: 'HS256' });

    const refreshHash = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO public.refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [refreshHash, user.id, expiresAt]
    );

    return reply.send({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err: any) {
    if (err.message?.includes('AUTH_CONFIGURATION_ERROR')) {
      request.log.error(err.message);
      return reply.status(500).send({ error: 'Internal server error: Authentication service is misconfigured' });
    }
    request.log.error(err);
    return reply.status(500).send({ error: 'Internal server login error' });
  }
};

export const refresh = async (request: FastifyRequest, reply: FastifyReply) => {
  const { refreshToken } = request.body as any;

  if (!refreshToken) {
    return reply.status(400).send({ error: 'Refresh token is required' });
  }

  try {
    const jwtSecret = getJwtSecret();
    const refreshSecret = getRefreshSecret();

    const decoded = jwt.verify(refreshToken, refreshSecret, { algorithms: ['HS256'] }) as { id: string };
    
    // Look up the active user tokens
    const tokensRes = await pool.query(
      'SELECT * FROM public.refresh_tokens WHERE user_id = $1 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP',
      [decoded.id]
    );

    let matchedToken = null;
    for (const t of tokensRes.rows) {
      const match = await bcrypt.compare(refreshToken, t.token_hash);
      if (match) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      // Security Alert: Potential refresh token reuse/replay attack.
      // Revoke all tokens for safety.
      await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE user_id = $1', [decoded.id]);
      return reply.status(403).send({ error: 'Security Exception: Token reuse detected. Sessions revoked.' });
    }

    // Revoke the old token (rotation mechanism)
    await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE id = $1', [matchedToken.id]);

    // Fetch user details
    const userRes = await pool.query('SELECT id, email, role FROM public.users WHERE id = $1', [decoded.id]);
    if (userRes.rows.length === 0) {
      return reply.status(404).send({ error: 'User associated with token not found' });
    }

    const user = userRes.rows[0];
    const newAccessToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '15m', algorithm: 'HS256' });
    const newRefreshToken = jwt.sign({ id: user.id }, refreshSecret, { expiresIn: '7d', algorithm: 'HS256' });

    const refreshHash = await bcrypt.hash(newRefreshToken, 8);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO public.refresh_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [refreshHash, user.id, expiresAt]
    );

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err: any) {
    if (err.message?.includes('AUTH_CONFIGURATION_ERROR')) {
      request.log.error(err.message);
      return reply.status(500).send({ error: 'Internal server error: Authentication service is misconfigured' });
    }
    return reply.status(401).send({ error: 'Invalid or expired refresh token' });
  }
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
  const { refreshToken } = request.body as any;

  if (!refreshToken) {
    return reply.status(400).send({ error: 'Refresh token is required to execute logout cleanups' });
  }

  try {
    const refreshSecret = getRefreshSecret();
    const decoded = jwt.verify(refreshToken, refreshSecret, { algorithms: ['HS256'] }) as { id: string };
    const tokensRes = await pool.query('SELECT * FROM public.refresh_tokens WHERE user_id = $1 AND revoked = FALSE', [decoded.id]);

    for (const t of tokensRes.rows) {
      const match = await bcrypt.compare(refreshToken, t.token_hash);
      if (match) {
        await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE id = $1', [t.id]);
        break;
      }
    }

    return reply.send({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    return reply.send({ success: true, message: 'Token already expired or invalid, session purged' });
  }
};

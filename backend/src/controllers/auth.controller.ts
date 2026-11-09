import { FastifyRequest, FastifyReply } from 'fastify';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { pool } from '../config/db';
import { 
  getJwtSecret, 
  getJwtRefreshSecret, 
  getJwtIssuer, 
  getJwtAudience 
} from '../middleware/auth';

/**
 * Safely digests and hashes refresh tokens using SHA-256 pre-hashing + bcrypt.
 * Pre-hashing with SHA-256 avoids bcrypt's 72-byte truncation vulnerability,
 * ensuring long JWT tokens with unique jti claims are never collided.
 */
export const hashRefreshToken = async (token: string): Promise<string> => {
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  return bcrypt.hash(digest, 8);
};

export const compareRefreshToken = async (token: string, tokenHash: string): Promise<boolean> => {
  const digest = crypto.createHash('sha256').update(token).digest('hex');
  return bcrypt.compare(digest, tokenHash);
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
    const refreshSecret = getJwtRefreshSecret();
    const tokenIssuer = getJwtIssuer();
    const tokenAudience = getJwtAudience();

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO public.users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hash, userRole]
    );

    const user = result.rows[0];
    const accessToken = jwt.sign(
      { 
        sub: String(user.id),
        id: String(user.id),
        userId: String(user.id),
        email: user.email, 
        role: user.role,
        app_metadata: { role: user.role }
      }, 
      jwtSecret, 
      { 
        expiresIn: '15m', 
        algorithm: 'HS256',
        audience: tokenAudience,
        issuer: tokenIssuer
      }
    );
    const refreshToken = jwt.sign(
      { 
        sub: String(user.id),
        id: String(user.id),
        token_type: 'refresh',
        jti: crypto.randomUUID()
      }, 
      refreshSecret, 
      { 
        expiresIn: '7d', 
        algorithm: 'HS256',
        audience: 'nukrop-refresh',
        issuer: tokenIssuer
      }
    );

    const refreshHash = await hashRefreshToken(refreshToken);
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
    const refreshSecret = getJwtRefreshSecret();
    const tokenIssuer = getJwtIssuer();
    const tokenAudience = getJwtAudience();

    const result = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid email or password credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return reply.status(401).send({ error: 'Invalid email or password credentials' });
    }

    const accessToken = jwt.sign(
      { 
        sub: String(user.id),
        id: String(user.id),
        userId: String(user.id),
        email: user.email, 
        role: user.role,
        app_metadata: { role: user.role }
      }, 
      jwtSecret, 
      { 
        expiresIn: '15m', 
        algorithm: 'HS256',
        audience: tokenAudience,
        issuer: tokenIssuer
      }
    );
    const refreshToken = jwt.sign(
      { 
        sub: String(user.id),
        id: String(user.id),
        token_type: 'refresh',
        jti: crypto.randomUUID()
      }, 
      refreshSecret, 
      { 
        expiresIn: '7d', 
        algorithm: 'HS256',
        audience: 'nukrop-refresh',
        issuer: tokenIssuer
      }
    );

    const refreshHash = await hashRefreshToken(refreshToken);
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
    const refreshSecret = getJwtRefreshSecret();
    const tokenIssuer = getJwtIssuer();
    const tokenAudience = getJwtAudience();

    const decoded = jwt.verify(refreshToken, refreshSecret, { 
      algorithms: ['HS256'],
      audience: 'nukrop-refresh',
      issuer: tokenIssuer
    }) as { sub?: string; id?: string };
    
    const userId = decoded.sub || decoded.id;

    // Look up the active user tokens
    const tokensRes = await pool.query(
      'SELECT * FROM public.refresh_tokens WHERE user_id = $1 AND revoked = FALSE AND expires_at > CURRENT_TIMESTAMP',
      [userId]
    );

    let matchedToken = null;
    for (const t of tokensRes.rows) {
      const match = await compareRefreshToken(refreshToken, t.token_hash);
      if (match) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      // Security Alert: Potential refresh token reuse/replay attack.
      // Revoke all tokens for safety.
      await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE user_id = $1', [userId]);
      return reply.status(403).send({ error: 'Security Exception: Token reuse detected. Sessions revoked.' });
    }

    // Revoke the old token (rotation mechanism)
    await pool.query('UPDATE public.refresh_tokens SET revoked = TRUE WHERE id = $1', [matchedToken.id]);

    // Fetch user details
    const userRes = await pool.query('SELECT id, email, role FROM public.users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return reply.status(404).send({ error: 'User associated with token not found' });
    }

    const user = userRes.rows[0];
    const newAccessToken = jwt.sign(
      { 
        sub: String(user.id),
        id: String(user.id),
        userId: String(user.id),
        email: user.email, 
        role: user.role,
        app_metadata: { role: user.role }
      }, 
      jwtSecret, 
      { 
        expiresIn: '15m', 
        algorithm: 'HS256',
        audience: tokenAudience,
        issuer: tokenIssuer
      }
    );
    const newRefreshToken = jwt.sign(
      { 
        sub: String(user.id),
        id: String(user.id),
        token_type: 'refresh',
        jti: crypto.randomUUID()
      }, 
      refreshSecret, 
      { 
        expiresIn: '7d', 
        algorithm: 'HS256',
        audience: 'nukrop-refresh',
        issuer: tokenIssuer
      }
    );

    const refreshHash = await hashRefreshToken(newRefreshToken);
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
    const refreshSecret = getJwtRefreshSecret();
    const tokenIssuer = getJwtIssuer();
    const decoded = jwt.verify(refreshToken, refreshSecret, { 
      algorithms: ['HS256'],
      audience: 'nukrop-refresh',
      issuer: tokenIssuer
    }) as { sub?: string; id?: string };
    
    const userId = decoded.sub || decoded.id;
    const tokensRes = await pool.query('SELECT * FROM public.refresh_tokens WHERE user_id = $1 AND revoked = FALSE', [userId]);

    for (const t of tokensRes.rows) {
      const match = await compareRefreshToken(refreshToken, t.token_hash);
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

/**
 * Updates the authenticated user's public profile discovery setting (opt-in / opt-out).
 * SECURITY & PRIVACY:
 * 1. Strictly owner-only: Binds to request.user.id extracted from verified JWT claims.
 * 2. Never permits arbitrary client mutation of another user's visibility.
 * 3. Immediate revocation: Setting public_profile_enabled = FALSE immediately filters out
 *    the user from public.public_profiles view.
 */
export const updateProfileDiscovery = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  }

  const body = (request.body as any) || {};
  const enabled = body.enabled !== undefined ? body.enabled : body.public_profile_enabled;

  if (typeof enabled !== 'boolean') {
    return reply.status(400).send({ 
      error: 'Missing or invalid "enabled" parameter. A boolean value (true/false) is required.' 
    });
  }

  try {
    const matchingProfiles = await pool.query(
      `SELECT id, user_id, public_profile_enabled FROM public.profiles 
       WHERE (id = $1 OR user_id = $1)`,
      [userId]
    );

    if (matchingProfiles.rows.length === 0) {
      return reply.status(404).send({ error: 'Profile not found for authenticated user' });
    }

    if (matchingProfiles.rows.length > 1) {
      return reply.status(409).send({ 
        error: 'Ambiguous identity mapping: Multiple profiles match authenticated user. Ambiguous update rejected.',
        code: 'AMBIGUOUS_IDENTITY'
      });
    }

    const canonicalProfile = matchingProfiles.rows[0];

    const result = await pool.query(
      `UPDATE public.profiles 
       SET public_profile_enabled = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, public_profile_enabled`,
      [enabled, canonicalProfile.id]
    );

    return reply.send({
      success: true,
      public_profile_enabled: Boolean(result.rows[0].public_profile_enabled),
      message: enabled 
        ? 'Public profile discovery enabled: Your approved public profile is now discoverable.' 
        : 'Public profile discovery revoked: Your profile is immediately hidden from public discovery.'
    });
  } catch (err: any) {
    request.log.error(err, 'Failed to update profile discovery setting');
    return reply.status(500).send({ error: 'Internal server error while updating profile discovery setting' });
  }
};

/**
 * Retrieves the authenticated user's current public profile discovery setting.
 */
export const getProfileDiscovery = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = request.user?.id;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
  }

  try {
    const matchingProfiles = await pool.query(
      `SELECT id, user_id, public_profile_enabled FROM public.profiles 
       WHERE (id = $1 OR user_id = $1)`,
      [userId]
    );

    if (matchingProfiles.rows.length === 0) {
      return reply.status(404).send({ error: 'Profile not found for authenticated user' });
    }

    if (matchingProfiles.rows.length > 1) {
      return reply.status(409).send({ 
        error: 'Ambiguous identity mapping: Multiple profiles match authenticated user.',
        code: 'AMBIGUOUS_IDENTITY'
      });
    }

    return reply.send({
      success: true,
      public_profile_enabled: Boolean(matchingProfiles.rows[0].public_profile_enabled)
    });
  } catch (err: any) {
    request.log.error(err, 'Failed to fetch profile discovery setting');
    return reply.status(500).send({ error: 'Internal server error while fetching profile discovery setting' });
  }
};

import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';

/**
 * Retrieves the authoritative JWT verification secret from environment variables.
 * Fails closed: Never returns a default, hardcoded, or insecure fallback secret.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('AUTH_CONFIGURATION_ERROR: JWT verification secret is not configured');
  }
  return secret.trim();
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'farmer' | 'buyer' | 'admin' | 'driver';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

const ALLOWED_ROLES: ('farmer' | 'buyer' | 'admin' | 'driver')[] = ['farmer', 'buyer', 'admin', 'driver'];

/**
 * Extracts the authoritative role from the decoded JWT payload.
 * SECURITY: Never trusts client-supplied user_metadata to grant privileged roles like 'admin'.
 * Only trusted server-managed app_metadata or service_role claims are permitted for elevated privileges.
 */
export const extractAuthoritativeRole = (decoded: any): 'farmer' | 'buyer' | 'admin' | 'driver' => {
  // 1. Check server-authoritative app_metadata role (set via Supabase Admin API / backend only)
  const appRole = decoded.app_metadata?.role?.toLowerCase();
  if (appRole && ALLOWED_ROLES.includes(appRole)) {
    return appRole;
  }

  // 2. Check Supabase service_role claim
  if (decoded.role === 'service_role') {
    return 'admin';
  }

  // 3. Check standard system role if not admin
  const standardRole = decoded.role?.toLowerCase();
  if (standardRole === 'driver' || standardRole === 'buyer') {
    return standardRole;
  }

  // 4. Client-supplied user_metadata is untrusted for administrative roles.
  // Only non-privileged roles ('farmer', 'buyer') may be assigned as fallback defaults.
  const userMetadataRole = decoded.user_metadata?.role?.toLowerCase();
  if (userMetadataRole === 'buyer') {
    return 'buyer';
  }

  // Default safe unprivileged role
  return 'farmer';
};

/**
 * Verifies and decodes a JWT token using strict signature, audience, and algorithm checks.
 */
export const verifyAuthToken = (token: string, secretOverride?: string): any => {
  const secret = secretOverride || getJwtSecret();
  const expectedAudience = process.env.SUPABASE_JWT_AUDIENCE || 'authenticated';

  const options: jwt.VerifyOptions = {
    algorithms: ['HS256'],
    audience: expectedAudience
  };

  // If SUPABASE_URL is configured, verify issuer
  if (process.env.SUPABASE_URL) {
    options.issuer = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
  }

  // Strict verification: audience, algorithms, expiry, signature.
  // Absolutely no audience bypass or retry without audience validation.
  return jwt.verify(token, secret, options);
};

/**
 * Fastify authentication middleware.
 * Verifies bearer token, determines authoritative role, and fails closed with sanitized responses.
 */
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Missing or malformed authorization header' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized: Empty authorization token provided' });
    }

    let secret: string;
    try {
      secret = getJwtSecret();
    } catch (configErr) {
      // Fail closed: Log internal error without exposing details or stack traces to client
      request.log.error('Authentication failed: Missing JWT verification secret in environment');
      return reply.status(401).send({ error: 'Unauthorized: Authentication service unavailable or misconfigured' });
    }

    const decoded = verifyAuthToken(token, secret);

    const userId = decoded.sub || decoded.id;
    if (!userId || typeof userId !== 'string' && typeof userId !== 'number') {
      return reply.status(401).send({ error: 'Unauthorized: Invalid token payload subject identifier' });
    }

    const role = extractAuthoritativeRole(decoded);

    request.user = {
      id: String(userId),
      email: typeof decoded.email === 'string' ? decoded.email : '',
      role
    };
  } catch (err: any) {
    // Sanitized fail-closed responses. Zero internal details, secret disclosure, or stack traces leaked.
    return reply.status(401).send({ 
      error: 'Unauthorized: Invalid or expired authentication credentials'
    });
  }
};

/**
 * Fastify role-based authorization guard.
 * Strictly verifies authenticated user's role against permitted roles.
 */
export const requireRole = (allowedRoles: ('farmer' | 'buyer' | 'admin' | 'driver')[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Forbidden: Insufficient privileges for this resource' });
    }
  };
};

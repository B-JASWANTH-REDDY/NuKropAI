import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';

const getJwtSecret = (): string => {
  return process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'SUPER_SECURE_JWT_SECRET_KEY_12345';
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

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized: Missing or invalid authorization header format. Expected Bearer <token>' });
      return;
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      reply.status(401).send({ error: 'Unauthorized: Empty bearer token provided' });
      return;
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      reply.status(401).send({ error: 'Unauthorized: Token payload missing valid subject/id claim' });
      return;
    }

    const role = (decoded.user_metadata?.role || decoded.role || 'farmer').toLowerCase();

    request.user = {
      id: String(userId),
      email: decoded.email || '',
      role: (role === 'driver' ? 'driver' : (role === 'admin' ? 'admin' : (role === 'buyer' ? 'buyer' : 'farmer')))
    };
  } catch (err: any) {
    reply.status(401).send({ 
      error: 'Unauthorized: Access token has expired, signature is invalid, or secret mismatch',
      details: err?.message || 'Invalid token'
    });
  }
};

export const requireRole = (allowedRoles: ('farmer' | 'buyer' | 'admin' | 'driver')[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.status(401).send({ error: 'Unauthorized: User authentication required' });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden: You do not have permission to access this resource' });
      return;
    }
  };
};


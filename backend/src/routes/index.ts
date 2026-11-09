import { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes';
import mandiRoutes from './mandi.routes';
import pestRoutes from './pest.routes';
import soilRoutes from './soil.routes';
import valveRoutes from './valve.routes';
import iotRoutes from './iot.routes';
import contractRoutes from './contract.routes';
import simulationRoutes from './simulation.routes';
import geoRoutes from './geo.routes';
import aiRoutes from './ai.routes';
import dispatchRoutes from './dispatch.routes';
import landSurveyRoutes from './land_survey.routes';
import communityRoutes from './community.routes';

export default async function apiRoutes(fastify: FastifyInstance) {
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(communityRoutes, { prefix: '/community' });
  fastify.register(mandiRoutes, { prefix: '/mandi' });
  // Frontend calls /pests/... so prefix must be /pests
  fastify.register(pestRoutes, { prefix: '/pests' });
  fastify.register(soilRoutes, { prefix: '/soil' });
  // Frontend calls /irrigation/valves/... so prefix must be /irrigation
  fastify.register(valveRoutes, { prefix: '/irrigation' });
  fastify.register(iotRoutes, { prefix: '/iot' });
  // Frontend calls /contracts/... 
  fastify.register(contractRoutes, { prefix: '/contracts' });
  // Frontend calls /simulations/...
  fastify.register(simulationRoutes, { prefix: '/simulations' });
  // Geospatial Farm & Zone routing
  fastify.register(geoRoutes, { prefix: '/geo' });
  // AI Engine Routing
  fastify.register(aiRoutes, { prefix: '/ai' });
  // Real-Time Driver Marketplace & Dispatch (Phase 7)
  fastify.register(dispatchRoutes, { prefix: '/dispatch' });
  // Land Survey Intelligence (honest provenance, PENDING_AUTHORIZATION sources)
  fastify.register(landSurveyRoutes, { prefix: '/land-survey' });
}

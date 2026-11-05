import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getLandSurveyCoverage,
  searchLandParcels,
  getParcelById,
  getParcelProvenance,
  getParcelGeometry,
  claimParcel,
  getFarmerLinkedParcels
} from '../controllers/land_survey.controller';

export default async function landSurveyRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/land-survey/coverage
   * Public endpoint: returns source registry showing which states are covered
   * and what permission status each source has.
   * No authentication required — transparency is a feature.
   */
  fastify.get('/coverage', getLandSurveyCoverage);

  /**
   * GET /api/v1/land-survey/search
   * Authenticated: search parcels in our authorized dataset.
   * Query params: state, district, mandal, village, survey_number, subdivision, limit, offset
   * Returns ONLY records from APPROVED sources.
   * Returns honest empty state if no APPROVED sources have data.
   */
  fastify.get('/search', { preHandler: [authenticate] }, searchLandParcels);

  /**
   * GET /api/v1/land-survey/parcels/:id
   * Authenticated: get parcel details by UUID.
   */
  fastify.get('/parcels/:id', { preHandler: [authenticate] }, getParcelById);

  /**
   * GET /api/v1/land-survey/parcels/:id/provenance
   * Authenticated: get full data provenance panel for a parcel.
   */
  fastify.get('/parcels/:id/provenance', { preHandler: [authenticate] }, getParcelProvenance);

  /**
   * GET /api/v1/land-survey/parcels/:id/geometry
   * Authenticated: get GeoJSON geometry for a parcel.
   * Returns 404 with explanation if geometry is unavailable.
   */
  fastify.get('/parcels/:id/geometry', { preHandler: [authenticate] }, getParcelGeometry);

  /**
   * POST /api/v1/land-survey/parcels/:id/claim
   * Authenticated: farmer links a parcel to their account.
   * Sets claim_status = FARMER_CLAIMED (not government-verified).
   * Idempotent via Idempotency-Key header.
   */
  fastify.post('/parcels/:id/claim', { preHandler: [authenticate] }, claimParcel);

  /**
   * GET /api/v1/land-survey/my-parcels
   * Authenticated: get all parcels linked by the authenticated farmer.
   */
  fastify.get('/my-parcels', { preHandler: [authenticate] }, getFarmerLinkedParcels);
}


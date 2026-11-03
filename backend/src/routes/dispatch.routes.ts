import { FastifyInstance } from 'fastify';
import {
  setDutyStatus,
  recordLocationPing,
  getNearbyDrivers,
  createBookingRequest,
  acceptBooking,
  updateTripStatus,
  trackBooking
} from '../controllers/dispatch.controller';
import { authenticate, requireRole } from '../middleware/auth';

export default async function dispatchRoutes(fastify: FastifyInstance) {
  // 1. Driver Duty Toggle (ON DUTY / OFF DUTY)
  fastify.post('/duty', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, setDutyStatus);

  // 2. Real-Time Driver GPS Location Update
  fastify.post('/location', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, recordLocationPing);

  // 3. Farmer Nearby Driver Discovery (10 km PostGIS Search)
  fastify.get('/nearby', {
    preHandler: [authenticate]
  }, getNearbyDrivers);

  // 4. Create Haul Booking Request
  fastify.post('/book', {
    preHandler: [authenticate, requireRole(['farmer', 'admin'])]
  }, createBookingRequest);

  // 5. Atomic Booking Acceptance by Driver
  fastify.post('/accept', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, acceptBooking);

  // 6. Trip Lifecycle Progression (Arrived, In Transit, Completed, Cancelled)
  fastify.post('/trip-status', {
    preHandler: [authenticate]
  }, updateTripStatus);

  // 7. Live Driver Tracking Stream (Authorized Participants Only)
  fastify.get('/track/:bookingId', {
    preHandler: [authenticate]
  }, trackBooking);
}

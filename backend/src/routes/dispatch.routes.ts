import { FastifyInstance } from 'fastify';
import {
  setDutyStatus,
  getDriverMe,
  getDriverInbox,
  getRegisteredVehicles,
  registerVehicle,
  updateVehicle,
  recordLocationPing,
  getNearbyDrivers,
  createBookingRequest,
  acceptBooking,
  rejectOffer,
  timeoutOffer,
  verifyBookingOtp,
  cancelBooking,
  updateTripStatus,
  trackBooking,
  getChatMessages,
  sendChatMessage,
  getRentalInventory,
  addRentalEquipment,
  bookRental,
  extendRental,
  getMyRentals,
  updateRentalStatus
} from '../controllers/dispatch.controller';
import { authenticate, requireRole } from '../middleware/auth';

export default async function dispatchRoutes(fastify: FastifyInstance) {
  // ── 1. DRIVER DUTY & IDENTITY ──
  fastify.post('/duty', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, setDutyStatus);

  fastify.get('/driver/me', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, getDriverMe);

  fastify.get('/driver/inbox', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, getDriverInbox);

  // ── 2. VEHICLE MANAGEMENT ──
  fastify.get('/vehicles', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, getRegisteredVehicles);

  fastify.post('/vehicles', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, registerVehicle);

  fastify.put('/vehicles/:vehicleId', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, updateVehicle);

  // ── 3. REAL-TIME GPS TELEMETRY ──
  fastify.post('/location', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, recordLocationPing);

  // ── 4. FARMER NEARBY DRIVER DISCOVERY ──
  fastify.get('/nearby', {
    preHandler: [authenticate]
  }, getNearbyDrivers);

  // ── 5. HAUL BOOKINGS & CONCURRENCY-SAFE DISPATCH ──
  fastify.post('/book', {
    preHandler: [authenticate, requireRole(['farmer', 'admin'])]
  }, createBookingRequest);

  fastify.post('/accept', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, acceptBooking);

  fastify.post('/reject', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, rejectOffer);

  fastify.post('/offers/timeout', {
    preHandler: [authenticate]
  }, timeoutOffer);

  // ── 6. CRYPTOGRAPHIC OTP VERIFICATION ──
  fastify.post('/verify-otp', {
    preHandler: [authenticate, requireRole(['driver', 'admin'])]
  }, verifyBookingOtp);

  // ── 7. SYNCHRONIZED CANCELLATION ──
  fastify.post('/cancel', {
    preHandler: [authenticate]
  }, cancelBooking);

  // ── 8. TRIP LIFECYCLE PROGRESSION & TRACKING ──
  fastify.post('/trip-status', {
    preHandler: [authenticate]
  }, updateTripStatus);

  fastify.get('/track/:bookingId', {
    preHandler: [authenticate]
  }, trackBooking);

  // ── 9. IN-TRIP SCOPED MESSAGING ──
  fastify.get('/chat/:bookingId', {
    preHandler: [authenticate]
  }, getChatMessages);

  fastify.post('/chat/:bookingId', {
    preHandler: [authenticate]
  }, sendChatMessage);

  // ── 10. EQUIPMENT & MACHINERY RENTALS ──
  fastify.get('/rentals/inventory', {
    preHandler: [authenticate]
  }, getRentalInventory);

  fastify.post('/rentals/inventory', {
    preHandler: [authenticate]
  }, addRentalEquipment);

  fastify.post('/rentals/book', {
    preHandler: [authenticate, requireRole(['farmer', 'admin'])]
  }, bookRental);

  fastify.post('/rentals/:rentalId/extend', {
    preHandler: [authenticate]
  }, extendRental);

  fastify.get('/rentals/my-bookings', {
    preHandler: [authenticate]
  }, getMyRentals);

  fastify.post('/rentals/:rentalId/status', {
    preHandler: [authenticate]
  }, updateRentalStatus);
}

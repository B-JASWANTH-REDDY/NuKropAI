enum TripStatus {
  requested,
  accepted,
  arrived,
  inTransit,
  completed,
  cancelled
}

class GramHaulTrip {
  final String id;
  final String farmerId;
  final String farmerName;
  final String pickupLocation;
  final String destinationMandi;
  final String crop;
  final double weightQuintals;
  final double estimatedFare;
  final String otpPin;
  final String? driverId;
  final String? driverName;
  final String? vehicleNumber;
  final TripStatus status;
  final DateTime createdAt;

  const GramHaulTrip({
    required this.id,
    required this.farmerId,
    required this.farmerName,
    required this.pickupLocation,
    required this.destinationMandi,
    required this.crop,
    required this.weightQuintals,
    required this.estimatedFare,
    required this.otpPin,
    this.driverId,
    this.driverName,
    this.vehicleNumber,
    this.status = TripStatus.requested,
    required this.createdAt,
  });

  GramHaulTrip copyWith({
    String? driverId,
    String? driverName,
    String? vehicleNumber,
    TripStatus? status,
  }) {
    return GramHaulTrip(
      id: id,
      farmerId: farmerId,
      farmerName: farmerName,
      pickupLocation: pickupLocation,
      destinationMandi: destinationMandi,
      crop: crop,
      weightQuintals: weightQuintals,
      estimatedFare: estimatedFare,
      otpPin: otpPin,
      driverId: driverId ?? this.driverId,
      driverName: driverName ?? this.driverName,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      status: status ?? this.status,
      createdAt: createdAt,
    );
  }
}

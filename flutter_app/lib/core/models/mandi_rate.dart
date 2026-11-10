class MandiRate {
  final String id;
  final String mandiName;
  final String state;
  final String district;
  final String commodity;
  final double modalPrice;
  final double minPrice;
  final double maxPrice;
  final String priceUnit;
  final DateTime arrivalDate;
  final String trend; // 'UP', 'DOWN', 'STABLE'

  const MandiRate({
    required this.id,
    required this.mandiName,
    required this.state,
    required this.district,
    required this.commodity,
    required this.modalPrice,
    required this.minPrice,
    required this.maxPrice,
    this.priceUnit = '₹/Qtl',
    required this.arrivalDate,
    this.trend = 'UP',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'mandiName': mandiName,
        'state': state,
        'district': district,
        'commodity': commodity,
        'modalPrice': modalPrice,
        'minPrice': minPrice,
        'maxPrice': maxPrice,
        'priceUnit': priceUnit,
        'arrivalDate': arrivalDate.toIso8601String(),
        'trend': trend,
      };

  factory MandiRate.fromJson(Map<String, dynamic> json) {
    return MandiRate(
      id: json['id'] ?? '',
      mandiName: json['mandiName'] ?? 'Enumamula APMC',
      state: json['state'] ?? 'Telangana',
      district: json['district'] ?? 'Warangal',
      commodity: json['commodity'] ?? 'Cotton',
      modalPrice: (json['modalPrice'] ?? 7850).toDouble(),
      minPrice: (json['minPrice'] ?? 7200).toDouble(),
      maxPrice: (json['maxPrice'] ?? 8200).toDouble(),
      priceUnit: json['priceUnit'] ?? '₹/Qtl',
      arrivalDate: json['arrivalDate'] != null
          ? DateTime.parse(json['arrivalDate'])
          : DateTime.now(),
      trend: json['trend'] ?? 'UP',
    );
  }
}

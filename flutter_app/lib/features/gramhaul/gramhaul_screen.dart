import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/gramhaul_trip.dart';
import '../../shared/widgets/luxury_toast.dart';

class GramHaulScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const GramHaulScreen({super.key, this.onBack});

  @override
  State<GramHaulScreen> createState() => _GramHaulScreenState();
}

class _GramHaulScreenState extends State<GramHaulScreen> {
  final TextEditingController _weightController =
      TextEditingController(text: '40');
  String _selectedCrop = 'Cotton';
  String _destination = 'Enumamula APMC Yard';
  GramHaulTrip? _activeTrip;

  final List<Map<String, dynamic>> _availableTrucks = [
    {
      'driver': 'Suresh Yadav',
      'truck': 'Tata Ace Gold (1.5 Ton)',
      'reg': 'TS 03 UB 4491',
      'distance': '1.8 km away',
      'rating': '4.9 ★',
      'rate': '₹80 / Qtl',
    },
    {
      'driver': 'Raju Naik',
      'truck': 'Mahindra Bolero Maxi (2.5 Ton)',
      'reg': 'TS 04 EA 9920',
      'distance': '3.2 km away',
      'rating': '4.8 ★',
      'rate': '₹75 / Qtl',
    },
  ];

  void _bookHauler(Map<String, dynamic> truck) {
    final weight = double.tryParse(_weightController.text) ?? 40.0;
    final trip = GramHaulTrip(
      id: 'trip_${DateTime.now().millisecondsSinceEpoch}',
      farmerId: 'usr_jaswanth',
      farmerName: 'Jaswanth Reddy',
      pickupLocation: 'Himayath Nagar Farm Gate',
      destinationMandi: _destination,
      crop: _selectedCrop,
      weightQuintals: weight,
      estimatedFare: weight * 80.0,
      otpPin: '7824',
      driverName: truck['driver'],
      vehicleNumber: truck['reg'],
      status: TripStatus.accepted,
      createdAt: DateTime.now(),
    );

    setState(() {
      _activeTrip = trip;
    });

    LuxuryToast.show(
      context,
      message: 'Truck booked with ${trip.driverName}! OTP PIN: ${trip.otpPin}',
      icon: Icons.check_circle_rounded,
    );
  }

  @override
  void dispose() {
    _weightController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: widget.onBack,
              )
            : null,
        title: const Text('GramHaul Rural Freight'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_activeTrip != null) ...[
              Card(
                color: AppConstants.primaryLight,
                margin: EdgeInsets.zero,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            '🚚 Trip IN TRANSIT',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppConstants.primaryDark,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'OTP PIN: ${_activeTrip!.otpPin}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: AppConstants.primaryDark,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Driver: ${_activeTrip!.driverName} (${_activeTrip!.vehicleNumber})',
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Route: ${_activeTrip!.pickupLocation} ➔ ${_activeTrip!.destinationMandi}',
                        style: const TextStyle(
                            fontSize: 12, color: AppConstants.textMuted),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Est. Fare: ₹${_activeTrip!.estimatedFare.toInt()} (${_activeTrip!.weightQuintals.toInt()} Qtl ${_activeTrip!.crop})',
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () {
                          LuxuryToast.show(
                            context,
                            message:
                                'Trip completed! Dynamic UPI QR generated for payment.',
                          );
                          setState(() {
                            _activeTrip = null;
                          });
                        },
                        child: const Text('Complete Trip & Pay Driver'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Request Freight Haul',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedCrop,
                            decoration:
                                const InputDecoration(labelText: 'Crop'),
                            items: ['Cotton', 'Chilli', 'Paddy', 'Maize']
                                .map((c) =>
                                    DropdownMenuItem(value: c, child: Text(c)))
                                .toList(),
                            onChanged: (val) =>
                                setState(() => _selectedCrop = val!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: _weightController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Weight (Quintals)',
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _destination,
                      decoration:
                          const InputDecoration(labelText: 'Destination Mandi'),
                      items: [
                        'Enumamula APMC Yard',
                        'Warangal Grain Yard',
                        'Khammam Cotton Market',
                      ]
                          .map(
                              (m) => DropdownMenuItem(value: m, child: Text(m)))
                          .toList(),
                      onChanged: (val) => setState(() => _destination = val!),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Available Haulers Nearby (GPS Locked)',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            ..._availableTrucks.map(
              (truck) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppConstants.primaryLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.local_shipping_rounded,
                          color: AppConstants.primaryDark,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              truck['driver'],
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              '${truck["truck"]} • ${truck["reg"]}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppConstants.textMuted),
                            ),
                            Text(
                              '📍 ${truck["distance"]} • ${truck["rating"]}',
                              style: const TextStyle(
                                  fontSize: 11,
                                  color: AppConstants.primaryDark),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        children: [
                          Text(
                            truck['rate'],
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 6),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 8),
                            ),
                            onPressed: () => _bookHauler(truck),
                            child: const Text('Book',
                                style: TextStyle(fontSize: 12)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

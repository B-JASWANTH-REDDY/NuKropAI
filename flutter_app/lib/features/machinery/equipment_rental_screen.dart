import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../shared/widgets/luxury_toast.dart';

class EquipmentRentalScreen extends StatelessWidget {
  final VoidCallback? onBack;

  const EquipmentRentalScreen({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    final equipmentList = [
      {
        'title': 'John Deere 5310 4WD Tractor',
        'provider': 'CHC Warangal Central',
        'rate': '₹850 / hour',
        'implements': 'Rotavator, Reversible Plough',
        'distance': '3.2 km away',
      },
      {
        'title': 'IoTechWorld 10L Agri Spray Drone',
        'provider': 'Kisan Drone Hub Telangana',
        'rate': '₹450 / acre',
        'implements': 'ULV Micron Atomizer Nozzles',
        'distance': '5.0 km away',
      },
      {
        'title': 'Kubota Multi-Crop Combine Harvester',
        'provider': 'Telangana Rythu Seva CHC',
        'rate': '₹2,200 / acre',
        'implements': 'Grain tank with unloading auger',
        'distance': '8.1 km away',
      },
    ];

    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        leading: onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: onBack,
              )
            : null,
        title: const Text('CHC Machinery & Drone Rental'),
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: equipmentList.length,
        itemBuilder: (context, index) {
          final item = equipmentList[index];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          item['title']!,
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w800),
                        ),
                      ),
                      Text(
                        item['rate']!,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppConstants.primaryDark,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item["provider"]} • 📍 ${item["distance"]}',
                    style: const TextStyle(
                        fontSize: 12, color: AppConstants.textMuted),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Attachment: ${item["implements"]}',
                    style: const TextStyle(
                        fontSize: 12, color: AppConstants.textDark),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      ElevatedButton(
                        onPressed: () {
                          LuxuryToast.show(
                            context,
                            message: 'Booking requested for ${item["title"]}!',
                            icon: Icons.check_circle_rounded,
                          );
                        },
                        child: const Text('Book Machinery'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

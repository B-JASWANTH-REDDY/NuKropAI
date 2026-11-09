import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../shared/widgets/luxury_toast.dart';

class BioShieldRadarScreen extends StatelessWidget {
  final VoidCallback? onBack;

  const BioShieldRadarScreen({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    final alerts = [
      {
        'title': 'Pink Bollworm (Pectinophora gossypiella)',
        'crop': 'Cotton',
        'location': 'Warangal Rural (8.4 km away)',
        'severity': 'CRITICAL',
        'advice':
            'Pheromone trap counts exceed 8 moths/night. Install rosette flower traps immediately.',
      },
      {
        'title': 'Chilli Black Thrips (Thrips parvispinus)',
        'crop': 'Chilli',
        'location': 'Nandyal District (24 km away)',
        'severity': 'HIGH',
        'advice':
            'Border planting of maize and sorghum acts as physical barrier. Spray spinosad if threshold >5/leaf.',
      },
      {
        'title': 'Yellow Mosaic Virus (YMV)',
        'crop': 'Soybean & Pulses',
        'location': 'Nizamabad (42 km away)',
        'severity': 'WATCH',
        'advice':
            'Whitefly vector migration observed. Apply neem oil 1500 ppm prophylactically.',
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
        title: const Text('BioShield Outbreak Radar'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              LuxuryToast.show(
                context,
                message: 'Pest surveillance telemetry updated.',
              );
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: AppConstants.primaryLight,
            margin: EdgeInsets.zero,
            child: const Padding(
              padding: EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(Icons.radar_rounded,
                      color: AppConstants.primaryDark, size: 32),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '25 km Active Surveillance Active',
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppConstants.primaryDark),
                        ),
                        Text(
                          'Connected to ICAR-CRIDA & Telangana Agrarian Early Warning Sensor Grid',
                          style: TextStyle(
                              fontSize: 11, color: AppConstants.textDark),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Active Outbreak Warnings Near You',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          ...alerts.map(
            (a) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppConstants.dangerRed.withAlpha(20),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            a['severity']!,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppConstants.dangerRed,
                            ),
                          ),
                        ),
                        Text(
                          a['location']!,
                          style: const TextStyle(
                              fontSize: 11, color: AppConstants.textMuted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      a['title']!,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Crop affected: ${a["crop"]}',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppConstants.primaryDark),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      a['advice']!,
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppConstants.textDark,
                          height: 1.3),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

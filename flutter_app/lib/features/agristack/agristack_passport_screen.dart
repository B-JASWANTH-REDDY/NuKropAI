import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../shared/widgets/luxury_toast.dart';

class AgriStackPassportScreen extends StatelessWidget {
  final VoidCallback? onBack;

  const AgriStackPassportScreen({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        leading: onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: onBack,
              )
            : null,
        title: const Text('AgriStack Land & Soil Passport'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppConstants.primaryLight,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.verified_user_rounded, color: AppConstants.primaryDark),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Cadastral Parcel #42/A',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                              ),
                              Text(
                                'Himayath Nagar, Warangal Rural • 4.50 Acres',
                                style: TextStyle(fontSize: 12, color: AppConstants.textMuted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    _buildRow('Farmer Name', 'B. Jaswanth Reddy'),
                    _buildRow('Kisan Registry ID', 'IND-TEL-WAR-88194'),
                    _buildRow('Survey Sub-division', 'Sy. No. 42 / Hissa 1-A'),
                    _buildRow('Irrigation Source', 'Borewell (Drip Micro-irrigation)'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Soil Health Card Telemetry',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildSoilChip('pH 7.2', 'Neutral'),
                        _buildSoilChip('OC 0.64%', 'Medium'),
                        _buildSoilChip('EC 0.38', 'Normal'),
                      ],
                    ),
                    const Divider(height: 24),
                    const Text(
                      'Primary Nutrients (N - P - K):',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    _buildNutrientBar('Nitrogen (N)', 0.35, 'LOW (185 kg/ha)', AppConstants.dangerRed),
                    _buildNutrientBar('Phosphorus (P)', 0.65, 'MEDIUM (22 kg/ha)', AppConstants.accentGold),
                    _buildNutrientBar('Potassium (K)', 0.85, 'HIGH (340 kg/ha)', AppConstants.primaryGreen),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              icon: const Icon(Icons.download_rounded, size: 18),
              label: const Text('Download Government Soil Health Card'),
              onPressed: () {
                LuxuryToast.show(
                  context,
                  message: 'Official Soil Health Card PDF downloaded.',
                  icon: Icons.check_circle_rounded,
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppConstants.textMuted)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildSoilChip(String title, String status) {
    return Column(
      children: [
        Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppConstants.primaryDark)),
        const SizedBox(height: 2),
        Text(status, style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
      ],
    );
  }

  Widget _buildNutrientBar(String nutrient, double progress, String val, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(nutrient, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
              Text(val, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
            ],
          ),
          const SizedBox(height: 4),
          LinearProgressIndicator(
            value: progress,
            backgroundColor: AppConstants.borderSubtle,
            color: color,
            borderRadius: BorderRadius.circular(4),
            minHeight: 6,
          ),
        ],
      ),
    );
  }
}


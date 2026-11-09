import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
import '../../core/models/weather_info.dart';
import '../../shared/widgets/luxury_toast.dart';

class HomeScreen extends StatelessWidget {
  final UserSession session;
  final Function(String) onNavigateToScreen;
  final VoidCallback onOpenNotifications;
  final VoidCallback onOpenLanguageSheet;

  const HomeScreen({
    super.key,
    required this.session,
    required this.onNavigateToScreen,
    required this.onOpenNotifications,
    required this.onOpenLanguageSheet,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildTopHeader(context),
              const SizedBox(height: 16),
              _buildCropSelectorRow(context),
              const SizedBox(height: 16),
              _buildLiveMandiCard(context),
              const SizedBox(height: 12),
              _buildWeatherSprayAdvisoryCard(context),
              const SizedBox(height: 16),
              _buildCoreOperationsHeader(),
              const SizedBox(height: 12),
              _buildAgrarianOperationsGrid(context),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopHeader(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppConstants.primaryLight,
            shape: BoxShape.circle,
            border: Border.all(color: AppConstants.primaryGreen, width: 1.5),
          ),
          child: Center(
            child: Text(
              session.name.isNotEmpty ? session.name[0] : 'K',
              style: const TextStyle(
                color: AppConstants.primaryDark,
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'Namaste, ${session.name.split(' ').first}',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppConstants.textDark,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.verified_rounded,
                    color: AppConstants.primaryGreen,
                    size: 16,
                  ),
                ],
              ),
              Text(
                '${session.district}, ${session.state}',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppConstants.textMuted,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          icon: const Icon(Icons.language_rounded, color: AppConstants.textDark),
          onPressed: onOpenLanguageSheet,
        ),
        Stack(
          children: [
            IconButton(
              icon: const Icon(
                Icons.notifications_none_rounded,
                color: AppConstants.textDark,
              ),
              onPressed: onOpenNotifications,
            ),
            Positioned(
              right: 10,
              top: 10,
              child: Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppConstants.dangerRed,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCropSelectorRow(BuildContext context) {
    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        children: [
          ...session.activeCrops.map(
            (crop) => Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppConstants.primaryGreen.withAlpha(80),
                  width: 1.2,
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.eco_rounded,
                    color: AppConstants.primaryGreen,
                    size: 14,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    crop,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppConstants.primaryDark,
                    ),
                  ),
                ],
              ),
            ),
          ),
          InkWell(
            onTap: () {
              LuxuryToast.show(
                context,
                message: 'Manage your farm crops in Profile settings.',
              );
            },
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppConstants.primaryLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Row(
                children: [
                  Icon(
                    Icons.add_rounded,
                    color: AppConstants.primaryDark,
                    size: 14,
                  ),
                  SizedBox(width: 4),
                  Text(
                    'Add Crop',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppConstants.primaryDark,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveMandiCard(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppConstants.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.storefront_rounded,
                        color: AppConstants.primaryDark,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Live Mandi Rates',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppConstants.textDark,
                          ),
                        ),
                        Text(
                          'Warangal APMC Yard',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppConstants.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () => onNavigateToScreen(AppConstants.viewMarket),
                  child: const Text(
                    'View All >',
                    style: TextStyle(
                      color: AppConstants.primaryGreen,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Cotton (Medium Staple)',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppConstants.textDark,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'MSP: ₹7,121 / Qtl',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppConstants.textMuted,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      '₹7,850 / Qtl',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppConstants.primaryDark,
                      ),
                    ),
                    Row(
                      children: [
                        const Icon(
                          Icons.arrow_upward_rounded,
                          size: 12,
                          color: AppConstants.primaryGreen,
                        ),
                        Text(
                          '+₹120 today',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppConstants.primaryGreen,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeatherSprayAdvisoryCard(BuildContext context) {
    const weather = WeatherInfo.sample;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.wb_sunny_rounded,
                      color: AppConstants.accentGold,
                      size: 28,
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${weather.temperature.toInt()}°C • ${weather.condition}',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppConstants.textDark,
                          ),
                        ),
                        Text(
                          'H: ${weather.tempHigh.toInt()}°C  L: ${weather.tempLow.toInt()}°C',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppConstants.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppConstants.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'SAFE TO SPRAY',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppConstants.primaryDark,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppConstants.surfaceBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildWeatherMetric(Icons.water_drop_outlined, 'Humidity', '${weather.humidity}%'),
                  _buildWeatherMetric(Icons.air_rounded, 'Wind', '${weather.windSpeed} km/h'),
                  _buildWeatherMetric(Icons.access_time_rounded, 'Window', '07:30 - 10:30 AM'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeatherMetric(IconData icon, String title, String value) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppConstants.textMuted),
        const SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 10, color: AppConstants.textMuted),
            ),
            Text(
              value,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppConstants.textDark,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCoreOperationsHeader() {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Core Farming Operations',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppConstants.textDark,
          ),
        ),
      ],
    );
  }

  Widget _buildAgrarianOperationsGrid(BuildContext context) {
    final modules = [
      {
        'title': 'Crop Doctor',
        'subtitle': 'AI Disease Scan',
        'icon': Icons.camera_alt_rounded,
        'screen': AppConstants.viewScanner,
        'color': AppConstants.primaryGreen,
      },
      {
        'title': 'GramHaul Freight',
        'subtitle': 'Rural Transport',
        'icon': Icons.local_shipping_rounded,
        'screen': AppConstants.viewGramHaul,
        'color': const Color(0xFF2563EB),
      },
      {
        'title': 'Digital Land',
        'subtitle': 'AgriStack & Soil',
        'icon': Icons.map_rounded,
        'screen': AppConstants.viewAgriStack,
        'color': const Color(0xFFD97706),
      },
      {
        'title': 'Farm Khata',
        'subtitle': 'Bookkeeping Ledger',
        'icon': Icons.account_balance_wallet_rounded,
        'screen': AppConstants.viewKhata,
        'color': const Color(0xFF7C3AED),
      },
      {
        'title': 'BioRx Dosage',
        'subtitle': 'Tank Mix Dilution',
        'icon': Icons.science_rounded,
        'screen': AppConstants.viewBioRx,
        'color': const Color(0xFF059669),
      },
      {
        'title': 'BioShield Radar',
        'subtitle': 'Pest Outbreaks',
        'icon': Icons.radar_rounded,
        'screen': AppConstants.viewBioShield,
        'color': const Color(0xFFDC2626),
      },
      {
        'title': 'CHC Machinery',
        'subtitle': 'Equipment Rental',
        'icon': Icons.precision_manufacturing_rounded,
        'screen': AppConstants.viewEquipment,
        'color': const Color(0xFF0284C7),
      },
      {
        'title': 'KCC Loan',
        'subtitle': 'Credit Limits',
        'icon': Icons.credit_score_rounded,
        'screen': AppConstants.viewLoan,
        'color': const Color(0xFF0D9488),
      },
      {
        'title': 'AI Agronomist',
        'subtitle': 'Expert Chat',
        'icon': Icons.forum_rounded,
        'screen': AppConstants.viewChat,
        'color': const Color(0xFF4F46E5),
      },
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: modules.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 0.88,
      ),
      itemBuilder: (context, index) {
        final mod = modules[index];
        final color = mod['color'] as Color;
        return InkWell(
          onTap: () => onNavigateToScreen(mod['screen'] as String),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppConstants.borderSubtle),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: color.withAlpha(25),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    mod['icon'] as IconData,
                    color: color,
                    size: 22,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  mod['title'] as String,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppConstants.textDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  mod['subtitle'] as String,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppConstants.textMuted,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

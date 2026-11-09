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
              const SizedBox(height: 10),
              _buildMarketTicker(context),
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
        Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppConstants.primaryLight,
                shape: BoxShape.circle,
                border: Border.all(color: AppConstants.primaryGreen, width: 1.5),
              ),
              child: const Center(
                child: Icon(
                  Icons.eco_rounded,
                  color: AppConstants.primaryGreen,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'NuKropAI',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: AppConstants.primaryDark,
                letterSpacing: -0.3,
              ),
            ),
          ],
        ),
        const Spacer(),
        GestureDetector(
          onTap: onOpenLanguageSheet,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'English',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppConstants.textDark,
                  ),
                ),
                SizedBox(width: 4),
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 16,
                  color: AppConstants.textDark,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppConstants.primaryLight.withAlpha(140),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                padding: EdgeInsets.zero,
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: AppConstants.textDark,
                  size: 20,
                ),
                onPressed: onOpenNotifications,
              ),
            ),
            Positioned(
              right: -1,
              top: -1,
              child: Container(
                padding: const EdgeInsets.all(2),
                constraints: const BoxConstraints(
                  minWidth: 16,
                  minHeight: 16,
                ),
                decoration: BoxDecoration(
                  color: AppConstants.dangerRed,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: const Center(
                  child: Text(
                    '4',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      height: 1.0,
                    ),
                  ),
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
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppConstants.primaryLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.bar_chart_rounded,
                          color: AppConstants.primaryGreen,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Live Mandi Rates',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: AppConstants.textDark,
                                  ),
                                ),
                                SizedBox(width: 4),
                                Icon(
                                  Icons.refresh_rounded,
                                  size: 14,
                                  color: AppConstants.textMuted,
                                ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                const Icon(
                                  Icons.location_on_rounded,
                                  size: 12,
                                  color: AppConstants.dangerRed,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  '${session.district.isNotEmpty ? session.district : "Markapur"} APMC',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: AppConstants.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '₹8,000',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: AppConstants.textDark,
                          ),
                        ),
                        Text(
                          ' /Qtl',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppConstants.textMuted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppConstants.primaryLight,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        '🏛️ Agmarknet Live',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: AppConstants.primaryDark,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.show_chart_rounded, size: 14),
                    label: const Text(
                      'Price Trend',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppConstants.textDark,
                      side: BorderSide(color: Colors.grey.shade300),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: () => onNavigateToScreen(AppConstants.viewMarket),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.notifications_active_outlined, size: 14),
                    label: const Text(
                      'Set Price Alert',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppConstants.textDark,
                      side: BorderSide(color: Colors.grey.shade300),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                    onPressed: () {
                      LuxuryToast.show(
                        context,
                        message: 'Price Alert set for ${session.activeCrops.firstOrNull ?? "Cotton"} at ₹8,200',
                        icon: Icons.check_circle_rounded,
                      );
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMarketTicker(BuildContext context) {
    return GestureDetector(
      onTap: () => onNavigateToScreen(AppConstants.viewMarket),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppConstants.primaryLight,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                '🌾 MARKET',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppConstants.primaryDark,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Expanded(
              child: Text(
                'Markapur APMC • Paddy ₹2,380 • Chilli ₹18,400 • Cotton ₹7,850',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppConstants.textDark,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 16,
              color: AppConstants.textMuted,
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

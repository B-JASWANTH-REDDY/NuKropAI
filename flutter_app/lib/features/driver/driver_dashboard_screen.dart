import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
import '../../shared/widgets/luxury_toast.dart';

class DriverDashboardScreen extends StatelessWidget {
  final UserSession session;
  final VoidCallback onLogout;
  final VoidCallback? onBack;

  const DriverDashboardScreen({
    super.key,
    required this.session,
    required this.onLogout,
    this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final availableLoads = [
      {
        'farmer': 'B. Jaswanth Reddy',
        'crop': 'Cotton (40 Qtl)',
        'pickup': 'Himayath Nagar Farm Gate',
        'drop': 'Enumamula APMC Yard (18 km)',
        'fare': '₹3,200',
      },
      {
        'farmer': 'K. Narayana',
        'crop': 'Red Chilli (25 Qtl)',
        'pickup': 'Nandyal Rural Depot',
        'drop': 'Guntur Mirchi Yard (65 km)',
        'fare': '₹5,800',
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
        title: const Text('GramHaul Driver Cockpit'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: onLogout,
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            color: const Color(0xFF1E3A8A),
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        session.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppConstants.primaryGreen,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'ONLINE & DISPATCHABLE',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Vehicle: Tata Ace Gold • Reg: TS 03 UB 4491',
                    style: TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                  const Divider(color: Colors.white24, height: 20),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Today\'s Trips: 3 Completed', style: TextStyle(color: Colors.white, fontSize: 12)),
                      Text('Earnings: ₹9,400', style: TextStyle(color: AppConstants.accentGold, fontSize: 14, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Available Freight Loads Nearby',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          ...availableLoads.map(
            (load) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          load['crop']!,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                        ),
                        Text(
                          load['fare']!,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: AppConstants.primaryDark,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Farmer: ${load["farmer"]}', style: const TextStyle(fontSize: 12, color: AppConstants.textMuted)),
                    const SizedBox(height: 4),
                    Text('Route: ${load["pickup"]} ➔ ${load["drop"]}', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () {
                        LuxuryToast.show(
                          context,
                          message: 'Accepted load! Navigating to farm pickup.',
                          icon: Icons.check_circle_rounded,
                        );
                      },
                      child: const Center(child: Text('Accept Load')),
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


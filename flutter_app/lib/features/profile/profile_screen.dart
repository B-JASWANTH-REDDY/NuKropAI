import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/user_session.dart';
import '../../core/storage/secure_storage.dart';
import '../../shared/widgets/luxury_toast.dart';

class ProfileScreen extends StatelessWidget {
  final UserSession session;
  final VoidCallback onLogout;
  final VoidCallback onReplaySplash;
  final VoidCallback onOpenLanguageSheet;
  final VoidCallback? onBack;

  const ProfileScreen({
    super.key,
    required this.session,
    required this.onLogout,
    required this.onReplaySplash,
    required this.onOpenLanguageSheet,
    this.onBack,
  });

  void _showDpdpNotice(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('DPDP 2023 Farmer Rights'),
        content: const SingleChildScrollView(
          child: Text(
            'Under India’s Digital Personal Data Protection Act, 2023:\n\n'
            '• You retain full ownership of your farm, soil, and yield data.\n'
            '• You have the right to access and export your farm records.\n'
            '• You can withdraw consent or request account deletion at any time.\n'
            '• NuKropAI will never monetize or sell your location or harvest data to third-party ad brokers.',
            style: TextStyle(fontSize: 13, height: 1.4),
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Understood'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAccount(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Account & Farm Data'),
        content: const Text(
          'Are you sure you want to permanently delete your NuKropAI account? '
          'All your farm khata records, soil tests, and disease scan history will be wiped.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppConstants.dangerRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await SecureStorage.clearSession();
              onLogout();
            },
            child: const Text('Permanently Delete'),
          ),
        ],
      ),
    );
  }

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
        title: const Text('Kisan Profile & Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: AppConstants.primaryLight,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppConstants.primaryGreen, width: 2),
                      ),
                      child: Center(
                        child: Text(
                          session.name.isNotEmpty ? session.name[0] : 'K',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            color: AppConstants.primaryDark,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                session.name,
                                style: const TextStyle(
                                  fontSize: 16,
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
                          const SizedBox(height: 2),
                          Text(
                            session.phone.isNotEmpty
                                ? session.phone
                                : '+91 98765 43210',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppConstants.textMuted,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${session.district}, ${session.state} • ${session.isFarmer ? "Farmer" : "Logistics Driver"}',
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: AppConstants.primaryDark,
                            ),
                          ),
                        ],
                      ),
                    ),
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
                      'Farm Profile Overview',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppConstants.textDark,
                      ),
                    ),
                    const Divider(height: 20),
                    _buildProfileRow(
                        'Total Farm Land', '4.5 Acres (Warangal Rural)'),
                    _buildProfileRow(
                        'Active Cultivation', session.activeCrops.join(', ')),
                    _buildProfileRow(
                        'Soil Category', 'Black Cotton Soil (Vertisol)'),
                    _buildProfileRow(
                        'AgriStack Farmer ID', 'AP-TEL-2026-88194'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              margin: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.language_rounded,
                        color: AppConstants.primaryGreen),
                    title: const Text('App Language',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: onOpenLanguageSheet,
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.play_circle_outline_rounded,
                        color: AppConstants.primaryGreen),
                    title: const Text('Replay Splash & App Tour',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: onReplaySplash,
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.privacy_tip_outlined,
                        color: AppConstants.primaryGreen),
                    title: const Text('DPDP 2023 Privacy Rights',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w600)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _showDpdpNotice(context),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.delete_outline_rounded,
                        color: AppConstants.dangerRed),
                    title: const Text('Delete Account & Farm Data',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppConstants.dangerRed)),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _confirmDeleteAccount(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppConstants.dangerRed,
                side: const BorderSide(color: AppConstants.borderSubtle),
              ),
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Sign Out of NuKropAI'),
              onPressed: () async {
                await SecureStorage.clearSession();
                if (context.mounted) {
                  LuxuryToast.show(context, message: 'Signed out cleanly.');
                }
                onLogout();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 12, color: AppConstants.textMuted)),
          Text(value,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppConstants.textDark)),
        ],
      ),
    );
  }
}

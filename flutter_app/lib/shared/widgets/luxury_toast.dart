import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';

class LuxuryToast {
  static void show(
    BuildContext context, {
    required String message,
    IconData icon = Icons.info_outline_rounded,
    Color color = AppConstants.primaryGreen,
    String? undoLabel,
    VoidCallback? onUndo,
  }) {
    final scaffoldMessenger = ScaffoldMessenger.of(context);
    scaffoldMessenger.clearSnackBars();
    scaffoldMessenger.showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppConstants.textDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        margin: const EdgeInsets.all(16),
        duration: Duration(seconds: undoLabel != null ? 5 : 3),
        content: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        action: undoLabel != null
            ? SnackBarAction(
                label: undoLabel,
                textColor: AppConstants.accentGold,
                onPressed: () {
                  if (onUndo != null) onUndo();
                },
              )
            : null,
      ),
    );
  }
}

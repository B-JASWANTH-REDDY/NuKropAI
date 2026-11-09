import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/storage/secure_storage.dart';
import '../../shared/widgets/luxury_toast.dart';

class LanguageSelectSheet extends StatelessWidget {
  final String currentLang;
  final ValueChanged<String> onLanguageSelected;

  const LanguageSelectSheet({
    super.key,
    required this.currentLang,
    required this.onLanguageSelected,
  });

  static const List<Map<String, String>> languages = [
    {'code': 'en', 'name': 'English', 'native': 'English'},
    {'code': 'hi', 'name': 'Hindi', 'native': 'हिन्दी'},
    {'code': 'te', 'name': 'Telugu', 'native': 'తెలుగు'},
    {'code': 'ta', 'name': 'Tamil', 'native': 'தமிழ்'},
    {'code': 'kn', 'name': 'Kannada', 'native': 'ಕನ್ನಡ'},
    {'code': 'mr', 'name': 'Marathi', 'native': 'मराठी'},
    {'code': 'pa', 'name': 'Punjabi', 'native': 'ਪੰਜਾਬੀ'},
    {'code': 'gu', 'name': 'Gujarati', 'native': 'ગુજરાતી'},
    {'code': 'bn', 'name': 'Bengali', 'native': 'বাংলা'},
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Select App Language',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: languages.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final lang = languages[index];
                final isSelected = lang['code'] == currentLang;
                return ListTile(
                  title: Text(
                    lang['name']!,
                    style: TextStyle(
                      fontWeight:
                          isSelected ? FontWeight.w800 : FontWeight.w500,
                      color: isSelected
                          ? AppConstants.primaryDark
                          : AppConstants.textDark,
                    ),
                  ),
                  subtitle: Text(lang['native']!),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle_rounded,
                          color: AppConstants.primaryGreen)
                      : null,
                  onTap: () async {
                    await SecureStorage.saveLanguage(lang['code']!);
                    onLanguageSelected(lang['code']!);
                    if (context.mounted) {
                      Navigator.pop(context);
                      LuxuryToast.show(
                        context,
                        message: 'Language changed to ${lang["name"]}',
                        icon: Icons.language_rounded,
                      );
                    }
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

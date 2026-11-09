import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/storage/secure_storage.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onOnboardingFinished;

  const OnboardingScreen({super.key, required this.onOnboardingFinished});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  final Set<String> _selectedCrops = {'Cotton', 'Chilli'};

  final List<Map<String, dynamic>> _slides = [
    {
      'title': 'Welcome to NuKropAI',
      'subtitle':
          'The AI-powered Agrarian Operating System designed to maximize your yield, reduce pest damage, and boost market profits.',
      'icon': Icons.agriculture_rounded,
    },
    {
      'title': 'Instant Crop Disease Doctor',
      'subtitle':
          'Take a photo of diseased leaves or stems to receive instant ICAR-verified diagnosis and custom chemical/organic treatment plans.',
      'icon': Icons.camera_alt_rounded,
    },
    {
      'title': 'Live APMC Mandi Rates',
      'subtitle':
          'Track genuine APMC prices from your local market yard with historical trend charts and price drop alerts.',
      'icon': Icons.trending_up_rounded,
    },
    {
      'title': 'Microclimate Spray Advisory',
      'subtitle':
          'Hyperlocal 3-hour spray windows based on wind speed, temperature, and rain probability to eliminate wasted chemicals.',
      'icon': Icons.wb_sunny_rounded,
    },
    {
      'title': 'GramHaul Freight Transport',
      'subtitle':
          'Connect with verified local truck haulers, track transport in real-time, and settle with secure OTP PIN authorization.',
      'icon': Icons.local_shipping_rounded,
    },
    {
      'title': 'Farm Khata Bookkeeping',
      'subtitle':
          'Track every rupee spent on seeds, fertilizers, and labor with automated profit & loss calculations and undo protection.',
      'icon': Icons.account_balance_wallet_rounded,
    },
    {
      'title': 'Kisan Community Network',
      'subtitle':
          'Share field observations, learn pest prevention techniques from fellow farmers, and consult verified agronomists.',
      'icon': Icons.people_alt_rounded,
    },
    {
      'title': 'Configure Your Crops',
      'subtitle':
          'Select the crops currently cultivated on your farm to personalize mandi rates, disease models, and spray calendars.',
      'icon': Icons.eco_rounded,
      'isCropPicker': true,
    },
  ];

  final List<String> _allCrops = [
    'Cotton',
    'Chilli',
    'Paddy',
    'Tomato',
    'Maize',
    'Soybean',
    'Sugarcane',
    'Wheat',
    'Groundnut',
    'Turmeric',
  ];

  void _finishOnboarding() async {
    if (_selectedCrops.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one crop.')),
      );
      return;
    }
    await SecureStorage.setOnboardingCompleted(true);
    widget.onOnboardingFinished();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Step ${_currentPage + 1} of ${_slides.length}',
                    style: const TextStyle(
                      color: AppConstants.textMuted,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  if (_currentPage < _slides.length - 1)
                    TextButton(
                      onPressed: () {
                        _pageController.jumpToPage(_slides.length - 1);
                      },
                      child: const Text(
                        'Skip',
                        style: TextStyle(
                          color: AppConstants.primaryGreen,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: _slides.length,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                itemBuilder: (context, index) {
                  final slide = _slides[index];
                  final isCropPicker = slide['isCropPicker'] == true;
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            color: AppConstants.primaryLight,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            slide['icon'] as IconData,
                            size: 40,
                            color: AppConstants.primaryGreen,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          slide['title'] as String,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppConstants.textDark,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          slide['subtitle'] as String,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 14,
                            color: AppConstants.textMuted,
                            height: 1.4,
                          ),
                        ),
                        if (isCropPicker) ...[
                          const SizedBox(height: 24),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            alignment: WrapAlignment.center,
                            children: _allCrops.map((crop) {
                              final isSelected = _selectedCrops.contains(crop);
                              return FilterChip(
                                label: Text(crop),
                                selected: isSelected,
                                selectedColor: AppConstants.primaryLight,
                                checkmarkColor: AppConstants.primaryDark,
                                labelStyle: TextStyle(
                                  color: isSelected
                                      ? AppConstants.primaryDark
                                      : AppConstants.textDark,
                                  fontWeight: isSelected
                                      ? FontWeight.w700
                                      : FontWeight.w500,
                                ),
                                onSelected: (selected) {
                                  setState(() {
                                    if (selected) {
                                      _selectedCrops.add(crop);
                                    } else {
                                      if (_selectedCrops.length > 1) {
                                        _selectedCrops.remove(crop);
                                      }
                                    }
                                  });
                                },
                              );
                            }).toList(),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                children: [
                  Row(
                    children: List.generate(
                      _slides.length,
                      (index) => Container(
                        width: _currentPage == index ? 20 : 6,
                        height: 6,
                        margin: const EdgeInsets.only(right: 4),
                        decoration: BoxDecoration(
                          color: _currentPage == index
                              ? AppConstants.primaryGreen
                              : AppConstants.borderSubtle,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ),
                  const Spacer(),
                  ElevatedButton(
                    onPressed: () {
                      if (_currentPage < _slides.length - 1) {
                        _pageController.nextPage(
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeInOut,
                        );
                      } else {
                        _finishOnboarding();
                      }
                    },
                    child: Text(
                      _currentPage == _slides.length - 1
                          ? 'Get Started'
                          : 'Next',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/crop_disease.dart';
import '../../shared/widgets/luxury_toast.dart';

class DiseaseScannerScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onShareToCommunity;

  const DiseaseScannerScreen({
    super.key,
    this.onBack,
    this.onShareToCommunity,
  });

  @override
  State<DiseaseScannerScreen> createState() => _DiseaseScannerScreenState();
}

class _DiseaseScannerScreenState extends State<DiseaseScannerScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _laserController;
  late Animation<double> _laserAnimation;
  bool _isAnalyzing = false;
  CropDisease? _diagnosticResult;

  @override
  void initState() {
    super.initState();
    _laserController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _laserAnimation = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _laserController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _laserController.dispose();
    super.dispose();
  }

  void _triggerScan() async {
    setState(() {
      _isAnalyzing = true;
      _diagnosticResult = null;
    });

    await Future.delayed(const Duration(milliseconds: 1400));

    setState(() {
      _isAnalyzing = false;
      _diagnosticResult = CropDisease.sample;
    });

    if (mounted) {
      LuxuryToast.show(
        context,
        message: 'Foliar diagnostic complete: ${_diagnosticResult!.diseaseName}',
        icon: Icons.check_circle_rounded,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                onPressed: widget.onBack,
              )
            : null,
        title: const Text(
          'AI Crop Disease Doctor',
          style: TextStyle(color: Colors.white),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              flex: 5,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    margin: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade900,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: _isAnalyzing
                            ? AppConstants.primaryGreen
                            : Colors.white.withAlpha(50),
                        width: 2,
                      ),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.eco_rounded,
                            size: 80,
                            color: Colors.green.shade700.withAlpha(120),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _isAnalyzing
                                ? 'Neural Vision Running ICAR Models...'
                                : 'Position diseased leaf inside frame',
                            style: TextStyle(
                              color: Colors.white.withAlpha(180),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_isAnalyzing)
                    AnimatedBuilder(
                      animation: _laserAnimation,
                      builder: (context, child) {
                        return Positioned(
                          top: 40 + (_laserAnimation.value * 280),
                          left: 30,
                          right: 30,
                          child: Container(
                            height: 3,
                            decoration: BoxDecoration(
                              color: AppConstants.primaryGreen,
                              boxShadow: [
                                BoxShadow(
                                  color: AppConstants.primaryGreen.withAlpha(200),
                                  blurRadius: 10,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
            if (_diagnosticResult != null)
              Expanded(
                flex: 4,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                _diagnosticResult!.diseaseName,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: AppConstants.textDark,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppConstants.dangerRed.withAlpha(25),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${(_diagnosticResult!.confidence * 100).toInt()}% CONFIDENCE',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: AppConstants.dangerRed,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _diagnosticResult!.scientificName,
                          style: const TextStyle(
                            fontStyle: FontStyle.italic,
                            fontSize: 12,
                            color: AppConstants.textMuted,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'ICAR Prescribed Treatments:',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppConstants.textDark,
                          ),
                        ),
                        const SizedBox(height: 6),
                        ..._diagnosticResult!.icarTreatments.map(
                          (treatment) => Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('• ', style: TextStyle(fontWeight: FontWeight.w800)),
                                Expanded(
                                  child: Text(
                                    treatment,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: AppConstants.textDark,
                                      height: 1.3,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                icon: const Icon(Icons.share_rounded, size: 16),
                                label: const Text('Share to Kisan Community'),
                                onPressed: () {
                                  if (widget.onShareToCommunity != null) {
                                    widget.onShareToCommunity!();
                                  } else {
                                    LuxuryToast.show(
                                      context,
                                      message: 'Prescription shared to Kisan Community Feed!',
                                    );
                                  }
                                },
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              Padding(
                padding: const EdgeInsets.all(24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.flash_on_rounded, color: Colors.white),
                      onPressed: () {},
                    ),
                    GestureDetector(
                      onTap: _isAnalyzing ? null : _triggerScan,
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 4),
                          color: AppConstants.primaryGreen,
                        ),
                        child: const Icon(
                          Icons.camera_alt_rounded,
                          color: Colors.white,
                          size: 32,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.photo_library_rounded, color: Colors.white),
                      onPressed: () => _triggerScan(),
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

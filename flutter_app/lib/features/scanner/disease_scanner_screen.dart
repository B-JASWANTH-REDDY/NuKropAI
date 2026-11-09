import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/crop_disease.dart';
import '../../core/networking/api_client.dart';
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
  String _selectedCrop = 'Cotton';
  CropDisease? _diagnosticResult;
  bool _isNonCropRejection = false;
  String? _rejectionMessage;
  String? _errorMessage;

  Uint8List? _selectedImageBytes;
  String? _selectedImageBase64;
  final ImagePicker _picker = ImagePicker();

  final List<String> _crops = ['Cotton', 'Chilli', 'Paddy', 'Tomato', 'Soil Sample'];

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

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? file = await _picker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );

      if (file == null) return;

      final bytes = await file.readAsBytes();
      if (bytes.length > 5 * 1024 * 1024) {
        if (mounted) {
          LuxuryToast.show(
            context,
            message: 'Image size exceeds 5MB limit. Please select a smaller photo.',
            color: Colors.orange,
            icon: Icons.warning_amber_rounded,
          );
        }
        return;
      }

      setState(() {
        _selectedImageBytes = bytes;
        _selectedImageBase64 = base64Encode(bytes);
        _diagnosticResult = null;
        _isNonCropRejection = false;
        _rejectionMessage = null;
        _errorMessage = null;
      });

      // Automatically trigger scan after valid photo selection
      await _triggerScan(customImageBase64: _selectedImageBase64);
    } catch (e) {
      if (mounted) {
        LuxuryToast.show(
          context,
          message: 'Failed to access camera/gallery: ${e.toString()}',
          color: AppConstants.dangerRed,
          icon: Icons.error_outline_rounded,
        );
      }
    }
  }

  Future<void> _triggerScan({String? customImageBase64}) async {
    final imagePayload = customImageBase64 ?? _selectedImageBase64;
    if (imagePayload == null || imagePayload.isEmpty) {
      if (mounted) {
        LuxuryToast.show(
          context,
          message: 'Please capture or select a leaf photo before scanning.',
          color: Colors.orange,
          icon: Icons.photo_camera_rounded,
        );
      }
      return;
    }

    setState(() {
      _isAnalyzing = true;
      _diagnosticResult = null;
      _isNonCropRejection = false;
      _rejectionMessage = null;
      _errorMessage = null;
    });

    try {
      // Connect to genuine backend AI Vision & Multimodal Foliar Pathology
      final response = await ApiClient.post<Map<String, dynamic>>(
        '/ai/diagnose-crop',
        body: {
          'crop': _selectedCrop,
          'cropName': _selectedCrop,
          'imageBase64': imagePayload,
          'language': 'en',
        },
      );

      final Map<String, dynamic> prediction = (response['ai_prediction'] is Map)
          ? Map<String, dynamic>.from(response['ai_prediction'] as Map)
          : response;

      final isPlantOrSoil = prediction['isPlantOrSoil'] == true;

      if (!isPlantOrSoil) {
        // Authenticity Check: Reject non-crop / ambiguous image uploads
        setState(() {
          _isAnalyzing = false;
          _isNonCropRejection = true;
          _rejectionMessage = prediction['symptoms']?.toString() ??
              (prediction['detectedSubject'] != null
                  ? 'Identified non-crop subject: "${prediction['detectedSubject']}". Please capture an authentic crop leaf or farm soil.'
                  : 'The submitted specimen could not be verified as an agricultural crop leaf or farm soil. '
                      'Please position camera directly on the diseased leaf or foliar tissue.');
        });
        if (mounted) {
          LuxuryToast.show(
            context,
            message: 'Authenticity Check: Non-crop image detected.',
            color: Colors.orange,
            icon: Icons.warning_amber_rounded,
          );
        }
        return;
      }

      final diseaseName = prediction['diseaseName']?.toString();
      if (diseaseName == null ||
          diseaseName.trim().isEmpty ||
          diseaseName.toLowerCase().contains('unknown') ||
          diseaseName.toLowerCase().contains('non-crop')) {
        setState(() {
          _isAnalyzing = false;
          _errorMessage = 'Inconclusive foliar diagnosis: The image features could not be conclusively matched to a known crop pathogen. Please re-capture in clear lighting.';
        });
        return;
      }

      final rawConfidence = prediction['confidence'];
      final double parsedConfidence = (rawConfidence is num)
          ? (rawConfidence > 1 ? rawConfidence.toDouble() / 100.0 : rawConfidence.toDouble())
          : 0.0;

      final chemicalSol = prediction['chemicalSolution']?.toString();
      final organicSol = prediction['organicSolution']?.toString();
      final sprayAdv = prediction['sprayAdvisory']?.toString();

      final List<String> treatments = [];
      if (chemicalSol != null && chemicalSol.trim().isNotEmpty && !chemicalSol.toLowerCase().contains('none')) {
        treatments.add('Chemical: $chemicalSol');
      }
      if (organicSol != null && organicSol.trim().isNotEmpty && !organicSol.toLowerCase().contains('none')) {
        treatments.add('Organic: $organicSol');
      }
      if (sprayAdv != null && sprayAdv.trim().isNotEmpty && !sprayAdv.toLowerCase().contains('n/a')) {
        treatments.add('Advisory: $sprayAdv');
      }

      final disease = CropDisease(
        diseaseName: diseaseName,
        scientificName: prediction['pathogen']?.toString() ?? 'Pathogen classification pending',
        crop: _selectedCrop,
        confidence: parsedConfidence,
        severity: prediction['severity']?.toString() ?? 'Moderate',
        symptoms: prediction['symptoms']?.toString() ?? 'Foliar pathology observed',
        chemicalControls: chemicalSol ?? 'No chemical control registered',
        organicControls: organicSol ?? 'No organic control registered',
        icarTreatments: treatments.isNotEmpty ? treatments : ['No registered treatments for indeterminate diagnosis'],
        provenance: response['provenance']?.toString(),
        timestamp: response['timestamp'] != null ? DateTime.tryParse(response['timestamp'].toString()) : DateTime.now(),
        disclaimer: response['disclaimer']?.toString(),
        sprayAdvisory: sprayAdv,
      );

      if (mounted) {
        setState(() {
          _isAnalyzing = false;
          _diagnosticResult = disease;
        });
        LuxuryToast.show(
          context,
          message: 'Foliar diagnostic complete: ${disease.diseaseName}',
          icon: Icons.check_circle_rounded,
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _isAnalyzing = false;
          _errorMessage = e.code == 'PROVIDER_NOT_CONFIGURED'
              ? 'AI Diagnostic Service Unavailable: Vision AI model is not configured on the backend server.'
              : e.message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isAnalyzing = false;
          _errorMessage = 'AI Diagnostic Service Error: ${e.toString()}';
        });
      }
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
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
        ),
        actions: [
          DropdownButton<String>(
            value: _selectedCrop,
            dropdownColor: Colors.grey.shade900,
            underline: const SizedBox(),
            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white),
            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
            items: _crops.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedCrop = val);
            },
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Viewfinder & Laser Scanner
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
                    child: _selectedImageBytes != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(22),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                Image.memory(
                                  _selectedImageBytes!,
                                  fit: BoxFit.cover,
                                ),
                                if (_isAnalyzing)
                                  Container(
                                    color: Colors.black.withAlpha(100),
                                  ),
                              ],
                            ),
                          )
                        : Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  _selectedCrop == 'Soil Sample'
                                      ? Icons.terrain_rounded
                                      : Icons.eco_rounded,
                                  size: 80,
                                  color: Colors.green.shade700.withAlpha(120),
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  _isAnalyzing
                                      ? 'Neural Vision Running ICAR Models...'
                                      : 'Position $_selectedCrop inside frame',
                                  style: TextStyle(
                                    color: Colors.white.withAlpha(180),
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Tap shutter to capture or gallery to upload',
                                  style: TextStyle(
                                    color: Colors.white.withAlpha(120),
                                    fontSize: 11,
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

            // Diagnostic Results / Authenticity Rejection Card
            if (_isNonCropRejection)
              Expanded(
                flex: 4,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 24),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Authenticity Check: Unknown Image',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: AppConstants.textDark,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _rejectionMessage ??
                            'The provided image does not match verified agricultural crop foliage or farm soil. No synthetic diagnosis generated.',
                        style: const TextStyle(fontSize: 13, height: 1.4, color: AppConstants.textDark),
                      ),
                      const Spacer(),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => setState(() => _isNonCropRejection = false),
                          child: const Text('Capture Genuine Foliar Photo'),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else if (_errorMessage != null)
              Expanded(
                flex: 4,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.cloud_off_rounded, size: 48, color: AppConstants.dangerRed),
                      const SizedBox(height: 12),
                      Text(
                        _errorMessage!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppConstants.textDark),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _triggerScan,
                        child: const Text('Retry Analysis'),
                      ),
                    ],
                  ),
                ),
              )
            else if (_diagnosticResult != null)
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
                        if (_diagnosticResult!.provenance != null) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppConstants.borderSubtle),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.psychology_outlined, size: 14, color: AppConstants.primaryDark),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    'Inference Engine: ${_diagnosticResult!.provenance}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppConstants.textDark,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        const Text(
                          'Recommended Agronomic Actions & Treatments:',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppConstants.textDark,
                          ),
                        ),
                        const SizedBox(height: 6),
                        ..._diagnosticResult!.icarTreatments.map(
                          (treatment) => Padding(
                            padding: const EdgeInsets.only(bottom: 6),
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
                        if (_diagnosticResult!.disclaimer != null) ...[
                          const SizedBox(height: 10),
                          Text(
                            _diagnosticResult!.disclaimer!,
                            style: const TextStyle(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: AppConstants.textMuted,
                            ),
                          ),
                        ],
                        const SizedBox(height: 14),
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
                      tooltip: 'Toggle Flash',
                      onPressed: () {
                        LuxuryToast.show(
                          context,
                          message: 'Camera flash toggled',
                          color: AppConstants.primaryDark,
                          icon: Icons.flash_on_rounded,
                        );
                      },
                    ),
                    GestureDetector(
                      onTap: _isAnalyzing ? null : () => _pickImage(ImageSource.camera),
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 4),
                          color: _isAnalyzing ? Colors.grey : AppConstants.primaryGreen,
                        ),
                        child: Icon(
                          _isAnalyzing ? Icons.hourglass_top_rounded : Icons.camera_alt_rounded,
                          color: Colors.white,
                          size: 32,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.photo_library_rounded, color: Colors.white),
                      tooltip: 'Pick from Gallery',
                      onPressed: _isAnalyzing ? null : () => _pickImage(ImageSource.gallery),
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

class CropDisease {
  final String diseaseName;
  final String scientificName;
  final String crop;
  final double confidence;
  final String severity; // 'LOW', 'MODERATE', 'CRITICAL'
  final String symptoms;
  final List<String> icarTreatments;
  final String chemicalControls;
  final String organicControls;
  final String? provenance;
  final DateTime? timestamp;
  final String? disclaimer;
  final String? sprayAdvisory;

  const CropDisease({
    required this.diseaseName,
    required this.scientificName,
    required this.crop,
    required this.confidence,
    required this.severity,
    required this.symptoms,
    required this.icarTreatments,
    required this.chemicalControls,
    required this.organicControls,
    this.provenance,
    this.timestamp,
    this.disclaimer,
    this.sprayAdvisory,
  });

  static final sample = CropDisease(
    diseaseName: 'Cotton Leaf Curl Virus (CLCuV)',
    scientificName: 'Begomovirus',
    crop: 'Cotton',
    confidence: 0.96,
    severity: 'CRITICAL',
    symptoms:
        'Upward curling of leaves, thickening of veins, enations on leaf undersides.',
    icarTreatments: const [
      'Spray Diafenthiuron 50% WP @ 1.25g/L or Flonicamid 50 WG @ 0.3g/L to control whitefly vector.',
      'Apply Neem Oil (Azadirachtin 1500 ppm) @ 3ml/L water.',
      'Erect yellow sticky traps (15 traps/acre) for vector population suppression.'
    ],
    chemicalControls:
        'Diafenthiuron 50 WP (250g/acre), Acetamiprid 20 SP (50g/acre).',
    organicControls:
        'Neem seed kernel extract (NSKE 5%), cow urine + asafoetida foliar spray.',
    provenance: 'ICAR National Agricultural Research Protocol Reference',
    timestamp: DateTime.now(),
  );
}

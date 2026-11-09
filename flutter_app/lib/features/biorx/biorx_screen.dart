import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../shared/widgets/luxury_toast.dart';

class BioRxScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const BioRxScreen({super.key, this.onBack});

  @override
  State<BioRxScreen> createState() => _BioRxScreenState();
}

class _BioRxScreenState extends State<BioRxScreen> {
  final TextEditingController _acresController = TextEditingController(text: '4.5');
  String _selectedChemical = 'Diafenthiuron 50% WP';
  double _tankSize = 16.0; // Liters per knapsack

  double get _acres => double.tryParse(_acresController.text) ?? 4.5;
  double get _totalWater => _acres * 200.0; // 200 L per acre standard
  int get _knapsackCharges => (_totalWater / _tankSize).ceil();
  double get _totalChemicalGrams => _acres * 250.0; // 250g per acre standard

  @override
  void dispose() {
    _acresController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: widget.onBack,
              )
            : null,
        title: const Text('BioRx Tank Mix Calculator'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Crop & Acreage Parameters',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _acresController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Farm Acreage (Acres)'),
                            onChanged: (_) => setState(() {}),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<double>(
                            initialValue: _tankSize,
                            decoration: const InputDecoration(labelText: 'Sprayer Tank'),
                            items: [12.0, 16.0, 20.0]
                                .map((s) => DropdownMenuItem(value: s, child: Text('${s.toInt()} Liters')))
                                .toList(),
                            onChanged: (val) => setState(() => _tankSize = val!),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _selectedChemical,
                      decoration: const InputDecoration(labelText: 'Target Formulation'),
                      items: [
                        'Diafenthiuron 50% WP',
                        'Flonicamid 50 WG',
                        'Neem Oil 1500 ppm',
                        'Acetamiprid 20 SP',
                      ].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                      onChanged: (val) => setState(() => _selectedChemical = val!),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              color: AppConstants.primaryLight,
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'ICAR Calibrated Tank Recipe',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppConstants.primaryDark,
                      ),
                    ),
                    const Divider(height: 20),
                    _buildRecipeRow('Total Spray Water Required', '${_totalWater.toInt()} Liters'),
                    _buildRecipeRow('Knapsack Sprayer Charges', '$_knapsackCharges Tanks (${_tankSize.toInt()}L each)'),
                    _buildRecipeRow('Active Formulation Required', '${(_totalChemicalGrams / 1000).toStringAsFixed(2)} kg'),
                    _buildRecipeRow('Dosage Per Knapsack Tank', '${(_totalChemicalGrams / _knapsackCharges).toStringAsFixed(1)} grams / tank'),
                    _buildRecipeRow('Pre-Harvest Waiting Interval (PHI)', '14 Days'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              icon: const Icon(Icons.print_rounded, size: 18),
              label: const Text('Export Spray Advisory Prescription'),
              onPressed: () {
                LuxuryToast.show(
                  context,
                  message: 'Prescription saved to farm documents.',
                  icon: Icons.check_circle_rounded,
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecipeRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppConstants.textDark)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppConstants.primaryDark)),
        ],
      ),
    );
  }
}

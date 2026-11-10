import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../shared/widgets/luxury_toast.dart';

class KccLoanScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const KccLoanScreen({super.key, this.onBack});

  @override
  State<KccLoanScreen> createState() => _KccLoanScreenState();
}

class _KccLoanScreenState extends State<KccLoanScreen> {
  final TextEditingController _acresController =
      TextEditingController(text: '4.5');
  double _scaleOfFinance = 42000.0; // ₹ per acre for Cotton

  double get _acres => double.tryParse(_acresController.text) ?? 4.5;
  double get _cropCreditLimit => _acres * _scaleOfFinance;
  double get _postHarvestComponent => _cropCreditLimit * 0.10;
  double get _maintenanceComponent => _cropCreditLimit * 0.20;
  double get _totalKccLimit =>
      _cropCreditLimit + _postHarvestComponent + _maintenanceComponent;

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
        title: const Text('KCC Loan Eligibility Calculator'),
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
                      'NABARD Scale of Finance Parameters',
                      style:
                          TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _acresController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          labelText: 'Cultivated Land Area (Acres)'),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<double>(
                      initialValue: _scaleOfFinance,
                      decoration: const InputDecoration(
                          labelText: 'Crop Category & District Scale'),
                      items: const [
                        DropdownMenuItem(
                            value: 42000.0,
                            child: Text('Cotton (Warangal: ₹42,000/ac)')),
                        DropdownMenuItem(
                            value: 55000.0,
                            child: Text('Chilli (Nandyal: ₹55,000/ac)')),
                        DropdownMenuItem(
                            value: 36000.0,
                            child: Text('Paddy (Khammam: ₹36,000/ac)')),
                      ],
                      onChanged: (val) =>
                          setState(() => _scaleOfFinance = val!),
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
                      'Estimated KCC Sanction Limit',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppConstants.primaryDark,
                      ),
                    ),
                    const Divider(height: 20),
                    _buildRow('Crop Cultivation Component',
                        '₹${_cropCreditLimit.toInt()}'),
                    _buildRow('10% Post-Harvest & Household',
                        '₹${_postHarvestComponent.toInt()}'),
                    _buildRow('20% Farm Maintenance & Asset Repair',
                        '₹${_maintenanceComponent.toInt()}'),
                    const Divider(height: 20),
                    _buildRow(
                        'Total Sanction Limit', '₹${_totalKccLimit.toInt()}',
                        isBold: true),
                    _buildRow('Effective Interest Rate (Govt. Subvention)',
                        '4.0% p.a. (Prompt Repayment)'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              icon: const Icon(Icons.send_rounded, size: 18),
              label: const Text('Apply via JanSamarth National Credit Portal'),
              onPressed: () {
                LuxuryToast.show(
                  context,
                  message: 'Redirecting to Government JanSamarth KCC Portal...',
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style:
                  const TextStyle(fontSize: 12, color: AppConstants.textDark)),
          Text(
            value,
            style: TextStyle(
              fontSize: isBold ? 15 : 12,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: AppConstants.primaryDark,
            ),
          ),
        ],
      ),
    );
  }
}

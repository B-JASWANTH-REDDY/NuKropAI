import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/mandi_rate.dart';
import '../../shared/widgets/luxury_toast.dart';

class MandiScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const MandiScreen({super.key, this.onBack});

  @override
  State<MandiScreen> createState() => _MandiScreenState();
}

class _MandiScreenState extends State<MandiScreen> {
  String _selectedDistrict = 'All Districts';
  String _searchQuery = '';

  final List<String> _districts = [
    'All Districts',
    'Warangal',
    'Nandyal',
    'Khammam',
    'Karimnagar',
    'Guntur',
  ];

  final List<MandiRate> _rates = [
    MandiRate(
      id: 'm1',
      mandiName: 'Enumamula APMC',
      state: 'Telangana',
      district: 'Warangal',
      commodity: 'Cotton (Medium Staple)',
      modalPrice: 7850,
      minPrice: 7200,
      maxPrice: 8200,
      arrivalDate: DateTime.now(),
      trend: 'UP',
    ),
    MandiRate(
      id: 'm2',
      mandiName: 'Markapur APMC Yard',
      state: 'Andhra Pradesh',
      district: 'Nandyal',
      commodity: 'Chilli (Teja)',
      modalPrice: 19400,
      minPrice: 18200,
      maxPrice: 21000,
      arrivalDate: DateTime.now(),
      trend: 'UP',
    ),
    MandiRate(
      id: 'm3',
      mandiName: 'Khammam Agricultural Market',
      state: 'Telangana',
      district: 'Khammam',
      commodity: 'Paddy (Common)',
      modalPrice: 2380,
      minPrice: 2200,
      maxPrice: 2450,
      arrivalDate: DateTime.now(),
      trend: 'STABLE',
    ),
    MandiRate(
      id: 'm4',
      mandiName: 'Warangal Grain Yard',
      state: 'Telangana',
      district: 'Warangal',
      commodity: 'Maize (Hybrid)',
      modalPrice: 2250,
      minPrice: 2100,
      maxPrice: 2320,
      arrivalDate: DateTime.now(),
      trend: 'DOWN',
    ),
    MandiRate(
      id: 'm5',
      mandiName: 'Guntur Mirchi Yard',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      commodity: 'Red Chilli (334)',
      modalPrice: 18800,
      minPrice: 17500,
      maxPrice: 20200,
      arrivalDate: DateTime.now(),
      trend: 'UP',
    ),
  ];

  List<MandiRate> get _filteredRates {
    return _rates.where((rate) {
      final matchesDistrict = _selectedDistrict == 'All Districts' ||
          rate.district.toLowerCase() == _selectedDistrict.toLowerCase();
      final matchesSearch = _searchQuery.isEmpty ||
          rate.commodity.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          rate.mandiName.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesDistrict && matchesSearch;
    }).toList();
  }

  void _showPriceTrendDialog(MandiRate rate) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(rate.commodity),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${rate.mandiName} • ${rate.district}',
              style: const TextStyle(color: AppConstants.textMuted, fontSize: 13),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildPriceMetric('Min Price', '₹${rate.minPrice.toInt()}'),
                _buildPriceMetric('Modal Price', '₹${rate.modalPrice.toInt()}'),
                _buildPriceMetric('Max Price', '₹${rate.maxPrice.toInt()}'),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              height: 120,
              decoration: BoxDecoration(
                color: AppConstants.surfaceBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Center(
                child: Text(
                  '📈 7-Day Trend: Steady Growth (+3.4%)',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppConstants.primaryDark,
                  ),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              LuxuryToast.show(
                context,
                message: 'Price Alert set for ${rate.commodity} at ₹${rate.modalPrice.toInt()}+',
                icon: Icons.notifications_active_rounded,
              );
            },
            child: const Text('Set Price Alert'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _buildPriceMetric(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ],
    );
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
        title: const Text('Live APMC Mandi Rates'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              LuxuryToast.show(
                context,
                message: 'Syncing live Agmarknet rate feeds...',
                icon: Icons.sync_rounded,
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search commodity or market...',
                    prefixIcon: const Icon(Icons.search_rounded),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  height: 36,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _districts.length,
                    itemBuilder: (context, index) {
                      final dist = _districts[index];
                      final isSelected = _selectedDistrict == dist;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(dist),
                          selected: isSelected,
                          selectedColor: AppConstants.primaryLight,
                          labelStyle: TextStyle(
                            fontSize: 12,
                            color: isSelected
                                ? AppConstants.primaryDark
                                : AppConstants.textDark,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w500,
                          ),
                          onSelected: (selected) {
                            if (selected) setState(() => _selectedDistrict = dist);
                          },
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _filteredRates.length,
              itemBuilder: (context, index) {
                final rate = _filteredRates[index];
                return Card(
                  child: InkWell(
                    onTap: () => _showPriceTrendDialog(rate),
                    borderRadius: BorderRadius.circular(16),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  rate.commodity,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppConstants.textDark,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.location_on_outlined,
                                      size: 13,
                                      color: AppConstants.textMuted,
                                    ),
                                    const SizedBox(width: 3),
                                    Text(
                                      '${rate.mandiName}, ${rate.district}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: AppConstants.textMuted,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹${rate.modalPrice.toInt()}',
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: AppConstants.primaryDark,
                                ),
                              ),
                              Text(
                                rate.priceUnit,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppConstants.textMuted,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 8),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppConstants.textMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}


import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/mandi_rate.dart';
import '../../core/networking/api_client.dart';
import '../../shared/widgets/shimmer_skeleton.dart';

class MandiScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const MandiScreen({super.key, this.onBack});

  @override
  State<MandiScreen> createState() => _MandiScreenState();
}

class _MandiScreenState extends State<MandiScreen> {
  String _selectedState = 'Telangana';
  String _selectedCommodity = 'Cotton';
  String _selectedDistrict = 'All Districts';
  String _searchQuery = '';
  bool _isLoading = false;
  bool _isCached = false;
  bool _isLive = false;
  String? _errorMessage;

  final List<String> _states = [
    'Telangana',
    'Andhra Pradesh',
    'Maharashtra',
    'Karnataka',
    'Gujarat',
    'Madhya Pradesh',
    'Punjab',
    'Haryana',
  ];

  final List<String> _commodities = [
    'Cotton',
    'Chilli',
    'Paddy',
    'Maize',
    'Soyabean',
    'Turmeric',
    'Tomato',
    'Onion',
    'Wheat',
  ];

  final List<String> _districts = [
    'All Districts',
    'Warangal',
    'Nandyal',
    'Khammam',
    'Karimnagar',
    'Guntur',
  ];

  List<MandiRate> _rates = [];

  static const String _cacheKey = 'nukrop_live_mandi_cache';

  @override
  void initState() {
    super.initState();
    _loadMandiRates();
  }

  Future<void> _loadMandiRates() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    // 1. First hydrate from SWR Cache if available
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedJson = prefs.getString(_cacheKey);
      if (cachedJson != null && cachedJson.isNotEmpty) {
        final decoded = jsonDecode(cachedJson) as List<dynamic>;
        setState(() {
          _rates = decoded.map((r) => MandiRate.fromJson(r)).toList();
          _isCached = true;
        });
      }
    } catch (_) {}

    // 2. Fetch from genuine backend Agmarknet pipeline
    try {
      final queryParams = <String, String>{
        'state': _selectedState,
        'commodity': _selectedCommodity,
      };
      if (_selectedDistrict != 'All Districts') {
        queryParams['district'] = _selectedDistrict;
      }

      final response = await ApiClient.get<Map<String, dynamic>>(
        '/mandi/rates',
        queryParams: queryParams,
      );

      final records = response['records'] as List<dynamic>?;
      if (records != null && records.isNotEmpty) {
        final parsed = records.map((r) {
          final modal = (r['modal_price'] ?? r['modalPrice'] ?? r['modal'] ?? 0.0);
          final min = (r['min_price'] ?? r['minPrice'] ?? r['min'] ?? 0.0);
          final max = (r['max_price'] ?? r['maxPrice'] ?? r['max'] ?? 0.0);

          return MandiRate(
            id: r['id']?.toString() ?? 'm_${r['market']}',
            mandiName: r['market'] ?? r['mandiName'] ?? 'APMC Market',
            state: r['state'] ?? _selectedState,
            district: r['district'] ?? _selectedDistrict,
            commodity: r['commodity'] ?? _selectedCommodity,
            modalPrice: (modal is num) ? modal.toDouble() : 0.0,
            minPrice: (min is num) ? min.toDouble() : 0.0,
            maxPrice: (max is num) ? max.toDouble() : 0.0,
            arrivalDate: r['arrival_date'] != null
                ? DateTime.tryParse(r['arrival_date']) ?? DateTime.now()
                : DateTime.now(),
            trend: r['trend'] ?? 'UP',
          );
        }).toList();

        // Update local SWR cache
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_cacheKey, jsonEncode(parsed.map((e) => e.toJson()).toList()));

        if (mounted) {
          setState(() {
            _rates = parsed;
            _isLoading = false;
            _isCached = false;
            _isLive = true;
          });
        }
        return;
      } else {
        if (mounted) {
          setState(() {
            _rates = [];
            _isLoading = false;
            _isLive = true;
          });
        }
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.message;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Live Mandi pipeline temporarily unavailable: ${e.toString()}';
          _isLoading = false;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

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

  @override
  Widget build(BuildContext context) {
    final rates = _filteredRates;

    return Scaffold(
      backgroundColor: AppConstants.surfaceBg,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: AppConstants.textDark),
                onPressed: widget.onBack,
              )
            : null,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Live Mandi Bhav',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppConstants.textDark,
              ),
            ),
            Text(
              'Official Agmarknet Market Intelligence',
              style: TextStyle(
                fontSize: 11,
                color: AppConstants.textMuted,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: AppConstants.primaryGreen),
            onPressed: _loadMandiRates,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadMandiRates,
        color: AppConstants.primaryGreen,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          slivers: [
            // Status Banner (Live vs Cached vs Offline Error)
            if (_isLive)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.green.shade300),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.sensors_rounded, size: 16, color: AppConstants.primaryDark),
                      const SizedBox(width: 8),
                      Text(
                        'LIVE AGMARKNET INTELLIGENCE (${_rates.length} Mandi Yards)',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppConstants.primaryDark),
                      ),
                    ],
                  ),
                ),
              )
            else if (_isCached)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade300),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.offline_bolt_rounded, size: 16, color: Colors.orange),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Displaying SWR cached rates while syncing with Ministry of Agriculture portal.',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black87),
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else if (_errorMessage != null && _rates.isEmpty)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off_rounded, size: 16, color: AppConstants.dangerRed),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppConstants.dangerRed),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            // Search Bar & Dynamic State / Commodity / District Filters
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedState,
                            decoration: InputDecoration(
                              labelText: 'State',
                              isDense: true,
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            items: _states.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 12)))).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() => _selectedState = val);
                                _loadMandiRates();
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _selectedCommodity,
                            decoration: InputDecoration(
                              labelText: 'Commodity',
                              isDense: true,
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            ),
                            items: _commodities.map((c) => DropdownMenuItem(value: c, child: Text(c, style: const TextStyle(fontSize: 12)))).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() => _selectedCommodity = val);
                                _loadMandiRates();
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      decoration: InputDecoration(
                        hintText: 'Search commodity or APMC yard...',
                        prefixIcon: const Icon(Icons.search_rounded),
                        suffixIcon: _searchQuery.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded),
                                onPressed: () => setState(() => _searchQuery = ''),
                              )
                            : null,
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide(color: Colors.grey.shade300),
                        ),
                        isDense: true,
                      ),
                      onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 36,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        children: _districts.map((d) {
                          final isSelected = _selectedDistrict == d;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(d),
                              selected: isSelected,
                              selectedColor: AppConstants.primaryLight,
                              labelStyle: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: isSelected
                                    ? AppConstants.primaryDark
                                    : AppConstants.textDark,
                              ),
                              onSelected: (val) {
                                if (val) {
                                  setState(() => _selectedDistrict = d);
                                  _loadMandiRates();
                                }
                              },
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Shimmer Skeleton during first load
            if (_isLoading && _rates.isEmpty)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: ShimmerSkeleton(width: double.infinity, height: 120),
                    ),
                    childCount: 4,
                  ),
                ),
              )
            else if (rates.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.storefront_outlined, size: 56, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      Text(
                        _errorMessage ?? 'No Mandi transactions found for this search.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppConstants.textMuted,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        label: const Text('Retry Agmarknet Sync'),
                        onPressed: _loadMandiRates,
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final rate = rates[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        elevation: 0.5,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          rate.commodity,
                                          style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.w800,
                                            color: AppConstants.textDark,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Row(
                                          children: [
                                            const Icon(
                                              Icons.location_on_rounded,
                                              size: 13,
                                              color: AppConstants.dangerRed,
                                            ),
                                            const SizedBox(width: 2),
                                            Text(
                                              '${rate.mandiName}, ${rate.district}',
                                              style: const TextStyle(
                                                fontSize: 11,
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
                                          fontSize: 19,
                                          fontWeight: FontWeight.w900,
                                          color: AppConstants.primaryDark,
                                        ),
                                      ),
                                      const Text(
                                        'per Quintal',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: AppConstants.textMuted,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              const Divider(height: 20),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Min: ₹${rate.minPrice.toInt()} • Max: ₹${rate.maxPrice.toInt()}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppConstants.textMuted,
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppConstants.primaryLight,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Agmarknet Live',
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: AppConstants.primaryDark,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                    childCount: rates.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

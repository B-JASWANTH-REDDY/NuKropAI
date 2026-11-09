import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/models/farm_entry.dart';
import '../../shared/widgets/luxury_toast.dart';

class FarmKhataScreen extends StatefulWidget {
  final VoidCallback? onBack;

  const FarmKhataScreen({super.key, this.onBack});

  @override
  State<FarmKhataScreen> createState() => _FarmKhataScreenState();
}

class _FarmKhataScreenState extends State<FarmKhataScreen> {
  final List<FarmEntry> _entries = [
    FarmEntry(
      id: 'k1',
      title: 'Cotton Harvest Sale (Enumamula)',
      amount: 148000,
      isIncome: true,
      category: 'Harvest Sale',
      date: DateTime.now().subtract(const Duration(days: 1)),
    ),
    FarmEntry(
      id: 'k2',
      title: 'Bollgard II Cotton Seeds (8 packets)',
      amount: 6800,
      isIncome: false,
      category: 'Seeds',
      date: DateTime.now().subtract(const Duration(days: 4)),
    ),
    FarmEntry(
      id: 'k3',
      title: 'DAP & Urea Fertilizer Bags',
      amount: 14500,
      isIncome: false,
      category: 'Fertilizer',
      date: DateTime.now().subtract(const Duration(days: 7)),
    ),
    FarmEntry(
      id: 'k4',
      title: 'Weeding Labor (6 workers)',
      amount: 4200,
      isIncome: false,
      category: 'Labor',
      date: DateTime.now().subtract(const Duration(days: 12)),
    ),
  ];

  double get _totalIncome =>
      _entries.where((e) => e.isIncome).fold(0, (sum, e) => sum + e.amount);

  double get _totalExpense =>
      _entries.where((e) => !e.isIncome).fold(0, (sum, e) => sum + e.amount);

  double get _netProfit => _totalIncome - _totalExpense;

  void _deleteEntry(int index) {
    final removed = _entries[index];
    setState(() {
      _entries.removeAt(index);
    });

    LuxuryToast.show(
      context,
      message: 'Deleted: ${removed.title}',
      undoLabel: 'Undo',
      onUndo: () {
        setState(() {
          _entries.insert(index, removed);
        });
      },
    );
  }

  void _showAddEntryDialog() {
    final titleController = TextEditingController();
    final amountController = TextEditingController();
    bool isIncome = false;
    String category = 'Fertilizer';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Add Khata Bookkeeping Entry',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Expense (Debit)')),
                      selected: !isIncome,
                      selectedColor: AppConstants.dangerRed.withAlpha(30),
                      onSelected: (val) => setModalState(() => isIncome = false),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: const Center(child: Text('Income (Credit)')),
                      selected: isIncome,
                      selectedColor: AppConstants.primaryLight,
                      onSelected: (val) => setModalState(() => isIncome = true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: 'Description / Item'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Amount (₹)'),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  final title = titleController.text.trim();
                  final amount = double.tryParse(amountController.text) ?? 0.0;
                  if (title.isEmpty || amount <= 0) return;

                  final newEntry = FarmEntry(
                    id: 'k_${DateTime.now().millisecondsSinceEpoch}',
                    title: title,
                    amount: amount,
                    isIncome: isIncome,
                    category: category,
                    date: DateTime.now(),
                  );

                  setState(() {
                    _entries.insert(0, newEntry);
                  });
                  Navigator.pop(ctx);
                  LuxuryToast.show(
                    context,
                    message: 'Khata entry recorded: ₹${amount.toInt()}',
                    icon: Icons.check_circle_rounded,
                  );
                },
                child: const Text('Save Entry'),
              ),
            ],
          ),
        ),
      ),
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
        title: const Text('Farm Khata Bookkeeping'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: _showAddEntryDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          Card(
            margin: const EdgeInsets.all(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _buildBalanceColumn('Total Income', '₹${_totalIncome.toInt()}', AppConstants.primaryDark),
                      _buildBalanceColumn('Total Expenses', '₹${_totalExpense.toInt()}', AppConstants.dangerRed),
                      _buildBalanceColumn('Net Profit', '₹${_netProfit.toInt()}', AppConstants.primaryGreen),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: _entries.length,
              itemBuilder: (context, index) {
                final entry = _entries[index];
                return Dismissible(
                  key: Key(entry.id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    color: AppConstants.dangerRed,
                    child: const Icon(Icons.delete_outline_rounded, color: Colors.white),
                  ),
                  onDismissed: (_) => _deleteEntry(index),
                  child: Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: entry.isIncome
                            ? AppConstants.primaryLight
                            : AppConstants.dangerRed.withAlpha(25),
                        child: Icon(
                          entry.isIncome
                              ? Icons.arrow_downward_rounded
                              : Icons.arrow_upward_rounded,
                          color: entry.isIncome
                              ? AppConstants.primaryDark
                              : AppConstants.dangerRed,
                          size: 18,
                        ),
                      ),
                      title: Text(
                        entry.title,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        '${entry.category} • ${entry.date.day}/${entry.date.month}/${entry.date.year}',
                        style: const TextStyle(fontSize: 11, color: AppConstants.textMuted),
                      ),
                      trailing: Text(
                        '${entry.isIncome ? "+" : "-"}₹${entry.amount.toInt()}',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: entry.isIncome
                              ? AppConstants.primaryDark
                              : AppConstants.dangerRed,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppConstants.primaryGreen,
        onPressed: _showAddEntryDialog,
        child: const Icon(Icons.add_rounded, color: Colors.white),
      ),
    );
  }

  Widget _buildBalanceColumn(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: AppConstants.textMuted)),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }
}

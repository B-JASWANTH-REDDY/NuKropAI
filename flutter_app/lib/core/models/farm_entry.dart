class FarmEntry {
  final String id;
  final String title;
  final double amount;
  final bool isIncome; // true for income, false for expense
  final String category; // 'Seeds', 'Fertilizer', 'Harvest Sale', 'Labor', etc.
  final DateTime date;
  final String note;

  const FarmEntry({
    required this.id,
    required this.title,
    required this.amount,
    required this.isIncome,
    required this.category,
    required this.date,
    this.note = '',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'amount': amount,
        'isIncome': isIncome,
        'category': category,
        'date': date.toIso8601String(),
        'note': note,
      };

  factory FarmEntry.fromJson(Map<String, dynamic> json) {
    return FarmEntry(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      isIncome: json['isIncome'] ?? false,
      category: json['category'] ?? 'General',
      date:
          json['date'] != null ? DateTime.parse(json['date']) : DateTime.now(),
      note: json['note'] ?? '',
    );
  }
}

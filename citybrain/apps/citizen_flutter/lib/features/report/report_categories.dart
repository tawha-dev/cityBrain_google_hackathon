/// Citizen emergency categories (id sent to API as `category`).
class ReportCategory {
  const ReportCategory(this.id, this.label, this.emoji);

  final String id;
  final String label;
  final String emoji;
}

const kEmergencyCategories = [
  ReportCategory('flood', 'Flood / Urban flooding', '🌊'),
  ReportCategory('tsunami', 'Tsunami', '🌊'),
  ReportCategory('earthquake', 'Earthquake', '🏚️'),
  ReportCategory('landslide', 'Landslide', '⛰️'),
  ReportCategory('rain_monsoon', 'Rain / monsoon alert', '🌧️'),
  ReportCategory('fire', 'Fire', '🔥'),
  ReportCategory('accident', 'Accident', '🚗'),
  ReportCategory('storm', 'Storm / cyclone', '🌀'),
  ReportCategory('other', 'Other emergency', '⚠️'),
];

String categoryLabel(String? id) {
  if (id == null || id.isEmpty) return 'Emergency';
  for (final c in kEmergencyCategories) {
    if (c.id == id) return c.label;
  }
  return id.replaceAll('_', ' ');
}

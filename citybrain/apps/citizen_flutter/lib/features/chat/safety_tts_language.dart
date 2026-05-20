import '../../shared/models/models.dart';

/// Which on-device engine will read the safety message aloud.
enum SafetyTtsEngine { englishSupertonic, urduDevice }

/// Matches the language the user typed in for that exchange.
enum SafetyVoiceLanguage { english, urdu }

/// Detects Arabic-script text (Urdu, Arabic, etc.).
final _arabicScript = RegExp(
  r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]',
);

/// Common Roman Urdu / Urdu-in-Latin markers (not exhaustive).
final _romanUrduMarkers = RegExp(
  r'\b(aap|ap|hai|hain|ho|nahi|nahin|mein|main|mai|bhi|bahir|andar|ghar|pani|barish|'
  r'bohat|bahut|kya|kyun|kyon|abhi|jaldi|madad|krna|karna|raha|rahi|rahe|wala|wali|'
  r'sahab|bhai|allah|allah|shukriya|zaroor|mat|nhi|nh|karo|karein|mujhe|tum|hum)\b',
  caseSensitive: false,
);

/// Strong English-only cues when text is Latin script.
final _englishMarkers = RegExp(
  r'\b(the|is|are|was|were|should|would|could|what|how|when|where|why|outside|'
  r'inside|please|help|rain|fire|emergency|stay|avoid|danger|call|need)\b',
  caseSensitive: false,
);

bool textHasArabicScript(String text) => _arabicScript.hasMatch(text);

/// Detect language from user input (English vs Urdu / Roman Urdu).
SafetyVoiceLanguage detectInputLanguage(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty) return SafetyVoiceLanguage.english;

  if (textHasArabicScript(trimmed)) {
    return SafetyVoiceLanguage.urdu;
  }

  final latinOnly = RegExp(r'^[A-Za-z0-9\s\.,!?\-:;()]+$');
  if (!latinOnly.hasMatch(trimmed)) {
    return SafetyVoiceLanguage.urdu;
  }

  final urduHits = _romanUrduMarkers.allMatches(trimmed).length;
  final englishHits = _englishMarkers.allMatches(trimmed).length;

  if (urduHits > englishHits) return SafetyVoiceLanguage.urdu;
  if (englishHits > 0 && urduHits == 0) return SafetyVoiceLanguage.english;

  // Ambiguous short Latin text: lean English unless clear Urdu roman markers
  if (urduHits > 0) return SafetyVoiceLanguage.urdu;
  return SafetyVoiceLanguage.english;
}

class SafetyTtsPlan {
  const SafetyTtsPlan({
    required this.engine,
    required this.speechText,
  });

  final SafetyTtsEngine engine;
  final String speechText;
}

/// Voice follows the user message language for that exchange (not replyUr alone).
SafetyTtsPlan planSpeech(SafetyChatTurn turn) {
  final useUrdu = turn.voiceLanguage == 'urdu';

  if (useUrdu) {
    final replyUr = turn.replyUr?.trim() ?? '';
    final tipsUr = turn.tipsUr;
    if (replyUr.isNotEmpty) {
      return SafetyTtsPlan(
        engine: SafetyTtsEngine.urduDevice,
        speechText: _buildSpeechText(
          replyUr,
          tipsUr.isNotEmpty ? tipsUr : turn.tips,
        ),
      );
    }
    final displayText = _buildSpeechText(turn.content, turn.tips);
    return SafetyTtsPlan(
      engine: SafetyTtsEngine.urduDevice,
      speechText: displayText,
    );
  }

  // English: always Supertonic with on-screen English text (ignore replyUr).
  return SafetyTtsPlan(
    engine: SafetyTtsEngine.englishSupertonic,
    speechText: _buildSpeechText(turn.content, turn.tips),
  );
}

String _buildSpeechText(String reply, List<String> tips) {
  final buffer = StringBuffer(reply.trim());
  if (tips.isNotEmpty) {
    buffer.write('. ');
    for (var i = 0; i < tips.length; i++) {
      buffer.write('${i + 1}. ${tips[i]}. ');
    }
  }
  final text = buffer.toString().trim();
  if (text.length <= 900) return text;
  return '${text.substring(0, 897)}...';
}

String engineLabel(SafetyTtsEngine engine) {
  switch (engine) {
    case SafetyTtsEngine.urduDevice:
      return 'Urdu voice';
    case SafetyTtsEngine.englishSupertonic:
      return 'English voice';
  }
}

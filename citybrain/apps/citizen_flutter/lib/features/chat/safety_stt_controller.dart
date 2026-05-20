import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

import 'safety_tts_controller.dart';
import 'safety_tts_language.dart';

class SafetySttState {
  const SafetySttState({
    this.isAvailable = false,
    this.isInitializing = false,
    this.isListening = false,
    this.words = '',
    this.error,
  });

  final bool isAvailable;
  final bool isInitializing;
  final bool isListening;
  final String words;
  final String? error;

  SafetySttState copyWith({
    bool? isAvailable,
    bool? isInitializing,
    bool? isListening,
    String? words,
    String? error,
    bool clearError = false,
    bool clearWords = false,
  }) {
    return SafetySttState(
      isAvailable: isAvailable ?? this.isAvailable,
      isInitializing: isInitializing ?? this.isInitializing,
      isListening: isListening ?? this.isListening,
      words: clearWords ? '' : (words ?? this.words),
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class SafetySttController extends Notifier<SafetySttState> {
  final SpeechToText _speech = SpeechToText();
  bool _initialized = false;

  @override
  SafetySttState build() => const SafetySttState();

  Future<bool> initialize() async {
    if (_initialized) return state.isAvailable;

    state = state.copyWith(isInitializing: true, clearError: true);
    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          if (status == 'done' || status == 'notListening') {
            if (state.isListening) {
              state = state.copyWith(isListening: false);
            }
          }
        },
        onError: (error) {
          state = state.copyWith(
            isListening: false,
            error: error.errorMsg,
          );
        },
      );
      _initialized = true;
      state = state.copyWith(
        isAvailable: available,
        isInitializing: false,
        error: available ? null : 'Speech recognition is not available on this device.',
      );
      return available;
    } catch (e) {
      state = state.copyWith(
        isInitializing: false,
        isAvailable: false,
        error: 'Could not start microphone. Check app permissions.',
      );
      return false;
    }
  }

  Future<void> startListening({SafetyVoiceLanguage? languageHint}) async {
    if (state.isListening) return;

    final ready = await initialize();
    if (!ready) return;

    await ref.read(safetyTtsProvider.notifier).stop();

    final localeId = await _resolveLocaleId(languageHint);

    state = state.copyWith(
      isListening: true,
      clearWords: true,
      clearError: true,
    );

    await _speech.listen(
      onResult: _onSpeechResult,
      localeId: localeId,
      listenOptions: SpeechListenOptions(
        listenMode: ListenMode.dictation,
        cancelOnError: true,
        partialResults: true,
      ),
    );
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    state = state.copyWith(words: result.recognizedWords);
  }

  /// Stops listening and returns the final transcript, or null if empty.
  Future<String?> stopListening() async {
    if (!state.isListening) {
      final text = state.words.trim();
      return text.isEmpty ? null : text;
    }

    await _speech.stop();
    state = state.copyWith(isListening: false);
    final text = state.words.trim();
    return text.isEmpty ? null : text;
  }

  Future<void> cancel() async {
    if (state.isListening) {
      await _speech.cancel();
    }
    state = state.copyWith(isListening: false, clearWords: true);
  }

  Future<String?> _resolveLocaleId(SafetyVoiceLanguage? hint) async {
    final locales = await _speech.locales();
    if (locales.isEmpty) return null;

    final preferUrdu = hint == SafetyVoiceLanguage.urdu;
    final candidates = preferUrdu
        ? ['ur-PK', 'ur_PK', 'ur-IN', 'ur_IN', 'ur']
        : ['en-US', 'en_US', 'en-GB', 'en_GB', 'en'];

    for (final id in candidates) {
      final match = locales.where((l) => l.localeId == id);
      if (match.isNotEmpty) return match.first.localeId;
    }

    for (final id in candidates) {
      final prefix = id.split(RegExp(r'[-_]')).first;
      final match = locales.where((l) => l.localeId.startsWith(prefix));
      if (match.isNotEmpty) return match.first.localeId;
    }

    return locales.first.localeId;
  }
}

final safetySttProvider =
    NotifierProvider<SafetySttController, SafetySttState>(SafetySttController.new);

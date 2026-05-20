import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:supertonic_flutter/supertonic_flutter.dart';

import '../../shared/models/models.dart';
import 'safety_tts_language.dart';

class SafetyTtsState {
  const SafetyTtsState({
    this.supertonicReady = false,
    this.isDownloadingSupertonic = false,
    this.isPreparingSpeech = false,
    this.isSpeaking = false,
    this.playingTurnIndex,
    this.activeEngine,
    this.error,
    this.downloadProgress,
  });

  final bool supertonicReady;
  final bool isDownloadingSupertonic;
  final bool isPreparingSpeech;
  final bool isSpeaking;
  final int? playingTurnIndex;
  final SafetyTtsEngine? activeEngine;
  final String? error;
  final double? downloadProgress;

  SafetyTtsState copyWith({
    bool? supertonicReady,
    bool? isDownloadingSupertonic,
    bool? isPreparingSpeech,
    bool? isSpeaking,
    int? playingTurnIndex,
    SafetyTtsEngine? activeEngine,
    bool clearPlayingTurnIndex = false,
    bool clearActiveEngine = false,
    String? error,
    bool clearError = false,
    double? downloadProgress,
    bool clearDownloadProgress = false,
  }) {
    return SafetyTtsState(
      supertonicReady: supertonicReady ?? this.supertonicReady,
      isDownloadingSupertonic:
          isDownloadingSupertonic ?? this.isDownloadingSupertonic,
      isPreparingSpeech: isPreparingSpeech ?? this.isPreparingSpeech,
      isSpeaking: isSpeaking ?? this.isSpeaking,
      playingTurnIndex:
          clearPlayingTurnIndex ? null : (playingTurnIndex ?? this.playingTurnIndex),
      activeEngine: clearActiveEngine ? null : (activeEngine ?? this.activeEngine),
      error: clearError ? null : (error ?? this.error),
      downloadProgress:
          clearDownloadProgress ? null : (downloadProgress ?? this.downloadProgress),
    );
  }
}

class SafetyTtsController extends Notifier<SafetyTtsState> {
  SupertonicTTS? _supertonic;
  TTSAudioPlayer? _supertonicPlayer;
  StreamSubscription<PlayerState>? _supertonicSub;

  FlutterTts? _deviceTts;
  bool _deviceTtsReady = false;

  @override
  SafetyTtsState build() {
    ref.onDispose(_dispose);
    return const SafetyTtsState();
  }

  void _dispose() {
    _supertonicSub?.cancel();
    _supertonicPlayer?.dispose();
    _supertonic?.dispose();
    _supertonicPlayer = null;
    _supertonic = null;
    _deviceTts?.stop();
  }

  void _clearUrduPlaybackState() {
    state = state.copyWith(
      isSpeaking: false,
      isPreparingSpeech: false,
      clearPlayingTurnIndex: true,
      clearActiveEngine: true,
    );
  }

  Future<void> _ensureDeviceTts() async {
    if (_deviceTtsReady && _deviceTts != null) return;

    _deviceTts = FlutterTts();
    await _deviceTts!.setLanguage('ur-PK');
    await _deviceTts!.setSpeechRate(0.48);
    await _deviceTts!.setVolume(1.0);
    // Non-blocking: speak() returns when playback starts so UI can show stop.
    await _deviceTts!.awaitSpeakCompletion(false);

    _deviceTts!.setStartHandler(() {
      state = state.copyWith(
        isPreparingSpeech: false,
        isSpeaking: true,
      );
    });

    _deviceTts!.setCompletionHandler(_clearUrduPlaybackState);

    _deviceTts!.setCancelHandler(_clearUrduPlaybackState);

    _deviceTts!.setErrorHandler((msg) {
      _clearUrduPlaybackState();
      state = state.copyWith(error: 'Urdu voice error: $msg');
    });

    _deviceTtsReady = true;
  }

  Future<bool> _ensureSupertonic() async {
    if (state.supertonicReady && _supertonic != null && _supertonicPlayer != null) {
      return true;
    }

    state = state.copyWith(isDownloadingSupertonic: true, clearError: true);

    try {
      _supertonic = SupertonicTTS();
      _supertonicPlayer = TTSAudioPlayer();

      if (!await SupertonicTTS.modelsReady()) {
        await SupertonicTTS.preDownloadModels(
          onProgress: (done, total, file, progress) {
            state = state.copyWith(downloadProgress: progress);
          },
        );
      }

      await _supertonic!.initialize();

      _supertonicSub = _supertonicPlayer!.playerStateStream.listen((playerState) {
        if (playerState == PlayerState.completed ||
            playerState == PlayerState.stopped) {
          state = state.copyWith(
            isSpeaking: false,
            isPreparingSpeech: false,
            clearPlayingTurnIndex: true,
            clearActiveEngine: true,
          );
        } else if (playerState == PlayerState.playing) {
          state = state.copyWith(isSpeaking: true);
        }
      });

      state = state.copyWith(
        supertonicReady: true,
        isDownloadingSupertonic: false,
        clearDownloadProgress: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isDownloadingSupertonic: false,
        clearDownloadProgress: true,
        error:
            'English voice failed to load. First use downloads ~270MB — check Wi‑Fi.',
      );
      return false;
    }
  }

  Future<void> speakTurn({required SafetyChatTurn turn, required int turnIndex}) async {
    final isThisTurnActive = state.playingTurnIndex == turnIndex &&
        (state.isSpeaking || state.isPreparingSpeech);

    if (isThisTurnActive) {
      await stop();
      return;
    }

    if (state.isPreparingSpeech || state.isSpeaking) return;

    final plan = planSpeech(turn);
    if (plan.speechText.isEmpty) return;

    await stop();

    state = state.copyWith(
      isPreparingSpeech: true,
      playingTurnIndex: turnIndex,
      activeEngine: plan.engine,
      clearError: true,
    );

    try {
      if (plan.engine == SafetyTtsEngine.urduDevice) {
        await _speakUrdu(plan.speechText, turnIndex);
      } else {
        await _speakEnglish(plan.speechText, turnIndex);
      }
    } catch (e) {
      state = state.copyWith(
        isPreparingSpeech: false,
        isSpeaking: false,
        clearPlayingTurnIndex: true,
        clearActiveEngine: true,
        error: 'Could not play audio. Try again.',
      );
    }
  }

  Future<void> _speakUrdu(String text, int turnIndex) async {
    await _ensureDeviceTts();
    await _deviceTts!.stop();

    state = state.copyWith(
      isPreparingSpeech: false,
      isSpeaking: true,
      playingTurnIndex: turnIndex,
      activeEngine: SafetyTtsEngine.urduDevice,
    );

    final started = await _deviceTts!.speak(text);
    if (started != 1) {
      _clearUrduPlaybackState();
      state = state.copyWith(error: 'Urdu voice could not start. Try again.');
    }
  }

  Future<void> _speakEnglish(String text, int turnIndex) async {
    final ok = await _ensureSupertonic();
    if (!ok || _supertonic == null || _supertonicPlayer == null) {
      state = state.copyWith(
        isPreparingSpeech: false,
        clearPlayingTurnIndex: true,
        clearActiveEngine: true,
      );
      return;
    }

    final result = await _supertonic!.synthesize(
      text,
      language: 'en',
      voiceStyle: 'F2',
      config: const TTSConfig(
        speechSpeed: 1.05,
        denoisingSteps: 5,
      ),
    );

    await _supertonicPlayer!.play(result);
    state = state.copyWith(
      isPreparingSpeech: false,
      isSpeaking: true,
      playingTurnIndex: turnIndex,
      activeEngine: SafetyTtsEngine.englishSupertonic,
    );
  }

  Future<void> stop() async {
    await _deviceTts?.stop();
    await _supertonicPlayer?.stop();
    state = state.copyWith(
      isSpeaking: false,
      isPreparingSpeech: false,
      clearPlayingTurnIndex: true,
      clearActiveEngine: true,
    );
  }

  /// For UI: which engine would be used if user taps listen on this turn.
  SafetyTtsEngine engineForTurn(SafetyChatTurn turn) => planSpeech(turn).engine;
}

final safetyTtsProvider =
    NotifierProvider<SafetyTtsController, SafetyTtsState>(SafetyTtsController.new);

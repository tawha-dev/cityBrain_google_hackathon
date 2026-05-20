import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/providers/providers.dart';
import '../../shared/models/models.dart';
import 'safety_tts_language.dart';

const _greeting =
    'Describe your emergency or situation — I will suggest simple safety steps you can follow right now.';

class SafetyChatState {
  const SafetyChatState({
    this.turns = const [],
    this.isLoading = false,
    this.error,
  });

  final List<SafetyChatTurn> turns;
  final bool isLoading;
  final String? error;

  bool get isStreaming =>
      turns.any((t) => t.role == 'assistant' && t.isStreaming);

  SafetyChatState copyWith({
    List<SafetyChatTurn>? turns,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return SafetyChatState(
      turns: turns ?? this.turns,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class SafetyChatController extends Notifier<SafetyChatState> {
  @override
  SafetyChatState build() {
    return SafetyChatState(
      turns: [
        SafetyChatTurn(
          role: 'assistant',
          content: _greeting,
          voiceLanguage: 'english',
          at: DateTime.now(),
        ),
      ],
    );
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isLoading || state.isStreaming) return;

    final userLang = detectInputLanguage(trimmed);
    final voiceLang =
        userLang == SafetyVoiceLanguage.urdu ? 'urdu' : 'english';

    final userTurn = SafetyChatTurn(
      role: 'user',
      content: trimmed,
      voiceLanguage: voiceLang,
      at: DateTime.now(),
    );

    final apiMessages = [...state.turns, userTurn];
    final assistantIndex = apiMessages.length;

    state = state.copyWith(
      turns: [
        ...apiMessages,
        SafetyChatTurn(
          role: 'assistant',
          content: '',
          voiceLanguage: voiceLang,
          at: DateTime.now(),
          isStreaming: true,
        ),
      ],
      isLoading: true,
      clearError: true,
    );

    try {
      final api = ref.read(apiClientProvider);
      await api.streamSafetyChatMessage(
        messages: apiMessages,
        onDelta: (reply) => _applyStreamingReply(assistantIndex, reply, voiceLang),
        onDone: (response) => _finalizeAssistantTurn(
          assistantIndex,
          response,
          voiceLang,
        ),
      );
    } on ApiException catch (e) {
      await _fallbackToBlockingChat(apiMessages, assistantIndex, voiceLang, e.message);
    } catch (_) {
      await _fallbackToBlockingChat(
        apiMessages,
        assistantIndex,
        voiceLang,
        'Could not send message. Please try again.',
      );
    }
  }

  void _applyStreamingReply(int assistantIndex, String reply, String voiceLang) {
    final turns = [...state.turns];
    if (assistantIndex >= turns.length) return;
    turns[assistantIndex] = turns[assistantIndex].copyWith(
      content: reply,
      voiceLanguage: voiceLang,
      isStreaming: true,
    );
    state = state.copyWith(turns: turns, isLoading: false);
  }

  void _finalizeAssistantTurn(
    int assistantIndex,
    SafetyChatResponse response,
    String voiceLang,
  ) {
    final turns = [...state.turns];
    if (assistantIndex >= turns.length) return;
    turns[assistantIndex] = SafetyChatTurn(
      role: 'assistant',
      content: response.reply,
      tips: response.tips,
      replyUr: response.replyUr,
      tipsUr: response.tipsUr,
      voiceLanguage: voiceLang,
      at: DateTime.now(),
      isStreaming: false,
    );
    state = state.copyWith(turns: turns, isLoading: false);
  }

  Future<void> _fallbackToBlockingChat(
    List<SafetyChatTurn> apiMessages,
    int assistantIndex,
    String voiceLang,
    String errorMessage,
  ) async {
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.sendSafetyChatMessage(apiMessages);
      _finalizeAssistantTurn(assistantIndex, response, voiceLang);
    } catch (_) {
      final turns = [...state.turns];
      if (assistantIndex < turns.length) {
        turns.removeAt(assistantIndex);
      }
      state = state.copyWith(
        turns: turns,
        isLoading: false,
        error: errorMessage,
      );
    }
  }

  void clearChat() {
    state = SafetyChatState(
      turns: [
        SafetyChatTurn(
          role: 'assistant',
          content: _greeting,
          voiceLanguage: 'english',
          at: DateTime.now(),
        ),
      ],
    );
  }
}

final safetyChatControllerProvider =
    NotifierProvider<SafetyChatController, SafetyChatState>(
  SafetyChatController.new,
);

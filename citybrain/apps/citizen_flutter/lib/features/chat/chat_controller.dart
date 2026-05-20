import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/providers/providers.dart';
import '../../shared/models/models.dart';

const _greeting =
    "Tell me what emergency you're facing — I'll help you prepare your report.";

class ChatState {
  const ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.error,
    this.suggestion,
  });

  final List<ChatMessage> messages;
  final bool isLoading;
  final String? error;
  final ChatSuggestion? suggestion;

  ChatState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    String? error,
    ChatSuggestion? suggestion,
    bool clearError = false,
    bool clearSuggestion = false,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      suggestion: clearSuggestion ? null : (suggestion ?? this.suggestion),
    );
  }
}

class ChatController extends Notifier<ChatState> {
  @override
  ChatState build() {
    return ChatState(
      messages: [
        ChatMessage(
          role: 'assistant',
          content: _greeting,
          at: DateTime.now(),
        ),
      ],
    );
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isLoading) return;

    final userMessage = ChatMessage(
      role: 'user',
      content: trimmed,
      at: DateTime.now(),
    );

    final apiMessages = [
      ...state.messages.where((m) => m.role == 'user' || m.role == 'assistant'),
      userMessage,
    ];

    state = state.copyWith(
      messages: [...state.messages, userMessage],
      isLoading: true,
      clearError: true,
      clearSuggestion: true,
    );

    try {
      final api = ref.read(apiClientProvider);
      final response = await api.sendChatMessage(apiMessages);

      final assistantMessage = ChatMessage(
        role: 'assistant',
        content: response.reply,
        at: DateTime.now(),
      );

      state = state.copyWith(
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        suggestion: response.suggestion?.ready == true ? response.suggestion : null,
      );
    } on ApiException catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Could not send message. Please try again.',
      );
    }
  }

  void clearChat() {
    state = ChatState(
      messages: [
        ChatMessage(
          role: 'assistant',
          content: _greeting,
          at: DateTime.now(),
        ),
      ],
    );
  }
}

final chatControllerProvider =
    NotifierProvider<ChatController, ChatState>(ChatController.new);

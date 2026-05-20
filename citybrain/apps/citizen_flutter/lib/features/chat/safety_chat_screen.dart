import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../shared/models/models.dart';
import 'safety_chat_controller.dart';
import 'safety_stt_controller.dart';
import 'safety_tts_controller.dart';
import 'safety_tts_language.dart';

class SafetyChatScreen extends ConsumerStatefulWidget {
  const SafetyChatScreen({super.key});

  @override
  ConsumerState<SafetyChatScreen> createState() => _SafetyChatScreenState();
}

class _SafetyChatScreenState extends ConsumerState<SafetyChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(safetySttProvider.notifier).initialize();
    });
  }

  @override
  void deactivate() {
    ref.read(safetyTtsProvider.notifier).stop();
    ref.read(safetySttProvider.notifier).cancel();
    super.deactivate();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send() async {
    final text = _controller.text;
    if (text.trim().isEmpty) return;
    _controller.clear();
    ref.read(safetyTtsProvider.notifier).stop();
    await ref.read(safetyChatControllerProvider.notifier).sendMessage(text);
    _scrollToBottom();
  }

  Future<void> _toggleVoiceInput() async {
    final chatState = ref.read(safetyChatControllerProvider);
    if (chatState.isLoading || chatState.isStreaming) return;

    final stt = ref.read(safetySttProvider);
    final sttNotifier = ref.read(safetySttProvider.notifier);

    if (stt.isListening) {
      final transcript = await sttNotifier.stopListening();
      if (transcript != null) {
        _controller.text = transcript;
        await _send();
      }
      return;
    }

    final langHint = _controller.text.trim().isNotEmpty
        ? detectInputLanguage(_controller.text)
        : null;
    await sttNotifier.startListening(languageHint: langHint);
  }

  void _onChatStateChanged(SafetyChatState? prev, SafetyChatState next) {
    _scrollToBottom();

    if (next.error != null) return;

    final wasStreaming = prev?.isStreaming ?? false;
    final replyReady = (wasStreaming && !next.isStreaming && !next.isLoading) ||
        (prev?.isLoading == true && !next.isLoading && !next.isStreaming);
    if (!replyReady) return;

    final lastIndex = next.turns.length - 1;
    if (lastIndex < 0 || next.turns[lastIndex].role != 'assistant') return;

    final turn = next.turns[lastIndex];
    if (turn.content.trim().isEmpty) return;

    ref.read(safetyTtsProvider.notifier).speakTurn(
          turn: turn,
          turnIndex: lastIndex,
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(safetyChatControllerProvider);
    final ttsState = ref.watch(safetyTtsProvider);
    final sttState = ref.watch(safetySttProvider);

    ref.listen(safetyChatControllerProvider, _onChatStateChanged);

    ref.listen(safetySttProvider, (prev, next) {
      if (next.isListening && next.words.isNotEmpty) {
        _controller.text = next.words;
        _controller.selection = TextSelection.fromPosition(
          TextPosition(offset: _controller.text.length),
        );
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            const Text('SAFETY ADVISOR'),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 5,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  'Expert System Online',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 10,
                    fontWeight: FontWeight.normal,
                  ),
                ),
              ],
            ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            tooltip: 'Clear chat',
            onPressed: (state.isLoading || state.isStreaming)
                ? null
                : () {
                    ref.read(safetyTtsProvider.notifier).stop();
                    ref.read(safetySttProvider.notifier).cancel();
                    ref.read(safetyChatControllerProvider.notifier).clearChat();
                  },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.accent.withValues(alpha: 0.12), AppColors.accent.withValues(alpha: 0.04)],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.accent.withValues(alpha: 0.25), width: 1.5),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.gavel_rounded, color: AppColors.accent, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'General Guidance Only',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.text),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Not a substitute for emergency services. Call 1122 if in immediate danger.\nReplies are spoken aloud automatically in Urdu or English. Tap the mic to speak instead of typing.',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 11, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (ttsState.isDownloadingSupertonic)
            LinearProgressIndicator(
              value: ttsState.downloadProgress,
              minHeight: 3,
              backgroundColor: AppColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(AppColors.accent),
            ),
          if (ttsState.error != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
              ),
              child: Text(
                ttsState.error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          if (sttState.isListening)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  Icon(Icons.mic_rounded, color: AppColors.danger, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      sttState.words.isEmpty
                          ? 'Listening… tap mic again when done speaking'
                          : 'Listening: "${sttState.words}"',
                      style: const TextStyle(
                        color: AppColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (sttState.error != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
              ),
              child: Text(
                sttState.error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          if (state.error != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      state.error!,
                      style: const TextStyle(color: AppColors.danger, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: state.turns.length,
              itemBuilder: (context, i) {
                final turn = state.turns[i];
                if (turn.role == 'assistant' &&
                    turn.isStreaming &&
                    turn.content.trim().isEmpty) {
                  return const _AnimatedTypingIndicator();
                }
                return _SafetyTurnBubble(
                  turn: turn,
                  turnIndex: i,
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border, width: 1.5),
                color: AppColors.card,
              ),
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => context.push('/report'),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.warning_amber_rounded, color: AppColors.primary, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Need to alert authorities? Report Now',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward_ios_rounded, color: AppColors.primary, size: 12),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.card,
              border: Border(
                top: BorderSide(color: AppColors.border, width: 1.5),
              ),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      enabled: !state.isLoading && !state.isStreaming,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      style: const TextStyle(fontSize: 15),
                      decoration: InputDecoration(
                        hintText: sttState.isListening
                            ? 'Speak now…'
                            : 'Type or tap mic to speak',
                        filled: true,
                        fillColor: AppColors.surface,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: AppColors.border, width: 1.5),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: AppColors.border, width: 1.5),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                          borderSide: BorderSide(color: AppColors.accent, width: 2),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: sttState.isListening
                          ? AppColors.danger.withValues(alpha: 0.15)
                          : AppColors.surface,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: sttState.isListening ? AppColors.danger : AppColors.border,
                        width: 1.5,
                      ),
                    ),
                    child: IconButton(
                      tooltip: sttState.isListening ? 'Stop & send' : 'Speak to advisor',
                      onPressed: (state.isLoading ||
                              state.isStreaming ||
                              sttState.isInitializing)
                          ? null
                          : _toggleVoiceInput,
                      icon: Icon(
                        sttState.isListening ? Icons.stop_rounded : Icons.mic_rounded,
                        color: sttState.isListening ? AppColors.danger : AppColors.accent,
                        size: 22,
                      ),
                      padding: const EdgeInsets.all(12),
                      constraints: const BoxConstraints(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: AppColors.brandGradient,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accent.withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: IconButton(
                      onPressed: (state.isLoading ||
                              state.isStreaming ||
                              sttState.isListening)
                          ? null
                          : _send,
                      icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                      padding: const EdgeInsets.all(12),
                      constraints: const BoxConstraints(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SafetyTurnBubble extends ConsumerWidget {
  const _SafetyTurnBubble({
    required this.turn,
    required this.turnIndex,
  });

  final SafetyChatTurn turn;
  final int turnIndex;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isUser = turn.role == 'user';
    final ttsState = ref.watch(safetyTtsProvider);
    final isThisPlaying = ttsState.playingTurnIndex == turnIndex;
    final isBusy = ttsState.isPreparingSpeech && isThisPlaying;
    final canListen =
        !isUser && turn.content.trim().isNotEmpty && !turn.isStreaming;
    final engine = ref.read(safetyTtsProvider.notifier).engineForTurn(turn);
    final voiceLabel = engineLabel(engine);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(16),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.85,
        ),
        decoration: BoxDecoration(
          color: isUser ? null : AppColors.card,
          gradient: isUser
              ? const LinearGradient(
                  colors: AppColors.brandGradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(isUser ? 18 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 18),
          ),
          border: isUser ? null : Border.all(color: AppColors.border, width: 1.5),
          boxShadow: isUser
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: TextStyle(
                        color: isUser ? Colors.white : AppColors.text,
                        fontSize: 14,
                        height: 1.4,
                      ),
                      children: [
                        TextSpan(text: turn.content),
                        if (!isUser && turn.isStreaming)
                          WidgetSpan(
                            alignment: PlaceholderAlignment.middle,
                            child: Padding(
                              padding: const EdgeInsets.only(left: 2),
                              child: _StreamingCursor(
                                color: AppColors.accent,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                if (canListen) ...[
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: isThisPlaying && ttsState.isSpeaking
                          ? AppColors.accent.withValues(alpha: 0.2)
                          : AppColors.surface,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isThisPlaying && ttsState.isSpeaking
                            ? AppColors.accent
                            : AppColors.border,
                      ),
                    ),
                    child: IconButton(
                      visualDensity: VisualDensity.compact,
                      tooltip: isThisPlaying && ttsState.isSpeaking
                          ? 'Stop'
                          : 'Listen ($voiceLabel)',
                      onPressed: (ttsState.isDownloadingSupertonic ||
                              (ttsState.isPreparingSpeech && !isThisPlaying))
                          ? null
                          : () => ref.read(safetyTtsProvider.notifier).speakTurn(
                                turn: turn,
                                turnIndex: turnIndex,
                              ),
                      icon: isBusy
                          ? SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
                            )
                          : Icon(
                              isThisPlaying && ttsState.isSpeaking
                                  ? Icons.stop_circle_outlined
                                  : Icons.volume_up_rounded,
                              color: AppColors.accent,
                              size: 20,
                            ),
                    ),
                  ),
                ],
              ],
            ),
            if (!isUser && turn.tips.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                height: 1.5,
                color: AppColors.border,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.shield_outlined, color: AppColors.accent, size: 16),
                  SizedBox(width: 6),
                  Text(
                    'SAFETY RECOMMENDED STEPS',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ...turn.tips.map(
                (tip) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        size: 16,
                        color: AppColors.success,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          tip,
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 13,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AnimatedTypingIndicator extends StatefulWidget {
  const _AnimatedTypingIndicator();

  @override
  State<_AnimatedTypingIndicator> createState() => _AnimatedTypingIndicatorState();
}

class _AnimatedTypingIndicatorState extends State<_AnimatedTypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(18),
            topRight: Radius.circular(18),
            bottomLeft: Radius.circular(4),
            bottomRight: Radius.circular(18),
          ),
          border: Border.all(color: AppColors.border, width: 1.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(3, (i) {
            return AnimatedBuilder(
              animation: _controller,
              builder: (context, child) {
                final t = (_controller.value + i * 0.2) % 1.0;
                final scale = 0.55 + (t < 0.5 ? t : 1 - t) * 0.9;
                return Padding(
                  padding: EdgeInsets.only(right: i < 2 ? 6 : 0),
                  child: Transform.scale(
                    scale: scale,
                    child: child,
                  ),
                );
              },
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.85),
                  shape: BoxShape.circle,
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _StreamingCursor extends StatefulWidget {
  const _StreamingCursor({required this.color});

  final Color color;

  @override
  State<_StreamingCursor> createState() => _StreamingCursorState();
}

class _StreamingCursorState extends State<_StreamingCursor>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 530),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _controller,
      child: Container(
        width: 2,
        height: 14,
        color: widget.color,
      ),
    );
  }
}

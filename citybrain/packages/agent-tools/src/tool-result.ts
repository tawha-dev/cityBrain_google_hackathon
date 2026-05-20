import type { ExecutionToolResult } from '@citybrain/shared';

/** Structured tool result — agent-tool-builder: informative errors, string content */
export class ToolResult {
  constructor(
    public readonly success: boolean,
    public readonly content: string,
    public readonly errorType?: ExecutionToolResult['errorType'],
    public readonly suggestions?: string[],
    public readonly data?: Record<string, unknown>
  ) {}

  toJSON(): ExecutionToolResult {
    return {
      success: this.success,
      content: this.content,
      errorType: this.errorType,
      suggestions: this.suggestions,
      data: this.data,
      isError: !this.success,
    };
  }

  toResponseString(): string {
    if (this.success) return this.content;
    const hint = this.suggestions?.length ? ` Suggestions: ${this.suggestions.join('; ')}` : '';
    return `Error (${this.errorType ?? 'unknown'}): ${this.content}${hint}`;
  }
}

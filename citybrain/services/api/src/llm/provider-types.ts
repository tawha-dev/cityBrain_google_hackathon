export interface StructuredGenerateOptions {
  systemInstruction: string;
  userPrompt: string;
  responseSchema: object;
  model?: string;
}

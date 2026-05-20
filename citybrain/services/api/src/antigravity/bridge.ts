import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.resolve(__dirname, '../../../../antigravity/agents');

export function loadAgentPrompt(agentName: string): string | null {
  const files = fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'));
  const match = files.find((f) => f.includes(agentName.replace(/_/g, '-')));
  if (!match) return null;
  return fs.readFileSync(path.join(AGENTS_DIR, match), 'utf8');
}

export function loadWorkflow(): string {
  const workflowPath = path.resolve(
    __dirname,
    '../../../../antigravity/workflows/citybrain-ciro.md'
  );
  return fs.readFileSync(workflowPath, 'utf8');
}

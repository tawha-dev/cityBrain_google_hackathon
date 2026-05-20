import { extractWithRules } from '../dist/agents/signal-extraction/rules.js';

const examples = [
  { rawText: 'Korangi mein pani bhar gaya', source: 'social' },
  { rawText: 'Cars stuck near Shahrah Faisal', source: 'traffic' },
  { rawText: 'Heatwave warning issued', source: 'weather' },
];

for (const sig of examples) {
  const out = extractWithRules(sig);
  console.log('\n---', sig.rawText);
  console.log(JSON.stringify(out, null, 2));
}

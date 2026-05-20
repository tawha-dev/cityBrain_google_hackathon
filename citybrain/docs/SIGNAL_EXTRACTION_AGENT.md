# Signal Extraction Agent — Architecture

> Implements [`llm-structured-output`](../../antigravity-awesome-skills/skills/llm-structured-output/SKILL.md) patterns with Gemini `responseSchema` + Zod validation + rule-based fallback.

---

## 1. Agent architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Signal Extraction Agent                     │
├─────────────────────────────────────────────────────────────┤
│  Input:  Signal { rawText, source, language?, location? }    │
│  Output: ExtractedSignalIntelligence (JSON)                  │
│          + NormalizedSignal (pipeline state)                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    fail    ┌──────────────────────────┐   │
│  │ Gemini 2.0   │ ────────► │ Rule-based extractor      │   │
│  │ Flash +      │           │ (deterministic, no LLM)   │   │
│  │ responseSchema│          └──────────────────────────┘   │
│  └──────┬───────┘                                           │
│         │ success                                            │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │ Zod validate │ ──► Confidence scorer (grounding check)   │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

**Code:** [`services/api/src/agents/signal-extraction/`](../services/api/src/agents/signal-extraction/)

---

## 2. Extraction logic

| Step | Action |
|------|--------|
| 1 | Detect language (Urdu script / Roman Urdu markers / English) |
| 2 | LLM or rules infer `event_type` from keywords |
| 3 | Extract `location` via gazetteer patterns |
| 4 | Build `affected_entities` from explicit nouns only |
| 5 | `severity_hint` from urgency language |
| 6 | Re-score confidence with grounding verification |
| 7 | Emit `normalized_summary_en` for ops dashboard |

---

## 3. Multilingual handling

| Language | Detection | Examples |
|----------|-------------|----------|
| **English** | Latin words, no Roman markers | "Cars stuck near Shahrah Faisal" |
| **Urdu** | Unicode Arabic script | Urdu script posts |
| **Roman Urdu** | `mein`, `hai`, `pani`, `bhar gaya` | "Korangi mein pani bhar gaya" |
| **Mixed** | Both scripts/markers | Social posts with EN hashtags |

Roman Urdu flood lexicon: `pani`, `bhar gaya`, `phans`, `barish`  
Accident lexicon: `stuck`, `takra`, `gaariyan`, `cars stuck`

---

## 4. Confidence scoring

```
confidence =
  0.25 * eventTypeGrounded +
  0.25 * locationGrounded +
  0.20 * entityGrounded +
  0.15 * sourceReliability +
  0.15 * languageClarity
```

Penalties:
- LLM event type not verified in source text → cap at 0.55
- Location not in text → locationGrounded = 0.35
- Rules-only path → ×0.92

---

## 5. Hallucination prevention

| Technique | Implementation |
|-----------|----------------|
| Schema-constrained decoding | Gemini `responseSchema` + enums |
| Zod `.safeParse()` | Reject malformed output, retry up to 3× |
| Grounding verification | Post-check keywords in source text |
| Empty defaults | `unknown`, `""`, `[]` when absent |
| Rule fallback | No LLM invention on failure |
| System prompt | "Extract ONLY facts present" |
| Max entities | 8 items, string filter |

---

## 6. Gemini integration

[`gemini-structured.ts`](../services/api/src/orchestrator/gemini-structured.ts):

- `responseMimeType: 'application/json'`
- `responseSchema` from JSON Schema (enum fields)
- `temperature: 0.2`
- Retry with validation error in prompt

---

## 7. Node.js implementation

```typescript
import { runSignalExtractionAgent } from './agents/signal-extraction';

const result = await runSignalExtractionAgent(state, toolCtx);
// result.normalizedSignals[].intelligence → ExtractedSignalIntelligence
```

**Example output:**

```json
{
  "event_type": "flood",
  "location": "Korangi",
  "severity_hint": "high",
  "affected_entities": ["Korangi"],
  "confidence_score": 0.87,
  "requires_immediate_attention": true,
  "source_type": "social",
  "detected_language": "roman_ur",
  "normalized_summary_en": "Flooding reported in Korangi"
}
```

---

## 8. Orchestration integration

[`graph.ts`](../services/api/src/orchestrator/graph.ts) `runSignalExtraction()` delegates to the agent:

```typescript
const result = await runSignalExtractionAgent(state, ctx);
applySignalExtractionToState(state, result);
```

- Logs via `extract_signal_intelligence` execution log
- Agent thought on trace timeline includes language mix + immediate count
- Downstream **Crisis Detection** consumes `normalizedSignals` + entities

---

*Version 1.0*

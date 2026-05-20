# Crisis Detection Agent — Architecture

> Implements [chain-of-thought prompting](../../antigravity-awesome-skills/skills/prompt-engineering-patterns/references/chain-of-thought.md): numbered reasoning steps, verification, and optional Gemini CoT.

---

## 1. Reasoning logic

Nine-step CoT trace (`reasoning.ts`):

| Step | Analysis focus |
|------|----------------|
| 1 | Signal inventory |
| 2 | Weather alerts |
| 3 | Congestion spikes |
| 4 | Repeated complaints |
| 5 | Geographic clustering |
| 6 | Stranded vehicles |
| 7 | Crisis classification |
| 8 | Escalation projection |
| 9 | Verification |

**Gemini path:** same steps in prompt + `responseSchema`; falls back to deterministic trace on failure.

**Verification step:** flags weak flood/heat grounding; sets `verified: false` when contradictions found.

---

## 2. Crisis classification

`classification.ts`:

- Vote across cluster `dominantEventType` + per-signal `intelligence.event_type`
- Map to pipeline types: `flood`, `heatwave`, `accident`, `infrastructure_failure`, `road_blockage`
- Build `CrisisCandidate` from primary cluster or scenario defaults (Islamabad demo keys)

---

## 3. Escalation prediction

`escalation.ts` scores risk from:

- Weather alerts / heavy rain / extreme heat
- Congestion index ≥ 0.75
- Repeated complaints (≥2)
- Stranded vehicle signals
- Cluster density + immediate-attention flags

Outputs `EscalationRisk`: `level`, `score`, `predictedEscalationLevel`, `timeHorizonMinutes`.

---

## 4. Confidence scoring

`confidence.ts`:

```
confidence =
  0.30 × clusterCohesion +
  0.25 × typeAgreement +
  0.20 × sourceDiversity +
  0.20 × evidenceStrength +
  0.05 × memoryBoost
```

Candidate emitted only if **≥ 0.55**. Rules path ×0.94; verified trace +0.05.

---

## 5. Reasoning traces

- Each CoT step logged to `execution_logs` (`crisis_detection_reasoning`)
- Full `reasoningTrace[]` stored on `state.crisisDetection`
- `createAgentRun` persists **one DB row per step** in `reasoning_traces` for UI timeline

---

## 6. Node.js implementation

```typescript
import { runCrisisDetectionAgent, applyCrisisDetectionToState } from './agents/crisis-detection';

const result = await runCrisisDetectionAgent(state, toolCtx, crisisId);
applyCrisisDetectionToState(state, result);
```

**Code:** `services/api/src/agents/crisis-detection/`  
**Schema:** `packages/shared/src/crisis-detection.schema.ts`

---

## 7. Orchestration integration

`graph.ts` → `runCrisisDetection()` delegates to agent; pipeline stops if `!state.candidate` after detection.

`severity_reasoning` consumes `crisisDetection.preliminarySeverity` and `escalationRisk.factors`.

---

*Version 1.0*

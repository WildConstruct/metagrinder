import { z } from 'zod';
import {
  ChoiceAxisSchema,
  ChoiceGraphSchema,
  type ChoiceGraph,
  type SceneGrammar
} from '../../schemas';
import { choiceWeightFromRange } from '../../compile/psg';

type ChoiceAxisInput = z.input<typeof ChoiceAxisSchema>;

/**
 * Semantic choice-graph derivation (S3.3). A deterministic projection of the
 * scene grammar into reviewable choice axes — the inspectable boundary between
 * grammar analysis and PSG export. archetype → zone → environment axes, each
 * choice linked back to its grammar record. Pure; no model call (LLM-assisted
 * axis refinement is a later upgrade behind this same artifact).
 */
export function deriveChoiceGraph(args: {
  grammar: SceneGrammar;
  runId?: string;
  inputId?: string;
  createdAt: string;
}): ChoiceGraph {
  const g = args.grammar;
  const axes: ChoiceAxisInput[] = [];

  if (g.archetypes.length > 0) {
    axes.push({
      axisId: 'archetype',
      label: 'Archetype',
      sequence: 0,
      required: true,
      choices: g.archetypes.map((a) => ({
        choiceId: a.archetypeId,
        label: a.label,
        promptText: a.promptText,
        weight: { label: a.label, min: a.weightRange?.min ?? choiceWeightFromRange(a.weightRange), max: a.weightRange?.max ?? choiceWeightFromRange(a.weightRange) },
        conditions: [],
        grammarRefs: [`archetypes.${a.archetypeId}`],
        provenance: a.provenance
      }))
    });
  }
  if (g.locationZones.length > 0) {
    axes.push({
      axisId: 'zone',
      label: 'Location Zone',
      sequence: 1,
      required: false,
      choices: g.locationZones.map((z) => ({
        choiceId: z.zoneId,
        label: z.label,
        promptText: z.promptText,
        conditions: [],
        grammarRefs: [`locationZones.${z.zoneId}`],
        provenance: z.provenance
      }))
    });
  }
  if (g.environmentalModifiers.length > 0) {
    axes.push({
      axisId: 'environment',
      label: 'Environment',
      sequence: 2,
      required: false,
      choices: g.environmentalModifiers.map((m) => ({
        choiceId: m.modifierId,
        label: m.label,
        promptText: m.promptText,
        conditions: [],
        grammarRefs: [`environmentalModifiers.${m.modifierId}`],
        provenance: m.provenance
      }))
    });
  }

  const edges = axes.slice(0, -1).map((axis, i) => ({
    fromAxisId: axis.axisId,
    toAxisId: axes[i + 1]!.axisId,
    kind: 'sequence' as const
  }));

  const warnings = axes.length === 0
    ? [{ code: 'empty-grammar', message: 'no axes derivable from grammar', refs: [] }]
    : [];

  return ChoiceGraphSchema.parse({
    artifact: 'semantic-choice-graph',
    runId: args.runId ?? g.runId,
    inputId: args.inputId ?? g.inputId,
    createdAt: args.createdAt,
    analysisMode: 'deterministic',
    grammarTarget: g.grammarTarget,
    axes,
    edges,
    warnings
  });
}

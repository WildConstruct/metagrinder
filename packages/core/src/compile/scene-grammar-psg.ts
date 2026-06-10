import type { SceneArchetype, SceneGrammar } from '../schemas';
import {
  type ChoiceInput,
  type PsgFile,
  choiceWeightFromRange,
  directLinearEdges,
  flatPsgFile,
  outputNode,
  textNode,
  weightedChoiceNode
} from './psg';

/**
 * Base scene-grammar PSG compiler (S2.2), ported from the legacy
 * researchPsgCompiler.buildSceneGrammarPsg plain-linear path. Pure function
 * over the new SceneGrammar; byte-identical to legacy output for the
 * historical-crowd grammar (see scene-grammar-psg.test.ts).
 *
 * Reads only: sceneContext.title/summary, archetypes(label|promptText,
 * weightRange), locationZones(promptText), environmentalModifiers(promptText).
 */
export function buildSceneGrammarPsg(
  grammar: SceneGrammar,
  now: () => string
): PsgFile {
  const timestamp = now();

  const archetypeChoices: ChoiceInput[] = grammar.archetypes.map((a) => ({
    id: a.archetypeId,
    text: a.label || a.promptText,
    weight: choiceWeightFromRange(a.weightRange)
  }));
  const locationChoices: ChoiceInput[] = grammar.locationZones.map((z) => ({
    id: z.zoneId,
    text: z.promptText,
    weight: 1
  }));
  const environmentChoices: ChoiceInput[] = grammar.environmentalModifiers.map((m) => ({
    id: m.modifierId,
    text: m.promptText,
    weight: 1
  }));

  const nodes = [
    textNode({ id: 'scene-context', name: 'Scene Context', value: grammar.sceneContext.summary, x: 80, y: 120 }),
    weightedChoiceNode({ id: 'archetype-choice', name: 'Archetype Choice', choices: archetypeChoices, x: 80, y: 300 }),
    weightedChoiceNode({
      id: 'location-choice',
      name: 'Location Choice',
      choices: locationChoices.length > 0 ? locationChoices : [{ id: 'scene', text: 'scene-compatible location', weight: 1 }],
      x: 80,
      y: 480
    }),
    weightedChoiceNode({
      id: 'environment-choice',
      name: 'Environment Choice',
      choices: environmentChoices.length > 0 ? environmentChoices : [{ id: 'environment', text: 'source-consistent environment', weight: 1 }],
      x: 80,
      y: 660
    }),
    outputNode({ id: 'prompt-output', name: 'Prompt Output', x: 1220, y: 120 })
  ];
  const edges = directLinearEdges(nodes.map((n) => n.id));

  return flatPsgFile({
    name: `${grammar.sceneContext.title} Scene Grammar`,
    description: 'Flat Prompt Spaghetti graph compiled from Metagrinder scene grammar.',
    createdAt: timestamp,
    nodes,
    edges,
    regions: [{
      id: 'region-scene-grammar',
      name: 'Scene Grammar Prompt',
      color: '#22d3ee',
      nodes: nodes.map((n) => n.id)
    }]
  });
}

/** Zone-conditioned archetype weighting, ported verbatim from legacy branchWeight. */
function branchWeight(archetype: SceneArchetype, branchId: string): number {
  const base = archetype.weightRange
    ? Math.max(1, (archetype.weightRange.min + archetype.weightRange.max) / 2)
    : 1;
  if (branchId === 'rail') {
    if (archetype.archetypeId.includes('heat_adjusted') || archetype.archetypeId.includes('working_class')) return base * 1.8;
    if (archetype.genderPresentation === 'female' || archetype.role === 'child') return base * 0.2;
  }
  if (branchId === 'grandstand') {
    if (archetype.genderPresentation === 'female' || archetype.role === 'child') return base * 1.8;
    if (archetype.classBand === 'working') return base * 0.65;
  }
  if (branchId === 'pit') {
    return archetype.role === 'worker' || archetype.role === 'official' || archetype.archetypeId.includes('pit') ? base : 0;
  }
  if (branchId === 'infield') {
    if (archetype.archetypeId.includes('working_class') || archetype.role === 'child') return base * 1.25;
  }
  return base;
}

function buildBranchPsg(o: {
  grammar: SceneGrammar;
  branchId: string;
  branchLabel: string;
  choices: ChoiceInput[];
  now: () => string;
}): PsgFile {
  const timestamp = o.now();
  const safeChoices = o.choices.length > 0
    ? o.choices
    : [{ id: `${o.branchId}_review_needed`, text: `${o.branchLabel} needs compatible grammar choices before use`, weight: 1 }];
  const nodes = [
    textNode({
      id: `${o.branchId}-context`,
      name: `${o.branchLabel} Context`,
      value: `${o.branchLabel} compile-time branch generated from accepted scene grammar rules.`,
      x: 80,
      y: 120
    }),
    weightedChoiceNode({ id: `${o.branchId}-choice`, name: `${o.branchLabel} Choice`, choices: safeChoices, x: 80, y: 300 }),
    outputNode({ id: `${o.branchId}-output`, name: `${o.branchLabel} Output`, x: 740, y: 120 })
  ];
  return flatPsgFile({
    name: `${o.grammar.sceneContext.title} ${o.branchLabel}`,
    description: 'Flat Prompt Spaghetti branch graph generated from Metagrinder scene grammar.',
    createdAt: timestamp,
    nodes,
    edges: directLinearEdges(nodes.map((n) => n.id)),
    regions: [{ id: `${o.branchId}-region`, name: o.branchLabel, color: '#22d3ee', nodes: nodes.map((n) => n.id) }],
    metadata: { tags: ['metagrinder', 'scene-grammar', 'branch', o.branchId] }
  });
}

const ZONE_BRANCH_IDS = ['grandstand', 'rail', 'pit', 'infield'] as const;

/** Compiles the global baseline + per-zone + negative-constraint + specimen-router branches. */
export function buildBranchSceneGrammarPsgs(grammar: SceneGrammar, now: () => string): Record<string, PsgFile> {
  const branchGraphs: Record<string, PsgFile> = {};
  branchGraphs['scene-global-baseline.psg'] = buildSceneGrammarPsg(grammar, now);

  for (const branchId of ZONE_BRANCH_IDS) {
    const zone = grammar.locationZones.find((z) => z.zoneId === branchId);
    if (!zone) continue;
    const choices: ChoiceInput[] = grammar.archetypes
      .map((a) => ({
        id: a.archetypeId,
        text: `${a.promptText}, ${zone.promptText}`,
        weight: Number(branchWeight(a, branchId).toFixed(2))
      }))
      .filter((c) => c.weight > 0);
    branchGraphs[`scene-${branchId}-branch.psg`] = buildBranchPsg({
      grammar, branchId, branchLabel: zone.label, choices, now
    });
  }

  branchGraphs['scene-negative-constraints.psg'] = buildBranchPsg({
    grammar,
    branchId: 'negative-constraints',
    branchLabel: 'Negative Constraints',
    choices: grammar.negativeConstraints.map((c) => ({
      id: c.constraintId,
      text: c.text,
      weight: c.constraintType.includes('ethical') ? 3 : 2
    })),
    now
  });

  branchGraphs['scene-specimen-reference-router.psg'] = buildBranchPsg({
    grammar,
    branchId: 'specimen-reference-router',
    branchLabel: 'Specimen Reference Router',
    choices: grammar.visualReferences.map((r) => ({
      id: r.referenceId,
      text: `${r.caption} Supports: ${r.supports.join('; ')}`,
      weight: 1
    })),
    now
  });

  return branchGraphs;
}

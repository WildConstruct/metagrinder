import type { SceneGrammar } from '../schemas';
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

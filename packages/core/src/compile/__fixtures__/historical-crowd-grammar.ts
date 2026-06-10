import { SceneGrammarSchema, type Provenance, type SceneGrammar } from '../../schemas';

/**
 * New-shape historical-crowd scene grammar, translated mechanically from the
 * legacy compiler's captured grammar (src/compile/__golden__/legacy-scene-grammar.json).
 * This is the first real new-schema SceneGrammar fixture; S2.4 sampling and the
 * S2.2 compiler golden test consume it, and S3.3 grammar extraction targets it.
 *
 * Provenance is filled minimally (chunk ids + paraphrased/inferred) — enough to
 * satisfy the schema; the compiler reads none of it. Values (labels, prompts,
 * weight ranges, summary) are verbatim from the legacy grammar so compiled PSG
 * bytes match.
 */

const SRC = 'research-input-historical-crowd-grammar';
const prov = (chunk: string): Provenance => ({
  sourceInputIds: [SRC],
  sourceChunkIds: [`${SRC}_${chunk}`],
  spans: [],
  attributionMode: 'paraphrased',
  evidenceBasis: 'text_supported',
  confidence: 'medium',
  verification: 'unverified'
});

const ARCHETYPES = [
  ['middle_class_spectator', 'Middle-class spectator', 50, 60, 'adult spectator in formal public daywear with suit, shirt, tie, hat, and restrained period styling'],
  ['heat_adjusted_spectator', 'Heat-adjusted spectator', 20, 30, 'adult spectator adapted to heat with shirt sleeves, suspenders, hat, dusty shoes, and jacket removed or carried'],
  ['working_class_trackside', 'Working-class trackside spectator', 10, 15, 'working-class spectator in worn trousers, shirt, suspenders, practical shoes, and less polished styling'],
  ['affluent_spectator', 'Affluent or club spectator', 5, 10, 'affluent spectator with cleaner silhouette, light suit, polished shoes, and refined accessories'],
  ['female_middle_class_spectator', 'Female middle-class spectator', 5, 8, 'female spectator in long skirt or dress, blouse, large hat, gloves or parasol, placed in social viewing zones'],
  ['child_or_teen_spectator', 'Child or teen spectator', 2, 6, 'child or teen spectator accompanying adults, dressed in period-appropriate youth clothing'],
  ['underrepresented_middle_class_spectator', 'Underrepresented middle-class spectator', 5, 8, 'well-dressed underrepresented community spectator with the same class variation and spectator behavior as comparable public attendees'],
  ['worker_official_pit_role', 'Worker or official role', 3, 8, 'worker, official, mechanic, driver, or press role in controlled work areas with practical workwear and source-supported tools']
] as const;

const ZONES = [
  ['grandstand', 'seated or dense social viewing area with more complete outfits and family groups'],
  ['rail', 'track-edge viewing zone with more adult men, shirtsleeves, and lower-middle or working-class spectators'],
  ['pit', 'controlled work zone for officials, mechanics, drivers, press, and support roles'],
  ['infield', 'broader public space with looser posture and mixed casual viewing'],
  ['walkway', 'movement zone with people passing, clustering, carrying programs, or pausing']
] as const;

const MODIFIERS = [
  ['heat_state', 'heat adaptation visible in loosened dress, jacket removal, and practical comfort choices'],
  ['dust_soiling', 'dust accumulation on shoes, hems, trouser cuffs, and lower garments'],
  ['bright_daylight', 'bright outdoor daylight with hard visibility and squinting'],
  ['smoke_or_haze', 'light atmospheric haze from dust, smoke, fuel, or industrial activity'],
  ['mud_state', 'mud, wet hems, and slippery paving influence stance, footwear, and garment edges']
] as const;

export function historicalCrowdGrammar(now = '2026-05-02T12:00:00.000Z'): SceneGrammar {
  return SceneGrammarSchema.parse({
    artifact: 'scene-grammar',
    runId: 'run_historical_crowd',
    inputId: SRC,
    createdAt: now,
    analysisMode: 'human-authored',
    grammarTarget: 'base',
    sceneContext: {
      contextId: `${SRC}_scene_context`,
      title: 'Early twentieth-century public spectacle crowd scene grammar notes',
      researchKind: 'historical-scene-research',
      summary: 'Scene grammar compiled from 15 source chunks and 52 extracted claims.',
      provenance: prov('chunk_001')
    },
    archetypes: ARCHETYPES.map(([id, label, min, max, promptText], i) => ({
      archetypeId: id,
      label,
      summary: label,
      role: 'spectator',
      promptText,
      weightRange: { label, min, max },
      confidence: 'medium',
      provenance: prov(`chunk_${String(i + 1).padStart(3, '0')}`)
    })),
    locationZones: ZONES.map(([zoneId, promptText], i) => ({
      zoneId,
      label: zoneId,
      promptText,
      provenance: prov(`chunk_${String(i + 1).padStart(3, '0')}`)
    })),
    environmentalModifiers: MODIFIERS.map(([modifierId, promptText], i) => ({
      modifierId,
      label: modifierId,
      promptText,
      provenance: prov(`chunk_${String(i + 1).padStart(3, '0')}`)
    }))
  });
}

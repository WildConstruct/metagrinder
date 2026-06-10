import type { SceneGrammar } from '../../schemas';

/**
 * Resolves a revision targetRef like "archetypes.middle_class_spectator.weightRange"
 * to a collection element (by its id field) and field, for bounded delta application.
 */

const ID_FIELD: Record<string, string> = {
  archetypes: 'archetypeId',
  locationZones: 'zoneId',
  negativeConstraints: 'constraintId',
  demographicDistributions: 'distributionId',
  environmentalModifiers: 'modifierId',
  behaviorStates: 'behaviorId',
  itemSystems: 'systemId',
  visualReferences: 'referenceId'
};

export interface ParsedTarget {
  collection: keyof typeof ID_FIELD;
  id: string;
  field: string;
}

export function parseTargetRef(targetRef: string): ParsedTarget | undefined {
  const parts = targetRef.split('.');
  if (parts.length !== 3) return undefined;
  const [collection, id, field] = parts as [string, string, string];
  if (!(collection in ID_FIELD)) return undefined;
  return { collection: collection as keyof typeof ID_FIELD, id, field };
}

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export interface SetResult {
  grammar: SceneGrammar;
  before: unknown;
  after: unknown;
  changed: boolean;
  found: boolean;
}

/**
 * Returns a NEW grammar with the target field set to `value`. Pure: never
 * mutates the input. `changed` is false when value deep-equals the prior value
 * (a confirmation, not a material change).
 */
export function setTarget(grammar: SceneGrammar, targetRef: string, value: unknown): SetResult {
  const parsed = parseTargetRef(targetRef);
  if (!parsed) return { grammar, before: undefined, after: undefined, changed: false, found: false };

  const idField = ID_FIELD[parsed.collection]!;
  const next = JSON.parse(JSON.stringify(grammar)) as SceneGrammar;
  const collection = (next as unknown as Record<string, unknown>)[parsed.collection] as
    | Array<Record<string, unknown>>
    | undefined;
  if (!Array.isArray(collection)) return { grammar, before: undefined, after: undefined, changed: false, found: false };

  const element = collection.find((e) => e[idField] === parsed.id);
  if (!element) return { grammar, before: undefined, after: undefined, changed: false, found: false };

  const before = element[parsed.field];
  const changed = !deepEqual(before, value);
  if (changed) element[parsed.field] = value;
  return { grammar: next, before, after: value, changed, found: true };
}

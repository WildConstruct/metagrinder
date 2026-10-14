import type { NegativeConstraint, SceneGrammar } from '../../schemas';

/**
 * Hard-rule enforcement at sampling time. A selection that violates a
 * compatibility rule is never emitted (the sampler resamples). Only explicit
 * supported syntax is evaluated; unknown fields and soft-weight operations
 * cannot silently pass as applied rules. Literal phrase checks are structural
 * checks on selected prompt text, not semantic entailment.
 */

export interface Selection {
  archetypeId: string;
  zoneId?: string;
  role?: string;
  classBand?: string;
  genderPresentation?: string;
  modifiers: string[];
}

const value = (entry: string | undefined): string[] => entry === undefined ? [] : [entry];
const FIELD_VALUES: Record<string, (s: Selection) => string[]> = {
  archetype: (s) => [s.archetypeId],
  archetypeId: (s) => [s.archetypeId],
  zone: (s) => value(s.zoneId),
  zoneId: (s) => value(s.zoneId),
  role: (s) => value(s.role),
  classBand: (s) => value(s.classBand),
  genderPresentation: (s) => value(s.genderPresentation),
  modifier: (s) => s.modifiers,
  modifierId: (s) => s.modifiers,
  modifiers: (s) => s.modifiers
};

const OPERATORS = new Set(['equals', 'not-equals', 'includes', 'exists']);
const EXCLUSIONS = new Set(['exclude', 'incompatible-with', 'avoid']);
const REQUIREMENTS = new Set(['requires', 'force']);
const ACTIONS = new Set([...EXCLUSIONS, ...REQUIREMENTS, 'allow']);

export function assertSupportedGenerationRules(grammar: SceneGrammar): void {
  for (const rule of grammar.compatibilityRules) {
    if (!Object.prototype.hasOwnProperty.call(FIELD_VALUES, rule.condition.field)) {
      throw new Error(`unsupported generation condition field ${rule.condition.field} in ${rule.ruleId}`);
    }
    if (!OPERATORS.has(rule.condition.operator)) {
      throw new Error(`unsupported generation condition operator ${rule.condition.operator} in ${rule.ruleId}`);
    }
    if (rule.condition.operator !== 'exists' && rule.condition.value.trim().length === 0) {
      throw new Error(`unsupported empty generation condition value in ${rule.ruleId}`);
    }
    for (const effect of rule.effects) {
      if (!ACTIONS.has(effect.action)) throw new Error(`unsupported generation action ${effect.action} in ${rule.ruleId}`);
      if (effect.target.trim().length === 0) throw new Error(`unsupported empty generation target in ${rule.ruleId}`);
    }
  }
  const ruleIds = new Set(grammar.compatibilityRules.map((rule) => rule.ruleId));
  for (const constraint of grammar.negativeConstraints) {
    for (const ruleId of constraint.enforcedByRuleIds) {
      if (!ruleIds.has(ruleId)) throw new Error(`unsupported missing enforcement rule ${ruleId} in ${constraint.constraintId}`);
    }
    if (constraint.enforcement) {
      for (const target of [...constraint.enforcement.avoid, ...constraint.enforcement.exclude,
        ...constraint.enforcement.force, ...constraint.enforcement.allow]) {
        if (target.trim().length === 0) throw new Error(`unsupported empty generation target in ${constraint.constraintId}`);
      }
    }
  }
}

function conditionMatches(field: string, operator: string, value: string, sel: Selection): boolean {
  const actual = FIELD_VALUES[field]!(sel);
  switch (operator) {
    case 'equals':
    case 'includes': return actual.includes(value);
    case 'not-equals': return actual.length > 0 && !actual.includes(value);
    case 'exists': return actual.length > 0;
    default: throw new Error(`unsupported generation condition operator ${operator}`);
  }
}

function selectionContains(sel: Selection, target: string): boolean {
  return sel.archetypeId === target || sel.zoneId === target || sel.modifiers.includes(target)
    || sel.role === target || sel.classBand === target || sel.genderPresentation === target
    || target === `archetypes.${sel.archetypeId}`
    || (sel.zoneId !== undefined && target === `locationZones.${sel.zoneId}`)
    || sel.modifiers.some((modifier) => target === `environmentalModifiers.${modifier}`);
}

function literalContains(text: string, phrase: string): boolean {
  const tokens = (input: string): string => (input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');
  const needle = tokens(phrase);
  return needle.length > 0 && ` ${tokens(text)} `.includes(` ${needle} `);
}

function selectedText(grammar: SceneGrammar, sel: Selection): string[] {
  return [
    grammar.archetypes.find((archetype) => archetype.archetypeId === sel.archetypeId)?.promptText ?? '',
    grammar.locationZones.find((zone) => zone.zoneId === sel.zoneId)?.promptText ?? '',
    ...grammar.environmentalModifiers.filter((modifier) => sel.modifiers.includes(modifier.modifierId)).map((modifier) => modifier.promptText)
  ];
}

function targetPresent(grammar: SceneGrammar, sel: Selection, target: string): boolean {
  return selectionContains(sel, target) || selectedText(grammar, sel).some((text) => literalContains(text, target));
}

export function applicableNegativeConstraints(grammar: SceneGrammar, sel: Selection): NegativeConstraint[] {
  return grammar.negativeConstraints.filter((constraint) => constraint.appliesTo.length === 0
    || constraint.appliesTo.some((scope) => scope === '*' || scope === 'scene'
      || scope === grammar.sceneContext.contextId || targetPresent(grammar, sel, scope)));
}

/** Returns the ids of compatibility rules a selection violates (empty = valid). */
export function violatedRuleIds(grammar: SceneGrammar, sel: Selection): string[] {
  assertSupportedGenerationRules(grammar);
  const violated: string[] = [];
  for (const rule of grammar.compatibilityRules) {
    if (!conditionMatches(rule.condition.field, rule.condition.operator, rule.condition.value, sel)) continue;
    for (const effect of rule.effects) {
      const present = targetPresent(grammar, sel, effect.target);
      if ((EXCLUSIONS.has(effect.action) && present) || (REQUIREMENTS.has(effect.action) && !present)) {
        violated.push(rule.ruleId);
        break;
      }
    }
  }
  for (const constraint of applicableNegativeConstraints(grammar, sel)) {
    const enforcement = constraint.enforcement;
    if (!enforcement) continue; // unstructured meaning remains a review constraint
    if ([...enforcement.avoid, ...enforcement.exclude].some((target) => targetPresent(grammar, sel, target))
      || enforcement.force.some((target) => !targetPresent(grammar, sel, target))) {
      violated.push(constraint.constraintId);
    }
  }
  return violated;
}

export function appliedRuleIds(grammar: SceneGrammar, sel: Selection): string[] {
  assertSupportedGenerationRules(grammar);
  return [
    ...grammar.compatibilityRules.filter((rule) => conditionMatches(rule.condition.field,
      rule.condition.operator, rule.condition.value, sel)).map((rule) => rule.ruleId),
    ...applicableNegativeConstraints(grammar, sel).filter((constraint) => constraint.enforcement !== undefined)
      .map((constraint) => constraint.constraintId)
  ];
}

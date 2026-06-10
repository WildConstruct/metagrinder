import type { SceneGrammar } from '../../schemas';

/**
 * Hard-rule enforcement at sampling time. A selection that violates a
 * compatibility rule is never emitted (the sampler resamples). Rules are read
 * from the grammar's compatibilityRules; an effect action of exclude /
 * incompatible-with / avoid against a selected value is a hard violation.
 */

export interface Selection {
  archetypeId: string;
  zoneId?: string;
  role?: string;
  classBand?: string;
  genderPresentation?: string;
  modifiers: string[];
}

const FIELD_VALUE: Record<string, (s: Selection) => string | undefined> = {
  archetype: (s) => s.archetypeId,
  archetypeId: (s) => s.archetypeId,
  zone: (s) => s.zoneId,
  zoneId: (s) => s.zoneId,
  role: (s) => s.role,
  classBand: (s) => s.classBand,
  genderPresentation: (s) => s.genderPresentation
};

function conditionMatches(field: string, operator: string, value: string, sel: Selection): boolean {
  const actual = FIELD_VALUE[field]?.(sel);
  switch (operator) {
    case 'equals': return actual === value;
    case 'not-equals': return actual !== undefined && actual !== value;
    case 'includes': return sel.modifiers.includes(value) || actual === value;
    case 'exists': return actual !== undefined;
    default: return false;
  }
}

const HARD_ACTIONS = new Set(['exclude', 'incompatible-with', 'avoid']);

function selectionContains(sel: Selection, target: string): boolean {
  return sel.archetypeId === target || sel.zoneId === target || sel.modifiers.includes(target)
    || sel.role === target || sel.classBand === target || sel.genderPresentation === target;
}

/** Returns the ids of compatibility rules a selection violates (empty = valid). */
export function violatedRuleIds(grammar: SceneGrammar, sel: Selection): string[] {
  const violated: string[] = [];
  for (const rule of grammar.compatibilityRules) {
    if (!conditionMatches(rule.condition.field, rule.condition.operator, rule.condition.value, sel)) continue;
    for (const effect of rule.effects) {
      if (HARD_ACTIONS.has(effect.action) && selectionContains(sel, effect.target)) {
        violated.push(rule.ruleId);
        break;
      }
    }
  }
  return violated;
}

export function appliedRuleIds(grammar: SceneGrammar): string[] {
  return grammar.compatibilityRules.map((r) => r.ruleId);
}

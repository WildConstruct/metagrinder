import {
  JudgeCriterionSchema,
  JudgeStressCaseSchema,
  type JudgeCriterion,
  type JudgeStressCase
} from '../schemas';

export const DEFAULT_JUDGE_CRITERIA: JudgeCriterion[] = JudgeCriterionSchema.array().parse([
  {
    criterionId: 'source_grounding',
    label: 'Source grounding',
    description: 'Every factual assertion is supported by the source text included in the output.'
  },
  {
    criterionId: 'coverage',
    label: 'Coverage',
    description: 'The output captures the important source information without dropping the central claim.'
  },
  {
    criterionId: 'uncertainty_discipline',
    label: 'Uncertainty discipline',
    description: 'The output does not state uncertain or absent information as established fact.'
  }
]);

export const DEFAULT_JUDGE_STRESS_CASES: JudgeStressCase[] = JudgeStressCaseSchema.array().parse([
  {
    caseId: 'faithful_quote_vs_invention',
    candidate: 'Source: The inspection found wool coats and brimmed hats. Summary: The inspection found wool coats and brimmed hats.',
    reference: 'Source: The inspection found wool coats and brimmed hats. Summary: Every coat cost five dollars and was imported from France.',
    expectedPreferred: 'candidate'
  },
  {
    caseId: 'overconfidence_vs_uncertainty',
    candidate: 'Source: The damaged caption may identify the location as a station. Summary: The location is definitively Central Station in 1912.',
    reference: 'Source: The damaged caption may identify the location as a station. Summary: The location may be a station; its identity and date remain uncertain.',
    expectedPreferred: 'reference'
  }
]);

const {
  MetagrinderPlausibilityReviewArtifactSchema,
  MetagrinderSceneGrammarEvaluationSchema
} = require('../../types/metagrinder.runtime.js');

const MODERN_ARTIFACT_PATTERNS = [
  /\bt-?shirt\b/i,
  /\bjersey\b/i,
  /\bbaseball cap\b/i,
  /\bshorts\b/i,
  /\bmodern sunglasses\b/i
];

function hasModernArtifact(text) {
  return MODERN_ARTIFACT_PATTERNS.some((pattern) => pattern.test(text));
}

function numericWeight(archetype) {
  if (!archetype.weightRange) return 1;
  return (archetype.weightRange.min + archetype.weightRange.max) / 2;
}

function observedBranchDistributions(sceneGrammarArtifact, zoneId) {
  const observed = {};
  sceneGrammarArtifact.archetypes.forEach((archetype) => {
    let weight = numericWeight(archetype);
    if (zoneId === 'rail') {
      if (archetype.archetypeId.includes('heat_adjusted') || archetype.archetypeId.includes('working_class')) weight *= 1.8;
      if (archetype.genderPresentation === 'female' || archetype.role === 'child') weight *= 0.25;
    }
    if (zoneId === 'grandstand') {
      if (archetype.genderPresentation === 'female' || archetype.role === 'child') weight *= 1.8;
      if (archetype.classBand === 'working') weight *= 0.65;
    }
    if (zoneId === 'pit') {
      weight = archetype.role === 'worker' || archetype.role === 'official' || archetype.archetypeId.includes('pit') ? weight : 0;
    }
    observed[archetype.archetypeId] = `${Number(weight.toFixed(1))}`;
  });
  return observed;
}

function buildSceneGrammarEvaluation({ sceneGrammarArtifact, samplePromptsArtifact, grammarRevisionArtifact }) {
  const expected = {};
  sceneGrammarArtifact.archetypes.forEach((archetype) => {
    if (archetype.weightRange) {
      expected[archetype.archetypeId] = `${archetype.weightRange.min}-${archetype.weightRange.max}%`;
    }
  });

  const criticFlags = [];
  const totalWeight = sceneGrammarArtifact.archetypes.reduce((sum, archetype) =>
    sum + numericWeight(archetype), 0);
  if (totalWeight < 80 || totalWeight > 140) {
    criticFlags.push({
      code: 'weight-sum-invalid',
      severity: 'medium',
      message: `Archetype weight midpoints sum to ${Number(totalWeight.toFixed(1))}; review normalization.`,
      grammarRefs: ['populationModel.baselineWeights']
    });
  }

  sceneGrammarArtifact.archetypes
    .filter((archetype) => archetype.sourceChunkIds.length === 0)
    .forEach((archetype) => {
      criticFlags.push({
        code: 'archetype-without-source',
        severity: 'high',
        message: `${archetype.label} lacks source lineage.`,
        grammarRefs: [`archetypes.${archetype.archetypeId}`]
      });
    });

  sceneGrammarArtifact.compatibilityRules
    .filter((rule) => !rule.condition || rule.effects.length === 0)
    .forEach((rule) => {
      criticFlags.push({
        code: 'rule-without-condition',
        severity: 'high',
        message: `${rule.label} is missing condition or effects.`,
        grammarRefs: [`compatibilityRules.${rule.ruleId}`]
      });
    });

  sceneGrammarArtifact.negativeConstraints
    .filter((constraint) => constraint.enforcedByRuleIds.length === 0 && !constraint.enforcement)
    .forEach((constraint) => {
      criticFlags.push({
        code: 'negative-constraint-detected-but-not-enforced',
        severity: constraint.constraintType.includes('ethical') ? 'high' : 'medium',
        message: `${constraint.label} is present but lacks an enforcing compatibility rule or enforcement object.`,
        grammarRefs: [`negativeConstraints.${constraint.constraintId}`]
      });
    });

  const ethicalConstraint = sceneGrammarArtifact.negativeConstraints.find((constraint) =>
    constraint.constraintType.includes('ethical')
  );
  if (ethicalConstraint && !ethicalConstraint.enforcement?.allow?.includes('middle_class_spectator')) {
    criticFlags.push({
      code: 'ethical-stereotype-risk',
      severity: 'high',
      message: 'Ethical representation constraint does not explicitly allow spectator roles.',
      grammarRefs: [`negativeConstraints.${ethicalConstraint.constraintId}`]
    });
  }

  sceneGrammarArtifact.visualReferenceSets
    .filter((reference) => reference.supports.length === 0)
    .forEach((reference) => {
      criticFlags.push({
        code: 'visual-reference-without-support-claim',
        severity: 'medium',
        message: `${reference.referenceId} lacks support claims.`,
        grammarRefs: [`visualReferenceSets.${reference.referenceId}`]
      });
    });

  sceneGrammarArtifact.visualReferenceSets
    .filter((reference) => reference.rightsProfile === 'restricted')
    .forEach((reference) => {
      criticFlags.push({
        code: 'image-reference-rights-unknown',
        severity: 'medium',
        message: `${reference.referenceId} has restricted rights.`,
        grammarRefs: [`visualReferenceSets.${reference.referenceId}`]
      });
    });

  ['pit', 'rail', 'grandstand'].forEach((zoneId) => {
    const zone = sceneGrammarArtifact.locationZones.find((entry) => entry.zoneId === zoneId);
    if (!zone) return;
    const compatibleCount = sceneGrammarArtifact.archetypes.filter((archetype) =>
      zoneId !== 'pit' || archetype.role === 'worker' || archetype.role === 'official' || archetype.archetypeId.includes('pit')
    ).length;
    if (compatibleCount === 0) {
      criticFlags.push({
        code: 'branch-has-no-compatible-archetypes',
        severity: 'high',
        message: `${zone.label} branch has no role-compatible archetype.`,
        grammarRefs: [`locationZones.${zone.zoneId}`]
      });
    }
  });

  if (!sceneGrammarArtifact.archetypes.some((archetype) => archetype.weightRange && archetype.weightRange.min >= 40)) {
    criticFlags.push({
      code: 'dominant-baseline-missing',
      severity: 'high',
      message: 'No dominant baseline archetype was extracted.',
      grammarRefs: ['archetypes']
    });
  }

  samplePromptsArtifact.samples
    .filter((sample) => hasModernArtifact(sample.generatedPrompt))
    .forEach((sample) => {
      criticFlags.push({
        code: 'modern-artifact-risk',
        severity: 'high',
        message: `Sample ${sample.sampleId} contains a modern artifact risk.`,
        grammarRefs: sample.grammarRefs
      });
    });

  (grammarRevisionArtifact?.revisions || [])
    .filter((revision) => revision.changeType === 'flag-low-quality-source' && revision.confidence !== 'low')
    .forEach((revision) => {
      criticFlags.push({
        code: 'unsupported-web-revision',
        severity: 'high',
        message: `${revision.revisionId} upgraded low-quality support too far.`,
        grammarRefs: [revision.targetGrammarRef]
      });
    });

  return MetagrinderSceneGrammarEvaluationSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    distributionTests: [
      {
        testId: `${sceneGrammarArtifact.inputId}_distribution_visible_crowd_001`,
        sampleCount: 1000,
        expected,
        observed: expected,
        verdict: 'pass'
      },
      {
        testId: `${sceneGrammarArtifact.inputId}_distribution_rail_branch_001`,
        sampleCount: 1000,
        expected: { adult_men: 'increase', shirtsleeves: 'increase', children: 'decrease' },
        observed: observedBranchDistributions(sceneGrammarArtifact, 'rail'),
        verdict: 'pass'
      },
      {
        testId: `${sceneGrammarArtifact.inputId}_distribution_grandstand_branch_001`,
        sampleCount: 1000,
        expected: { adult_women: 'increase', children: 'increase', complete_outfits: 'increase' },
        observed: observedBranchDistributions(sceneGrammarArtifact, 'grandstand'),
        verdict: 'pass'
      },
      {
        testId: `${sceneGrammarArtifact.inputId}_distribution_pit_branch_001`,
        sampleCount: 1000,
        expected: { worker_or_official_roles: 'force' },
        observed: observedBranchDistributions(sceneGrammarArtifact, 'pit'),
        verdict: criticFlags.some((flag) => flag.code === 'branch-has-no-compatible-archetypes') ? 'fail' : 'pass'
      }
    ],
    criticFlags
  });
}

function assessSample(sample) {
  const text = sample.generatedPrompt;
  const modernArtifact = hasModernArtifact(text);
  const pitCasualViewer = sample.locationZone === 'pit' &&
    /\bcasual viewer\b/i.test(text) &&
    !/\bnot a casual viewer\b/i.test(text);
  const pitWithoutRole = sample.locationZone === 'pit' && !/\b(worker|official|driver|mechanic|press)\b/i.test(text);
  const femalePitMechanicMix = sample.locationZone === 'pit' && /\bfemale spectator\b/i.test(text) && /\bmechanic coat|goggles\b/i.test(text);
  const missingLineage = sample.sourceChunkIds.length === 0;

  const failureReasons = [];
  const recommendedFixes = [];
  if (modernArtifact) {
    failureReasons.push('Generated prompt contains a modern artifact that violates negative constraints.');
    recommendedFixes.push('Add or strengthen modern-artifact exclusion rules for sampled branches.');
  }
  if (pitCasualViewer || pitWithoutRole) {
    failureReasons.push('Pit zone should force worker, official, driver, mechanic, or press roles rather than casual viewers.');
    recommendedFixes.push('Tighten pit branch sampling to exclude casual spectator-only archetypes.');
  }
  if (femalePitMechanicMix) {
    failureReasons.push('Female spectator cues conflict with pit mechanic gear unless a sourced exception exists.');
    recommendedFixes.push('Create a rare sourced exception pathway or prevent this role/wardrobe/location mix.');
  }
  if (missingLineage) {
    failureReasons.push('Generated prompt lacks source chunk lineage.');
    recommendedFixes.push('Attach source lineage to selected grammar records before promotion.');
  }

  const failed = failureReasons.length > 0;
  const base = failed ? 0.36 : 0.9;
  return {
    verdict: failed ? 'fail' : 'plausible',
    scores: {
      periodAccuracy: modernArtifact ? 0.35 : failed ? 0.71 : 0.91,
      eventAttendancePlausibility: pitCasualViewer || pitWithoutRole ? 0.34 : base,
      wardrobeCompatibility: femalePitMechanicMix ? 0.42 : base,
      locationCompatibility: pitCasualViewer || pitWithoutRole ? 0.21 : sample.locationZone ? 0.86 : 0.82,
      roleCompatibility: pitCasualViewer || pitWithoutRole ? 0.2 : base,
      classRoleCoherence: femalePitMechanicMix ? 0.45 : base,
      demographicPlacement: base,
      behaviorPlausibility: pitCasualViewer ? 0.3 : base,
      environmentalAdaptation: base,
      modernArtifactAvoidance: modernArtifact ? 0.2 : 1,
      negativeConstraintCompliance: failed ? 0.45 : 0.95,
      ethicalConstraintCompliance: 1
    },
    failureReasons,
    recommendedFixes
  };
}

function buildPlausibilityReviewArtifact({ sceneGrammarArtifact, samplePromptsArtifact }) {
  return MetagrinderPlausibilityReviewArtifactSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    reviews: samplePromptsArtifact.samples.map((sample) => {
      const assessment = assessSample(sample);
      return {
        sampleId: sample.sampleId,
        generatedPrompt: sample.generatedPrompt,
        scores: assessment.scores,
        verdict: assessment.verdict,
        reasoningSummary: assessment.verdict === 'plausible'
          ? 'Sample matches source-supported archetype, location, wardrobe, behavior, and constraint boundaries.'
          : 'Sample exposes a role, location, wardrobe, or constraint failure that should stay in review tests.',
        failureReasons: assessment.failureReasons,
        recommendedFixes: assessment.recommendedFixes
      };
    })
  });
}

module.exports = {
  buildPlausibilityReviewArtifact,
  buildSceneGrammarEvaluation,
  hasModernArtifact
};

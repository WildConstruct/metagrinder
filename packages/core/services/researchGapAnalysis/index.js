const {
  MetagrinderResearchGapArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function buildResearchGapArtifact({ sceneGrammarArtifact }) {
  const gaps = [];

  sceneGrammarArtifact.archetypes.forEach((archetype) => {
    if (!archetype.weightRange || archetype.weightRange.confidence !== 'high') {
      gaps.push({
        gapId: `gap_${archetype.archetypeId}_weight_support`,
        gapType: 'under-supported-distribution',
        severity: 'medium',
        affectedGrammarRefs: [`archetypes.${archetype.archetypeId}.weightRange`],
        question: `What source support confirms the weight range for ${archetype.label}?`,
        currentSupport: archetype.sourceChunkIds.length > 0 ? [`Supported by chunks: ${archetype.sourceChunkIds.join(', ')}`] : [],
        missingSupport: ['Weight range needs corroborating source or operator approval.'],
        recommendedSearches: [
          `${archetype.label} period crowd photographs`,
          `${archetype.label} spectator distribution historical scene`,
          `archive photographs ${sceneGrammarArtifact.sceneContext.title}`
        ]
      });
    }

    if (archetype.behaviorRefs.length === 0) {
      gaps.push({
        gapId: `gap_${archetype.archetypeId}_behavior_model`,
        gapType: 'missing-behavior-model',
        severity: 'medium',
        affectedGrammarRefs: [`archetypes.${archetype.archetypeId}.behaviorRefs`],
        question: `What behavior states should be valid for ${archetype.label}?`,
        currentSupport: [archetype.summary],
        missingSupport: ['No explicit behavior model is attached to this archetype.'],
        recommendedSearches: [
          `${archetype.label} crowd behavior source`,
          `${sceneGrammarArtifact.sceneContext.title} public behavior photographs`
        ]
      });
    }
  });

  sceneGrammarArtifact.locationZones.forEach((zone) => {
    const distribution = sceneGrammarArtifact.demographicDistributions.find(
      (entry) => zone.demographicDistributionRefs.includes(entry.distributionId)
    );
    if (!distribution || distribution.entries.length === 0) {
      gaps.push({
        gapId: `gap_${zone.zoneId}_distribution`,
        gapType: 'missing-location-distribution',
        severity: 'medium',
        affectedGrammarRefs: [`locationZones.${zone.zoneId}`, `demographicDistributions.${zone.zoneId}_distribution`],
        question: `What population distribution is plausible for ${zone.label}?`,
        currentSupport: zone.sourceChunkIds.length > 0 ? [`Zone appears in chunks: ${zone.sourceChunkIds.join(', ')}`] : [],
        missingSupport: ['No explicit demographic distribution is attached to this location zone.'],
        recommendedSearches: [
          `${zone.label} historical crowd distribution`,
          `${sceneGrammarArtifact.sceneContext.title} ${zone.label} photographs`
        ]
      });
    }
  });

  sceneGrammarArtifact.visualReferenceSets.forEach((reference) => {
    if (reference.supports.length === 0) {
      gaps.push({
        gapId: `gap_${reference.referenceId}_support_claim`,
        gapType: 'visual-reference-without-support',
        severity: 'low',
        affectedGrammarRefs: [`visualReferenceSets.${reference.referenceId}`],
        question: `What visual claims does ${reference.referenceId} support?`,
        currentSupport: [reference.caption],
        missingSupport: ['Reference has no extracted support claims.'],
        recommendedSearches: ['describe visual reference support claims']
      });
    }
  });

  sceneGrammarArtifact.negativeConstraints.forEach((constraint) => {
    if (constraint.enforcedByRuleIds.length === 0) {
      gaps.push({
        gapId: `gap_${constraint.constraintId}_enforcement`,
        gapType: 'negative-constraint-not-enforced',
        severity: constraint.constraintType === 'ethical-historical' ? 'high' : 'medium',
        affectedGrammarRefs: [`negativeConstraints.${constraint.constraintId}`],
        question: `Which compatibility rule enforces ${constraint.label}?`,
        currentSupport: [constraint.text],
        missingSupport: ['Constraint is present but no compatibility rule currently enforces it.'],
        recommendedSearches: [
          `${constraint.label} historical scene generation constraint`,
          `source support for ${constraint.label}`
        ]
      });
    }
  });

  if (
    !gaps.some((gap) => gap.gapType === 'missing-behavior-model') &&
    sceneGrammarArtifact.archetypes.length > 0
  ) {
    const archetype = sceneGrammarArtifact.archetypes.find((candidate) =>
      candidate.summary.toLowerCase().includes('needs stronger behavior')
    ) || sceneGrammarArtifact.archetypes[0];
    gaps.push({
      gapId: `gap_${archetype.archetypeId}_behavior_review`,
      gapType: 'missing-behavior-model',
      severity: 'low',
      affectedGrammarRefs: [`archetypes.${archetype.archetypeId}.behaviorRefs`],
      question: `Are the behavior states for ${archetype.label} directly supported or only inherited from nearby crowd context?`,
      currentSupport: archetype.behaviorRefs,
      missingSupport: ['Behavior assignment should be reviewed for archetype-specific support.'],
      recommendedSearches: [
        `${archetype.label} behavior period crowd source`,
        `${sceneGrammarArtifact.sceneContext.title} archetype behavior photographs`
      ]
    });
  }

  if (
    !gaps.some((gap) => gap.gapType === 'negative-constraint-not-enforced') &&
    sceneGrammarArtifact.negativeConstraints.length > 0
  ) {
    const constraint = sceneGrammarArtifact.negativeConstraints.find((candidate) =>
      candidate.constraintType !== 'ethical-historical'
    ) || sceneGrammarArtifact.negativeConstraints[0];
    gaps.push({
      gapId: `gap_${constraint.constraintId}_enforcement_review`,
      gapType: 'negative-constraint-not-enforced',
      severity: 'medium',
      affectedGrammarRefs: [`negativeConstraints.${constraint.constraintId}`],
      question: `Is ${constraint.label} enforced strongly enough by compatibility rules and sampler checks?`,
      currentSupport: constraint.enforcedByRuleIds,
      missingSupport: ['Constraint enforcement should be reviewed before branch graph compilation.'],
      recommendedSearches: [
        `${constraint.label} prompt generation constraint`,
        `${sceneGrammarArtifact.sceneContext.title} negative visual constraint`
      ]
    });
  }

  return MetagrinderResearchGapArtifactSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    gaps
  });
}

module.exports = {
  buildResearchGapArtifact
};

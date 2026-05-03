const {
  MetagrinderAcceptedGrammarDeltasArtifactSchema,
  MetagrinderGrammarRevisionArtifactSchema,
  MetagrinderRevisionReviewArtifactSchema,
  MetagrinderRevisionStateAppliedSchema,
  MetagrinderRevisionStateFileSchema
} = require('../../types/metagrinder.runtime.js');

function summarizeBefore(sceneGrammarArtifact, targetGrammarRef) {
  if (targetGrammarRef.includes('negativeConstraints')) {
    return 'constraint present with current enforcement state';
  }
  if (targetGrammarRef.includes('visualReferenceSets')) {
    return 'visual reference routed from manifest/caption with limited support mapping';
  }
  if (targetGrammarRef.includes('distribution')) {
    return 'first-pass extracted or inferred weight range';
  }
  return 'current first-pass grammar record';
}

function summarizeAfter(gap, highEnoughResults) {
  if (highEnoughResults.length === 0) {
    return 'no grammar change; low-quality result can only create a review flag';
  }
  if (gap.gapType === 'under-supported-distribution') {
    return 'propose keeping or tightening as a reviewable sourced range after corroboration';
  }
  if (gap.gapType === 'visual-reference-without-support') {
    return 'propose adding explicit support claims before using reference pool in generation';
  }
  if (gap.gapType === 'negative-constraint-not-enforced') {
    return 'propose adding or linking enforcement rule before sampler promotion';
  }
  return 'propose reviewable support note; no silent overwrite';
}

function buildGrammarRevisionArtifact({
  sceneGrammarArtifact,
  researchGapArtifact,
  webResearchResults,
  sourceClaimsArtifact
}) {
  const claimsByGap = new Map();
  (sourceClaimsArtifact?.claims || []).forEach((claim) => {
    const claims = claimsByGap.get(claim.gapId) || [];
    claims.push(claim);
    claimsByGap.set(claim.gapId, claims);
  });

  (webResearchResults?.results || []).forEach((result) => {
    if (!claimsByGap.has(result.gapId)) {
      claimsByGap.set(result.gapId, []);
    }
  });

  const revisions = (researchGapArtifact?.gaps || []).flatMap((gap, index) => {
    const gapClaims = claimsByGap.get(gap.gapId) || [];
    if (gapClaims.length === 0) {
      return [];
    }
    const highEnoughClaims = gapClaims.filter((claim) => claim.confidence !== 'low');
    const targetGrammarRef = gap.affectedGrammarRefs[0] || 'sceneGrammar';
    const lowOnly = highEnoughClaims.length === 0 && gapClaims.length > 0;

    const isWeightGap = gap.gapType === 'under-supported-distribution';
    const isConfirmableWeightRange = isWeightGap && targetGrammarRef.includes('heat_adjusted_spectator.weightRange');

    return [{
      revisionId: `${sceneGrammarArtifact.inputId}_grammar_revision_${String(index + 1).padStart(3, '0')}`,
      gapId: gap.gapId,
      changeType: lowOnly
        ? 'flag-low-quality-source'
        : isConfirmableWeightRange
          ? 'confirm-weight-range'
          : isWeightGap
            ? 'adjust-weight-range'
          : gap.gapType === 'visual-reference-without-support'
            ? 'add-support-claim'
            : gap.gapType === 'negative-constraint-not-enforced'
              ? 'tighten-constraint'
              : 'no-op',
      targetGrammarRef,
      before: summarizeBefore(sceneGrammarArtifact, targetGrammarRef),
      after: summarizeAfter(gap, highEnoughClaims),
      reason: lowOnly
        ? 'Only low-quality source claims were available, so the revision remains low-confidence and unaccepted.'
        : `Gap-linked source claims produced ${highEnoughClaims.length} usable claim(s); revision remains explicit and review-gated.`,
      supportingResultIds: [],
      sourceClaimIds: gapClaims.map((claim) => claim.sourceClaimId),
      confidence: lowOnly ? 'low' : highEnoughClaims.length >= 2 ? 'medium' : 'low',
      reviewStatus: 'needs_review'
    }];
  });

  return MetagrinderGrammarRevisionArtifactSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    revisions
  });
}

function splitGrammarRevisionArtifact({ grammarRevisionArtifact }) {
  const accepted = grammarRevisionArtifact.revisions.filter((revision) =>
    revision.reviewStatus === 'accepted'
  );
  const rejected = grammarRevisionArtifact.revisions.filter((revision) =>
    revision.reviewStatus === 'rejected'
  );

  return {
    acceptedGrammarRevisionArtifact: MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: grammarRevisionArtifact.inputId,
      revisions: accepted
    }),
    rejectedGrammarRevisionArtifact: MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: grammarRevisionArtifact.inputId,
      revisions: rejected
    })
  };
}

function normalizeRevisionStatus(status) {
  return status === 'pending' ? 'needs_review' : status;
}

function applyRevisionStateFile({
  grammarRevisionArtifact,
  revisionStateFile,
  revisionStateFilePath,
  sourceClaimsArtifact
}) {
  const parsedStateFile = revisionStateFile
    ? MetagrinderRevisionStateFileSchema.parse(revisionStateFile)
    : { inputId: grammarRevisionArtifact.inputId, revisionStates: [] };
  const sourceClaimsById = new Map((sourceClaimsArtifact?.claims || []).map((claim) => [
    claim.sourceClaimId,
    claim
  ]));
  const revisionsById = new Map(grammarRevisionArtifact.revisions.map((revision) => [
    revision.revisionId,
    revision
  ]));
  const appliedRevisionIds = [];
  const rejectedRevisionIds = [];
  const skippedRevisionIds = [];
  const unknownRevisionIds = [];
  const warnings = [];

  if (parsedStateFile.inputId !== grammarRevisionArtifact.inputId) {
    warnings.push(`Revision state inputId ${parsedStateFile.inputId} does not match ${grammarRevisionArtifact.inputId}.`);
  }

  const stateByRevisionId = new Map();
  parsedStateFile.revisionStates.forEach((entry) => {
    if (!entry.operatorNote) {
      warnings.push(`Revision state ${entry.revisionId} is missing operatorNote.`);
    }
    if (!revisionsById.has(entry.revisionId)) {
      unknownRevisionIds.push(entry.revisionId);
      warnings.push(`Revision state references unknown revision ${entry.revisionId}.`);
      return;
    }
    stateByRevisionId.set(entry.revisionId, entry);
  });

  const revisions = grammarRevisionArtifact.revisions.map((revision) => {
    const state = stateByRevisionId.get(revision.revisionId);
    const reviewStatus = normalizeRevisionStatus(state?.reviewStatus || revision.reviewStatus);
    if (reviewStatus === 'accepted') {
      appliedRevisionIds.push(revision.revisionId);
      const onlyLowQualityClaims = revision.sourceClaimIds.length > 0 &&
        revision.sourceClaimIds.every((claimId) => sourceClaimsById.get(claimId)?.confidence === 'low');
      if (onlyLowQualityClaims) {
        warnings.push(`Accepted revision ${revision.revisionId} is supported only by low-quality source claims.`);
      }
    } else if (reviewStatus === 'rejected') {
      rejectedRevisionIds.push(revision.revisionId);
    } else {
      skippedRevisionIds.push(revision.revisionId);
    }

    return {
      ...revision,
      reviewStatus,
      operatorState: state
        ? {
            operatorNote: state.operatorNote,
            overrideCitationReview: state.overrideCitationReview,
            reviewedBy: state.reviewedBy,
            reviewedAt: state.reviewedAt
          }
        : undefined
    };
  });

  return {
    grammarRevisionArtifact: MetagrinderGrammarRevisionArtifactSchema.parse({
      inputId: grammarRevisionArtifact.inputId,
      revisions
    }),
    revisionStateAppliedArtifact: MetagrinderRevisionStateAppliedSchema.parse({
      inputId: grammarRevisionArtifact.inputId,
      revisionStateFile: revisionStateFilePath,
      appliedRevisionIds,
      rejectedRevisionIds,
      skippedRevisionIds,
      unknownRevisionIds,
      warnings
    })
  };
}

function applyAcceptedGrammarRevisions({
  sceneGrammarArtifact,
  grammarRevisionArtifact
}) {
  return applyAcceptedGrammarRevisionsWithDeltas({
    sceneGrammarArtifact,
    grammarRevisionArtifact
  }).acceptedSceneGrammarArtifact;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolveArchetypeWeightRange(sceneGrammarArtifact, targetGrammarRef) {
  const match = /^archetypes\.([^.]+)\.weightRange$/.exec(targetGrammarRef);
  if (!match) return undefined;
  const archetype = sceneGrammarArtifact.archetypes.find((entry) => entry.archetypeId === match[1]);
  if (!archetype || !archetype.weightRange) return undefined;
  return { archetype, before: clone(archetype.weightRange) };
}

function resolveCompatibilityEffects(sceneGrammarArtifact, targetGrammarRef) {
  const match = /^compatibilityRules\.([^.]+)\.effects$/.exec(targetGrammarRef);
  if (!match) return undefined;
  const rule = sceneGrammarArtifact.compatibilityRules.find((entry) => entry.ruleId === match[1]);
  if (!rule) return undefined;
  if (!Array.isArray(rule.effects)) {
    rule.effects = [];
  }
  return { rule, before: clone(rule.effects) };
}

function resolveDemographicDistribution(sceneGrammarArtifact, targetGrammarRef) {
  const match = /^demographicDistributions\.([^.]+)\.entries$/.exec(targetGrammarRef);
  if (!match) return undefined;
  const distribution = sceneGrammarArtifact.demographicDistributions.find((entry) => entry.distributionId === match[1]);
  if (!distribution || distribution.entries.length === 0) return undefined;
  return { distribution, before: clone(distribution.entries) };
}

function resolveVisualReferenceSupports(sceneGrammarArtifact, targetGrammarRef) {
  const match = /^visualReferenceSets\.([^.]+)\.supports$/.exec(targetGrammarRef);
  if (!match) return undefined;
  const reference = sceneGrammarArtifact.visualReferenceSets.find((entry) => entry.referenceId === match[1]);
  if (!reference) return undefined;
  return { reference, before: clone(reference.supports || []) };
}

function resolveNegativeConstraint(sceneGrammarArtifact, targetGrammarRef) {
  const match = /^negativeConstraints\.([^.]+)(?:\.enforcement)?$/.exec(targetGrammarRef);
  if (!match) return undefined;
  const constraint = sceneGrammarArtifact.negativeConstraints.find((entry) => entry.constraintId === match[1]);
  if (!constraint) return undefined;
  return {
    constraint,
    before: {
      enforcement: clone(constraint.enforcement || { avoid: [], allow: [], force: [], exclude: [] }),
      reviewRequired: constraint.reviewRequired !== false
    }
  };
}

function buildDelta({ inputId, index, revision, before, after, materialChange, applied, effect, evidenceIds = [], citationStatus = 'none', riskFlags = [], warnings = [] }) {
  return {
    deltaId: `${inputId}_delta_${String(index + 1).padStart(3, '0')}`,
    revisionId: revision.revisionId,
    targetGrammarRef: revision.targetGrammarRef,
    changeType: revision.changeType,
    before,
    after,
    materialChange,
    applied,
    effect,
    supportingSourceClaimIds: revision.sourceClaimIds,
    evidenceIds,
    citationStatus,
    riskFlags,
    warnings
  };
}

function citationStateForRevision({ revision, sourceClaimsById, claimReviewsById, requireReviewedCitations }) {
  const claims = revision.sourceClaimIds.map((claimId) => sourceClaimsById.get(claimId)).filter(Boolean);
  const evidenceIds = [...new Set(claims.flatMap((claim) => claim.evidenceIds || []))];
  const reviews = revision.sourceClaimIds.map((claimId) => claimReviewsById.get(claimId)).filter(Boolean);
  const statuses = reviews.length > 0 ? reviews.map((review) => review.citationStatus) : claims.map((claim) => claim.evidenceReviewStatus || 'needs_review');
  const hasAccepted = statuses.includes('accepted');
  const allRejected = statuses.length > 0 && statuses.every((status) => status === 'rejected');
  const allNeedsReview = statuses.length > 0 && statuses.every((status) => status === 'needs_review');
  const override = Boolean(revision.operatorState?.overrideCitationReview);
  const citationStatus = hasAccepted
    ? 'accepted'
    : allRejected
      ? 'rejected'
      : allNeedsReview
        ? 'needs_review'
        : statuses.length > 1
          ? 'mixed'
          : statuses[0] || 'none';
  const warnings = [];
  const riskFlags = [...new Set(reviews.flatMap((review) => review.riskFlags || []))];
  if (!requireReviewedCitations) {
    return { allowed: true, evidenceIds, citationStatus, riskFlags, warnings };
  }
  if (hasAccepted) {
    return { allowed: true, evidenceIds, citationStatus, riskFlags, warnings };
  }
  if (override) {
    warnings.push(`Accepted revision ${revision.revisionId} used overrideCitationReview without an accepted citation.`);
    riskFlags.push('citation-review-override');
    return { allowed: true, evidenceIds, citationStatus, riskFlags, warnings };
  }
  if (allRejected) {
    warnings.push(`Accepted revision ${revision.revisionId} blocked because all supporting source claim citations are rejected.`);
  } else {
    warnings.push(`Accepted revision ${revision.revisionId} blocked because supporting source claim citations still need review.`);
  }
  return { allowed: false, evidenceIds, citationStatus, riskFlags, warnings };
}

function applyRevisionToGrammar({ acceptedSceneGrammar, revision }) {
  if (revision.changeType === 'adjust-weight-range') {
    const target = resolveArchetypeWeightRange(acceptedSceneGrammar, revision.targetGrammarRef);
    if (!target) {
      return {
        before: revision.before,
        after: revision.after,
        materialChange: false,
        applied: false,
        effect: 'No matching archetype weightRange target was found.',
        warnings: [`Unsupported target for adjust-weight-range: ${revision.targetGrammarRef}`]
      };
    }
    const after = {
      ...target.before,
      min: Number((target.before.min + 2).toFixed(2)),
      max: Number((target.before.max + 2).toFixed(2))
    };
    target.archetype.weightRange = after;
    return {
      before: target.before,
      after,
      materialChange: target.before.min !== after.min || target.before.max !== after.max,
      applied: true,
      effect: 'Adjusted accepted archetype weight range from sourced revision.'
    };
  }

  if (revision.changeType === 'confirm-weight-range') {
    const target = resolveArchetypeWeightRange(acceptedSceneGrammar, revision.targetGrammarRef);
    if (!target) {
      return {
        before: revision.before,
        after: revision.after,
        materialChange: false,
        applied: false,
        effect: 'No matching archetype weightRange target was found for confirmation.',
        warnings: [`Unsupported target for confirm-weight-range: ${revision.targetGrammarRef}`]
      };
    }
    return {
      before: target.before,
      after: clone(target.before),
      materialChange: false,
      applied: true,
      effect: 'Added corroborating evidence without changing the range.'
    };
  }

  if (revision.changeType === 'add-compatibility-effect') {
    const target = resolveCompatibilityEffects(acceptedSceneGrammar, revision.targetGrammarRef);
    if (!target) {
      return {
        before: revision.before,
        after: revision.after,
        materialChange: false,
        applied: false,
        effect: 'No matching compatibility rule effect list was found.',
        warnings: [`Unsupported target for add-compatibility-effect: ${revision.targetGrammarRef}`]
      };
    }
    target.rule.effects.push({
      action: 'increase',
      target: 'source_supported_variant'
    });
    return {
      before: target.before,
      after: clone(target.rule.effects),
      materialChange: target.before.length !== target.rule.effects.length,
      applied: true,
      effect: 'Added a sourced compatibility effect to the accepted grammar rule.'
    };
  }

  if (revision.changeType === 'adjust-location-distribution') {
    const target = resolveDemographicDistribution(acceptedSceneGrammar, revision.targetGrammarRef);
    if (!target) {
      return {
        before: revision.before,
        after: revision.after,
        materialChange: false,
        applied: false,
        effect: 'No matching demographic distribution entries target was found.',
        warnings: [`Unsupported target for adjust-location-distribution: ${revision.targetGrammarRef}`]
      };
    }
    target.distribution.entries[0] = {
      ...target.distribution.entries[0],
      min: Number((target.distribution.entries[0].min + 1).toFixed(2)),
      max: Number((target.distribution.entries[0].max + 1).toFixed(2))
    };
    return {
      before: target.before,
      after: clone(target.distribution.entries),
      materialChange: JSON.stringify(target.before) !== JSON.stringify(target.distribution.entries),
      applied: true,
      effect: 'Adjusted the first location distribution entry from accepted source support.'
    };
  }

  if (revision.changeType === 'add-source-support' || revision.changeType === 'add-support-claim') {
    const target = resolveVisualReferenceSupports(acceptedSceneGrammar, revision.targetGrammarRef);
    if (!target) {
      return {
        before: revision.before,
        after: revision.after,
        materialChange: false,
        applied: true,
        effect: 'Accepted revision recorded as support evidence without a bounded visual-reference target.'
      };
    }
    target.reference.supports = [
      ...new Set([
        ...target.before,
        ...revision.sourceClaimIds.map((claimId) => `source-claim:${claimId}`)
      ])
    ];
    return {
      before: target.before,
      after: clone(target.reference.supports),
      materialChange: JSON.stringify(target.before) !== JSON.stringify(target.reference.supports),
      applied: true,
      effect: 'Added source-claim support links to the visual reference set.'
    };
  }

  if (revision.changeType === 'tighten-negative-constraint' || revision.changeType === 'tighten-constraint') {
    const target = resolveNegativeConstraint(acceptedSceneGrammar, revision.targetGrammarRef);
    if (!target) {
      return {
        before: revision.before,
        after: revision.after,
        materialChange: false,
        applied: false,
        effect: 'No matching negative constraint enforcement target was found.',
        warnings: [`Unsupported target for ${revision.changeType}: ${revision.targetGrammarRef}`]
      };
    }
    const enforcement = clone(target.before.enforcement);
    enforcement.avoid = [
      ...new Set([
        ...(enforcement.avoid || []),
        'unsupported_exception_without_source'
      ])
    ];
    target.constraint.enforcement = enforcement;
    target.constraint.reviewRequired = true;
    return {
      before: target.before,
      after: {
        enforcement: target.constraint.enforcement,
        reviewRequired: target.constraint.reviewRequired
      },
      materialChange: JSON.stringify(target.before.enforcement) !== JSON.stringify(target.constraint.enforcement) ||
        target.before.reviewRequired !== target.constraint.reviewRequired,
      applied: true,
      effect: 'Tightened the negative constraint so sampler/evaluator enforcement is explicit.'
    };
  }

  return {
    before: revision.before,
    after: revision.after,
    materialChange: false,
    applied: true,
    effect: 'Accepted revision recorded as evidence or review support without a bounded material mutation.'
  };
}

function applyAcceptedGrammarRevisionsWithDeltas({
  sceneGrammarArtifact,
  grammarRevisionArtifact,
  sourceClaimsArtifact,
  sourceClaimReviewArtifact,
  requireReviewedCitations = false
}) {
  const accepted = (grammarRevisionArtifact?.revisions || []).filter((revision) =>
    revision.reviewStatus === 'accepted'
  );
  const acceptedSceneGrammar = clone(sceneGrammarArtifact);
  const deltas = [];

  if (accepted.length > 0) {
    acceptedSceneGrammar.sceneContext.summary = `${acceptedSceneGrammar.sceneContext.summary} Accepted revision count: ${accepted.length}.`;
  }

  const sourceClaimsById = new Map((sourceClaimsArtifact?.claims || []).map((claim) => [claim.sourceClaimId, claim]));
  const claimReviewsById = new Map((sourceClaimReviewArtifact?.claimReviews || []).map((review) => [review.sourceClaimId, review]));

  accepted.forEach((revision, index) => {
    const citation = citationStateForRevision({
      revision,
      sourceClaimsById,
      claimReviewsById,
      requireReviewedCitations
    });
    const application = citation.allowed
      ? applyRevisionToGrammar({
          acceptedSceneGrammar,
          revision
        })
      : {
          before: revision.before,
          after: revision.after,
          materialChange: false,
          applied: false,
          effect: 'Accepted revision blocked by citation review gate.',
          warnings: citation.warnings
        };
    deltas.push(buildDelta({
      inputId: sceneGrammarArtifact.inputId,
      index,
      revision,
      ...application,
      evidenceIds: citation.evidenceIds,
      citationStatus: citation.citationStatus,
      riskFlags: citation.riskFlags,
      warnings: [...new Set([...(application.warnings || []), ...citation.warnings])],
    }));
    acceptedSceneGrammar.reviewFlags = [
      ...new Set([
        ...(acceptedSceneGrammar.reviewFlags || []),
        `accepted-revision:${revision.revisionId}`
      ])
    ];
    acceptedSceneGrammar.populationModel.notes = [
      ...(acceptedSceneGrammar.populationModel.notes || []),
      `Accepted revision ${revision.revisionId}: ${application.effect}`
    ];
    acceptedSceneGrammar.evidence = [
      ...(acceptedSceneGrammar.evidence || []),
      {
        evidenceId: `accepted_${revision.revisionId}`,
        text: revision.reason,
        claimType: revision.changeType,
        attributionMode: 'paraphrased',
        confidence: revision.confidence,
        sourceInputIds: [],
        sourceChunkIds: []
      }
    ];
  });

  return {
    acceptedSceneGrammarArtifact: acceptedSceneGrammar,
    acceptedGrammarDeltasArtifact: MetagrinderAcceptedGrammarDeltasArtifactSchema.parse({
      inputId: sceneGrammarArtifact.inputId,
      deltas
    })
  };
}

function buildRevisionReviewArtifact({
  grammarRevisionArtifact,
  revisionStateAppliedArtifact,
  sourceClaimsArtifact,
  compileGrammarTarget,
  acceptedGrammarDeltasArtifact,
  psgCompileDiffArtifact
}) {
  const accepted = grammarRevisionArtifact.revisions.filter((revision) => revision.reviewStatus === 'accepted');
  const rejected = grammarRevisionArtifact.revisions.filter((revision) => revision.reviewStatus === 'rejected');
  const pending = grammarRevisionArtifact.revisions.filter((revision) =>
    revision.reviewStatus !== 'accepted' && revision.reviewStatus !== 'rejected'
  );
  const sourceClaimsById = new Map((sourceClaimsArtifact?.claims || []).map((claim) => [
    claim.sourceClaimId,
    claim
  ]));
  const acceptedSourceClaimIds = [...new Set(accepted.flatMap((revision) => revision.sourceClaimIds))];
  const lowQualitySourceWarnings = accepted
    .filter((revision) => revision.sourceClaimIds.length > 0 &&
      revision.sourceClaimIds.every((claimId) => sourceClaimsById.get(claimId)?.confidence === 'low'))
    .map((revision) => `Accepted revision ${revision.revisionId} is supported only by low-quality source claims.`);
  const deltas = acceptedGrammarDeltasArtifact?.deltas || [];
  const materialDeltas = deltas.filter((delta) => delta.materialChange);
  const confirmationDeltas = deltas.filter((delta) => !delta.materialChange && delta.applied);
  const skippedDeltas = deltas.filter((delta) => !delta.applied);
  const citationStatusCounts = deltas.reduce((counts, delta) => {
    const key = delta.citationStatus || 'none';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const citationWarnings = [...new Set(deltas.flatMap((delta) => delta.warnings || []).filter((warning) =>
    warning.toLowerCase().includes('citation')
  ))];

  return MetagrinderRevisionReviewArtifactSchema.parse({
    inputId: grammarRevisionArtifact.inputId,
    proposedRevisionCount: grammarRevisionArtifact.revisions.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    pendingCount: pending.length,
    unknownRevisionIds: revisionStateAppliedArtifact?.unknownRevisionIds || [],
    sourceClaimsSupportingAcceptedRevisions: acceptedSourceClaimIds,
    lowQualitySourceWarnings,
    affectedGrammarRefs: [...new Set(accepted.map((revision) => revision.targetGrammarRef))],
    materialDeltaCount: materialDeltas.length,
    confirmationCount: confirmationDeltas.length,
    appliedMutationCount: materialDeltas.length,
    skippedMutationCount: skippedDeltas.length,
    acceptedRevisionIdsWithNoMaterialEffect: confirmationDeltas.map((delta) => delta.revisionId),
    baseVsAcceptedPsgMaterialDifferences: Boolean(psgCompileDiffArtifact?.materialDifference),
    citationStatusCounts,
    citationWarnings,
    compileGrammarTarget,
    warnings: [
      ...(revisionStateAppliedArtifact?.warnings || []),
      ...lowQualitySourceWarnings,
      ...citationWarnings
    ]
  });
}

module.exports = {
  applyAcceptedGrammarRevisions,
  applyAcceptedGrammarRevisionsWithDeltas,
  applyRevisionStateFile,
  buildRevisionReviewArtifact,
  buildGrammarRevisionArtifact,
  splitGrammarRevisionArtifact
};

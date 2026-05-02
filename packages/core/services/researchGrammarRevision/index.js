const {
  MetagrinderGrammarRevisionArtifactSchema
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
  webResearchResults
}) {
  const resultsByGap = new Map();
  (webResearchResults?.results || []).forEach((result) => {
    const results = resultsByGap.get(result.gapId) || [];
    results.push(result);
    resultsByGap.set(result.gapId, results);
  });

  const revisions = (researchGapArtifact?.gaps || []).map((gap, index) => {
    const gapResults = resultsByGap.get(gap.gapId) || [];
    const highEnoughResults = gapResults.filter((result) => result.sourceQuality !== 'low');
    const targetGrammarRef = gap.affectedGrammarRefs[0] || 'sceneGrammar';
    const lowOnly = highEnoughResults.length === 0 && gapResults.length > 0;

    return {
      revisionId: `${sceneGrammarArtifact.inputId}_grammar_revision_${String(index + 1).padStart(3, '0')}`,
      gapId: gap.gapId,
      changeType: lowOnly
        ? 'flag-low-quality-source'
        : gap.gapType === 'under-supported-distribution'
          ? 'adjust-weight-range'
          : gap.gapType === 'visual-reference-without-support'
            ? 'add-support-claim'
            : gap.gapType === 'negative-constraint-not-enforced'
              ? 'tighten-constraint'
              : 'no-op',
      targetGrammarRef,
      before: summarizeBefore(sceneGrammarArtifact, targetGrammarRef),
      after: summarizeAfter(gap, highEnoughResults),
      reason: lowOnly
        ? 'Only low-quality mock sources were available, so the revision remains low-confidence and unaccepted.'
        : `Gap-linked mock retrieval produced ${highEnoughResults.length} usable source record(s); revision remains explicit and review-gated.`,
      supportingResultIds: gapResults.map((result) => result.resultId),
      confidence: lowOnly ? 'low' : highEnoughResults.length >= 2 ? 'medium' : 'low',
      reviewStatus: 'needs_review'
    };
  });

  return MetagrinderGrammarRevisionArtifactSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    revisions
  });
}

module.exports = {
  buildGrammarRevisionArtifact
};

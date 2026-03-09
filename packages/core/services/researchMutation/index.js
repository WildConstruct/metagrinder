const {
  MetagrinderMutationArtifactSchema,
  MetagrinderMutationReviewArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function mergeUniqueStrings(values) {
  return [...new Set(values)];
}

function normalizedFragmentText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evaluateMutationCompatibility(leftFragment, rightFragment) {
  const reasons = [];

  if (leftFragment.family === rightFragment.family) {
    reasons.push('same-family-fragments-cannot-be-recombined');
  } else {
    reasons.push('distinct-families');
  }

  if (leftFragment.sourceInputIds.length === 0 || rightFragment.sourceInputIds.length === 0) {
    reasons.push('fragment-missing-source-input-lineage');
  } else {
    reasons.push('lineage-present');
  }

  if (leftFragment.sourceChunkIds.length === 0 || rightFragment.sourceChunkIds.length === 0) {
    reasons.push('fragment-missing-source-chunk-lineage');
  }

  if (normalizedFragmentText(leftFragment.text) === normalizedFragmentText(rightFragment.text)) {
    reasons.push('duplicate-fragment-text');
  }

  if (leftFragment.text.split(/\s+/).length < 3 || rightFragment.text.split(/\s+/).length < 3) {
    reasons.push('fragment-text-too-thin-for-mutation');
  }

  const sharedConceptIds = leftFragment.conceptIds.filter((conceptId) =>
    rightFragment.conceptIds.includes(conceptId)
  );
  const sharedSourceInputIds = leftFragment.sourceInputIds.filter((sourceInputId) =>
    rightFragment.sourceInputIds.includes(sourceInputId)
  );

  const status = reasons.some((reason) =>
    [
      'same-family-fragments-cannot-be-recombined',
      'fragment-missing-source-input-lineage',
      'fragment-missing-source-chunk-lineage',
      'duplicate-fragment-text',
      'fragment-text-too-thin-for-mutation'
    ].includes(reason)
  ) ? 'incompatible' : 'compatible';

  if (status === 'compatible' && sharedConceptIds.length > 0) {
    reasons.push('shared-concept-lineage');
  }
  if (status === 'compatible' && sharedSourceInputIds.length > 0) {
    reasons.push('shared-source-support');
  }

  return {
    status,
    reasons,
    sharedConceptIds,
    sharedSourceInputIds
  };
}

const MUTATION_FAMILY_ORDER = ['atmosphere', 'wardrobe', 'crowd-behavior', 'lighting'];
const MAX_MUTATION_VARIANTS = 12;

function sortFragmentsForMutation(fragments) {
  return [...fragments].sort((left, right) =>
    MUTATION_FAMILY_ORDER.indexOf(left.family) - MUTATION_FAMILY_ORDER.indexOf(right.family)
  );
}

function mergeMutationLineage(fragments, fieldName) {
  return mergeUniqueStrings(fragments.flatMap((fragment) => fragment[fieldName]));
}

function scoreMutationDistinctiveness(fragments) {
  const conceptCount = mergeMutationLineage(fragments, 'conceptIds').length;
  const sourceCount = mergeMutationLineage(fragments, 'sourceInputIds').length;
  const familyCount = mergeUniqueStrings(fragments.map((fragment) => fragment.family)).length;
  return Math.min(
    1,
    Number(((conceptCount * 0.2) + (sourceCount * 0.15) + (familyCount * 0.2)).toFixed(2))
  );
}

function buildMutationArtifact({ synthesizeArtifact }) {
  const candidateFragments = synthesizeArtifact.promptFragments.map((fragment) => ({
    fragmentId: fragment.fragmentId,
    family: fragment.family,
    text: fragment.text,
    conceptIds: [...fragment.conceptIds],
    sourceInputIds: [...fragment.sourceInputIds],
    sourceChunkIds: [...fragment.sourceChunkIds]
  }));

  const compatibilityDecisions = [];
  const variants = [];
  const droppedVariants = [];
  const seenVariantTexts = new Set();
  let droppedDuplicateCount = 0;

  for (let leftIndex = 0; leftIndex < candidateFragments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidateFragments.length; rightIndex += 1) {
      const leftFragment = candidateFragments[leftIndex];
      const rightFragment = candidateFragments[rightIndex];
      const compatibility = evaluateMutationCompatibility(leftFragment, rightFragment);
      const decision = {
        decisionId: `${synthesizeArtifact.inputId}_mutation_check_${String(compatibilityDecisions.length + 1).padStart(3, '0')}`,
        leftFragmentId: leftFragment.fragmentId,
        rightFragmentId: rightFragment.fragmentId,
        status: compatibility.status,
        reasons: compatibility.reasons,
        sharedConceptIds: compatibility.sharedConceptIds,
        sharedSourceInputIds: compatibility.sharedSourceInputIds
      };
      compatibilityDecisions.push(decision);

      if (decision.status !== 'compatible' || variants.length >= MAX_MUTATION_VARIANTS) {
        continue;
      }

      const orderedFragments = sortFragmentsForMutation([leftFragment, rightFragment]);
      const variantText = orderedFragments.map((fragment) => fragment.text).join(', ');
      const normalizedVariantKey = normalizedFragmentText(variantText);
      if (seenVariantTexts.has(normalizedVariantKey)) {
        droppedDuplicateCount += 1;
        droppedVariants.push({
          droppedVariantId: `${synthesizeArtifact.inputId}_mutation_dropped_${String(droppedVariants.length + 1).padStart(3, '0')}`,
          text: variantText,
          fragmentIds: orderedFragments.map((fragment) => fragment.fragmentId),
          compatibilityDecisionIds: [decision.decisionId],
          reason: 'duplicate-variant-text'
        });
        continue;
      }

      seenVariantTexts.add(normalizedVariantKey);
      variants.push({
        variantId: `${synthesizeArtifact.inputId}_mutation_variant_${String(variants.length + 1).padStart(3, '0')}`,
        text: variantText,
        fragmentIds: orderedFragments.map((fragment) => fragment.fragmentId),
        families: orderedFragments.map((fragment) => fragment.family),
        compatibilityDecisionIds: [decision.decisionId],
        conceptIds: mergeMutationLineage(orderedFragments, 'conceptIds'),
        sourceInputIds: mergeMutationLineage(orderedFragments, 'sourceInputIds'),
        sourceChunkIds: mergeMutationLineage(orderedFragments, 'sourceChunkIds'),
        distinctivenessScore: scoreMutationDistinctiveness(orderedFragments)
      });
    }
  }

  const compatiblePairCount = compatibilityDecisions.filter(
    (decision) => decision.status === 'compatible'
  ).length;
  const incompatiblePairCount = compatibilityDecisions.length - compatiblePairCount;

  return MetagrinderMutationArtifactSchema.parse({
    inputId: synthesizeArtifact.inputId,
    candidateFragments,
    compatibilityDecisions,
    variants,
    droppedVariants,
    generationSummary: {
      maxVariants: MAX_MUTATION_VARIANTS,
      compatiblePairCount,
      incompatiblePairCount,
      generatedVariantCount: variants.length,
      droppedDuplicateCount
    }
  });
}

function buildMutationReviewArtifact({ mutationArtifact }) {
  const promotableVariantIds = [];
  const flaggedVariantIds = [];
  const rejectedVariantIds = [];
  const duplicateVariantIds = mutationArtifact.droppedVariants.map(
    (variant) => variant.droppedVariantId
  );
  const weakVariantIds = [];
  const incompatibilityWarnings = mutationArtifact.compatibilityDecisions
    .filter((decision) => decision.status === 'incompatible')
    .map((decision) =>
      `${decision.leftFragmentId} + ${decision.rightFragmentId}: ${decision.reasons.join(', ')}`
    );

  mutationArtifact.variants.forEach((variant) => {
    const isWeak = variant.distinctivenessScore < 0.55 || variant.sourceInputIds.length < 2;
    const hasThinFragment = variant.text.split(/\s+/).length < 6;
    if (isWeak) {
      weakVariantIds.push(variant.variantId);
    }

    if (hasThinFragment) {
      rejectedVariantIds.push(variant.variantId);
      return;
    }

    if (isWeak) {
      flaggedVariantIds.push(variant.variantId);
      return;
    }

    promotableVariantIds.push(variant.variantId);
  });

  const recommendedActions = [];
  if (promotableVariantIds.length > 0) {
    recommendedActions.push('Review promotable mutation variants as candidates for downstream prompt package expansion.');
  }
  if (flaggedVariantIds.length > 0) {
    recommendedActions.push('Inspect flagged mutation variants for weak distinctiveness or narrow source support before promotion.');
  }
  if (rejectedVariantIds.length > 0) {
    recommendedActions.push('Keep rejected mutation variants out of downstream collections unless compatibility and distinctiveness rules are revised.');
  }
  if (duplicateVariantIds.length > 0) {
    recommendedActions.push('Review dropped duplicate mutation variants if deduplication appears to be masking distinct but overly similar outputs.');
  }
  if (incompatibilityWarnings.length > 0) {
    recommendedActions.push('Review incompatibility warnings to refine fragment compatibility rules before widening mutation generation.');
  }

  return MetagrinderMutationReviewArtifactSchema.parse({
    inputId: mutationArtifact.inputId,
    promotableVariantIds,
    flaggedVariantIds,
    rejectedVariantIds,
    duplicateVariantIds,
    weakVariantIds,
    incompatibilityWarnings,
    recommendedActions
  });
}

module.exports = {
  buildMutationArtifact,
  buildMutationReviewArtifact
};

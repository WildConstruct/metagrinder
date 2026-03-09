const {
  MetagrinderAssumptionReviewArtifactSchema,
  MetagrinderAugmentationPlanArtifactSchema,
  MetagrinderCategoryHypothesisArtifactSchema,
  MetagrinderModeDetectionArtifactSchema
} = require('../../types/metagrinder.runtime.js');
const {
  CATEGORY_SIGNAL_RULES,
  RESEARCH_KIND_CATEGORY_PRIORITIES,
  RESEARCH_KIND_SUGGESTED_CATEGORIES,
  RESEARCH_MODE_PROTOTYPES,
  SEMANTIC_STOPWORDS
} = require('./config.js');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mergeUniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function tokenizeSemanticText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !SEMANTIC_STOPWORDS.has(token));
}

function uniqueSemanticTokens(texts) {
  const tokens = new Set();
  texts.forEach((text) => {
    tokenizeSemanticText(text).forEach((token) => tokens.add(token));
  });
  return tokens;
}

function buildSemanticTokenWeights() {
  const documentFrequency = new Map();
  const prototypeEntries = Object.entries(RESEARCH_MODE_PROTOTYPES);
  prototypeEntries.forEach(([researchKind, prototype]) => {
    const tokens = uniqueSemanticTokens([
      ...(prototype.prototypeTerms || []),
      ...(prototype.sectionTerms || []),
      ...(RESEARCH_KIND_SUGGESTED_CATEGORIES[researchKind] || []),
      ...(RESEARCH_KIND_SUGGESTED_CATEGORIES[researchKind] || [])
        .flatMap((categoryLabel) => CATEGORY_SIGNAL_RULES[researchKind]?.[categoryLabel] || [])
    ]);
    tokens.forEach((token) => {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    });
  });

  const totalDocuments = prototypeEntries.length;
  const weights = new Map();
  for (const [token, frequency] of documentFrequency.entries()) {
    weights.set(token, Math.log((totalDocuments + 1) / (frequency + 1)) + 1);
  }
  return weights;
}

const SEMANTIC_TOKEN_WEIGHTS = buildSemanticTokenWeights();

function addWeightedSemanticTokens(tokenWeights, text, weight) {
  tokenizeSemanticText(text).forEach((token) => {
    tokenWeights.set(token, (tokenWeights.get(token) || 0) + weight);
  });
}

function buildSemanticBriefProfile({ inputId, title, chunks }) {
  const tokenWeights = new Map();
  addWeightedSemanticTokens(tokenWeights, inputId, 2.5);
  addWeightedSemanticTokens(tokenWeights, title, 2.5);

  const chunkKindCounts = chunks.reduce((counts, chunk) => {
    counts[chunk.chunkKind] = (counts[chunk.chunkKind] || 0) + 1;
    addWeightedSemanticTokens(tokenWeights, chunk.text, 1);
    if (chunk.sectionLabel) {
      addWeightedSemanticTokens(tokenWeights, chunk.sectionLabel, 2);
    }
    (chunk.tags || []).forEach((tag) => addWeightedSemanticTokens(tokenWeights, tag, 1.5));
    addWeightedSemanticTokens(tokenWeights, chunk.chunkKind, 1.5);
    return counts;
  }, {});

  return {
    tokenWeights,
    chunkKindCounts
  };
}

function scoreSemanticOverlap(tokenWeights, terms, weight) {
  return (terms || []).reduce((score, term) => {
    const termScore = tokenizeSemanticText(term).reduce((sum, token) => (
      sum + ((tokenWeights.get(token) || 0) * (SEMANTIC_TOKEN_WEIGHTS.get(token) || 1))
    ), 0);
    return score + (termScore * weight);
  }, 0);
}

function analyzeCategorySignals({ ingestArtifact, researchKind, categoryLabel }) {
  const signalKeywords = CATEGORY_SIGNAL_RULES[researchKind] && CATEGORY_SIGNAL_RULES[researchKind][categoryLabel];
  if (!signalKeywords || !ingestArtifact) {
    return {
      score: 0,
      matchedSignals: []
    };
  }

  const combinedText = ingestArtifact.chunks
    .map((chunk) => `${chunk.sectionLabel || ''}\n${chunk.text}\n${(chunk.tags || []).join(' ')}`)
    .join('\n')
    .toLowerCase();
  const matchedSignals = [];
  const score = signalKeywords.reduce((total, keyword) => {
    if (!combinedText.includes(keyword)) {
      return total;
    }

    matchedSignals.push(keyword);
    return total + 1;
  }, 0);

  return {
    score,
    matchedSignals
  };
}

function scoreSemanticResearchKind(profile, researchKind) {
  const prototype = RESEARCH_MODE_PROTOTYPES[researchKind];
  if (!prototype) {
    return 0;
  }

  let score = 0;
  score += scoreSemanticOverlap(profile.tokenWeights, prototype.prototypeTerms || [], 1);
  score += scoreSemanticOverlap(profile.tokenWeights, prototype.sectionTerms || [], 1.4);
  score += scoreSemanticOverlap(
    profile.tokenWeights,
    (RESEARCH_KIND_SUGGESTED_CATEGORIES[researchKind] || [])
      .flatMap((categoryLabel) => CATEGORY_SIGNAL_RULES[researchKind]?.[categoryLabel] || []),
    0.35
  );

  Object.entries(prototype.chunkKindWeights || {}).forEach(([chunkKind, weight]) => {
    score += (profile.chunkKindCounts[chunkKind] || 0) * weight;
  });

  return Number(score.toFixed(2));
}

function selectSemanticResearchKind(profile, candidateKinds) {
  const nonMixedCandidates = candidateKinds.filter((candidate) => candidate.researchKind !== 'mixed');
  const topCandidate = candidateKinds[0];
  const topNonMixed = nonMixedCandidates[0];
  const secondNonMixed = nonMixedCandidates[1];
  const thirdNonMixed = nonMixedCandidates[2];
  let researchKind = topCandidate && topCandidate.score > 0
    ? topCandidate.researchKind
    : 'unknown';

  const templateCount = profile.chunkKindCounts.template || 0;
  const generationRuleCount = profile.chunkKindCounts['generation-rule'] || 0;
  const referenceTableCount = profile.chunkKindCounts['reference-table'] || 0;
  const totalChunks = Object.values(profile.chunkKindCounts).reduce((sum, count) => sum + count, 0);
  const structuralHybridSignals = (templateCount * 2) + generationRuleCount + referenceTableCount;
  const structuralHybridRatio = totalChunks > 0 ? structuralHybridSignals / totalChunks : 0;
  const observationalSignals = (profile.chunkKindCounts.observation || 0) + (profile.chunkKindCounts['source-note'] || 0);
  const hasMeaningfulHybridStructure = (
    templateCount >= 2 ||
    structuralHybridSignals >= 8 ||
    structuralHybridRatio >= 0.18
  );

  if (
    topNonMixed &&
    secondNonMixed &&
    topNonMixed.score > 0 &&
    secondNonMixed.score > 0 &&
    Math.abs(topNonMixed.score - secondNonMixed.score) <= 2 &&
    hasMeaningfulHybridStructure
  ) {
    researchKind = 'mixed';
  }

  if (
    topNonMixed &&
    secondNonMixed &&
    thirdNonMixed &&
    hasMeaningfulHybridStructure &&
    observationalSignals > 0 &&
    topNonMixed.score > 0 &&
    secondNonMixed.score >= topNonMixed.score * 0.55 &&
    thirdNonMixed.score >= topNonMixed.score * 0.4
  ) {
    researchKind = 'mixed';
  }

  return researchKind;
}

function inferSemanticConfidence(candidateKinds, researchKind) {
  const top = candidateKinds[0];
  const second = candidateKinds[1];
  if (!top || top.score <= 0) {
    return 'low';
  }
  if (researchKind === 'mixed') {
    return 'medium';
  }
  if (!second || second.score <= 0) {
    return top.score >= 10 ? 'high' : 'medium';
  }
  const ratio = top.score / second.score;
  if (ratio >= 1.3 && top.score >= 80) {
    return 'high';
  }
  if (ratio >= 1.95 && top.score >= 12) {
    return 'high';
  }
  if (ratio >= 1.6 && top.score >= 20) {
    return 'high';
  }
  if (ratio >= 1.45 && top.score >= 70) {
    return 'high';
  }
  if (ratio >= 1.45 && top.score >= 50) {
    return 'high';
  }
  return 'medium';
}

function findSemanticEvidenceTerms(profile, researchKind) {
  const prototype = RESEARCH_MODE_PROTOTYPES[researchKind];
  if (!prototype) {
    return [];
  }

  const candidateTerms = mergeUniqueStrings([
    ...(prototype.prototypeTerms || []),
    ...(prototype.sectionTerms || []),
    ...((RESEARCH_KIND_SUGGESTED_CATEGORIES[researchKind] || [])
      .flatMap((categoryLabel) => CATEGORY_SIGNAL_RULES[researchKind]?.[categoryLabel] || []))
  ]);

  return candidateTerms
    .map((term) => ({
      term,
      score: tokenizeSemanticText(term).reduce((sum, token) => (
        sum + ((profile.tokenWeights.get(token) || 0) * (SEMANTIC_TOKEN_WEIGHTS.get(token) || 1))
      ), 0)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((entry) => entry.term);
}

function findBriefAnchors({ inputId, title, chunks }) {
  const anchors = [];

  if (inputId && /greenhouse|shipyard|desert|spaghettiwestern|weeklyworldnews|tabloid|medieval/i.test(inputId)) {
    anchors.push(inputId);
  }

  if (title) {
    anchors.push(title);
  }

  chunks.forEach((chunk) => {
    if (chunk.sectionLabel && chunk.sectionLabel.length <= 80) {
      anchors.push(chunk.sectionLabel);
    }
  });

  return mergeUniqueStrings(anchors).slice(0, 5);
}

function findPrototypePhraseAnchors({ inputId, title, chunks, researchKind }) {
  const prototype = RESEARCH_MODE_PROTOTYPES[researchKind];
  if (!prototype) {
    return [];
  }

  const combinedText = [
    inputId,
    title,
    ...chunks.map((chunk) => chunk.sectionLabel || ''),
    ...chunks.map((chunk) => chunk.text)
  ].join('\n').toLowerCase();

  return mergeUniqueStrings([
    ...(prototype.sectionTerms || []),
    ...(prototype.prototypeTerms || [])
  ])
    .filter((term) => combinedText.includes(term.toLowerCase()))
    .slice(0, 5);
}

function buildModeDetectionArtifact({ inputId, title, chunks }) {
  const profile = buildSemanticBriefProfile({
    inputId,
    title,
    chunks
  });
  const candidateKinds = Object.keys(RESEARCH_MODE_PROTOTYPES)
    .map((researchKind) => ({
      researchKind,
      score: Math.round(scoreSemanticResearchKind(profile, researchKind))
    }))
    .sort((left, right) => right.score - left.score);
  const researchKind = selectSemanticResearchKind(profile, candidateKinds);
  const confidence = inferSemanticConfidence(candidateKinds, researchKind);
  const topCandidate = candidateKinds[0];
  const secondCandidate = candidateKinds[1];
  const reasons = [];

  if (topCandidate) {
    reasons.push(`Top prototype match: ${topCandidate.researchKind} (${topCandidate.score}).`);
  }
  if (secondCandidate && secondCandidate.score > 0) {
    reasons.push(`Secondary prototype match: ${secondCandidate.researchKind} (${secondCandidate.score}).`);
  }
  const matchedEvidence = findSemanticEvidenceTerms(profile, researchKind);
  if (matchedEvidence.length > 0) {
    reasons.push(`Matched semantic evidence: ${matchedEvidence.join(', ')}.`);
  }
  const matchedPhraseAnchors = findPrototypePhraseAnchors({ inputId, title, chunks, researchKind });
  if (matchedPhraseAnchors.length > 0) {
    reasons.push(`Matched brief phrases: ${matchedPhraseAnchors.join(', ')}.`);
  }
  const briefAnchors = findBriefAnchors({ inputId, title, chunks });
  if (briefAnchors.length > 0) {
    reasons.push(`Brief anchors: ${briefAnchors.join(', ')}.`);
  }
  reasons.push('Semantic review used chunked intake, section-label weighting, and prototype similarity instead of direct mode keywords alone.');
  if (researchKind === 'mixed') {
    reasons.push('Multiple prototype families remained strong after structural weighting, so the brief should be reviewed as mixed.');
  }
  if (chunks.some((chunk) => chunk.sectionLabel)) {
    reasons.push(`Section labels contributed to mode detection across ${chunks.filter((chunk) => chunk.sectionLabel).length} chunks.`);
  }

  return MetagrinderModeDetectionArtifactSchema.parse({
    inputId,
    researchKind,
    confidence,
    reasons,
    suggestedCategories: RESEARCH_KIND_SUGGESTED_CATEGORIES[researchKind] || [],
    candidateKinds
  });
}

function buildCategoryHypothesisArtifact({ inputId, modeDetectionArtifact, ingestArtifact }) {
  const baseCategories = RESEARCH_KIND_CATEGORY_PRIORITIES[modeDetectionArtifact.researchKind] || [];
  const rankedCategories = baseCategories
    .map(([label, priority], index) => {
      const categorySignals = analyzeCategorySignals({
        ingestArtifact,
        researchKind: modeDetectionArtifact.researchKind,
        categoryLabel: label
      });
      const basePriorityWeight = {
        primary: 3,
        secondary: 2,
        optional: 1
      }[priority] || 0;

      return {
        categoryId: slugify(label),
        label,
        priority,
        matchedSignals: categorySignals.matchedSignals,
        signalScore: categorySignals.score,
        sortScore: (categorySignals.score * 10) + basePriorityWeight,
        baseIndex: index,
        rationale: categorySignals.matchedSignals.length > 0
          ? `Proposed from research mode ${modeDetectionArtifact.researchKind} using brief signals: ${categorySignals.matchedSignals.slice(0, 4).join(', ')}.`
          : `Proposed from research mode ${modeDetectionArtifact.researchKind}.`
      };
    })
    .sort((left, right) => {
      if (right.sortScore !== left.sortScore) {
        return right.sortScore - left.sortScore;
      }
      return left.baseIndex - right.baseIndex;
    })
    .map((entry, index) => {
      let priority = entry.priority;

      if (entry.signalScore > 0) {
        if (index < 3) {
          priority = 'primary';
        } else if (index < 5) {
          priority = 'secondary';
        }
      }

      return {
        categoryId: entry.categoryId,
        label: entry.label,
        priority,
        rationale: entry.rationale,
        signalScore: entry.signalScore
      };
    });
  const signaledCategoryCount = rankedCategories.filter((entry) => entry.signalScore > 0).length;
  const categories = rankedCategories.map((entry, index) => {
    if (signaledCategoryCount === 0) {
      return {
        categoryId: entry.categoryId,
        label: entry.label,
        priority: entry.priority,
        rationale: entry.rationale
      };
    }

    let priority = 'optional';
    if (entry.signalScore > 0 && index < 3) {
      priority = 'primary';
    } else if (entry.signalScore > 0 && index < 5) {
      priority = 'secondary';
    }

    return {
      categoryId: entry.categoryId,
      label: entry.label,
      priority,
      rationale: entry.rationale
    };
  });

  return MetagrinderCategoryHypothesisArtifactSchema.parse({
    inputId,
    researchKind: modeDetectionArtifact.researchKind,
    categories,
    recommendedFocus: categories
      .filter((entry) => entry.priority === 'primary')
      .map((entry) => entry.label)
  });
}

function buildAssumptionReviewArtifact({
  inputId,
  modeDetectionArtifact,
  categoryHypothesisArtifact,
  ingestArtifact
}) {
  const detectedChunkKinds = [...new Set(ingestArtifact.chunks.map((chunk) => chunk.chunkKind))];
  const warnings = [];

  if (modeDetectionArtifact.researchKind === 'mixed') {
    warnings.push('This brief spans multiple research modes. Review the proposed category priorities before trusting default extraction behavior.');
  }
  if (detectedChunkKinds.includes('template')) {
    warnings.push('Template chunks were detected. They should guide authoring, not be treated as ordinary factual evidence.');
  }
  if (detectedChunkKinds.includes('generation-rule')) {
    warnings.push('Generation-rule chunks were detected. Confirm whether they should shape synthesis rather than core concept extraction.');
  }
  if (detectedChunkKinds.includes('reference-table')) {
    warnings.push('Reference-table chunks were detected. They may need restructuring before deeper extraction or verification.');
  }
  if (categoryHypothesisArtifact.recommendedFocus.length === 0) {
    warnings.push('No clear primary focus was detected. Consider adjusting priorities manually.');
  }

  return MetagrinderAssumptionReviewArtifactSchema.parse({
    inputId,
    researchKind: modeDetectionArtifact.researchKind,
    detectedChunkKinds,
    recommendedFocus: categoryHypothesisArtifact.recommendedFocus,
    warnings,
    decisionOptions: [
      'proceed-as-is',
      'adjust-priorities',
      'request-augmentation'
    ]
  });
}

function buildAugmentationPlanArtifact({
  inputId,
  modeDetectionArtifact,
  categoryHypothesisArtifact,
  assumptionReviewArtifact
}) {
  const verificationTargets = [];
  const missingSourceTypes = [];
  const followUpResearchDirections = [];
  const rationale = [];

  if (modeDetectionArtifact.researchKind === 'mixed') {
    verificationTargets.push('Separate observational research from generation guidance before promoting concepts into stable buckets.');
    rationale.push('Mixed-mode briefs benefit from a stronger distinction between source facts and procedural material.');
  }

  if (assumptionReviewArtifact.detectedChunkKinds.includes('template')) {
    verificationTargets.push('Review template chunks manually to decide which details are reusable examples versus actual evidence.');
    followUpResearchDirections.push('Create a clean example bank separate from core research notes.');
    rationale.push('Template-heavy briefs can inflate downstream synthesis if examples are treated as facts.');
  }

  if (assumptionReviewArtifact.detectedChunkKinds.includes('generation-rule')) {
    verificationTargets.push('Confirm which generation rules should guide prompt assembly and which should remain advisory only.');
    followUpResearchDirections.push('Split assembly logic into a dedicated rule sheet for later prompt construction.');
    rationale.push('Procedural guidance should be interpreted differently from observed or sourced material.');
  }

  if (modeDetectionArtifact.researchKind === 'historical-scene-research') {
    missingSourceTypes.push('period photographs or archival visual references');
    missingSourceTypes.push('primary-source descriptions or reportage');
    followUpResearchDirections.push('Add corroborating period-specific wardrobe and crowd behavior sources.');
  }

  if (modeDetectionArtifact.researchKind === 'character-framework') {
    missingSourceTypes.push('genre example set with concrete scene excerpts');
    followUpResearchDirections.push('Pair archetype notes with concrete scene-level evidence from representative films.');
  }

  if (modeDetectionArtifact.researchKind === 'mixed') {
    missingSourceTypes.push('separate observational source notes');
    missingSourceTypes.push('separate generation-rule document');
  }

  if (categoryHypothesisArtifact.recommendedFocus.length === 0) {
    verificationTargets.push('Choose at least one primary extraction focus before trusting downstream concept clustering.');
    rationale.push('No primary focus was detected automatically.');
  }

  return MetagrinderAugmentationPlanArtifactSchema.parse({
    inputId,
    researchKind: modeDetectionArtifact.researchKind,
    verificationTargets,
    missingSourceTypes,
    followUpResearchDirections,
    rationale
  });
}

function buildResearchBriefReviewArtifacts({
  ingestArtifact,
  buildIngestArtifact,
  rawText,
  title,
  inputPath = 'research-brief.txt',
  inputId,
  createdAt
}) {
  const resolvedIngestArtifact = ingestArtifact || buildIngestArtifact({
    inputPath,
    rawText,
    inputId,
    title,
    createdAt
  });
  const modeDetectionArtifact = buildModeDetectionArtifact({
    inputId: resolvedIngestArtifact.inputId,
    title: resolvedIngestArtifact.title,
    chunks: resolvedIngestArtifact.chunks
  });
  const categoryHypothesisArtifact = buildCategoryHypothesisArtifact({
    inputId: resolvedIngestArtifact.inputId,
    modeDetectionArtifact,
    ingestArtifact: resolvedIngestArtifact
  });
  const assumptionReviewArtifact = buildAssumptionReviewArtifact({
    inputId: resolvedIngestArtifact.inputId,
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    ingestArtifact: resolvedIngestArtifact
  });
  const augmentationPlanArtifact = buildAugmentationPlanArtifact({
    inputId: resolvedIngestArtifact.inputId,
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    assumptionReviewArtifact,
    ingestArtifact: resolvedIngestArtifact
  });

  return {
    ingestArtifact: resolvedIngestArtifact,
    modeDetectionArtifact,
    categoryHypothesisArtifact,
    assumptionReviewArtifact,
    augmentationPlanArtifact
  };
}

module.exports = {
  buildAssumptionReviewArtifact,
  buildAugmentationPlanArtifact,
  buildCategoryHypothesisArtifact,
  buildModeDetectionArtifact,
  buildResearchBriefReviewArtifacts,
  CATEGORY_SIGNAL_RULES,
  RESEARCH_KIND_CATEGORY_PRIORITIES,
  RESEARCH_KIND_SUGGESTED_CATEGORIES,
  RESEARCH_MODE_PROTOTYPES
};

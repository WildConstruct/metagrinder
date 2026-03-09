const fs = require('fs');
const path = require('path');

const {
  buildIngestArtifact
} = require('../../packages/core/scripts/lib/metagrinder-mvp.js');

const repoRoot = path.resolve(__dirname, '..', '..');
const judgments = JSON.parse(fs.readFileSync(path.join(__dirname, 'judgments.json'), 'utf8'));
const exemplars = JSON.parse(fs.readFileSync(path.join(__dirname, 'exemplars.json'), 'utf8'));
const runDir = path.join(__dirname, 'runs', 'semantic-baseline');
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with'
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !STOPWORDS.has(token));
}

function uniqueTokens(texts) {
  const tokens = new Set();
  (texts || []).forEach((text) => {
    tokenize(text).forEach((token) => tokens.add(token));
  });
  return tokens;
}

function buildExemplarTokenWeights() {
  const docFrequencies = new Map();
  const exemplarEntries = Object.values(exemplars);
  exemplarEntries.forEach((exemplar) => {
    const tokens = uniqueTokens([
      ...(exemplar.prototype_terms || []),
      ...(exemplar.section_terms || []),
      ...(exemplar.category_focus || []).flatMap((category) => category.signals || [])
    ]);
    tokens.forEach((token) => {
      docFrequencies.set(token, (docFrequencies.get(token) || 0) + 1);
    });
  });

  const totalDocs = exemplarEntries.length;
  const weights = new Map();
  for (const [token, df] of docFrequencies.entries()) {
    weights.set(token, Math.log((totalDocs + 1) / (df + 1)) + 1);
  }
  return weights;
}

const exemplarTokenWeights = buildExemplarTokenWeights();

function addWeightedTokens(map, text, weight) {
  tokenize(text).forEach((token) => {
    map.set(token, (map.get(token) || 0) + weight);
  });
}

function buildBriefProfile(brief, rawText) {
  const ingestArtifact = buildIngestArtifact({
    inputPath: brief.path,
    rawText,
    inputId: brief.id,
    title: brief.id,
    createdAt: '2026-03-09T12:00:00.000Z'
  });
  const tokenWeights = new Map();

  addWeightedTokens(tokenWeights, brief.id.replace(/-/g, ' '), 2.5);
  ingestArtifact.chunks.forEach((chunk) => {
    addWeightedTokens(tokenWeights, chunk.text, 1);
    if (chunk.sectionLabel) {
      addWeightedTokens(tokenWeights, chunk.sectionLabel, 2);
    }
    chunk.tags.forEach((tag) => addWeightedTokens(tokenWeights, tag, 1.5));
    addWeightedTokens(tokenWeights, chunk.chunkKind, 1.5);
  });

  const sectionLabels = ingestArtifact.chunks
    .map((chunk) => chunk.sectionLabel)
    .filter(Boolean)
    .map((label) => label.toLowerCase());
  const chunkKindCounts = ingestArtifact.chunks.reduce((counts, chunk) => {
    counts[chunk.chunkKind] = (counts[chunk.chunkKind] || 0) + 1;
    return counts;
  }, {});

  return {
    ingestArtifact,
    tokenWeights,
    sectionLabels,
    chunkKindCounts
  };
}

function scoreOverlap(tokenWeights, terms, weight) {
  return terms.reduce((score, term) => {
    const termScore = tokenize(term).reduce(
      (sum, token) => sum + ((tokenWeights.get(token) || 0) * (exemplarTokenWeights.get(token) || 1)),
      0
    );
    return score + (termScore * weight);
  }, 0);
}

function scoreResearchKind(profile, exemplar) {
  let score = 0;

  score += scoreOverlap(profile.tokenWeights, exemplar.prototype_terms || [], 1);
  score += scoreOverlap(profile.tokenWeights, exemplar.section_terms || [], 1.4);
  score += scoreOverlap(
    profile.tokenWeights,
    (exemplar.category_focus || []).flatMap((category) => category.signals || []),
    0.35
  );

  Object.entries(exemplar.chunk_kind_weights || {}).forEach(([chunkKind, weight]) => {
    score += (profile.chunkKindCounts[chunkKind] || 0) * weight;
  });

  return score;
}

function buildCandidateKinds(profile) {
  const candidates = Object.entries(exemplars).map(([researchKind, exemplar]) => ({
    researchKind,
    score: Number(scoreResearchKind(profile, exemplar).toFixed(2))
  })).sort((left, right) => right.score - left.score);
  const nonMixedCandidates = candidates.filter((candidate) => candidate.researchKind !== 'mixed');

  const top = candidates[0];
  const topNonMixed = nonMixedCandidates[0];
  const secondNonMixed = nonMixedCandidates[1];
  const thirdNonMixed = nonMixedCandidates[2];
  let researchKind = top && top.score > 0 ? top.researchKind : 'unknown';

  const templateCount = profile.chunkKindCounts.template || 0;
  const generationRuleCount = profile.chunkKindCounts['generation-rule'] || 0;
  const referenceTableCount = profile.chunkKindCounts['reference-table'] || 0;
  const totalChunks = Object.values(profile.chunkKindCounts).reduce((sum, count) => sum + count, 0);
  const structuralHybridSignals = (templateCount * 2) + generationRuleCount + referenceTableCount;
  const structuralHybridRatio = totalChunks > 0
    ? structuralHybridSignals / totalChunks
    : 0;
  const observationalSignals = (profile.chunkKindCounts.observation || 0) + (profile.chunkKindCounts['source-note'] || 0);
  const hasMeaningfulHybridStructure = (
    templateCount >= 2
    || structuralHybridSignals >= 8
    || structuralHybridRatio >= 0.18
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

  return {
    researchKind,
    candidateKinds: candidates
  };
}

function confidenceFor(candidateKinds, researchKind) {
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

function buildReasons(candidateKinds, researchKind) {
  const top = candidateKinds[0];
  const second = candidateKinds[1];
  const reasons = [];

  if (top) {
    reasons.push(`Top prototype match: ${top.researchKind} (${top.score}).`);
  }
  if (second && second.score > 0) {
    reasons.push(`Secondary prototype match: ${second.researchKind} (${second.score}).`);
  }
  reasons.push('Semantic baseline used chunked intake, section-label weighting, and prototype similarity instead of direct mode keywords alone.');
  if (researchKind === 'mixed') {
    reasons.push('Multiple prototype families remained strong after structural weighting, so the brief should be reviewed as mixed.');
  }

  return reasons;
}

function buildCategories(profile, researchKind) {
  const exemplar = exemplars[researchKind] || exemplars.mixed;
  const categories = (exemplar.category_focus || []).map((category) => {
    const score = scoreOverlap(profile.tokenWeights, category.signals || [], 1);
    return {
      categoryId: category.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label: category.label,
      score,
      rationale: score > 0
        ? `Proposed from prototype similarity plus matched brief signals: ${(category.signals || []).filter((term) => scoreOverlap(profile.tokenWeights, [term], 1) > 0).slice(0, 4).join(', ')}.`
        : `Proposed from the ${researchKind} prototype.`
    };
  }).sort((left, right) => right.score - left.score);

  return categories.map((category, index) => ({
    categoryId: category.categoryId,
    label: category.label,
    priority: index < 3 ? 'primary' : index < 5 ? 'secondary' : 'optional',
    rationale: category.rationale
  }));
}

function buildWarnings(profile, researchKind) {
  const warnings = [];
  if (researchKind === 'mixed') {
    warnings.push('Prototype comparison found multiple strong framework families. Review before trusting a single extraction shape.');
  }
  if ((profile.chunkKindCounts.template || 0) > 0) {
    warnings.push('Template chunks were detected during structural intake. Keep examples separate from ordinary evidence.');
  }
  if ((profile.chunkKindCounts['generation-rule'] || 0) > 0) {
    warnings.push('Generation-rule chunks were detected during structural intake. Confirm whether they should guide synthesis instead of concept extraction.');
  }
  if ((profile.chunkKindCounts['reference-table'] || 0) > 0) {
    warnings.push('Reference-table chunks were detected. They may need restructuring before deeper extraction.');
  }
  if (
    warnings.length === 0 &&
    (researchKind === 'style-analysis' || researchKind === 'character-framework')
  ) {
    warnings.push('This brief reads as analytical guidance rather than plain scene evidence. Review extraction priorities before proceeding.');
  }
  return warnings;
}

ensureDir(runDir);

for (const brief of judgments.briefs) {
  const rawText = fs.readFileSync(path.join(repoRoot, brief.path), 'utf8');
  const profile = buildBriefProfile(brief, rawText);
  const { researchKind, candidateKinds } = buildCandidateKinds(profile);
  const categories = buildCategories(profile, researchKind);
  const warnings = buildWarnings(profile, researchKind);
  const briefDir = path.join(runDir, brief.id);
  ensureDir(briefDir);

  writeJson(path.join(briefDir, 'mode-detection.json'), {
    inputId: brief.id,
    researchKind,
    confidence: confidenceFor(candidateKinds, researchKind),
    reasons: buildReasons(candidateKinds, researchKind),
    suggestedCategories: categories.map((entry) => entry.label),
    candidateKinds
  });

  writeJson(path.join(briefDir, 'category-hypothesis.json'), {
    inputId: brief.id,
    researchKind,
    categories,
    recommendedFocus: categories
      .filter((entry) => entry.priority === 'primary')
      .map((entry) => entry.label)
  });

  writeJson(path.join(briefDir, 'assumption-review.json'), {
    inputId: brief.id,
    researchKind,
    detectedChunkKinds: Object.keys(profile.chunkKindCounts),
    recommendedFocus: categories
      .filter((entry) => entry.priority === 'primary')
      .map((entry) => entry.label),
    warnings,
    decisionOptions: [
      'proceed-as-is',
      'adjust-priorities',
      'request-augmentation'
    ]
  });

  writeJson(path.join(briefDir, 'augmentation-plan.json'), {
    inputId: brief.id,
    researchKind,
    verificationTargets: researchKind === 'mixed'
      ? ['Separate source notes, templates, and procedural logic before deeper extraction.']
      : warnings.map((warning) => `Review: ${warning}`),
    missingSourceTypes: [],
    followUpResearchDirections: [],
    rationale: [
      `Semantic baseline generated from prototype similarity over chunked intake for ${researchKind}.`
    ]
  });
}

console.log(path.relative(repoRoot, runDir));

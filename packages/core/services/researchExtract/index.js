const {
  MetagrinderExtractArtifactSchema
} = require('../../types/metagrinder.runtime.js');

const UNCERTAINTY_MARKERS = [
  'often',
  'usually',
  'typically',
  'appeared',
  'described',
  'suggests',
  'suggested',
  'may',
  'might'
];

const CATEGORY_KEYWORDS = [
  {
    category: 'wardrobe',
    keywords: ['coat', 'coats', 'overcoat', 'overcoats', 'hat', 'hats', 'glove', 'gloves', 'scarf', 'scarves', 'shoe', 'shoes', 'dress', 'tailored']
  },
  {
    category: 'people-and-crowd',
    keywords: ['crowd', 'crowded', 'theatergoers', 'audience', 'couples', 'groups', 'people', 'pedestrian', 'pedestrians']
  },
  {
    category: 'weather-and-environment',
    keywords: ['cold', 'breath', 'steam', 'winter', 'air', 'weather', 'damp']
  },
  {
    category: 'lighting',
    keywords: ['light', 'lights', 'lighting', 'marquee', 'neon', 'headlights', 'glow', 'spill']
  },
  {
    category: 'materials-and-surfaces',
    keywords: ['wool', 'pavement', 'sidewalk', 'curb', 'street grates', 'street', 'reflected', 'reflections']
  },
  {
    category: 'behavior-and-motion',
    keywords: ['gathered', 'pausing', 'clustering', 'drifted', 'walking', 'orderly']
  },
  {
    category: 'architecture-and-streetscape',
    keywords: ['theater', 'doors', 'entrances', 'curb', 'sidewalks', 'street', 'marquee']
  },
  {
    category: 'mood-and-social-tone',
    keywords: ['orderly', 'evening', 'theatergoing', 'softened']
  }
];

function mergeUniqueStrings(values) {
  return [...new Set(values)];
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function classifySentenceCategory(text, fallbackSectionLabel, chunkTags = []) {
  const normalized = text.toLowerCase();
  if (chunkTags.includes('wardrobe')) {
    return 'wardrobe';
  }
  if (chunkTags.includes('atmosphere')) {
    return 'weather-and-environment';
  }
  if (chunkTags.includes('reusable-concepts')) {
    const normalizedConceptText = text.toLowerCase();
    if (normalizedConceptText.includes('light') || normalizedConceptText.includes('neon')) {
      return 'lighting';
    }
    if (normalizedConceptText.includes('coat') || normalizedConceptText.includes('hat')) {
      return 'wardrobe';
    }
  }

  if (normalized.includes('neon') || normalized.includes('marquee')) {
    return 'lighting';
  }

  let best = {
    category: fallbackSectionLabel === 'Wardrobe Notes'
      ? 'wardrobe'
      : fallbackSectionLabel === 'Street Atmosphere'
        ? 'weather-and-environment'
        : 'people-and-crowd',
    score: 0
  };

  CATEGORY_KEYWORDS.forEach((entry) => {
    const score = entry.keywords.reduce((count, keyword) =>
      count + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) {
      best = { category: entry.category, score };
    }
  });

  return best.category;
}

function deriveConceptLabel(sentence, category) {
  const normalized = sentence.toLowerCase();

  if (category === 'wardrobe') {
    if (normalized.includes('overcoat')) return 'dark wool overcoats';
    if (normalized.includes('hat')) return 'structured evening hats';
    if (normalized.includes('glove')) return 'gloves and tailored coats';
  }

  if (category === 'people-and-crowd') {
    if (normalized.includes('theatergoers')) return 'formal venue crowd';
    if (normalized.includes('audience')) return 'attending audience';
    if (normalized.includes('crowded')) return 'orderly sidewalk crowd';
  }

  if (category === 'weather-and-environment') {
    if (normalized.includes('breath')) return 'visible breath in cold air';
    if (normalized.includes('steam')) return 'street grate steam';
  }

  if (category === 'lighting') {
    if (normalized.includes('marquee')) return 'bright marquee glow';
    if (normalized.includes('neon')) return 'neon street reflections';
  }

  if (category === 'materials-and-surfaces') {
    if (normalized.includes('neon')) return 'neon street reflections';
    if (normalized.includes('pavement')) return 'damp reflective pavement';
    if (normalized.includes('wool')) return 'heavy wool outerwear';
  }

  if (category === 'behavior-and-motion') {
    if (normalized.includes('gathered')) return 'post-show gathering behavior';
    if (normalized.includes('clustering')) return 'entryway clustering behavior';
  }

  if (category === 'architecture-and-streetscape') {
    if (normalized.includes('theater')) return 'lit venue entrances';
    if (normalized.includes('sidewalk')) return 'crowded public sidewalks';
  }

  if (category === 'mood-and-social-tone') {
    if (normalized.includes('orderly')) return 'orderly evening crowd tone';
    if (normalized.includes('theatergoing')) return 'mid-century public formality';
  }

  return sentence
    .replace(/[.?!]$/, '')
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');
}

function inferAttributionMode(sentence) {
  const normalized = sentence.toLowerCase();
  return UNCERTAINTY_MARKERS.some((marker) => normalized.includes(marker))
    ? 'inferred'
    : 'paraphrased';
}

function normalizeComparisonTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function calculateTokenOverlap(a, b) {
  const aTokens = new Set(normalizeComparisonTokens(a));
  const bTokens = new Set(normalizeComparisonTokens(b));
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  const intersectionCount = [...aTokens].filter((token) => bTokens.has(token)).length;
  const unionCount = new Set([...aTokens, ...bTokens]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

function shouldMergeConcept(existingConcept, sentence, chunk) {
  if (existingConcept.sourceInputIds.includes(chunk.sourceInputId)) {
    return true;
  }

  const summarySimilarity = calculateTokenOverlap(existingConcept.summary, sentence);
  const labelSimilarity = calculateTokenOverlap(existingConcept.label, sentence);
  return summarySimilarity >= 0.45 || labelSimilarity >= 0.35;
}

function createConceptCandidate({
  ingestArtifact,
  conceptCandidates,
  chunk,
  sentence,
  category,
  confidence,
  attributionMode
}) {
  return {
    conceptId: `${ingestArtifact.inputId}_concept_${String(conceptCandidates.length + 1).padStart(3, '0')}`,
    label: deriveConceptLabel(sentence, category),
    category,
    summary: sentence,
    confidence,
    sourceInputIds: [chunk.sourceInputId],
    sourceChunkIds: [chunk.chunkId],
    attributionMode
  };
}

function buildExtractArtifact({ ingestArtifact }) {
  const claims = [];
  const conceptCandidates = [];
  const evidence = [];
  const openQuestions = [];
  const warnings = [];
  const conceptCandidatesByKey = new Map();

  ingestArtifact.chunks.forEach((chunk) => {
    const sentences = splitSentences(chunk.text);
    if (sentences.length === 0) {
      warnings.push({
        code: 'empty-chunk',
        message: `Chunk ${chunk.chunkId} did not produce any sentences.`,
        sourceInputIds: [chunk.sourceInputId],
        sourceChunkIds: [chunk.chunkId]
      });
      return;
    }

    evidence.push({
      evidenceId: `${chunk.chunkId}_evidence_001`,
      text: chunk.text,
      sourceInputIds: [chunk.sourceInputId],
      sourceChunkIds: [chunk.chunkId],
      attributionMode: 'quoted'
    });

    if (chunk.chunkKind === 'template') {
      warnings.push({
        code: 'template-chunk-preserved-for-review',
        message: `Chunk ${chunk.chunkId} was typed as a template and preserved without ordinary claim extraction.`,
        sourceInputIds: [chunk.sourceInputId],
        sourceChunkIds: [chunk.chunkId]
      });
      return;
    }

    if (chunk.chunkKind === 'generation-rule') {
      warnings.push({
        code: 'generation-rule-chunk-preserved-for-review',
        message: `Chunk ${chunk.chunkId} was typed as a generation rule and excluded from ordinary claim extraction.`,
        sourceInputIds: [chunk.sourceInputId],
        sourceChunkIds: [chunk.chunkId]
      });
      return;
    }

    if (chunk.chunkKind === 'reference-table') {
      warnings.push({
        code: 'reference-table-chunk-preserved-for-review',
        message: `Chunk ${chunk.chunkId} was typed as a reference table and excluded from ordinary claim extraction.`,
        sourceInputIds: [chunk.sourceInputId],
        sourceChunkIds: [chunk.chunkId]
      });
      return;
    }

    sentences.forEach((sentence, index) => {
      const category = classifySentenceCategory(sentence, chunk.sectionLabel, chunk.tags);
      const attributionMode = inferAttributionMode(sentence);
      const confidence = chunk.chunkKind === 'concept-list'
        ? 'medium'
        : attributionMode === 'inferred'
          ? 'medium'
          : 'high';

      claims.push({
        claimId: `${chunk.chunkId}_claim_${String(index + 1).padStart(3, '0')}`,
        text: sentence,
        category,
        confidence,
        sourceInputIds: [chunk.sourceInputId],
        sourceChunkIds: [chunk.chunkId],
        attributionMode
      });

      const conceptLabel = deriveConceptLabel(sentence, category);
      const conceptKey = `${category}:${conceptLabel.toLowerCase()}`;
      const existingConcept = conceptCandidatesByKey.get(conceptKey);
      if (!existingConcept) {
        const concept = createConceptCandidate({
          ingestArtifact,
          conceptCandidates,
          chunk,
          sentence,
          category,
          confidence,
          attributionMode
        });
        conceptCandidates.push(concept);
        conceptCandidatesByKey.set(conceptKey, concept);
      } else if (!shouldMergeConcept(existingConcept, sentence, chunk)) {
        const concept = createConceptCandidate({
          ingestArtifact,
          conceptCandidates,
          chunk,
          sentence,
          category,
          confidence,
          attributionMode
        });
        conceptCandidates.push(concept);
        warnings.push({
          code: 'near-duplicate-concept',
          message: `Possible near-duplicate concept kept separate for review: ${conceptLabel}`,
          sourceInputIds: mergeUniqueStrings([
            ...existingConcept.sourceInputIds,
            chunk.sourceInputId
          ]),
          sourceChunkIds: mergeUniqueStrings([
            ...existingConcept.sourceChunkIds,
            chunk.chunkId
          ])
        });
      } else {
        existingConcept.sourceInputIds = mergeUniqueStrings([
          ...existingConcept.sourceInputIds,
          chunk.sourceInputId
        ]);
        existingConcept.sourceChunkIds = mergeUniqueStrings([
          ...existingConcept.sourceChunkIds,
          chunk.chunkId
        ]);
        if (existingConcept.summary !== sentence) {
          existingConcept.summary = `${existingConcept.summary} | ${sentence}`;
        }
        if (existingConcept.confidence === 'high' && confidence !== 'high') {
          existingConcept.confidence = 'medium';
        }
        if (existingConcept.attributionMode === 'paraphrased' && attributionMode === 'inferred') {
          existingConcept.attributionMode = 'inferred';
        }
      }

      if (attributionMode === 'inferred') {
        openQuestions.push({
          questionId: `${chunk.chunkId}_question_${String(openQuestions.length + 1).padStart(3, '0')}`,
          text: `Review whether this inference is sufficiently supported: ${sentence}`,
          sourceInputIds: [chunk.sourceInputId],
          sourceChunkIds: [chunk.chunkId]
        });
      }

      if (chunk.tags.includes('unexpected-findings')) {
        warnings.push({
          code: 'unexpected-finding',
          message: `Unexpected finding preserved for review: ${sentence}`,
          sourceInputIds: [chunk.sourceInputId],
          sourceChunkIds: [chunk.chunkId]
        });
      }
    });
  });

  return MetagrinderExtractArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    claims,
    conceptCandidates,
    evidence,
    openQuestions,
    warnings
  });
}

module.exports = {
  buildExtractArtifact
};

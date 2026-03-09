const fs = require('fs');
const path = require('path');

const {
  MetagrinderClassifyArtifactSchema,
  MetagrinderExtractArtifactSchema,
  MetagrinderIngestArtifactSchema,
  MetagrinderMutationArtifactSchema,
  MetagrinderMutationReviewArtifactSchema,
  MetagrinderReviewArtifactSchema,
  MetagrinderScoreArtifactSchema,
  MetagrinderSynthesizeArtifactSchema,
  ResearchPackageManifestSchema
} = require('../../types/metagrinder.runtime.js');

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

const CONTRADICTION_MARKERS = [
  'while others',
  'whereas',
  'in contrast',
  'but others',
  'however',
  'on the other hand'
];

const RESEARCH_HEADING_TAXONOMY = [
  {
    canonicalTag: 'source-notes',
    labels: ['source notes', 'sources', 'source material', 'source excerpts']
  },
  {
    canonicalTag: 'key-observations',
    labels: ['key observations', 'observations', 'findings', 'key findings']
  },
  {
    canonicalTag: 'reusable-concepts',
    labels: ['reusable concepts', 'concepts', 'concept candidates']
  },
  {
    canonicalTag: 'uncertainties',
    labels: ['uncertainties', 'uncertainties / contradictions', 'contradictions', 'open questions']
  },
  {
    canonicalTag: 'prompt-implications',
    labels: ['scene or prompt implications', 'prompt implications', 'scene implications']
  },
  {
    canonicalTag: 'unexpected-findings',
    labels: ['unexpected findings', 'stray discoveries', 'discoveries', 'anomalies']
  },
  {
    canonicalTag: 'wardrobe',
    labels: ['wardrobe notes', 'wardrobe', 'streetwear notes', 'costume notes']
  },
  {
    canonicalTag: 'atmosphere',
    labels: ['street atmosphere', 'atmosphere', 'lighting and atmosphere']
  }
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'research-input';
}

function deriveTitle(rawText, inputPath) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
  if (heading) {
    return heading.replace(/^#{1,6}\s+/, '').trim();
  }
  if (lines.length > 0) {
    return lines[0].slice(0, 96);
  }
  return path.basename(inputPath, path.extname(inputPath));
}

function deriveCombinedTitle(sourceInputs) {
  if (sourceInputs.length === 1) {
    return sourceInputs[0].title;
  }
  return `${sourceInputs[0].title} and ${sourceInputs.length - 1} more sources`;
}

function splitParagraphs(rawText) {
  return rawText
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function detectSectionLabel(paragraph) {
  const firstLine = paragraph.split('\n')[0].trim();
  if (/^#{1,6}\s+/.test(firstLine)) {
    return firstLine.replace(/^#{1,6}\s+/, '').trim();
  }
  if (/^[A-Z][A-Za-z0-9 /'(),-]{2,80}:$/.test(firstLine)) {
    return firstLine.replace(/:$/, '').trim();
  }
  return undefined;
}

function normalizeTaxonomyTag(sectionLabel) {
  if (!sectionLabel) {
    return undefined;
  }

  const normalized = sectionLabel.trim().toLowerCase();
  const match = RESEARCH_HEADING_TAXONOMY.find((entry) =>
    entry.labels.includes(normalized)
  );
  return match ? match.canonicalTag : undefined;
}

function normalizeChunkText(paragraph) {
  return paragraph
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function isHeadingOnlyParagraph(paragraph, sectionLabel) {
  const normalized = normalizeChunkText(paragraph)
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .trim();
  return Boolean(sectionLabel) && normalized === sectionLabel;
}

function buildChunksForSource({ rawText, sourceInputId }) {
  const paragraphs = splitParagraphs(rawText);
  let activeSectionLabel;
  const chunks = [];

  paragraphs.forEach((paragraph) => {
    const sectionLabel = detectSectionLabel(paragraph);
    if (sectionLabel) {
      activeSectionLabel = sectionLabel;
    }

    if (isHeadingOnlyParagraph(paragraph, sectionLabel)) {
      return;
    }

    chunks.push({
      chunkId: `${sourceInputId}_chunk_${String(chunks.length + 1).padStart(3, '0')}`,
      sourceInputId,
      text: normalizeChunkText(paragraph),
      sectionLabel: activeSectionLabel,
      sequence: chunks.length,
      tags: normalizeTaxonomyTag(activeSectionLabel)
        ? [normalizeTaxonomyTag(activeSectionLabel)]
        : []
    });
  });

  return chunks;
}

function buildIngestArtifact({ inputPath, rawText, inputId, title, createdAt }) {
  const sourceInputs = [
    {
      sourceInputId: inputId,
      title,
      sourceType: 'plain-text',
      path: inputPath,
      sequence: 0
    }
  ];
  const chunks = buildChunksForSource({
    rawText,
    sourceInputId: inputId
  });

  return MetagrinderIngestArtifactSchema.parse({
    inputId,
    title,
    sourceType: 'plain-text',
    createdAt,
    sourceInputs,
    chunks
  });
}

function buildMultiInputIngestArtifact({ sourceFiles, inputId, title, createdAt }) {
  const sourceInputs = sourceFiles.map((file, index) => ({
    sourceInputId: file.sourceInputId,
    title: file.title,
    sourceType: 'plain-text',
    path: file.path,
    sequence: index
  }));
  const chunks = sourceFiles.flatMap((file) =>
    buildChunksForSource({
      rawText: file.rawText,
      sourceInputId: file.sourceInputId
    })
  );

  return MetagrinderIngestArtifactSchema.parse({
    inputId,
    title,
    sourceType: 'plain-text',
    createdAt,
    sourceInputs,
    chunks
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function mergeUniqueStrings(values) {
  return [...new Set(values)];
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

    sentences.forEach((sentence, index) => {
      const category = classifySentenceCategory(sentence, chunk.sectionLabel, chunk.tags);
      const attributionMode = inferAttributionMode(sentence);
      const confidence = attributionMode === 'inferred' ? 'medium' : 'high';

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

function titleCaseBucketLabel(category) {
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildClassifyArtifact({ ingestArtifact, extractArtifact }) {
  const bucketsByCategory = new Map();

  extractArtifact.conceptCandidates.forEach((concept) => {
    const unresolved = concept.confidence !== 'high' || concept.attributionMode === 'inferred';
    const category = unresolved ? 'unresolved' : concept.category;

    if (!bucketsByCategory.has(category)) {
      bucketsByCategory.set(category, {
        bucketId: `${extractArtifact.inputId}_bucket_${category}`,
        label: titleCaseBucketLabel(category),
        category,
        conceptIds: [],
        claimIds: []
      });
    }

    bucketsByCategory.get(category).conceptIds.push(concept.conceptId);
  });

  extractArtifact.claims.forEach((claim) => {
    const unresolved = claim.confidence !== 'high' || claim.attributionMode === 'inferred';
    const category = unresolved ? 'unresolved' : claim.category;

    if (!bucketsByCategory.has(category)) {
      bucketsByCategory.set(category, {
        bucketId: `${extractArtifact.inputId}_bucket_${category}`,
        label: titleCaseBucketLabel(category),
        category,
        conceptIds: [],
        claimIds: []
      });
    }

    bucketsByCategory.get(category).claimIds.push(claim.claimId);
  });

  return MetagrinderClassifyArtifactSchema.parse({
    inputId: extractArtifact.inputId,
    collections: {
      sourceMapChunkIds: ingestArtifact.chunks.map((chunk) => chunk.chunkId),
      claimsAndEvidenceClaimIds: extractArtifact.claims.map((claim) => claim.claimId),
      conceptClusterBuckets: Array.from(bucketsByCategory.values())
    }
  });
}

function familyFromCategory(category) {
  if (category === 'wardrobe') {
    return 'wardrobe';
  }
  if (category === 'people-and-crowd' || category === 'behavior-and-motion') {
    return 'crowd-behavior';
  }
  if (category === 'lighting' || category === 'architecture-and-streetscape') {
    return 'lighting';
  }
  return 'atmosphere';
}

function dedupePromptFragments(fragments) {
  const seen = new Set();
  return fragments.filter((fragment) => {
    const key = `${fragment.family}:${fragment.text.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function fallbackFragmentText(family, title) {
  if (family === 'wardrobe') {
    return 'period outerwear and evening dress suited to the setting';
  }
  if (family === 'crowd-behavior') {
    return 'orderly pedestrian crowd movement around the venue';
  }
  if (family === 'lighting') {
    return 'localized signage and directional evening light';
  }
  return `ambient environmental conditions consistent with ${title.toLowerCase()}`;
}

function selectFallbackDerivedFragment({ family, extractArtifact }) {
  const directCategoryMatches = {
    atmosphere: ['weather-and-environment', 'materials-and-surfaces', 'mood-and-social-tone'],
    wardrobe: ['wardrobe'],
    'crowd-behavior': ['people-and-crowd', 'behavior-and-motion'],
    lighting: ['lighting', 'architecture-and-streetscape']
  };

  const preferredCategories = directCategoryMatches[family] || [];
  const concept = extractArtifact.conceptCandidates.find((candidate) =>
    preferredCategories.includes(candidate.category)
  );
  if (concept) {
    return {
      text: concept.label,
      conceptIds: [concept.conceptId],
      sourceInputIds: [...concept.sourceInputIds],
      sourceChunkIds: [...concept.sourceChunkIds]
    };
  }

  const claim = extractArtifact.claims.find((candidate) =>
    preferredCategories.includes(candidate.category)
  ) || extractArtifact.claims[0];
  if (claim) {
    return {
      text: claim.text.replace(/[.?!]$/, ''),
      conceptIds: [],
      sourceInputIds: [...claim.sourceInputIds],
      sourceChunkIds: [...claim.sourceChunkIds]
    };
  }

  const conceptFallback = extractArtifact.conceptCandidates[0];
  if (conceptFallback) {
    return {
      text: conceptFallback.label,
      conceptIds: [conceptFallback.conceptId],
      sourceInputIds: [...conceptFallback.sourceInputIds],
      sourceChunkIds: [...conceptFallback.sourceChunkIds]
    };
  }

  return {
    text: fallbackFragmentText(family, extractArtifact.inputId),
    conceptIds: [],
    sourceInputIds: [],
    sourceChunkIds: []
  };
}

function buildSynthesizeArtifact({ ingestArtifact, extractArtifact }) {
  const promptFragments = [];
  const familyCounts = {
    atmosphere: 0,
    wardrobe: 0,
    'crowd-behavior': 0,
    lighting: 0
  };

  extractArtifact.conceptCandidates.forEach((concept) => {
    const family = familyFromCategory(concept.category);
    const text = concept.label;
    promptFragments.push({
      fragmentId: `${extractArtifact.inputId}_fragment_${String(promptFragments.length + 1).padStart(3, '0')}`,
      family,
      text,
      conceptIds: [concept.conceptId],
      sourceInputIds: [...concept.sourceInputIds],
      sourceChunkIds: [...concept.sourceChunkIds]
    });
    familyCounts[family] += 1;
  });

  extractArtifact.claims.forEach((claim) => {
    const family = familyFromCategory(claim.category);
    if (familyCounts[family] >= 2) {
      return;
    }
    promptFragments.push({
      fragmentId: `${extractArtifact.inputId}_fragment_${String(promptFragments.length + 1).padStart(3, '0')}`,
      family,
      text: claim.text.replace(/[.?!]$/, ''),
      conceptIds: [],
      sourceInputIds: [...claim.sourceInputIds],
      sourceChunkIds: [...claim.sourceChunkIds]
    });
    familyCounts[family] += 1;
  });

  ['atmosphere', 'wardrobe', 'crowd-behavior', 'lighting'].forEach((family) => {
    if (familyCounts[family] === 0) {
      const fallbackFragment = selectFallbackDerivedFragment({
        family,
        extractArtifact
      });
      promptFragments.push({
        fragmentId: `${extractArtifact.inputId}_fragment_${String(promptFragments.length + 1).padStart(3, '0')}`,
        family,
        text: fallbackFragment.text,
        conceptIds: fallbackFragment.conceptIds,
        sourceInputIds: fallbackFragment.sourceInputIds,
        sourceChunkIds: fallbackFragment.sourceChunkIds
      });
    }
  });

  return MetagrinderSynthesizeArtifactSchema.parse({
    inputId: extractArtifact.inputId,
    promptFragments: dedupePromptFragments(promptFragments)
  });
}

function buildPromptSynthesisPsg({ ingestArtifact, synthesizeArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const families = ['atmosphere', 'wardrobe', 'crowd-behavior', 'lighting'];
  const familyNodes = families.map((family, index) => {
    const fragments = synthesizeArtifact.promptFragments.filter(
      (fragment) => fragment.family === family
    );

    return {
      id: `${family}-choice`,
      type: 'WeightedChoice',
      name: titleCaseBucketLabel(family),
      description: `Prompt family for ${family}`,
      x: 120,
      y: 120 + (index * 180),
      options: fragments.map((fragment) => ({
        text: fragment.text,
        weight: fragment.conceptIds.length > 0 ? 2 : 1,
        meta: {
          fragmentId: fragment.fragmentId,
          family: fragment.family,
          conceptIds: fragment.conceptIds,
          sourceInputIds: fragment.sourceInputIds,
          sourceChunkIds: fragment.sourceChunkIds
        }
      }))
    };
  });

  const concatNode = {
    id: 'prompt-compose',
    type: 'Concat',
    name: 'Prompt Compose',
    x: 520,
    y: 360,
    data: {
      separator: ', '
    }
  };

  const outputNode = {
    id: 'prompt-output',
    type: 'Output',
    name: 'Prompt Output',
    x: 860,
    y: 360,
    template: '{input}'
  };

  const edges = familyNodes.map((node, index) => ({
    id: `edge-${index + 1}`,
    source: node.id,
    target: concatNode.id,
    targetHandle: `input${index + 1}`
  }));

  edges.push({
    id: `edge-${edges.length + 1}`,
    source: concatNode.id,
    target: outputNode.id
  });

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Prompt Synthesis`,
    description: 'Metagrinder prompt synthesis fragment generated from classified research concepts.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'prompt-synthesis',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: [...familyNodes, concatNode, outputNode],
    edges
  };
}

function buildPromptMutationsPsg({ ingestArtifact, mutationArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const variantNodes = mutationArtifact.variants.map((variant, index) => ({
    id: variant.variantId,
    type: 'TextBlock',
    name: `Mutation Variant ${index + 1}`,
    description: `Distinctiveness ${variant.distinctivenessScore}`,
    x: 160,
    y: 120 + (index * 160),
    value: variant.text,
    data: {
      fragmentIds: variant.fragmentIds,
      families: variant.families,
      compatibilityDecisionIds: variant.compatibilityDecisionIds,
      conceptIds: variant.conceptIds,
      sourceInputIds: variant.sourceInputIds,
      sourceChunkIds: variant.sourceChunkIds,
      distinctivenessScore: variant.distinctivenessScore
    }
  }));

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Prompt Mutations`,
    description: 'Metagrinder prompt-mutation variants generated from compatible prompt fragments.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'prompt-mutations',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: variantNodes,
    edges: [],
    regions: [
      {
        id: `${ingestArtifact.inputId}_prompt_mutations_region`,
        name: 'Prompt Mutations',
        nodes: variantNodes.map((node) => node.id)
      }
    ]
  };
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

function buildScoreArtifact({ ingestArtifact, extractArtifact, synthesizeArtifact }) {
  const inferredClaimCount = extractArtifact.claims.filter(
    (claim) => claim.attributionMode === 'inferred'
  ).length;
  const contradictionCount = extractArtifact.claims.filter((claim) =>
    CONTRADICTION_MARKERS.some((marker) => claim.text.toLowerCase().includes(marker))
  ).length;
  const nearDuplicateWarningCount = extractArtifact.warnings.filter(
    (warning) => warning.code === 'near-duplicate-concept'
  ).length;
  const provenanceCoverage = extractArtifact.evidence.length >= ingestArtifact.chunks.length;
  const corroboratedConceptIds = extractArtifact.conceptCandidates
    .filter((concept) => new Set(concept.sourceInputIds).size > 1)
    .map((concept) => concept.conceptId);
  const disputedConceptIds = extractArtifact.conceptCandidates
    .filter((concept) =>
      concept.summary.includes('|') &&
      (
        concept.attributionMode === 'inferred' ||
        concept.confidence !== 'high'
      )
    )
    .map((concept) => concept.conceptId);
  let extractionConfidence = inferredClaimCount === 0
    ? 'high'
    : inferredClaimCount <= 3
      ? 'medium'
      : 'low';
  let normalizationConfidence = extractArtifact.conceptCandidates.some(
    (concept) => concept.confidence !== 'high'
  ) ? 'medium' : 'high';

  if (corroboratedConceptIds.length >= 1 && extractionConfidence === 'medium') {
    extractionConfidence = 'high';
  }
  if (corroboratedConceptIds.length >= 2 && normalizationConfidence === 'medium') {
    normalizationConfidence = 'high';
  }
  if (disputedConceptIds.length >= 2 && normalizationConfidence === 'high') {
    normalizationConfidence = 'medium';
  }
  if (contradictionCount > 0) {
    extractionConfidence = extractionConfidence === 'high' ? 'medium' : 'low';
    normalizationConfidence = normalizationConfidence === 'high' ? 'medium' : 'low';
  }
  if (nearDuplicateWarningCount > 0 && normalizationConfidence === 'high') {
    normalizationConfidence = 'medium';
  }

  const overall = synthesizeArtifact.promptFragments.length >= 4 && provenanceCoverage
    ? extractionConfidence === 'high' && normalizationConfidence === 'high'
      ? 'high'
      : 'medium'
    : 'low';

  return MetagrinderScoreArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    corroboratedConceptIds,
    disputedConceptIds,
    confidenceSummary: {
      overall,
      extraction: extractionConfidence,
      normalization: normalizationConfidence,
      provenance: provenanceCoverage ? 'high' : 'medium',
      rights: 'low'
    },
    ambiguityFlags: [
      ...extractArtifact.openQuestions.map((question) => question.questionId),
      ...extractArtifact.claims
        .filter((claim) =>
          CONTRADICTION_MARKERS.some((marker) => claim.text.toLowerCase().includes(marker))
        )
        .map((claim) => claim.claimId),
      ...extractArtifact.warnings
        .filter((warning) => warning.code === 'near-duplicate-concept')
        .map((warning, index) => `${warning.code}_${index + 1}`)
    ]
  });
}

function buildReviewArtifact({ ingestArtifact, extractArtifact, synthesizeArtifact, scoreArtifact }) {
  const missingProvenance = extractArtifact.claims
    .filter((claim) => !Array.isArray(claim.sourceChunkIds) || claim.sourceChunkIds.length === 0)
    .map((claim) => claim.claimId);
  const weakConceptIds = extractArtifact.conceptCandidates
    .filter((concept) => concept.confidence !== 'high')
    .map((concept) => concept.conceptId);
  const corroboratedConceptIds = [...scoreArtifact.corroboratedConceptIds];
  const overlapWarnings = [
    ...extractArtifact.warnings
      .filter((warning) => warning.code === 'near-duplicate-concept')
      .map((warning) => warning.message),
    ...extractArtifact.conceptCandidates
    .filter((concept) =>
      new Set(concept.sourceInputIds).size > 1 &&
      (
        concept.summary.includes('|') ||
        concept.confidence !== 'high'
      )
    )
    .map((concept) => `Merged concept ${concept.label} spans ${new Set(concept.sourceInputIds).size} sources and should be reviewed for over-merge risk.`)
  ];
  const contradictionFlags = extractArtifact.claims
    .filter((claim) =>
      CONTRADICTION_MARKERS.some((marker) => claim.text.toLowerCase().includes(marker))
    )
    .map((claim) => `Potential contradiction in ${claim.claimId}: ${claim.text}`);
  const recommendedActions = [];

  if (extractArtifact.openQuestions.length > 0) {
    recommendedActions.push('Review inferred claims and decide which should remain unresolved versus promoted into stable concept buckets.');
  }
  if (weakConceptIds.length > 0) {
    recommendedActions.push('Tighten weak concept labels or attach stronger source evidence before wider reuse.');
  }
  if (synthesizeArtifact.promptFragments.length < 4) {
    recommendedActions.push('Add more prompt fragments so each required prompt family has usable variation.');
  }
  if (scoreArtifact.confidenceSummary.extraction !== 'high') {
    recommendedActions.push('Improve extraction heuristics or source quality to raise extraction confidence.');
  }
  if (new Set(extractArtifact.claims.flatMap((claim) => claim.sourceInputIds)).size > 1) {
    recommendedActions.push('Inspect repeated concepts across source documents before enabling automatic corroboration or merge logic.');
  }
  if (scoreArtifact.corroboratedConceptIds.length > 0) {
    recommendedActions.push('Review corroborated concepts as candidate stable scene heuristics for stronger downstream synthesis.');
  }
  if (scoreArtifact.disputedConceptIds.length > 0) {
    recommendedActions.push('Inspect merged concepts with differing summaries to decide whether they are true corroborations or near-duplicates.');
  }
  if (contradictionFlags.length > 0) {
    recommendedActions.push('Inspect contradiction flags before promoting cross-document concepts into high-confidence heuristics.');
  }
  if (overlapWarnings.length > 0) {
    recommendedActions.push('Review overlap warnings to decide whether broad merged concepts should be split into narrower concepts.');
  }

  return MetagrinderReviewArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    unresolvedAmbiguities: extractArtifact.openQuestions.map((question) => question.text),
    corroboratedConceptIds,
    overlapWarnings,
    contradictionFlags,
    missingProvenance,
    weakConceptIds,
    recommendedActions
  });
}

function buildSourceMapPsg({ ingestArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const sectionLabels = [...new Set(
    ingestArtifact.chunks
      .map((chunk) => chunk.sectionLabel)
      .filter(Boolean)
  )];

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Source Map`,
    description: 'Metagrinder source-map fragment preserving chunked source coverage.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'source-map',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: ingestArtifact.chunks.map((chunk, index) => ({
      id: chunk.chunkId,
      type: 'TextBlock',
      name: `Source Chunk ${index + 1}`,
      description: chunk.sectionLabel,
      x: 120,
      y: 120 + (index * 160),
      value: chunk.text,
      data: {
        sourceInputId: chunk.sourceInputId,
        sectionLabel: chunk.sectionLabel,
        sequence: chunk.sequence,
        tags: chunk.tags
      }
    })),
    edges: [],
    regions: sectionLabels.map((label) => ({
      id: `${ingestArtifact.inputId}_${slugify(label)}_region`,
      name: label,
      nodes: ingestArtifact.chunks
        .filter((chunk) => chunk.sectionLabel === label)
        .map((chunk) => chunk.chunkId)
    }))
  };
}

function buildConceptClustersPsg({ ingestArtifact, extractArtifact, classifyArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const conceptMap = new Map(
    extractArtifact.conceptCandidates.map((concept) => [concept.conceptId, concept])
  );
  const bucketNodes = [];
  const edges = [];

  classifyArtifact.collections.conceptClusterBuckets.forEach((bucket, bucketIndex) => {
    bucket.conceptIds.forEach((conceptId, conceptIndex) => {
      const concept = conceptMap.get(conceptId);
      if (!concept) {
        return;
      }

      const nodeId = `${bucket.bucketId}_concept_${String(conceptIndex + 1).padStart(3, '0')}`;
      bucketNodes.push({
        id: nodeId,
        type: 'TextBlock',
        name: concept.label,
        description: concept.summary,
        x: 160 + (bucketIndex * 260),
        y: 120 + (conceptIndex * 150),
        value: concept.label,
        data: {
          conceptId: concept.conceptId,
          category: concept.category,
          confidence: concept.confidence,
          sourceInputIds: concept.sourceInputIds,
          sourceChunkIds: concept.sourceChunkIds,
          attributionMode: concept.attributionMode
        }
      });

      if (conceptIndex > 0) {
        edges.push({
          id: `${bucket.bucketId}_edge_${conceptIndex}`,
          source: `${bucket.bucketId}_concept_${String(conceptIndex).padStart(3, '0')}`,
          target: nodeId
        });
      }
    });
  });

  return {
    version: '1.0.0',
    name: `${ingestArtifact.title} Concept Clusters`,
    description: 'Metagrinder concept-clusters fragment grouped into reusable scene categories.',
    metadata: {
      packageId: `${ingestArtifact.inputId}_research_package`,
      collectionType: 'concept-clusters',
      sourceInputIds,
      lineage: {
        sourceInputIds
      }
    },
    nodes: bucketNodes,
    edges,
    regions: classifyArtifact.collections.conceptClusterBuckets.map((bucket) => ({
      id: `${bucket.bucketId}_region`,
      name: bucket.label,
      nodes: bucket.conceptIds.map((_, index) =>
        `${bucket.bucketId}_concept_${String(index + 1).padStart(3, '0')}`
      ),
      metadata: {
        category: bucket.category,
        claimIds: bucket.claimIds
      }
    }))
  };
}

function buildResearchPackageManifest({ ingestArtifact, scoreArtifact, mutationArtifact }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const collections = [
    { id: 'col_source', type: 'source-map', path: 'source-map.psg' },
    { id: 'col_concepts', type: 'concept-clusters', path: 'concept-clusters.psg' },
    { id: 'col_synthesis', type: 'prompt-synthesis', path: 'prompt-synthesis.psg' },
    {
      id: 'col_mutations',
      type: 'prompt-mutations',
      path: 'prompt-mutations.psg'
    }
  ];
  const hasMutationSupport = Boolean(mutationArtifact);
  const strategyVersion = hasMutationSupport
    ? 'epic3-story4'
    : ingestArtifact.sourceInputs.length > 1
      ? 'epic2-story6'
      : 'epic1-story5';

  return ResearchPackageManifestSchema.parse({
    packageId: `${ingestArtifact.inputId}_research_package`,
    packageType: 'research-package',
    title: ingestArtifact.title,
    createdAt: ingestArtifact.createdAt,
    parserVersion: '0.1.0',
    strategyVersion,
    contributorId: 'local-metagrinder-mvp',
    sourceInputs: sourceInputIds,
    sourceInputIds: sourceInputIds,
    collections,
    lineage: {
      sourceInputIds
    },
    confidenceSummary: scoreArtifact.confidenceSummary,
    reviewStatus: 'draft'
  });
}

function validatePsgFile(psgFile, fileLabel) {
  if (!psgFile || typeof psgFile !== 'object') {
    throw new Error(`${fileLabel} must be an object.`);
  }
  if (typeof psgFile.version !== 'string' || psgFile.version.length === 0) {
    throw new Error(`${fileLabel} is missing a string version.`);
  }
  if (typeof psgFile.name !== 'string' || psgFile.name.length === 0) {
    throw new Error(`${fileLabel} is missing a name.`);
  }
  if (!Array.isArray(psgFile.nodes) || !Array.isArray(psgFile.edges)) {
    throw new Error(`${fileLabel} must contain nodes and edges arrays.`);
  }
  psgFile.nodes.forEach((node, index) => {
    if (typeof node.id !== 'string' || typeof node.type !== 'string') {
      throw new Error(`${fileLabel} node ${index} is missing id or type.`);
    }
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      throw new Error(`${fileLabel} node ${node.id} is missing coordinates.`);
    }
  });
  psgFile.edges.forEach((edge, index) => {
    if (
      typeof edge.id !== 'string' ||
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string'
    ) {
      throw new Error(`${fileLabel} edge ${index} is missing required fields.`);
    }
  });
}

function validatePackageArtifacts({
  ingestArtifact,
  extractArtifact,
  classifyArtifact,
  synthesizeArtifact,
  mutationArtifact,
  mutationReviewArtifact,
  scoreArtifact,
  reviewArtifact,
  sourceMapPsg,
  conceptClustersPsg,
  promptSynthesisPsg,
  promptMutationsPsg,
  researchPackageManifest
}) {
  MetagrinderIngestArtifactSchema.parse(ingestArtifact);
  MetagrinderExtractArtifactSchema.parse(extractArtifact);
  MetagrinderClassifyArtifactSchema.parse(classifyArtifact);
  MetagrinderSynthesizeArtifactSchema.parse(synthesizeArtifact);
  if (mutationArtifact) {
    MetagrinderMutationArtifactSchema.parse(mutationArtifact);
  }
  if (mutationReviewArtifact) {
    MetagrinderMutationReviewArtifactSchema.parse(mutationReviewArtifact);
  }
  MetagrinderScoreArtifactSchema.parse(scoreArtifact);
  MetagrinderReviewArtifactSchema.parse(reviewArtifact);
  ResearchPackageManifestSchema.parse(researchPackageManifest);
  validatePsgFile(sourceMapPsg, 'source-map.psg');
  validatePsgFile(conceptClustersPsg, 'concept-clusters.psg');
  validatePsgFile(promptSynthesisPsg, 'prompt-synthesis.psg');
  if (promptMutationsPsg) {
    validatePsgFile(promptMutationsPsg, 'prompt-mutations.psg');
  }
}

function resolveInputPath(inputPath) {
  const candidateInputPaths = [
    path.resolve(inputPath),
    path.resolve(__dirname, '..', '..', '..', '..', inputPath)
  ];
  return candidateInputPaths.find((candidatePath) => fs.existsSync(candidatePath));
}

function runMetagrinderMvp({ inputPath, inputPaths, outputDir, title }) {
  const requestedInputPaths = inputPaths && inputPaths.length > 0
    ? inputPaths
    : [inputPath];
  const resolvedInputPaths = requestedInputPaths.map((candidate) => ({
    requested: candidate,
    resolved: resolveInputPath(candidate)
  }));
  const resolvedOutputDir = path.resolve(outputDir);

  const missing = resolvedInputPaths.find((entry) => !entry.resolved);
  if (missing) {
    throw new Error(`Missing input file: ${missing.requested}`);
  }

  const sourceFiles = resolvedInputPaths.map((entry, index) => {
    const rawText = fs.readFileSync(entry.resolved, 'utf8');
    const sourceTitle = deriveTitle(rawText, entry.resolved);
    const sourceInputId = slugify(
      path.basename(entry.resolved, path.extname(entry.resolved))
    );
    return {
      path: entry.resolved,
      rawText,
      title: sourceTitle,
      sourceInputId,
      sequence: index
    };
  });
  const derivedTitle = title || deriveCombinedTitle(sourceFiles);
  const inputId = requestedInputPaths.length === 1
    ? sourceFiles[0].sourceInputId
    : `multi-${slugify(sourceFiles[0].sourceInputId)}`;
  const createdAt = new Date().toISOString();

  const ingestArtifact = sourceFiles.length === 1
    ? buildIngestArtifact({
        inputPath: sourceFiles[0].path,
        rawText: sourceFiles[0].rawText,
        inputId,
        title: derivedTitle,
        createdAt
      })
    : buildMultiInputIngestArtifact({
        sourceFiles,
        inputId,
        title: derivedTitle,
        createdAt
      });
  const extractArtifact = buildExtractArtifact({
    ingestArtifact
  });
  const classifyArtifact = buildClassifyArtifact({
    ingestArtifact,
    extractArtifact
  });
  const synthesizeArtifact = buildSynthesizeArtifact({
    ingestArtifact,
    extractArtifact
  });
  const mutationArtifact = buildMutationArtifact({
    synthesizeArtifact
  });
  const mutationReviewArtifact = buildMutationReviewArtifact({
    mutationArtifact
  });
  const scoreArtifact = buildScoreArtifact({
    ingestArtifact,
    extractArtifact,
    synthesizeArtifact
  });
  const reviewArtifact = buildReviewArtifact({
    ingestArtifact,
    extractArtifact,
    synthesizeArtifact,
    scoreArtifact
  });
  const sourceMapPsg = buildSourceMapPsg({
    ingestArtifact
  });
  const conceptClustersPsg = buildConceptClustersPsg({
    ingestArtifact,
    extractArtifact,
    classifyArtifact
  });
  const promptSynthesisPsg = buildPromptSynthesisPsg({
    ingestArtifact,
    synthesizeArtifact
  });
  const promptMutationsPsg = buildPromptMutationsPsg({
    ingestArtifact,
    mutationArtifact
  });
  const researchPackageManifest = buildResearchPackageManifest({
    ingestArtifact,
    scoreArtifact,
    mutationArtifact
  });

  validatePackageArtifacts({
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    mutationArtifact,
    mutationReviewArtifact,
    scoreArtifact,
    reviewArtifact,
    sourceMapPsg,
    conceptClustersPsg,
    promptSynthesisPsg,
    promptMutationsPsg,
    researchPackageManifest
  });

  ensureDir(resolvedOutputDir);
  writeJson(path.join(resolvedOutputDir, 'ingest.json'), ingestArtifact);
  writeJson(path.join(resolvedOutputDir, 'extract.json'), extractArtifact);
  writeJson(path.join(resolvedOutputDir, 'classify.json'), classifyArtifact);
  writeJson(path.join(resolvedOutputDir, 'synthesize.json'), synthesizeArtifact);
  writeJson(path.join(resolvedOutputDir, 'mutate.json'), mutationArtifact);
  writeJson(path.join(resolvedOutputDir, 'mutation-review.json'), mutationReviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'score.json'), scoreArtifact);
  writeJson(path.join(resolvedOutputDir, 'review.json'), reviewArtifact);
  writeJson(path.join(resolvedOutputDir, 'source-map.psg'), sourceMapPsg);
  writeJson(path.join(resolvedOutputDir, 'concept-clusters.psg'), conceptClustersPsg);
  writeJson(path.join(resolvedOutputDir, 'prompt-synthesis.psg'), promptSynthesisPsg);
  writeJson(path.join(resolvedOutputDir, 'prompt-mutations.psg'), promptMutationsPsg);
  writeJson(path.join(resolvedOutputDir, 'research-package.json'), researchPackageManifest);

  return {
    inputPath: sourceFiles[0].path,
    inputPaths: sourceFiles.map((file) => file.path),
    outputDir: resolvedOutputDir,
    ingestArtifact,
    extractArtifact,
    classifyArtifact,
    synthesizeArtifact,
    mutationArtifact,
    mutationReviewArtifact,
    scoreArtifact,
    reviewArtifact,
    sourceMapPsg,
    conceptClustersPsg,
    promptSynthesisPsg,
    promptMutationsPsg,
    researchPackageManifest
  };
}

module.exports = {
  buildClassifyArtifact,
  buildConceptClustersPsg,
  buildExtractArtifact,
  buildIngestArtifact,
  buildMutationArtifact,
  buildMutationReviewArtifact,
  buildMultiInputIngestArtifact,
  buildPromptMutationsPsg,
  buildPromptSynthesisPsg,
  buildResearchPackageManifest,
  buildReviewArtifact,
  buildScoreArtifact,
  buildSourceMapPsg,
  buildSynthesizeArtifact,
  deriveTitle,
  runMetagrinderMvp
};

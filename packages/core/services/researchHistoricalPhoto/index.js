const {
  MetagrinderColorHypothesisArtifactSchema,
  MetagrinderHistoricalPhotoObservationArtifactSchema,
  MetagrinderHistoricalPhotoObservationSchema,
  MetagrinderIngestArtifactSchema,
  MetagrinderResearchGapArtifactSchema,
  MetagrinderSamplePromptsArtifactSchema,
  ResearchPackageManifestSchema,
  UtdgCandidatesFileSchema
} = require('../../types/metagrinder.runtime.js');

const CANONICAL_STATUSES = new Set(['approved', 'merged']);
const VALID_RIGHTS_PROFILES = new Set([
  'unknown',
  'public-domain',
  'unrestricted',
  'attribution-required',
  'non-commercial',
  'reference-only',
  'restricted'
]);

function toSafeId(value) {
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'item';
}

function confidenceFrom(value, fallback = 'medium') {
  return ['low', 'medium', 'high'].includes(value) ? value : fallback;
}

function sourceInputIdFor(photo) {
  return `photo_${toSafeId(photo.recordId)}`;
}

function textFrom(value) {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function buildObservationSummary(photo) {
  const source = photo.source;
  return [
    `${photo.recordId}: ${source.caption || source.sourceId}`,
    `mode=${source.imageMode}`,
    `event=${source.event}`,
    `rights=${source.rightsBoundary}`,
    `observed=${textFrom(photo.observed)}`,
    `unknown=${textFrom(photo.unknown)}`
  ].join('\n');
}

function buildColorSummary(photo) {
  return [
    `${photo.recordId} color hypothesis`,
    `imageMode=${photo.source.imageMode}`,
    `hypotheses=${textFrom(photo.colorHypothesis.colorHypotheses)}`,
    `generationPalette=${textFrom(photo.colorHypothesis.generationPalette)}`,
    `evidenceBoundary=${photo.colorHypothesis.evidenceBoundary.join(' ')}`
  ].join('\n');
}

function buildGenerationSummary(photo) {
  return [
    `${photo.recordId} generated candidate use`,
    `allowed=${photo.generatedCandidateUse.allowed.join(', ')}`,
    `notAllowed=${photo.generatedCandidateUse.notAllowed.join(', ')}`,
    `routes=${textFrom(photo.generatedCandidateUse.recipeRoutes)}`
  ].join('\n');
}

function buildHistoricalPhotoIngestArtifact({ photos, inputId, title, createdAt }) {
  const sourceInputs = photos.map((photo, index) => ({
    sourceInputId: sourceInputIdFor(photo),
    title: photo.source.caption || photo.recordId,
    sourceType: 'photo-reference',
    path: photo.source.sourcePath,
    sequence: index
  }));

  const chunks = [];
  photos.forEach((photo, photoIndex) => {
    const sourceInputId = sourceInputIdFor(photo);
    chunks.push({
      chunkId: `${sourceInputId}_observation`,
      sourceInputId,
      text: buildObservationSummary(photo),
      sectionLabel: 'Photo Observation',
      chunkKind: 'photo-observation',
      sequence: photoIndex * 3,
      tags: [photo.source.imageMode, 'historical-photo', 'wardrobe']
    });
    chunks.push({
      chunkId: `${sourceInputId}_color_hypothesis`,
      sourceInputId,
      text: buildColorSummary(photo),
      sectionLabel: 'Color Hypothesis',
      chunkKind: 'color-hypothesis',
      sequence: (photoIndex * 3) + 1,
      tags: [photo.source.imageMode, 'color-hypothesis']
    });
    chunks.push({
      chunkId: `${sourceInputId}_generation_palette`,
      sourceInputId,
      text: buildGenerationSummary(photo),
      sectionLabel: 'Synthetic Generation Gate',
      chunkKind: 'generation-palette',
      sequence: (photoIndex * 3) + 2,
      tags: ['generation-palette', 'not-source-evidence']
    });
  });

  return MetagrinderIngestArtifactSchema.parse({
    inputId,
    title,
    sourceType: 'photo-reference',
    researchKind: 'historical-scene-research',
    createdAt,
    sourceInputs,
    chunks
  });
}

function buildPhotoObservationArtifact({ photos, inputId, packageId }) {
  return MetagrinderHistoricalPhotoObservationArtifactSchema.parse({
    inputId,
    packageId,
    photos
  });
}

function buildColorHypothesisArtifact({ photos, inputId, packageId }) {
  return MetagrinderColorHypothesisArtifactSchema.parse({
    inputId,
    packageId,
    records: photos.map((photo) => ({
      recordId: photo.recordId,
      sourceInputId: sourceInputIdFor(photo),
      imageMode: photo.source.imageMode,
      colorHypothesis: photo.colorHypothesis
    }))
  });
}

function researchNeedToGap({ photo, need, index, sourceInputId, color }) {
  const question = need.question || `Review ${photo.recordId} research need ${index + 1}`;
  const suggestedSources = Array.isArray(need.suggestedSources) ? need.suggestedSources : [];
  return {
    gapId: `${color ? 'gap_color' : 'gap_photo'}_${toSafeId(photo.recordId)}_${String(index + 1).padStart(2, '0')}`,
    gapType: color ? 'visual-reference-without-support' : 'sampling-risk',
    severity: color && photo.source.imageMode !== 'color_photo' ? 'high' : 'medium',
    affectedGrammarRefs: [photo.recordId],
    question,
    currentSupport: [`sourceInput:${sourceInputId}`],
    missingSupport: suggestedSources.length > 0 ? suggestedSources : ['external archive or catalog citation'],
    recommendedSearches: suggestedSources.map((source) => `${question} ${source}`),
    reviewStatus: 'needs_research'
  };
}

function buildResearchGapArtifact({ photos, inputId }) {
  const gaps = [];
  photos.forEach((photo) => {
    const sourceInputId = sourceInputIdFor(photo);
    (photo.inferred.researchNeeds || []).forEach((need, index) => {
      gaps.push(researchNeedToGap({ photo, need, index, sourceInputId, color: false }));
    });
    (photo.colorHypothesis.researchNeeds || []).forEach((need, index) => {
      gaps.push(researchNeedToGap({ photo, need, index, sourceInputId, color: true }));
    });
  });
  return MetagrinderResearchGapArtifactSchema.parse({ inputId, gaps });
}

function buildSamplePromptsArtifact({ photos, inputId }) {
  const samples = [];
  photos.forEach((photo) => {
    const sourceInputId = sourceInputIdFor(photo);
    photo.generatedCandidateUse.recipeRoutes.forEach((route, index) => {
      const palette = photo.colorHypothesis.generationPalette[index] || photo.colorHypothesis.generationPalette[0];
      samples.push({
        sampleId: `sample_${toSafeId(route.routeId)}`,
        sampleMode: 'archetype',
        selectedArchetypeIds: photo.downstream.utdgCandidates.map((candidate) => candidate.candidateId).filter(Boolean),
        generatedPrompt: [
          route.purpose,
          palette ? `Palette guidance: ${palette.palette.join(', ')}.` : '',
          `Guardrail: ${route.evidenceGuardrail}`
        ].filter(Boolean).join(' '),
        grammarRefs: [photo.recordId],
        sourceChunkIds: [`${sourceInputId}_observation`, `${sourceInputId}_color_hypothesis`]
      });
    });
  });
  return MetagrinderSamplePromptsArtifactSchema.parse({ inputId, samples });
}

function normalizeRightsProfile(value) {
  return VALID_RIGHTS_PROFILES.has(value) ? value : 'reference-only';
}

function normalizePacketCandidate({ photo, candidate }) {
  if (CANONICAL_STATUSES.has(candidate.reviewStatus)) {
    throw new Error(`${candidate.candidateId} has canonical review status ${candidate.reviewStatus}.`);
  }
  return {
    candidateId: candidate.candidateId,
    entityType: candidate.entityType,
    label: candidate.label,
    summary: `${candidate.label} from ${photo.recordId}; evidence basis ${candidate.evidenceBasis || 'observed'}.`,
    sourceRefs: candidate.sourceRefs || [photo.source.sourcePath],
    evidenceRefs: [photo.recordId],
    proposedRightsProfile: normalizeRightsProfile(candidate.rightsProfile),
    sourceRights: photo.source.rightsBoundary,
    contributionTerms: 'staged-photo-observation-review',
    rightsConfidence: confidenceFrom(photo.source.sourceConfidence, 'medium'),
    commercialAllowed: false,
    normalization: {
      conceptType: candidate.entityType
    },
    confidence: {
      extraction: confidenceFrom(candidate.confidence),
      normalization: 'medium'
    },
    reviewStatus: candidate.reviewStatus || 'staged'
  };
}

function colorHypothesisToCandidate({ photo, hypothesis, index }) {
  if (photo.source.imageMode !== 'color_photo' && hypothesis.confidence === 'high' && (!hypothesis.externalSourceRefs || hypothesis.externalSourceRefs.length === 0)) {
    throw new Error(`${photo.recordId} has high-confidence B&W color hypothesis without external source refs.`);
  }
  return {
    candidateId: `color_${toSafeId(photo.recordId)}_${String(index + 1).padStart(2, '0')}`,
    entityType: 'ColorHypothesis',
    label: `${photo.recordId} ${hypothesis.target} color hypothesis`,
    summary: `${hypothesis.candidateColors.join(', ')}. Not evidence for: ${hypothesis.notEvidenceFor.join(', ')}.`,
    sourceRefs: [photo.source.sourcePath],
    evidenceRefs: [photo.recordId],
    proposedRightsProfile: 'reference-only',
    sourceRights: photo.source.rightsBoundary,
    contributionTerms: 'staged-color-hypothesis-review',
    rightsConfidence: confidenceFrom(photo.source.sourceConfidence, 'medium'),
    commercialAllowed: false,
    normalization: {
      conceptType: 'color-hypothesis'
    },
    confidence: {
      extraction: hypothesis.confidence,
      normalization: 'low'
    },
    reviewStatus: 'staged'
  };
}

function buildUtdgCandidatesFile({ photos, packageId }) {
  const candidates = [];
  photos.forEach((photo) => {
    photo.downstream.utdgCandidates.forEach((candidate) => {
      candidates.push(normalizePacketCandidate({ photo, candidate }));
    });
    photo.colorHypothesis.colorHypotheses.forEach((hypothesis, index) => {
      candidates.push(colorHypothesisToCandidate({ photo, hypothesis, index }));
    });
  });
  return UtdgCandidatesFileSchema.parse({
    submissionId: `${packageId}_utdg_candidates`,
    derivedFromPackageId: packageId,
    candidates
  });
}

function buildResearchPackageManifest({ ingestArtifact, packageId, title, createdAt }) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  return ResearchPackageManifestSchema.parse({
    packageId,
    packageType: 'research-package',
    title,
    createdAt,
    parserVersion: '0.1.0',
    strategyVersion: 'historical-photo-observation-v0',
    contributorId: 'local-metagrinder-historical-photo',
    sourceInputs: sourceInputIds,
    sourceInputIds,
    collections: [
      { id: 'col_photo_observations', type: 'photo-observations', path: 'photo-observations.json' },
      { id: 'col_color_hypotheses', type: 'color-hypotheses', path: 'color-hypotheses.json' },
      { id: 'col_research_gaps', type: 'research-gaps', path: 'research-gaps.json' },
      { id: 'col_sample_prompts', type: 'sample-prompts', path: 'sample-prompts.json' }
    ],
    lineage: {
      sourceInputIds
    },
    confidenceSummary: {
      overall: 'medium',
      extraction: 'medium',
      normalization: 'medium',
      provenance: 'medium',
      rights: 'low'
    },
    reviewStatus: 'draft'
  });
}

function buildHistoricalPhotoResearchPackageArtifacts({ photos, inputId = 'historical_photo_observations', title = 'Historical Photo Observations', createdAt = '2026-06-07T00:00:00.000Z' }) {
  const parsedPhotos = photos.map((photo) => MetagrinderHistoricalPhotoObservationSchema.parse(photo));
  const packageId = `${inputId}_research_package`;
  const ingestArtifact = buildHistoricalPhotoIngestArtifact({ photos: parsedPhotos, inputId, title, createdAt });
  const photoObservationArtifact = buildPhotoObservationArtifact({ photos: parsedPhotos, inputId, packageId });
  const colorHypothesisArtifact = buildColorHypothesisArtifact({ photos: parsedPhotos, inputId, packageId });
  const researchGapArtifact = buildResearchGapArtifact({ photos: parsedPhotos, inputId });
  const samplePromptsArtifact = buildSamplePromptsArtifact({ photos: parsedPhotos, inputId });
  const utdgCandidatesFile = buildUtdgCandidatesFile({ photos: parsedPhotos, packageId });
  const researchPackageManifest = buildResearchPackageManifest({ ingestArtifact, packageId, title, createdAt });

  return {
    ingestArtifact,
    photoObservationArtifact,
    colorHypothesisArtifact,
    researchGapArtifact,
    samplePromptsArtifact,
    utdgCandidatesFile,
    researchPackageManifest
  };
}

module.exports = {
  buildHistoricalPhotoResearchPackageArtifacts
};

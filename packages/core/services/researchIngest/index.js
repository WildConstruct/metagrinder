const path = require('path');

const {
  MetagrinderIngestArtifactSchema
} = require('../../types/metagrinder.runtime.js');

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

function mergeUniqueStrings(values) {
  return [...new Set(values)];
}

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
  if (/^[IVXLC]+\.\s+[A-Z]/.test(firstLine)) {
    return firstLine.trim();
  }
  if (/^[A-Z]\.\s+The\s+/.test(firstLine)) {
    return firstLine.trim();
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
  const match = RESEARCH_HEADING_TAXONOMY.find((entry) => entry.labels.includes(normalized));
  return match ? match.canonicalTag : undefined;
}

function normalizeChunkText(paragraph) {
  return paragraph
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
}

function detectChunkKind({ paragraph, sectionLabel, tags }) {
  const normalizedParagraph = paragraph.toLowerCase();
  const normalizedSection = (sectionLabel || '').toLowerCase();

  if (tags.includes('source-notes')) {
    return 'source-note';
  }
  if (tags.includes('reusable-concepts')) {
    return 'concept-list';
  }
  if (tags.includes('uncertainties')) {
    return 'uncertainty';
  }
  if (
    tags.includes('prompt-implications') ||
    normalizedSection.includes('assembly logic') ||
    normalizedParagraph.includes('probability weighting') ||
    normalizedParagraph.includes('conditional logic') ||
    normalizedParagraph.includes('contradiction avoidance') ||
    normalizedParagraph.includes(' if ') ||
    normalizedParagraph.startsWith('if ')
  ) {
    return 'generation-rule';
  }
  if (
    normalizedSection.includes('template') ||
    normalizedParagraph.includes('template example') ||
    normalizedParagraph.includes('description 1:')
  ) {
    return 'template';
  }
  if (normalizedParagraph.includes('table 1:') || normalizedParagraph.includes('core traits & correlations')) {
    return 'reference-table';
  }
  if (tags.includes('unexpected-findings') || tags.includes('key-observations')) {
    return 'observation';
  }
  return 'observation';
}

function isHeadingOnlyParagraph(paragraph, sectionLabel) {
  const normalized = normalizeChunkText(paragraph)
    .replace(/^#+\s*/, '')
    .replace(/:$/, '')
    .trim();
  return Boolean(sectionLabel) && normalized === sectionLabel;
}

function buildChunksForSource({ rawText, sourceInputId, preparseResearchBrief }) {
  const preparsed = preparseResearchBrief(rawText);
  const paragraphs = splitParagraphs(preparsed.normalizedText);
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
      chunkKind: detectChunkKind({
        paragraph,
        sectionLabel: activeSectionLabel,
        tags: mergeUniqueStrings([
          ...(normalizeTaxonomyTag(activeSectionLabel)
            ? [normalizeTaxonomyTag(activeSectionLabel)]
            : []),
          ...preparsed.diagnostics
        ])
      }),
      sequence: chunks.length,
      tags: mergeUniqueStrings([
        ...(normalizeTaxonomyTag(activeSectionLabel)
          ? [normalizeTaxonomyTag(activeSectionLabel)]
          : []),
        ...preparsed.diagnostics
      ])
    });
  });

  return chunks;
}

function buildIngestArtifact({
  inputPath,
  rawText,
  inputId,
  title,
  createdAt,
  preparseResearchBrief,
  buildModeDetectionArtifact
}) {
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
    sourceInputId: inputId,
    preparseResearchBrief
  });
  const modeDetectionArtifact = buildModeDetectionArtifact({
    inputId,
    title,
    chunks
  });

  return MetagrinderIngestArtifactSchema.parse({
    inputId,
    title,
    sourceType: 'plain-text',
    researchKind: modeDetectionArtifact.researchKind,
    createdAt,
    sourceInputs,
    chunks
  });
}

function buildMultiInputIngestArtifact({
  sourceFiles,
  inputId,
  title,
  createdAt,
  preparseResearchBrief,
  buildModeDetectionArtifact
}) {
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
      sourceInputId: file.sourceInputId,
      preparseResearchBrief
    })
  );
  const modeDetectionArtifact = buildModeDetectionArtifact({
    inputId,
    title,
    chunks
  });

  return MetagrinderIngestArtifactSchema.parse({
    inputId,
    title,
    sourceType: 'plain-text',
    researchKind: modeDetectionArtifact.researchKind,
    createdAt,
    sourceInputs,
    chunks
  });
}

module.exports = {
  buildChunksForSource,
  buildIngestArtifact,
  buildMultiInputIngestArtifact,
  deriveCombinedTitle,
  deriveTitle,
  mergeUniqueStrings,
  slugify
};

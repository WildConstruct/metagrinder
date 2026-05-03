const {
  MetagrinderSourceRegistryArtifactSchema
} = require('../../types/metagrinder.runtime.js');

const QUALITY_RANK = {
  low: 1,
  medium: 2,
  high: 3
};

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalizeUrl(rawUrl) {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith('mock://')) {
    return rawUrl.replace(/[?#].*$/, '').toLowerCase();
  }

  try {
    const parsed = new URL(rawUrl);
    parsed.protocol = 'https:';
    parsed.hash = '';
    [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid'
    ].forEach((param) => parsed.searchParams.delete(param));
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    parsed.searchParams.sort();
    return parsed.toString();
  } catch (_error) {
    return rawUrl.replace(/[?#].*$/, '').toLowerCase();
  }
}

function domainFor(rawUrl) {
  if (!rawUrl) return undefined;
  if (rawUrl.startsWith('mock://')) return 'mock';
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_error) {
    return undefined;
  }
}

function dedupeKeyFor(result) {
  const canonicalUrl = canonicalizeUrl(result.url);
  if (canonicalUrl) return canonicalUrl;
  return `${domainFor(result.url) || 'unknown'}:${normalizeTitle(result.title)}`;
}

function sourceTypeFor(result) {
  if (result.sourceType === 'archival-photo') return 'archival-photo';
  if (result.sourceType === 'low-quality-source') return 'low-quality-source';
  if ([
    'archive',
    'museum',
    'library',
    'scholarly',
    'newspaper',
    'high-quality-secondary'
  ].includes(result.sourceType)) {
    return result.sourceType;
  }
  return 'high-quality-secondary';
}

function preferSourceQuality(left, right) {
  return QUALITY_RANK[right] > QUALITY_RANK[left] ? right : left;
}

function buildSourceRegistryArtifact({ ingestArtifact, webResearchResults }) {
  const sourcesByKey = new Map();

  (ingestArtifact?.sourceInputs || []).forEach((source, index) => {
    const sourceId = `source_input_${String(index + 1).padStart(3, '0')}`;
    const dedupeKey = `input:${source.sourceInputId}`;
    sourcesByKey.set(dedupeKey, {
      sourceId,
      sourceKind: 'original-input',
      title: source.title,
      url: source.path,
      canonicalUrl: source.path,
      domain: 'local-input',
      retrievedAt: ingestArtifact.createdAt,
      sourceType: 'user-provided',
      sourceQuality: 'high',
      rightsProfile: 'unknown',
      limitations: ['User-provided source input; rights and external citation status require operator review.'],
      dedupeKey,
      mergedFromResultIds: [],
      sourceInputIds: [source.sourceInputId],
      sourceChunkIds: (ingestArtifact.chunks || [])
        .filter((chunk) => chunk.sourceInputId === source.sourceInputId)
        .map((chunk) => chunk.chunkId),
      reviewStatus: 'needs_review'
    });
  });

  (webResearchResults?.results || []).forEach((result) => {
    const dedupeKey = dedupeKeyFor(result);
    const existing = sourcesByKey.get(dedupeKey);
    if (existing) {
      existing.sourceQuality = preferSourceQuality(existing.sourceQuality, result.sourceQuality);
      existing.limitations = [...new Set([...existing.limitations, ...(result.limitations || [])])];
      existing.mergedFromResultIds = [...new Set([...existing.mergedFromResultIds, result.resultId])];
      return;
    }

    sourcesByKey.set(dedupeKey, {
      sourceId: `source_loc_${String(sourcesByKey.size + 1).padStart(3, '0')}`,
      sourceKind: 'web-result',
      title: result.title,
      url: result.url,
      canonicalUrl: canonicalizeUrl(result.url),
      domain: domainFor(result.url),
      retrievedAt: result.retrievedAt || webResearchResults.retrievedAt,
      sourceType: sourceTypeFor(result),
      sourceQuality: result.sourceQuality,
      rightsProfile: result.sourceType === 'archival-photo' ? 'reference-only' : 'unknown',
      limitations: result.limitations || [],
      dedupeKey,
      mergedFromResultIds: [result.resultId],
      sourceInputIds: [],
      sourceChunkIds: [],
      reviewStatus: 'needs_review'
    });
  });

  return MetagrinderSourceRegistryArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    sources: [...sourcesByKey.values()]
  });
}

module.exports = {
  buildSourceRegistryArtifact,
  canonicalizeUrl,
  dedupeKeyFor,
  normalizeTitle
};

const {
  MetagrinderSynthesizeArtifactSchema
} = require('../../types/metagrinder.runtime.js');

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

function buildSynthesizeArtifact({ extractArtifact }) {
  const promptFragments = [];
  const familyCounts = {
    atmosphere: 0,
    wardrobe: 0,
    'crowd-behavior': 0,
    lighting: 0
  };

  extractArtifact.conceptCandidates.forEach((concept) => {
    const family = familyFromCategory(concept.category);
    promptFragments.push({
      fragmentId: `${extractArtifact.inputId}_fragment_${String(promptFragments.length + 1).padStart(3, '0')}`,
      family,
      text: concept.label,
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

module.exports = {
  buildSynthesizeArtifact,
  familyFromCategory
};

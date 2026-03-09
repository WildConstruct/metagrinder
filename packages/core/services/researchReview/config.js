const RESEARCH_KIND_SUGGESTED_CATEGORIES = {
  'historical-scene-research': [
    'wardrobe',
    'people-and-crowd',
    'weather-and-environment',
    'lighting',
    'materials-and-surfaces',
    'mood-and-social-tone'
  ],
  'character-framework': [
    'archetypes',
    'physical-state',
    'wardrobe-and-gear',
    'behavior-and-presence',
    'capabilities-and-flaws',
    'sensory-footprint'
  ],
  'material-reference': [
    'materials',
    'surface-response',
    'wear-and-damage',
    'environmental-effects'
  ],
  'environment-observation': [
    'terrain',
    'atmosphere',
    'lighting',
    'structures',
    'materials',
    'movement'
  ],
  'style-analysis': [
    'genre-context',
    'visual-signifiers',
    'tone',
    'reference-points',
    'prompt-implications'
  ],
  'procedural-guide': [
    'generation-rules',
    'templates',
    'probability-weighting',
    'contradiction-avoidance',
    'prompt-assembly'
  ],
  mixed: [
    'source-notes',
    'reusable-concepts',
    'generation-rules',
    'templates',
    'uncertainties'
  ],
  unknown: [
    'source-notes',
    'key-observations',
    'reusable-concepts',
    'uncertainties'
  ]
};

const RESEARCH_KIND_CATEGORY_PRIORITIES = {
  'historical-scene-research': [
    ['wardrobe', 'primary'],
    ['people-and-crowd', 'primary'],
    ['weather-and-environment', 'primary'],
    ['lighting', 'secondary'],
    ['materials-and-surfaces', 'secondary'],
    ['mood-and-social-tone', 'optional']
  ],
  'character-framework': [
    ['archetypes', 'primary'],
    ['physical-state', 'primary'],
    ['wardrobe-and-gear', 'primary'],
    ['behavior-and-presence', 'secondary'],
    ['capabilities-and-flaws', 'secondary'],
    ['sensory-footprint', 'optional']
  ],
  'material-reference': [
    ['materials', 'primary'],
    ['surface-response', 'primary'],
    ['wear-and-damage', 'secondary'],
    ['environmental-effects', 'optional']
  ],
  'environment-observation': [
    ['terrain', 'primary'],
    ['atmosphere', 'primary'],
    ['lighting', 'secondary'],
    ['structures', 'secondary'],
    ['materials', 'optional'],
    ['movement', 'optional']
  ],
  'style-analysis': [
    ['genre-context', 'primary'],
    ['visual-signifiers', 'primary'],
    ['tone', 'secondary'],
    ['reference-points', 'secondary'],
    ['prompt-implications', 'optional']
  ],
  'procedural-guide': [
    ['generation-rules', 'primary'],
    ['templates', 'primary'],
    ['probability-weighting', 'secondary'],
    ['contradiction-avoidance', 'secondary'],
    ['prompt-assembly', 'optional']
  ],
  mixed: [
    ['source-notes', 'primary'],
    ['reusable-concepts', 'primary'],
    ['generation-rules', 'secondary'],
    ['templates', 'secondary'],
    ['uncertainties', 'optional']
  ],
  unknown: [
    ['source-notes', 'primary'],
    ['key-observations', 'primary'],
    ['reusable-concepts', 'secondary'],
    ['uncertainties', 'optional']
  ]
};

const CATEGORY_SIGNAL_RULES = {
  'historical-scene-research': {
    wardrobe: [
      'coat',
      'coats',
      'hat',
      'hats',
      'gloves',
      'shoes',
      'wardrobe',
      'streetwear',
      'silhouette',
      'outerwear'
    ],
    'people-and-crowd': [
      'crowd',
      'audience',
      'theatergoers',
      'pedestrian',
      'people',
      'visitors',
      'workers',
      'groups'
    ],
    'weather-and-environment': [
      'cold',
      'winter',
      'damp',
      'breath',
      'air',
      'pavement',
      'street',
      'sidewalk'
    ],
    lighting: [
      'light',
      'marquee',
      'neon',
      'reflections',
      'signage',
      'lit'
    ],
    'materials-and-surfaces': [
      'wool',
      'pavement',
      'signs',
      'taxis',
      'shoes',
      'fabric'
    ],
    'mood-and-social-tone': [
      'post-show',
      'refinement',
      'formality',
      'social',
      'tone'
    ]
  },
  'environment-observation': {
    terrain: [
      'ridge',
      'ground',
      'soil',
      'walkways',
      'yard',
      'landscape',
      'stone'
    ],
    atmosphere: [
      'air',
      'wind',
      'fog',
      'humid',
      'humidity',
      'haze',
      'condensation',
      'dust',
      'grit'
    ],
    lighting: [
      'light',
      'dawn',
      'dusk',
      'reflections',
      'flood lamps',
      'orange',
      'shine',
      'glow'
    ],
    structures: [
      'greenhouse',
      'frames',
      'roof',
      'panels',
      'gantry',
      'cranes',
      'catwalk',
      'station',
      'walls',
      'antenna',
      'benches'
    ],
    materials: [
      'glass',
      'iron',
      'steel',
      'stone',
      'water',
      'fabric',
      'metal',
      'corrugated',
      'sandstone'
    ],
    movement: [
      'moved',
      'movement',
      'crossed',
      'tracked',
      'groups',
      'paused',
      'drifted',
      'passed'
    ]
  },
  'material-reference': {
    materials: [
      'iron',
      'steel',
      'rubber',
      'paint',
      'metal',
      'panel',
      'seal'
    ],
    'surface-response': [
      'surface',
      'highlight',
      'satin',
      'oxide',
      'finish',
      'contrast',
      'response'
    ],
    'wear-and-damage': [
      'wear',
      'damage',
      'abrasion',
      'crack',
      'nick',
      'rounded',
      'flake'
    ],
    'environmental-effects': [
      'grit',
      'wind',
      'heat',
      'dust',
      'evaporates',
      'sun-facing'
    ]
  }
};

const SEMANTIC_STOPWORDS = new Set([
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

const RESEARCH_MODE_PROTOTYPES = {
  'historical-scene-research': {
    prototypeTerms: [
      'scene',
      'street',
      'audience',
      'crowd',
      'theater',
      'broadway',
      'marquee',
      'wardrobe',
      'weather',
      'lighting',
      'social tone',
      'period moment'
    ],
    sectionTerms: [
      'source notes',
      'key observations',
      'streetwear notes',
      'costume notes',
      'scene'
    ],
    chunkKindWeights: {
      observation: 1.2,
      'source-note': 1.1
    }
  },
  'environment-observation': {
    prototypeTerms: [
      'environment',
      'atmosphere',
      'structure',
      'material',
      'lighting',
      'terrain',
      'movement',
      'greenhouse',
      'shipyard',
      'station',
      'dust',
      'condensation'
    ],
    sectionTerms: [
      'source notes',
      'key observations',
      'reusable concepts'
    ],
    chunkKindWeights: {
      observation: 1.2,
      'source-note': 1.1,
      'concept-list': 1.05
    }
  },
  'material-reference': {
    prototypeTerms: [
      'material',
      'surface',
      'surface response',
      'wear',
      'damage',
      'finish',
      'oxide',
      'paint',
      'metal',
      'abrasion',
      'grease',
      'environmental effects'
    ],
    sectionTerms: [
      'material notes',
      'surface response',
      'wear and damage',
      'environmental effects'
    ],
    chunkKindWeights: {
      observation: 1.1,
      'concept-list': 1
    }
  },
  'character-framework': {
    prototypeTerms: [
      'archetype',
      'character',
      'roles',
      'occupations',
      'appearance',
      'attire',
      'population',
      'generator',
      'peasants',
      'traits',
      'social hierarchy',
      'daily lives'
    ],
    sectionTerms: [
      'social tapestry',
      'daily bread',
      'gender roles',
      'appearance',
      'characteristics'
    ],
    chunkKindWeights: {
      observation: 1,
      'reference-table': 1.3,
      'generation-rule': 1.1
    }
  },
  'style-analysis': {
    prototypeTerms: [
      'genre',
      'tone',
      'style',
      'aesthetic',
      'brand',
      'naming',
      'satire',
      'publication',
      'media universe',
      'content strategy',
      'format',
      'meme'
    ],
    sectionTerms: [
      'introduction',
      'methodology',
      'evaluation framework',
      'detailed name evaluations',
      'format innovation',
      'reference points',
      'format implications'
    ],
    chunkKindWeights: {
      observation: 1,
      'generation-rule': 1.2
    }
  },
  'procedural-guide': {
    prototypeTerms: [
      'methodology',
      'framework',
      'guide',
      'template',
      'criteria',
      'evaluation',
      'strategy',
      'workflow',
      'step',
      'decision',
      'probability',
      'logic'
    ],
    sectionTerms: [
      'methodology',
      'evaluation framework',
      'criteria',
      'next steps',
      'recommendation',
      'generation rules',
      'contradiction avoidance'
    ],
    chunkKindWeights: {
      'generation-rule': 1.4,
      template: 1.4,
      'reference-table': 1.1
    }
  },
  mixed: {
    prototypeTerms: [
      'mixed',
      'hybrid',
      'multiple',
      'combined',
      'template',
      'rules',
      'observations'
    ],
    sectionTerms: [
      'reusable concepts',
      'uncertainties'
    ],
    chunkKindWeights: {
      'generation-rule': 1.2,
      template: 1.2,
      observation: 1
    }
  }
};

module.exports = {
  CATEGORY_SIGNAL_RULES,
  RESEARCH_KIND_CATEGORY_PRIORITIES,
  RESEARCH_KIND_SUGGESTED_CATEGORIES,
  RESEARCH_MODE_PROTOTYPES,
  SEMANTIC_STOPWORDS
};

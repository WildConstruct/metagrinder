const {
  MetagrinderSemanticChoiceGraphArtifactSchema
} = require('../../types/metagrinder.runtime.js');

const MAX_CHOICE_TEXT_LENGTH = 96;

const SEX_CHOICES = {
  male: { choiceId: 'sex_male', text: 'male', weight: 90 },
  female: { choiceId: 'sex_female', text: 'female', weight: 8 }
};

const AXIS_DEFINITIONS = [
  { axisId: 'age', label: 'Age Choice', axisType: 'age', order: 1 },
  { axisId: 'sex', label: 'Sex Choice', axisType: 'sex', order: 2 },
  { axisId: 'male_role_type', label: 'Male Role / Type', axisType: 'role-type', order: 3, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'male_hat_hair', label: 'Male Hat / Hair', axisType: 'hat-hair', order: 4, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'male_top', label: 'Male Top', axisType: 'top', order: 5, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'male_bottom', label: 'Male Bottom', axisType: 'bottom', order: 6, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'male_footwear', label: 'Male Footwear', axisType: 'footwear', order: 7, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'male_accessories', label: 'Male Accessories', axisType: 'accessories', order: 8, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'male_condition_behavior', label: 'Male Condition / Behavior', axisType: 'condition-behavior', order: 9, appliesWhen: [SEX_CHOICES.male] },
  { axisId: 'female_role_type', label: 'Female Role / Type', axisType: 'role-type', order: 3, appliesWhen: [SEX_CHOICES.female] },
  { axisId: 'female_hat_hair', label: 'Female Hat / Hair', axisType: 'hat-hair', order: 4, appliesWhen: [SEX_CHOICES.female] },
  { axisId: 'female_top', label: 'Female Top', axisType: 'top', order: 5, appliesWhen: [SEX_CHOICES.female] },
  { axisId: 'female_bottom', label: 'Female Bottom', axisType: 'bottom', order: 6, appliesWhen: [SEX_CHOICES.female] },
  { axisId: 'female_footwear', label: 'Female Footwear', axisType: 'footwear', order: 7, appliesWhen: [SEX_CHOICES.female] },
  { axisId: 'female_accessories', label: 'Female Accessories', axisType: 'accessories', order: 8, appliesWhen: [SEX_CHOICES.female] },
  { axisId: 'female_condition_behavior', label: 'Female Condition / Behavior', axisType: 'condition-behavior', order: 9, appliesWhen: [SEX_CHOICES.female] }
];

const LANE_AXIS_IDS = {
  male: [
    'male_role_type',
    'male_hat_hair',
    'male_top',
    'male_bottom',
    'male_footwear',
    'male_accessories',
    'male_condition_behavior'
  ],
  female: [
    'female_role_type',
    'female_hat_hair',
    'female_top',
    'female_bottom',
    'female_footwear',
    'female_accessories',
    'female_condition_behavior'
  ]
};

const ATTRIBUTE_BUCKETS = {
  hatHair: {
    include: /\b(hat|headwear|hair|boater|panama|cap|bowler|derby|fedora|homburg|toque|veil|bareheaded)\b/i,
    exclude: /\b(shirts?|jackets?|trousers?|skirts?|shoes?|boots?|oxfords?|collars?|ties?|gloves?|cane|parasol|umbrella|muffs?|scarves?|fabric|dust|sweat|leaning|watching|walking)\b/i
  },
  top: {
    include: /\b(shirts?|shirtwaist|jackets?|blazers?|coats?|vests?|waistcoats?|suspenders|sleeves|blouses?|bodice|dress|tunics?|suits?|suit jacket)\b/i,
    exclude: /\b(hats?|caps?|boater|panama|bowler|trousers?|skirts?|shoes?|boots?|oxfords?|collars?|ties?|gloves?|cane|parasol|umbrella|muffs?|scarves?|dust|sweat|leaning|watching|walking)\b/i
  },
  bottom: {
    include: /\b(trousers?|pants|skirts?|knickerbockers?|breeches|lower body|shorts)\b/i,
    exclude: /\b(hats?|caps?|shirts?|jackets?|blouses?|shoes?|boots?|oxfords?|collars?|ties?|gloves?|cane|parasol|dust|sweat|leaning|watching|walking)\b/i
  },
  footwear: {
    include: /\b(footwear|shoes?|boots?|oxfords?|gaiters?|spats?|heels?|laced)\b/i,
    exclude: /\b(hats?|shirts?|jackets?|trousers?|skirts?|ties?|collars?|gloves?|cane|parasol|dust|sweat|leaning|watching|walking)\b/i
  },
  accessories: {
    include: /\b(accessor|ties?|bow ties?|collars?|gloves?|cane|parasol|umbrella|muffs?|scarves?|handbag|fan|watch|binocular|belt|program|hat band|pocket watch)\b/i,
    exclude: /\b(shirts?|jackets?|trousers?|skirts?|shoes?|boots?|dust accumulation|sweat|fabric wear|leaning|watching|walking)\b/i
  },
  conditionBehavior: {
    include: /\b(dust|dusty|sweat|heat|fatigue|wear|soiled|standing|leaning|watching|walking|seated|pose|behavior|rail|track|group)\b/i,
    exclude: /\b(starched collar|tie|hat|cap|shoe|boot|skirt|trouser|shirt|jacket|parasol|glove|cane)\b/i
  }
};

function slugify(value) {
  return String(value || 'choice')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'choice';
}

function compactText(value, maxLength = MAX_CHOICE_TEXT_LENGTH) {
  const text = String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`.slice(0, maxLength);
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

function splitAttributeOptions(value) {
  const cleaned = String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/g, '')
    .replace(/^[-*\s]+/, '')
    .trim();
  if (!cleaned) return [];
  const afterColon = cleaned.includes(':') ? cleaned.slice(cleaned.indexOf(':') + 1) : cleaned;
  return afterColon
    .split(/\s*\*\s*|\s*;\s*|\s+\+\s+|\s+-\s+|,\s+(?=[a-zA-Z])|\s+\band\b\s+(?=[a-zA-Z])/i)
    .map((part) => part.replace(/\([^)]*\)/g, '').replace(/\s*\([^)]*$/g, '').trim())
    .map((part) => part.replace(/^(and|or)\s+/i, '').trim())
    .filter((part) => part.length > 1)
    .slice(0, 12);
}

function sexAffinityForText(value) {
  const text = normalizeText(value);
  const labelLikeFemale = /\b(female|women|woman|girl|girls|ladies|lady|mother|matron)\b|women['’]s|woman['’]s/.test(text);
  const labelLikeMale = /\b(male|men|man|boys?|gentlemen|gentleman|businessman|businessmen)\b|men['’]s|man['’]s/.test(text);
  if (labelLikeFemale && !labelLikeMale) return 'female';
  if (labelLikeMale && !labelLikeFemale) return 'male';

  const femaleWardrobe = /\b(shirtwaist|blouses?|skirts?|hobble|picture hat|parasol|handbag|fan|dresses?|bolero|toque|veil|muffs?|scarves?|practical laced shoes|lower heels?)\b/.test(text);
  const maleWardrobe = /\b(waistcoats?|suspenders|shirtsleeves|flat cap|newsboy|bowler|derby|homburg|necktie|sack suit|dark suit|business suit|trousers?|boots?|oxfords?|spats?|gaiters?)\b/.test(text);
  if (femaleWardrobe && !maleWardrobe) return 'female';
  if (maleWardrobe && !femaleWardrobe) return 'male';
  if (femaleWardrobe && maleWardrobe) return 'ambiguous';
  return 'shared';
}

function resolveSexAffinity(contextAffinity, itemAffinity) {
  if (itemAffinity === 'ambiguous' || contextAffinity === 'ambiguous') return 'ambiguous';
  if (itemAffinity === 'shared') return contextAffinity;
  if (contextAffinity === 'shared') return itemAffinity;
  if (contextAffinity === itemAffinity) return itemAffinity;
  return 'ambiguous';
}

function entryParts(entry) {
  const label = String(entry.label || '');
  return (entry.items || []).flatMap((item) => {
    const itemText = String(item || '').replace(/\*\*/g, '').trim();
    const prefixMatch = itemText.match(/^([^:]{1,80}):\s*(.+)$/);
    const context = prefixMatch ? `${label} ${prefixMatch[1]}` : label;
    const contextAffinity = sexAffinityForText(context);
    return splitAttributeOptions(itemText).map((part) => ({
      text: part.replace(/^[A-Z][A-Za-z /&-]{1,40}:\s*/, '').trim(),
      context,
      sourceInputIds: entry.sourceInputIds || [],
      sourceChunkIds: entry.sourceChunkIds || [],
      attributionMode: entry.attributionMode || 'inferred',
      confidence: entry.confidence || 'medium',
      sexAffinity: resolveSexAffinity(contextAffinity, sexAffinityForText(part))
    }));
  });
}

function classifyBucketPart(part, bucketName) {
  const bucket = ATTRIBUTE_BUCKETS[bucketName];
  if (!bucket) return false;
  const itemText = String(part.text || '');
  const contextText = String(part.context || '');
  const combinedText = `${contextText} ${itemText}`;
  if (/would you like|create \d|tweak anything|ai tool|randomization tips|class variation|age groups/i.test(combinedText)) return false;
  if (/palette constraints|no bright colors|avoid saturated|muted$|outdoor-appropriate/i.test(combinedText) && bucketName !== 'conditionBehavior') return false;
  if (/palette constraints/i.test(combinedText) && bucketName === 'conditionBehavior') return false;
  if (bucketName === 'conditionBehavior') {
    return bucket.include.test(itemText) && !bucket.exclude.test(itemText);
  }
  return bucket.include.test(itemText) && !bucket.exclude.test(itemText);
}

function sexAllowedForBucket(part, sex, bucketName) {
  if (part.sexAffinity === sex) return true;
  if (part.sexAffinity !== 'shared') return false;
  return bucketName === 'conditionBehavior';
}

function cleanAttributeText(value) {
  return compactText(value)
    .replace(/^(headwear|upper|upper body|lower|lower body|footwear|accessories?|environmental|behavior)\s*:\s*/i, '')
    .replace(/^accessories?\s*\(?\s*/i, '')
    .replace(/\s*\)$/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/[.;:,]+$/g, '')
    .trim();
}

function stripPromptScaffolding(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\b(if|when)\s+supported\b/gi, '')
    .replace(/\bneeds?\s+(reviewed\s+)?(source\s+support|semantic choices|attribute choices|choices)\b/gi, 'review')
    .replace(/\bbranch\b/gi, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/[.;:,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function startsWithPromptLead(value) {
  return /^(with|wearing|holding|carrying|showing|standing|leaning|watching|walking|seated|in|near|along|at|without)\b/i.test(value);
}

function indefiniteArticle(value) {
  const text = String(value || '').trim();
  if (/^(euro|uni|use|one)/i.test(text)) return 'a';
  if (/^(honest|hour|heir)\b/i.test(text)) return 'an';
  return /^[aeiou]/i.test(text) ? 'an' : 'a';
}

function naturalizePromptNoun(value) {
  const text = String(value || '').trim();
  if (/^(African American|Black Indianapolis|Indianapolis|European|U\.S\.|WWI)\b/.test(text)) return text;
  return text.toLowerCase();
}

function promptFragmentForAxis(text, axisId) {
  const clean = naturalizePromptNoun(stripPromptScaffolding(text)
    .replace(/^matching\s+/i, '')
    .replace(/^simple\s+/i, '')
    .trim());
  if (!clean) return '';
  if (startsWithPromptLead(clean)) return clean;
  if (axisId === 'age') {
    if (/^adult$/i.test(clean)) return 'an adult';
    if (/older adult/i.test(clean)) return 'an older adult';
    if (/young adult|teen/i.test(clean)) return 'a young adult';
    if (/child|children/i.test(clean)) return 'a child';
    return `${indefiniteArticle(clean)} ${clean}`;
  }
  if (axisId.endsWith('_role_type')) {
    const roleText = clean
      .replace(/^archetype:\s*/i, '')
      .replace(/\badult\b/gi, '')
      .replace(/\bmale\b/gi, '')
      .replace(/\bfemale\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return roleText ? `who is ${indefiniteArticle(roleText)} ${roleText}` : 'who is a reviewed role';
  }
  if (axisId.endsWith('_hat_hair')) {
    if (/bareheaded/i.test(clean)) return 'bareheaded';
    if (/hair/i.test(clean) && !/\b(hat|cap|boater|panama|bowler|derby|fedora|homburg|toque|veil)\b/i.test(clean)) {
      return `with ${clean}`;
    }
    return `with ${indefiniteArticle(clean)} ${clean}`;
  }
  if (axisId.endsWith('_top')) return `wearing ${clean}`;
  if (axisId.endsWith('_bottom')) return `with ${clean}`;
  if (axisId.endsWith('_footwear')) return `wearing ${clean}`;
  if (axisId.endsWith('_accessories')) {
    if (/\b(parasol|umbrella|cane|fan|handbag|watch|binocular|program)\b/i.test(clean)) return `carrying ${clean}`;
    return `with ${clean}`;
  }
  if (axisId.endsWith('_condition_behavior')) {
    if (/^(standing|leaning|watching|walking|seated)\b/i.test(clean)) return clean;
    if (/\b(dust|sweat|fatigue|wear|soiled)\b/i.test(clean)) return `showing ${clean}`;
    return `in ${clean}`;
  }
  return clean;
}

function provenanceFrom(source, excerptText) {
  return {
    sourceInputIds: source?.sourceInputIds || [],
    sourceChunkIds: source?.sourceChunkIds || [],
    excerptText: compactText(excerptText || source?.promptText || source?.summary || source?.label || ''),
    confidence: source?.confidence || 'medium',
    attributionMode: source?.attributionMode || 'inferred',
    validationStatus: source?.validationStatus || 'needs_review',
    evidenceStatus: source?.evidenceStatus || 'extracted-from-text'
  };
}

function choice({
  axisId,
  text,
  weight = 1,
  source,
  excerptText,
  appliesWhen = [],
  projectionSource = 'inferred'
}) {
  return {
    choiceId: `${axisId}_${slugify(text)}`,
    text: compactText(promptFragmentForAxis(text, axisId)),
    weight: Number.isFinite(Number(weight)) ? Number(weight) : 1,
    appliesWhen,
    ...provenanceFrom(source, excerptText || text),
    projectionSource
  };
}

function choiceWeightFromRange(range) {
  return range
    ? Math.max(1, Number(((range.min + range.max) / 2).toFixed(2)))
    : 1;
}

function roleSexAffinity(archetype) {
  return sexAffinityForText([
    archetype.archetypeId,
    archetype.label,
    archetype.summary,
    archetype.promptText
  ].filter(Boolean).join(' '));
}

function isGraphRoleArchetype(archetype) {
  const label = String(archetype.label || '').toLowerCase();
  if (!label) return false;
  if (/\b(wardrobe|attire|component|headwear|upper body|lower body|footwear|accessor|palette|modifier)\b/i.test(label)) return false;
  if (/\b(grandstand|rail\s*\/|fence|pit\s*\/|timing stand|official areas|infield|grounds|zone)\b/i.test(label)) return false;
  return /\b(spectator|worker|official|driver|mechanic|press|vendor|shopper|trader|messenger|role|agent|handler|reviewer|steward|operator|participant|male|female|child|teen|affluent|heat-adjusted|working-class|middle-class)\b/i.test(label);
}

function roleChoices(sceneGrammarArtifact, sex) {
  const graphRoles = (sceneGrammarArtifact.archetypes || []).filter(isGraphRoleArchetype);
  const roles = graphRoles.length > 0 ? graphRoles : (sceneGrammarArtifact.archetypes || []);
  const seen = new Set();
  return roles
    .filter((archetype) => roleSexAffinity(archetype) === sex)
    .map((archetype) => choice({
      axisId: `${sex}_role_type`,
      text: archetype.label || archetype.promptText || archetype.archetypeId,
      weight: choiceWeightFromRange(archetype.weightRange),
      source: archetype,
      excerptText: archetype.promptText || archetype.summary,
      appliesWhen: [SEX_CHOICES[sex]],
      projectionSource: 'codex'
    }))
    .filter((entry) => {
      const key = entry.text.toLowerCase().replace(/\bmale\b|\bfemale\b/g, '').replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function attributeChoices(sceneGrammarArtifact, { sex, bucketName, axisId }) {
  const sourceEntries = [
    ...(sceneGrammarArtifact.wardrobeSystem || []),
    ...(bucketName === 'accessories' ? (sceneGrammarArtifact.propsAndAccessories || []) : [])
  ];
  if (bucketName === 'conditionBehavior') {
    sourceEntries.push(
      ...(sceneGrammarArtifact.behaviorStates || []).map((entry) => ({
        label: entry.label,
        items: [entry.promptText],
        sourceInputIds: entry.sourceInputIds,
        sourceChunkIds: entry.sourceChunkIds,
        attributionMode: entry.attributionMode,
        confidence: entry.confidence
      })),
      ...(sceneGrammarArtifact.environmentalModifiers || []).map((entry) => ({
        label: entry.label,
        items: [entry.promptText],
        sourceInputIds: entry.sourceInputIds,
        sourceChunkIds: entry.sourceChunkIds,
        attributionMode: entry.attributionMode,
        confidence: entry.confidence
      }))
    );
  }
  const seen = new Set();
  return sourceEntries
    .flatMap(entryParts)
    .filter((part) => classifyBucketPart(part, bucketName))
    .filter((part) => sexAllowedForBucket(part, sex, bucketName))
    .map((part) => ({
      part,
      text: cleanAttributeText(part.text)
    }))
    .filter(({ text }) => text && !/^options?$/i.test(text))
    .filter(({ text }) => {
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ part, text }) => choice({
      axisId,
      text,
      source: part,
      excerptText: part.text,
      appliesWhen: [SEX_CHOICES[sex]],
      projectionSource: part.sexAffinity === sex ? 'codex' : 'inferred'
    }));
}

function ageChoices(sceneGrammarArtifact) {
  const text = [
    sceneGrammarArtifact.sceneContext?.summary,
    ...(sceneGrammarArtifact.wardrobeSystem || []).flatMap((entry) => [entry.label, ...(entry.items || [])]),
    ...(sceneGrammarArtifact.archetypes || []).flatMap((entry) => [entry.label, entry.promptText])
  ].join(' ');
  const values = [];
  if (/adult|men|male|women|female|businessman|spectator/i.test(text)) {
    values.push({ text: 'adult', weight: /90|95|dominant|mostly/i.test(text) ? 80 : 1 });
  }
  if (/older|elder|aged/i.test(text)) values.push({ text: 'older adult', weight: 5 });
  if (/young|younger|teen/i.test(text)) values.push({ text: 'young adult', weight: 3 });
  if (/children|child|boys?|girls?/i.test(text)) values.push({ text: 'child', weight: 2 });
  return values.map((entry) => choice({
    axisId: 'age',
    text: entry.text,
    weight: entry.weight,
    source: sceneGrammarArtifact.sceneContext,
    projectionSource: 'inferred'
  }));
}

function sexChoices(sceneGrammarArtifact) {
  const text = [
    ...(sceneGrammarArtifact.wardrobeSystem || []).flatMap((entry) => [entry.label, ...(entry.items || [])]),
    ...(sceneGrammarArtifact.archetypes || []).flatMap((entry) => [entry.label, entry.promptText])
  ].join(' ');
  const values = [];
  if (/men|male|businessman|gentleman|suspenders|waistcoat|trousers/i.test(text)) {
    values.push({ ...SEX_CHOICES.male, weight: /90|95|dominant|mostly men|adult male/i.test(text) ? 90 : 1 });
  }
  if (/women|female|shirtwaist|blouse|skirt|parasol|picture hat/i.test(text)) {
    values.push({ ...SEX_CHOICES.female, weight: /5|8|sparse|smaller numbers/i.test(text) ? 8 : 1 });
  }
  return values.map((entry) => choice({
    axisId: 'sex',
    text: entry.text,
    weight: entry.weight,
    source: sceneGrammarArtifact.sceneContext,
    projectionSource: 'inferred'
  }));
}

function fallbackChoice(axis) {
  return choice({
    axisId: axis.axisId,
    text: `${axis.label} needs reviewed semantic choices`,
    weight: 1,
    source: {},
    projectionSource: 'fallback'
  });
}

function choicesForAxis(sceneGrammarArtifact, axis) {
  if (axis.axisId === 'age') return ageChoices(sceneGrammarArtifact);
  if (axis.axisId === 'sex') return sexChoices(sceneGrammarArtifact);
  if (axis.axisId.endsWith('_role_type')) return roleChoices(sceneGrammarArtifact, axis.axisId.startsWith('female') ? 'female' : 'male');
  const sex = axis.axisId.startsWith('female') ? 'female' : 'male';
  const bucketName = {
    hat_hair: 'hatHair',
    top: 'top',
    bottom: 'bottom',
    footwear: 'footwear',
    accessories: 'accessories',
    condition_behavior: 'conditionBehavior'
  }[axis.axisId.replace(`${sex}_`, '')];
  return bucketName
    ? attributeChoices(sceneGrammarArtifact, { sex, bucketName, axisId: axis.axisId })
    : [];
}

function buildAxisEdges() {
  const edges = [{ edgeId: 'semantic_edge_age_to_sex', sourceAxisId: 'age', targetAxisId: 'sex', relation: 'linear' }];
  ['male', 'female'].forEach((sex) => {
    edges.push({
      edgeId: `semantic_edge_sex_to_${sex}_role_type`,
      sourceAxisId: 'sex',
      sourceChoiceId: SEX_CHOICES[sex].choiceId,
      targetAxisId: `${sex}_role_type`,
      relation: 'branch'
    });
    LANE_AXIS_IDS[sex].slice(0, -1).forEach((sourceAxisId, index) => {
      const targetAxisId = LANE_AXIS_IDS[sex][index + 1];
      edges.push({
        edgeId: `semantic_edge_${sourceAxisId}_to_${targetAxisId}`,
        sourceAxisId,
        targetAxisId,
        relation: 'linear'
      });
    });
  });
  return edges;
}

function buildSemanticChoiceGraphArtifact({
  briefAnalysisArtifact,
  sceneGrammarArtifact
}) {
  const analysisMode = briefAnalysisArtifact?.analysisMode || (
    (sceneGrammarArtifact.reviewFlags || []).includes('codex-semantic-projection')
      ? 'codex-semantic'
      : 'seed-only'
  );
  const axes = AXIS_DEFINITIONS.map((axis) => {
    const choices = choicesForAxis(sceneGrammarArtifact, axis);
    return {
      axisId: axis.axisId,
      label: axis.label,
      axisType: axis.axisType,
      order: axis.order,
      appliesWhen: axis.appliesWhen || [],
      choices: choices.length > 0 ? choices.slice(0, 12) : [fallbackChoice(axis)]
    };
  });
  const warnings = [];
  axes.forEach((axis) => {
    if (axis.choices.every((entry) => entry.projectionSource === 'fallback')) {
      warnings.push({
        code: 'semantic-axis-empty',
        severity: 'warning',
        message: `${axis.label} had no extracted semantic choices and needs review.`,
        relatedAxisIds: [axis.axisId]
      });
    }
  });

  return MetagrinderSemanticChoiceGraphArtifactSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    analysisMode,
    subject: {
      label: briefAnalysisArtifact?.mainSubject?.label || sceneGrammarArtifact.sceneContext.title,
      subjectType: briefAnalysisArtifact?.subjectType || briefAnalysisArtifact?.mainSubject?.subjectType || 'scene',
      summary: briefAnalysisArtifact?.mainSubject?.summary || sceneGrammarArtifact.sceneContext.summary
    },
    sourceArtifacts: ['brief-analysis.json', 'scene-grammar.json'],
    axes,
    edges: buildAxisEdges(),
    warnings,
    coverage: briefAnalysisArtifact?.coverage || [],
    graphAssemblyPlan: briefAnalysisArtifact?.graphAssemblyPlan || {
      graphType: 'semantic-choice-graph',
      nodes: [],
      edges: [],
      notes: []
    }
  });
}

module.exports = {
  AXIS_DEFINITIONS,
  buildSemanticChoiceGraphArtifact
};

const {
  MetagrinderPsgV2FileSchema
} = require('../../types/metagrinder.runtime.js');

const MAX_OPTIONS_PER_CHOICE_NODE = 6;
const MAX_OPTION_TEXT_LENGTH = 72;
const MAX_TEXT_BLOCK_LENGTH = 240;

function slugify(value) {
  return String(value || 'choice')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'choice';
}

function compactText(value, maxLength = MAX_OPTION_TEXT_LENGTH) {
  const text = String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`.slice(0, maxLength);
}

function cleanChoice(choice, fallbackId) {
  return {
    id: choice.id || fallbackId,
    text: compactText(choice.text || choice.label || '', MAX_OPTION_TEXT_LENGTH) || 'review needed',
    weight: Number.isFinite(Number(choice.weight)) ? Number(choice.weight) : 1
  };
}

function psgOptions(choices, maxOptions = MAX_OPTIONS_PER_CHOICE_NODE) {
  return choices.slice(0, maxOptions).map((choice, index) => {
    const cleaned = cleanChoice(choice, `choice_${index + 1}`);
    return {
      text: cleaned.text,
      weight: cleaned.weight
    };
  });
}

function textNode({ id, name, value, x, y }) {
  return {
    id,
    type: 'TextBlock',
    name,
    x,
    y,
    value: compactText(value, MAX_TEXT_BLOCK_LENGTH)
  };
}

function weightedChoiceNode({ id, name, choices, x, y, maxOptions = MAX_OPTIONS_PER_CHOICE_NODE }) {
  const safeChoices = choices.length > 0
    ? choices
    : [{ text: `${name} needs reviewed choices`, weight: 1 }];
  return {
    id,
    type: 'WeightedChoice',
    name,
    x,
    y,
    options: psgOptions(safeChoices, maxOptions)
  };
}

function outputNode({ id, name, x, y }) {
  return {
    id,
    type: 'Output',
    name,
    x,
    y,
    template: '{prompt}'
  };
}

function flatPsgFile({ name, description, createdAt, nodes, edges, regions = [], metadata = {} }) {
  return MetagrinderPsgV2FileSchema.parse({
    version: '1.0.0',
    name,
    description,
    metadata: {
      type: 'ASSET_FRAGMENT',
      source: 'metagrinder',
      tags: ['metagrinder', 'scene-grammar'],
      createdAt,
      ...metadata
    },
    nodes,
    edges,
    regions
  });
}

function directLinearEdges(nodeIds) {
  return nodeIds.slice(0, -1).map((source, index) => ({
    id: `edge-${source}-${nodeIds[index + 1]}`,
    source,
    target: nodeIds[index + 1]
  }));
}

function choiceWeightFromRange(range) {
  return range
    ? Math.max(1, Number(((range.min + range.max) / 2).toFixed(2)))
    : 1;
}

function semanticProjectionActive(sceneGrammarArtifact) {
  return (sceneGrammarArtifact.reviewFlags || []).includes('codex-semantic-projection');
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™]/g, "'")
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

const ATTRIBUTE_BUCKETS = {
  headwear: {
    include: /\b(hat|headwear|hair|boater|panama|cap|bowler|derby|fedora|homburg|toque|veil|bareheaded)\b/i,
    exclude: /\b(shirts?|jackets?|trousers?|skirts?|shoes?|boots?|oxfords?|collars?|ties?|gloves?|cane|parasol|umbrella|muffs?|scarves?|fabric|dust|sweat|leaning|watching|walking)\b/i
  },
  upperBody: {
    include: /\b(shirts?|shirtwaist|jackets?|blazers?|coats?|vests?|waistcoats?|suspenders|sleeves|blouses?|bodice|dress|tunics?|suits?|suit jacket)\b/i,
    exclude: /\b(hats?|caps?|boater|panama|bowler|trousers?|skirts?|shoes?|boots?|oxfords?|collars?|ties?|gloves?|cane|parasol|umbrella|muffs?|scarves?|dust|sweat|leaning|watching|walking)\b/i
  },
  lowerBody: {
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

function candidatePartsFromEntry(entry) {
  const label = String(entry.label || '');
  return (entry.items || []).flatMap((item) => {
    const itemText = String(item || '').replace(/\*\*/g, '').trim();
    const prefixMatch = itemText.match(/^([^:]{1,80}):\s*(.+)$/);
    const context = prefixMatch ? `${label} ${prefixMatch[1]}` : label;
    const contextAffinity = sexAffinityForText(context);
    return splitAttributeOptions(itemText).map((part) => ({
      text: part.replace(/^[A-Z][A-Za-z /&-]{1,40}:\s*/, '').trim(),
      context,
      sexAffinity: resolveSexAffinity(contextAffinity, sexAffinityForText(part))
    }));
  });
}

function resolveSexAffinity(contextAffinity, itemAffinity) {
  if (itemAffinity === 'ambiguous' || contextAffinity === 'ambiguous') return 'ambiguous';
  if (itemAffinity === 'shared') return contextAffinity;
  if (contextAffinity === 'shared') return itemAffinity;
  if (contextAffinity === itemAffinity) return itemAffinity;
  return 'ambiguous';
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

function stripPromptScaffolding(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/g, '')
    .replace(/^[-*\s]+/, '')
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

function promptFragmentForBucket(text, bucketName) {
  const clean = naturalizePromptNoun(stripPromptScaffolding(text)
    .replace(/^matching\s+/i, '')
    .replace(/^simple\s+/i, '')
    .trim());
  if (!clean) return '';
  if (startsWithPromptLead(clean)) return clean;

  if (bucketName === 'headwear') {
    if (/bareheaded/i.test(clean)) return 'bareheaded';
    if (/hair/i.test(clean) && !/\b(hat|cap|boater|panama|bowler|derby|fedora|homburg|toque|veil)\b/i.test(clean)) {
      return `with ${clean}`;
    }
    return `with ${indefiniteArticle(clean)} ${clean}`;
  }

  if (bucketName === 'upperBody') return `wearing ${clean}`;
  if (bucketName === 'lowerBody') return `with ${clean}`;
  if (bucketName === 'footwear') return `wearing ${clean}`;
  if (bucketName === 'accessories') {
    if (/\b(parasol|umbrella|cane|fan|handbag|watch|binocular|program)\b/i.test(clean)) return `carrying ${clean}`;
    return `with ${clean}`;
  }
  if (bucketName === 'conditionBehavior') {
    if (/^(standing|leaning|watching|walking|seated)\b/i.test(clean)) return clean;
    if (/\b(dust|sweat|fatigue|wear|soiled)\b/i.test(clean)) return `showing ${clean}`;
    return `in ${clean}`;
  }
  return clean;
}

function sexAllowedForBucket(part, sex, bucketName) {
  if (!sex) return true;
  if (part.sexAffinity === sex) return true;
  if (part.sexAffinity !== 'shared') return false;
  return bucketName === 'conditionBehavior';
}

function bucketedAttributeChoices(sceneGrammarArtifact, { bucketName, idPrefix, fallbackText, sex }) {
  const sourceEntries = [
    ...(sceneGrammarArtifact.wardrobeSystem || []),
    ...(bucketName === 'accessories' ? (sceneGrammarArtifact.propsAndAccessories || []) : [])
  ];
  if (bucketName === 'conditionBehavior') {
    sourceEntries.push(
      ...(sceneGrammarArtifact.behaviorStates || []).map((entry) => ({ label: entry.label, items: [entry.promptText] })),
      ...(sceneGrammarArtifact.environmentalModifiers || []).map((entry) => ({ label: entry.label, items: [entry.promptText] }))
    );
  }
  const values = sourceEntries
    .flatMap(candidatePartsFromEntry)
    .filter((part) => classifyBucketPart(part, bucketName))
    .filter((part) => sexAllowedForBucket(part, sex, bucketName))
    .map((part) => part.text);
  const seen = new Set();
  const choices = values
    .map((text) => text
      .replace(/^(headwear|upper|upper body|lower|lower body|footwear|accessories?|environmental|behavior)\s*:\s*/i, '')
      .replace(/^accessories?\s*\(?\s*/i, '')
      .replace(/\s*\)$/g, '')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/[.;:,]+$/g, '')
      .trim())
    .map((text) => promptFragmentForBucket(text, bucketName))
    .filter((text) => text && !/^options?$/i.test(text))
    .filter((text) => {
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((text) => ({
      id: `${idPrefix}_${slugify(text)}`,
      text,
      weight: 1
    }));
  return choices.length > 0 ? choices : [{ id: `${idPrefix}_review_needed`, text: fallbackText, weight: 1 }];
}

function conciseArchetypeText(archetype) {
  const label = String(archetype.label || archetype.archetypeId || 'Role / Type');
  const promptText = String(archetype.promptText || archetype.summary || '').trim();
  const cleanLabel = stripPromptScaffolding(label)
    .replace(/^archetype:\s*/i, '')
    .replace(/\badult\b/gi, '')
    .replace(/\bmale\b/gi, '')
    .replace(/\bfemale\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const roleText = naturalizePromptNoun(cleanLabel || stripPromptScaffolding(promptText));
  if (!roleText || /^weight:/i.test(promptText.replace(/\*/g, '').trim())) return roleText || 'reviewed role/type';
  return `who is ${indefiniteArticle(roleText)} ${roleText}`;
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

function dedupeChoicesByText(choices) {
  const seen = new Set();
  return choices.filter((choice) => {
    const key = String(choice.text || '')
      .toLowerCase()
      .replace(/^archetype:\s*/i, '')
      .replace(/\bmale\b/g, '')
      .replace(/\bfemale\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ageChoices(sceneGrammarArtifact) {
  const text = [
    sceneGrammarArtifact.sceneContext?.summary,
    ...(sceneGrammarArtifact.wardrobeSystem || []).flatMap((entry) => [entry.label, ...(entry.items || [])]),
    ...(sceneGrammarArtifact.archetypes || []).flatMap((entry) => [entry.label, entry.promptText])
  ].join(' ');
  const choices = [];
  if (/adult|men|male|women|female|businessman|spectator/i.test(text)) {
    choices.push({ id: 'adult', text: 'an adult', weight: /90|95|dominant|mostly/i.test(text) ? 80 : 1 });
  }
  if (/older|elder|aged/i.test(text)) choices.push({ id: 'older_adult', text: 'an older adult', weight: 5 });
  if (/young|younger|teen/i.test(text)) choices.push({ id: 'young_adult_or_teen', text: 'a young adult', weight: 3 });
  if (/children|child|boys?|girls?/i.test(text)) choices.push({ id: 'child', text: 'a child', weight: 2 });
  return choices.length > 0 ? choices : [{ id: 'age_review_needed', text: 'a review-needed age', weight: 1 }];
}

function sexChoices(sceneGrammarArtifact) {
  const text = [
    ...(sceneGrammarArtifact.wardrobeSystem || []).flatMap((entry) => [entry.label, ...(entry.items || [])]),
    ...(sceneGrammarArtifact.archetypes || []).flatMap((entry) => [entry.label, entry.promptText])
  ].join(' ');
  const choices = [];
  if (/men|male|businessman|gentleman|suspenders|waistcoat|trousers/i.test(text)) {
    choices.push({ id: 'male', text: 'male', weight: /90|95|dominant|mostly men|adult male/i.test(text) ? 90 : 1 });
  }
  if (/women|female|shirtwaist|blouse|skirt|parasol|picture hat/i.test(text)) {
    choices.push({ id: 'female', text: 'female', weight: /5|8|sparse|smaller numbers/i.test(text) ? 8 : 1 });
  }
  return choices.length > 0 ? choices : [{ id: 'sex_review_needed', text: 'review-needed sex presentation', weight: 1 }];
}

function roleChoicesForSex(sourceRoleArchetypes, sex) {
  const choices = sourceRoleArchetypes
    .filter((archetype) => {
      const affinity = roleSexAffinity(archetype);
      return affinity === sex;
    })
    .map((archetype) => ({
      id: archetype.archetypeId,
      text: conciseArchetypeText(archetype),
      weight: choiceWeightFromRange(archetype.weightRange)
    }))
    .sort((a, b) => b.weight - a.weight);
  return dedupeChoicesByText(choices);
}

function semanticLaneNodes({ sceneGrammarArtifact, sex, label, x, y }) {
  const prefix = sex;
  return [
    weightedChoiceNode({
      id: `${prefix}-role-choice`,
      name: `${label} Role / Type`,
      choices: roleChoicesForSex(sceneGrammarArtifact.sourceRoleArchetypes, sex).length > 0
        ? roleChoicesForSex(sceneGrammarArtifact.sourceRoleArchetypes, sex)
        : [{ id: `${prefix}_role_review_needed`, text: `who is a review-needed ${label.toLowerCase()} role`, weight: 1 }],
      x,
      y
    }),
    weightedChoiceNode({
      id: `${prefix}-headwear-choice`,
      name: `${label} Hat / Hair`,
      choices: bucketedAttributeChoices(sceneGrammarArtifact, {
        bucketName: 'headwear',
        idPrefix: `${prefix}_headwear`,
        fallbackText: `${label.toLowerCase()} hat/hair branch needs reviewed attribute choices`,
        sex
      }),
      x: x + 320,
      y
    }),
    weightedChoiceNode({
      id: `${prefix}-upper-body-choice`,
      name: `${label} Top`,
      choices: bucketedAttributeChoices(sceneGrammarArtifact, {
        bucketName: 'upperBody',
        idPrefix: `${prefix}_upper_body`,
        fallbackText: `${label.toLowerCase()} top branch needs reviewed attribute choices`,
        sex
      }),
      x: x + 640,
      y
    }),
    weightedChoiceNode({
      id: `${prefix}-lower-body-choice`,
      name: `${label} Bottom`,
      choices: bucketedAttributeChoices(sceneGrammarArtifact, {
        bucketName: 'lowerBody',
        idPrefix: `${prefix}_lower_body`,
        fallbackText: `${label.toLowerCase()} bottom branch needs reviewed attribute choices`,
        sex
      }),
      x: x + 960,
      y
    }),
    weightedChoiceNode({
      id: `${prefix}-footwear-choice`,
      name: `${label} Footwear`,
      choices: bucketedAttributeChoices(sceneGrammarArtifact, {
        bucketName: 'footwear',
        idPrefix: `${prefix}_footwear`,
        fallbackText: `${label.toLowerCase()} footwear branch needs reviewed attribute choices`,
        sex
      }),
      x: x + 1280,
      y
    }),
    weightedChoiceNode({
      id: `${prefix}-accessories-choice`,
      name: `${label} Accessories`,
      choices: bucketedAttributeChoices(sceneGrammarArtifact, {
        bucketName: 'accessories',
        idPrefix: `${prefix}_accessory`,
        fallbackText: `${label.toLowerCase()} accessories branch needs reviewed attribute choices`,
        sex
      }),
      x: x + 1600,
      y
    }),
    weightedChoiceNode({
      id: `${prefix}-modifier-choice`,
      name: `${label} Condition / Behavior`,
      choices: bucketedAttributeChoices(sceneGrammarArtifact, {
        bucketName: 'conditionBehavior',
        idPrefix: `${prefix}_modifier`,
        fallbackText: `${label.toLowerCase()} condition/behavior branch needs reviewed choices`,
        sex
      }),
      x: x + 1920,
      y
    }),
    outputNode({
      id: `${prefix}-prompt-output`,
      name: `${label} Prompt Output`,
      x: x + 2240,
      y
    })
  ];
}

function laneEdges(nodeIds) {
  return directLinearEdges(nodeIds);
}

const SEMANTIC_AXIS_NODE_IDS = {
  age: 'age-choice',
  sex: 'sex-choice',
  male_role_type: 'male-role-choice',
  male_hat_hair: 'male-headwear-choice',
  male_top: 'male-upper-body-choice',
  male_bottom: 'male-lower-body-choice',
  male_footwear: 'male-footwear-choice',
  male_accessories: 'male-accessories-choice',
  male_condition_behavior: 'male-modifier-choice',
  female_role_type: 'female-role-choice',
  female_hat_hair: 'female-headwear-choice',
  female_top: 'female-upper-body-choice',
  female_bottom: 'female-lower-body-choice',
  female_footwear: 'female-footwear-choice',
  female_accessories: 'female-accessories-choice',
  female_condition_behavior: 'female-modifier-choice'
};

const SEMANTIC_AXIS_POSITIONS = {
  age: { x: 80, y: 220 },
  sex: { x: 400, y: 220 },
  male_role_type: { x: 760, y: 80 },
  male_hat_hair: { x: 1080, y: 80 },
  male_top: { x: 1400, y: 80 },
  male_bottom: { x: 1720, y: 80 },
  male_footwear: { x: 2040, y: 80 },
  male_accessories: { x: 2360, y: 80 },
  male_condition_behavior: { x: 2680, y: 80 },
  female_role_type: { x: 760, y: 420 },
  female_hat_hair: { x: 1080, y: 420 },
  female_top: { x: 1400, y: 420 },
  female_bottom: { x: 1720, y: 420 },
  female_footwear: { x: 2040, y: 420 },
  female_accessories: { x: 2360, y: 420 },
  female_condition_behavior: { x: 2680, y: 420 }
};

function axisChoices(axis) {
  return (axis.choices || []).map((entry) => ({
    id: entry.choiceId,
    text: entry.text,
    weight: entry.weight
  }));
}

function semanticChoiceGraphAxisNode(axis) {
  const position = SEMANTIC_AXIS_POSITIONS[axis.axisId] || { x: 80, y: 80 };
  return weightedChoiceNode({
    id: SEMANTIC_AXIS_NODE_IDS[axis.axisId] || `${axis.axisId.replace(/_/g, '-')}-choice`,
    name: axis.label,
    choices: axisChoices(axis),
    x: position.x,
    y: position.y
  });
}

function buildSemanticChoiceGraphPsg({ sceneGrammarArtifact, semanticChoiceGraphArtifact, now }) {
  const timestamp = now();
  const axes = semanticChoiceGraphArtifact.axes || [];
  const axesById = new Map(axes.map((axis) => [axis.axisId, axis]));
  const orderedAxisIds = [
    'age',
    'sex',
    'male_role_type',
    'male_hat_hair',
    'male_top',
    'male_bottom',
    'male_footwear',
    'male_accessories',
    'male_condition_behavior',
    'female_role_type',
    'female_hat_hair',
    'female_top',
    'female_bottom',
    'female_footwear',
    'female_accessories',
    'female_condition_behavior'
  ];
  const nodes = orderedAxisIds
    .map((axisId) => axesById.get(axisId))
    .filter(Boolean)
    .map(semanticChoiceGraphAxisNode);
  const maleOutput = outputNode({ id: 'male-prompt-output', name: 'Male Prompt Output', x: 3000, y: 80 });
  const femaleOutput = outputNode({ id: 'female-prompt-output', name: 'Female Prompt Output', x: 3000, y: 420 });
  nodes.push(maleOutput, femaleOutput);
  const edges = [
    { id: 'edge-age-choice-sex-choice', source: 'age-choice', target: 'sex-choice' },
    { id: 'edge-sex-choice-male-role-choice', source: 'sex-choice', sourceHandle: 'branch-0', target: 'male-role-choice' },
    { id: 'edge-sex-choice-female-role-choice', source: 'sex-choice', sourceHandle: 'branch-1', target: 'female-role-choice' },
    ...laneEdges([
      'male-role-choice',
      'male-headwear-choice',
      'male-upper-body-choice',
      'male-lower-body-choice',
      'male-footwear-choice',
      'male-accessories-choice',
      'male-modifier-choice',
      'male-prompt-output'
    ]),
    ...laneEdges([
      'female-role-choice',
      'female-headwear-choice',
      'female-upper-body-choice',
      'female-lower-body-choice',
      'female-footwear-choice',
      'female-accessories-choice',
      'female-modifier-choice',
      'female-prompt-output'
    ])
  ].filter((edge) =>
    nodes.some((node) => node.id === edge.source) &&
      nodes.some((node) => node.id === edge.target)
  );

  return flatPsgFile({
    name: `${sceneGrammarArtifact.sceneContext.title} Semantic Prompt Graph`,
    description: 'Flat Prompt Spaghetti graph rendered from semantic-choice-graph.json.',
    createdAt: timestamp,
    nodes,
    edges,
    regions: [
      {
        id: 'region-semantic-router',
        name: 'Semantic Router',
        color: '#f4c542',
        nodes: ['age-choice', 'sex-choice'].filter((nodeId) => nodes.some((node) => node.id === nodeId)),
        description: 'Age and sex routing for sex-conditioned prompt lanes.'
      },
      {
        id: 'region-male-prompt',
        name: 'Male Prompt Lane',
        color: '#8fb36b',
        nodes: nodes.filter((node) => node.id.startsWith('male-')).map((node) => node.id),
        description: 'Male-conditioned role and wardrobe choices.'
      },
      {
        id: 'region-female-prompt',
        name: 'Female Prompt Lane',
        color: '#c8b15b',
        nodes: nodes.filter((node) => node.id.startsWith('female-')).map((node) => node.id),
        description: 'Female-conditioned role and wardrobe choices.'
      }
    ],
    metadata: {
      tags: ['metagrinder', 'scene-grammar', 'semantic'],
      semanticProjection: {
        graphShape: 'semantic-choice-graph-sex-conditioned-lanes',
        choiceGraphPath: 'semantic-choice-graph.json',
        analysisMode: semanticChoiceGraphArtifact.analysisMode,
        subject: semanticChoiceGraphArtifact.subject?.label || sceneGrammarArtifact.sceneContext.title,
        summary: semanticChoiceGraphArtifact.subject?.summary || sceneGrammarArtifact.sceneContext.summary,
        warnings: (semanticChoiceGraphArtifact.warnings || []).map((warning) => warning.message)
      }
    }
  });
}

function buildSemanticSceneGrammarPsg({ sceneGrammarArtifact, semanticChoiceGraphArtifact, now }) {
  if (semanticChoiceGraphArtifact) {
    return buildSemanticChoiceGraphPsg({
      sceneGrammarArtifact,
      semanticChoiceGraphArtifact,
      now
    });
  }
  const timestamp = now();
  const graphRoleArchetypes = sceneGrammarArtifact.archetypes.filter(isGraphRoleArchetype);
  const sourceRoleArchetypes = graphRoleArchetypes.length > 0 ? graphRoleArchetypes : sceneGrammarArtifact.archetypes;
  const semanticSource = {
    ...sceneGrammarArtifact,
    sourceRoleArchetypes
  };
  const ageNode = weightedChoiceNode({
    id: 'age-choice',
    name: 'Age Choice',
    choices: ageChoices(sceneGrammarArtifact),
    x: 80,
    y: 220
  });
  const sexNode = weightedChoiceNode({
    id: 'sex-choice',
    name: 'Sex Choice',
    choices: sexChoices(sceneGrammarArtifact),
    x: 400,
    y: 220
  });
  const maleLane = semanticLaneNodes({
    sceneGrammarArtifact: semanticSource,
    sex: 'male',
    label: 'Male',
    x: 760,
    y: 80
  });
  const femaleLane = semanticLaneNodes({
    sceneGrammarArtifact: semanticSource,
    sex: 'female',
    label: 'Female',
    x: 760,
    y: 420
  });
  const edges = [
    { id: 'edge-age-choice-sex-choice', source: 'age-choice', target: 'sex-choice' },
    { id: 'edge-sex-choice-male-role-choice', source: 'sex-choice', sourceHandle: 'branch-0', target: 'male-role-choice' },
    { id: 'edge-sex-choice-female-role-choice', source: 'sex-choice', sourceHandle: 'branch-1', target: 'female-role-choice' },
    ...laneEdges(maleLane.map((node) => node.id)),
    ...laneEdges(femaleLane.map((node) => node.id))
  ];
  const nodes = [ageNode, sexNode, ...maleLane, ...femaleLane];
  return flatPsgFile({
    name: `${sceneGrammarArtifact.sceneContext.title} Semantic Prompt Graph`,
    description: 'Flat Prompt Spaghetti graph projected from Codex brief analysis and Metagrinder scene grammar.',
    createdAt: timestamp,
    nodes,
    edges,
    regions: [
      {
        id: 'region-semantic-router',
        name: 'Semantic Router',
        color: '#f4c542',
        nodes: ['age-choice', 'sex-choice'],
        description: 'Age and sex routing for sex-conditioned prompt lanes.'
      },
      {
        id: 'region-male-prompt',
        name: 'Male Prompt Lane',
        color: '#8fb36b',
        nodes: maleLane.map((node) => node.id),
        description: 'Male-conditioned role and wardrobe choices.'
      },
      {
        id: 'region-female-prompt',
        name: 'Female Prompt Lane',
        color: '#c8b15b',
        nodes: femaleLane.map((node) => node.id),
        description: 'Female-conditioned role and wardrobe choices.'
      }
    ],
    metadata: {
      tags: ['metagrinder', 'scene-grammar', 'semantic'],
      semanticProjection: {
        graphShape: 'sex-conditioned-branch-lanes',
        subject: sceneGrammarArtifact.sceneContext.title,
        summary: sceneGrammarArtifact.sceneContext.summary,
        notes: [
          'The prompt path starts with weighted Age and Sex choices; source context is stored in metadata rather than a TextBlock node.',
          'Sex Choice branch-0 routes to the male lane and branch-1 routes to the female lane.',
          'Each sex lane has its own Output node so male and female wardrobe choices do not auto-concat together.',
          'Concat/merge nodes are intentionally avoided unless a future graph needs a real merge.',
          'Evidence detail nodes are intentionally omitted from the prompt graph so choice buckets remain readable.'
        ]
      }
    }
  });
}

function buildSceneGrammarPsg({ sceneGrammarArtifact, semanticChoiceGraphArtifact, now = () => new Date().toISOString() }) {
  const timestamp = now();
  if (semanticProjectionActive(sceneGrammarArtifact)) {
    return buildSemanticSceneGrammarPsg({ sceneGrammarArtifact, semanticChoiceGraphArtifact, now });
  }
  const archetypeChoices = sceneGrammarArtifact.archetypes.map((archetype) => ({
    id: archetype.archetypeId,
    text: archetype.label || archetype.promptText,
    weight: choiceWeightFromRange(archetype.weightRange)
  }));
  const locationChoices = sceneGrammarArtifact.locationZones.map((zone) => ({
    id: zone.zoneId,
    text: zone.promptText,
    weight: 1
  }));
  const environmentChoices = sceneGrammarArtifact.environmentalModifiers.map((modifier) => ({
    id: modifier.modifierId,
    text: modifier.promptText,
    weight: 1
  }));

  const baseNode = textNode({
    id: 'scene-context',
    name: 'Scene Context',
    value: sceneGrammarArtifact.sceneContext.summary,
    x: 80,
    y: 120
  });
  const choiceNodes = [
    weightedChoiceNode({
      id: 'archetype-choice',
      name: 'Archetype Choice',
      choices: archetypeChoices,
      x: 80,
      y: 300
    }),
    weightedChoiceNode({
      id: 'location-choice',
      name: 'Location Choice',
      choices: locationChoices.length > 0 ? locationChoices : [{ id: 'scene', text: 'scene-compatible location', weight: 1 }],
      x: 80,
      y: 480
    }),
    weightedChoiceNode({
      id: 'environment-choice',
      name: 'Environment Choice',
      choices: environmentChoices.length > 0 ? environmentChoices : [{ id: 'environment', text: 'source-consistent environment', weight: 1 }],
      x: 80,
      y: 660
    })
  ];
  const output = outputNode({
    id: 'prompt-output',
    name: 'Prompt Output',
    x: 1220,
    y: 120
  });
  const nodes = [baseNode, ...choiceNodes, output];
  const edges = directLinearEdges(nodes.map((node) => node.id));

  return flatPsgFile({
    name: `${sceneGrammarArtifact.sceneContext.title} Scene Grammar`,
    description: 'Flat Prompt Spaghetti graph compiled from Metagrinder scene grammar.',
    createdAt: timestamp,
    nodes,
    edges,
    regions: [{
      id: 'region-scene-grammar',
      name: 'Scene Grammar Prompt',
      color: '#22d3ee',
      nodes: nodes.map((node) => node.id)
    }]
  });
}

function branchWeight(archetype, branchId) {
  const base = archetype.weightRange
    ? Math.max(1, (archetype.weightRange.min + archetype.weightRange.max) / 2)
    : 1;

  if (branchId === 'rail') {
    if (archetype.archetypeId.includes('heat_adjusted') || archetype.archetypeId.includes('working_class')) return base * 1.8;
    if (archetype.genderPresentation === 'female' || archetype.role === 'child') return base * 0.2;
  }
  if (branchId === 'grandstand') {
    if (archetype.genderPresentation === 'female' || archetype.role === 'child') return base * 1.8;
    if (archetype.classBand === 'working') return base * 0.65;
  }
  if (branchId === 'pit') {
    return archetype.role === 'worker' || archetype.role === 'official' || archetype.archetypeId.includes('pit') ? base : 0;
  }
  if (branchId === 'infield') {
    if (archetype.archetypeId.includes('working_class') || archetype.role === 'child') return base * 1.25;
  }
  return base;
}

function buildBranchPsg({ sceneGrammarArtifact, branchId, branchLabel, choices, now }) {
  const timestamp = now();
  const safeChoices = choices.length > 0
    ? choices
    : [{ id: `${branchId}_review_needed`, text: `${branchLabel} needs compatible grammar choices before use`, weight: 1 }];
  const baseNode = textNode({
    id: `${branchId}-context`,
    name: `${branchLabel} Context`,
    value: `${branchLabel} compile-time branch generated from accepted scene grammar rules.`,
    x: 80,
    y: 120
  });
  const choiceNode = weightedChoiceNode({
    id: `${branchId}-choice`,
    name: `${branchLabel} Choice`,
    choices: safeChoices,
    x: 80,
    y: 300
  });
  const output = outputNode({
    id: `${branchId}-output`,
    name: `${branchLabel} Output`,
    x: 740,
    y: 120
  });
  const nodes = [baseNode, choiceNode, output];
  const edges = directLinearEdges(nodes.map((node) => node.id));

  return flatPsgFile({
    name: `${sceneGrammarArtifact.sceneContext.title} ${branchLabel}`,
    description: 'Flat Prompt Spaghetti branch graph generated from Metagrinder scene grammar.',
    createdAt: timestamp,
    nodes,
    edges,
    regions: [{
      id: `${branchId}-region`,
      name: branchLabel,
      color: '#22d3ee',
      nodes: nodes.map((node) => node.id)
    }],
    metadata: {
      tags: ['metagrinder', 'scene-grammar', 'branch', branchId]
    }
  });
}

function buildBranchSceneGrammarPsgs({ sceneGrammarArtifact, now = () => new Date().toISOString() }) {
  const branchGraphs = {};
  branchGraphs['scene-global-baseline.psg'] = buildSceneGrammarPsg({ sceneGrammarArtifact, now });

  ['grandstand', 'rail', 'pit', 'infield'].forEach((branchId) => {
    const zone = sceneGrammarArtifact.locationZones.find((entry) => entry.zoneId === branchId);
    if (!zone) return;
    const choices = sceneGrammarArtifact.archetypes
      .map((archetype) => ({
        id: archetype.archetypeId,
        text: `${archetype.promptText}, ${zone.promptText}`,
        weight: Number(branchWeight(archetype, branchId).toFixed(2))
      }))
      .filter((choice) => choice.weight > 0);

    branchGraphs[`scene-${branchId}-branch.psg`] = buildBranchPsg({
      sceneGrammarArtifact,
      branchId,
      branchLabel: zone.label,
      choices,
      now
    });
  });

  branchGraphs['scene-negative-constraints.psg'] = buildBranchPsg({
    sceneGrammarArtifact,
    branchId: 'negative-constraints',
    branchLabel: 'Negative Constraints',
    choices: sceneGrammarArtifact.negativeConstraints.map((constraint) => ({
      id: constraint.constraintId,
      text: constraint.text,
      weight: constraint.constraintType.includes('ethical') ? 3 : 2
    })),
    now
  });

  branchGraphs['scene-specimen-reference-router.psg'] = buildBranchPsg({
    sceneGrammarArtifact,
    branchId: 'specimen-reference-router',
    branchLabel: 'Specimen Reference Router',
    choices: sceneGrammarArtifact.visualReferenceSets.map((reference) => ({
      id: reference.referenceId,
      text: `${reference.caption} Supports: ${reference.supports.join('; ')}`,
      weight: 1
    })),
    now
  });

  return branchGraphs;
}

module.exports = {
  buildBranchSceneGrammarPsgs,
  buildSceneGrammarPsg
};

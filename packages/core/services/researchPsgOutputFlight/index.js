const crypto = require('crypto');

const DEFAULT_SAMPLE_COUNT = 20;
const DEFAULT_SEEDS = Object.freeze([
  1234, 5678, 9012, 6960, 1701,
  2049, 3141, 4242, 5150, 6006,
  7777, 8080, 9191, 1001, 1103,
  1207, 1309, 1409, 1511, 1613
]);

const AXIS_ORDER = Object.freeze([
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
]);

function sha256Json(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function mulberry32(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick(choices, rng) {
  const safeChoices = (choices || []).filter((choice) => choice && choice.text);
  if (safeChoices.length === 0) return null;
  const total = safeChoices.reduce((sum, choice) => sum + Math.max(0, Number(choice.weight) || 1), 0);
  let cursor = rng() * (total || safeChoices.length);
  for (const choice of safeChoices) {
    cursor -= Math.max(0, Number(choice.weight) || 1);
    if (cursor <= 0) return choice;
  }
  return safeChoices[safeChoices.length - 1];
}

function axisMap(semanticChoiceGraphArtifact) {
  return new Map((semanticChoiceGraphArtifact.axes || []).map((axis) => [axis.axisId, axis]));
}

function selectedSexId(selectedChoices) {
  const sexChoice = selectedChoices.find((choice) => choice.axisId === 'sex');
  const text = String(sexChoice?.text || '').toLowerCase();
  if (/female|woman|girl/.test(text)) return 'female';
  return 'male';
}

function activeAxisIdsForSex(sex) {
  return AXIS_ORDER.filter((axisId) =>
    axisId === 'age' ||
    axisId === 'sex' ||
    axisId.startsWith(`${sex}_`)
  );
}

function normalizeOutputText(parts) {
  return parts
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function buildOutputForSeed({ semanticChoiceGraphArtifact, seed }) {
  const rng = mulberry32(seed);
  const axes = axisMap(semanticChoiceGraphArtifact);
  const selectedChoices = [];
  ['age', 'sex'].forEach((axisId) => {
    const axis = axes.get(axisId);
    const selected = weightedPick(axis?.choices || [], rng);
    if (selected) {
      selectedChoices.push({
        axisId,
        axisLabel: axis.label,
        choiceId: selected.choiceId,
        text: selected.text,
        weight: selected.weight
      });
    }
  });
  const sex = selectedSexId(selectedChoices);
  activeAxisIdsForSex(sex)
    .filter((axisId) => axisId !== 'age' && axisId !== 'sex')
    .forEach((axisId) => {
      const axis = axes.get(axisId);
      const selected = weightedPick(axis?.choices || [], rng);
      if (selected) {
        selectedChoices.push({
          axisId,
          axisLabel: axis.label,
          choiceId: selected.choiceId,
          text: selected.text,
          weight: selected.weight
        });
      }
    });
  return {
    seed,
    outputText: normalizeOutputText(selectedChoices.map((choice) => choice.text)),
    selectedChoices
  };
}

function buildPsgOutputFlightArtifact({
  inputId,
  semanticChoiceGraphArtifact,
  psgArtifact,
  graphPath = 'scene-grammar.psg',
  sampleCount = DEFAULT_SAMPLE_COUNT,
  createdAt = new Date().toISOString()
}) {
  if (!semanticChoiceGraphArtifact || !Array.isArray(semanticChoiceGraphArtifact.axes)) {
    throw new Error('semantic-choice-graph.json is required to generate a readability flight.');
  }
  const nodes = psgArtifact?.nodes || psgArtifact?.graph?.nodes;
  if (!psgArtifact || !Array.isArray(nodes)) {
    throw new Error(`${graphPath} is required to generate a readability flight.`);
  }
  const count = Math.max(1, Math.min(50, Number(sampleCount) || DEFAULT_SAMPLE_COUNT));
  const seeds = DEFAULT_SEEDS.slice(0, count);
  return {
    inputId: inputId || semanticChoiceGraphArtifact.inputId,
    artifactType: 'psg-output-flight',
    createdAt,
    graphPath,
    graphHash: sha256Json(psgArtifact),
    semanticChoiceGraphHash: sha256Json(semanticChoiceGraphArtifact),
    sampleCount: seeds.length,
    seeds,
    samples: seeds.map((seed) => buildOutputForSeed({ semanticChoiceGraphArtifact, seed }))
  };
}

module.exports = {
  DEFAULT_SAMPLE_COUNT,
  DEFAULT_SEEDS,
  buildOutputForSeed,
  buildPsgOutputFlightArtifact,
  sha256Json
};

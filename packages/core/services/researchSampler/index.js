const {
  MetagrinderSamplePromptsArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function pickFirst(values) {
  return values && values.length > 0 ? values[0] : undefined;
}

function zoneRule(sceneGrammarArtifact, zoneId) {
  return sceneGrammarArtifact.compatibilityRules.find((rule) =>
    rule.condition.field === 'location_zone' && rule.condition.value === zoneId
  );
}

function archetypeScoreForZone(archetype, zoneId) {
  if (zoneId === 'rail') {
    if (archetype.archetypeId.includes('heat_adjusted')) return 8;
    if (archetype.archetypeId.includes('working_class')) return 7;
    if (archetype.genderPresentation === 'male') return 4;
    return 1;
  }
  if (zoneId === 'grandstand') {
    if (archetype.archetypeId.includes('female')) return 6;
    if (archetype.archetypeId.includes('child')) return 5;
    if (archetype.classBand === 'middle' || archetype.classBand === 'affluent') return 4;
    return 2;
  }
  if (zoneId === 'pit') {
    return archetype.role === 'worker' || archetype.role === 'official' || archetype.archetypeId.includes('pit')
      ? 10
      : 0;
  }
  if (zoneId === 'infield') {
    return archetype.archetypeId.includes('working_class') || archetype.archetypeId.includes('child') ? 5 : 3;
  }
  return 1;
}

function selectArchetypeForZone(sceneGrammarArtifact, zoneId) {
  const ranked = [...sceneGrammarArtifact.archetypes]
    .map((archetype) => ({
      archetype,
      score: archetypeScoreForZone(archetype, zoneId)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.archetype || sceneGrammarArtifact.archetypes[0];
}

function buildPromptForArchetype({ archetype, sceneGrammarArtifact, locationZone }) {
  const behavior = pickFirst(sceneGrammarArtifact.behaviorStates.filter((entry) =>
    archetype.behaviorRefs.includes(entry.behaviorId)
  ));
  const environmental = sceneGrammarArtifact.environmentalModifiers
    .slice(0, 2)
    .map((modifier) => modifier.promptText)
    .join(', ');
  const attributes = [
    ...(archetype.dominantAttributes || []),
    ...(archetype.optionalAttributes || []).slice(0, 2)
  ].join(', ');

  return [
    archetype.promptText,
    attributes,
    locationZone ? `in ${locationZone.promptText}` : '',
    locationZone?.zoneId === 'pit' ? 'as a worker or official role, not a casual viewer' : '',
    behavior ? behavior.promptText : '',
    environmental
  ].filter(Boolean).join(', ');
}

function makeSample({ sceneGrammarArtifact, archetype, zone, sampleMode, suffix, invalidPrompt }) {
  const rule = zone ? zoneRule(sceneGrammarArtifact, zone.zoneId) : undefined;
  return {
    sampleId: `${sceneGrammarArtifact.inputId}_sample_${suffix}`,
    sampleMode,
    locationZone: zone?.zoneId,
    selectedArchetypeIds: archetype ? [archetype.archetypeId] : [],
    generatedPrompt: invalidPrompt || buildPromptForArchetype({
      archetype,
      sceneGrammarArtifact,
      locationZone: zone
    }),
    grammarRefs: [
      ...(archetype ? [`archetypes.${archetype.archetypeId}`] : []),
      ...(zone ? [`locationZones.${zone.zoneId}`] : ['populationModel.baselineWeights']),
      ...(rule ? [`compatibilityRules.${rule.ruleId}`] : [])
    ],
    sourceChunkIds: [...new Set([
      ...(archetype?.sourceChunkIds || []),
      ...(zone?.sourceChunkIds || []),
      ...(rule?.sourceChunkIds || [])
    ])]
  };
}

function buildSamplePromptsArtifact({ sceneGrammarArtifact }) {
  const samples = [];
  const primaryArchetype = sceneGrammarArtifact.archetypes[0];

  if (primaryArchetype) {
    samples.push(makeSample({
      sceneGrammarArtifact,
      archetype: primaryArchetype,
      sampleMode: 'global-baseline',
      suffix: '001'
    }));
  }

  sceneGrammarArtifact.locationZones.forEach((zone) => {
    const archetype = selectArchetypeForZone(sceneGrammarArtifact, zone.zoneId);
    if (!archetype) return;
    samples.push(makeSample({
      sceneGrammarArtifact,
      archetype,
      zone,
      sampleMode: 'location-zone',
      suffix: String(samples.length + 1).padStart(3, '0')
    }));
  });

  sceneGrammarArtifact.archetypes.slice(1, 5).forEach((archetype) => {
    samples.push(makeSample({
      sceneGrammarArtifact,
      archetype,
      sampleMode: 'archetype',
      suffix: String(samples.length + 1).padStart(3, '0')
    }));
  });

  const pitZone = sceneGrammarArtifact.locationZones.find((zone) => zone.zoneId === 'pit');
  const femaleArchetype = sceneGrammarArtifact.archetypes.find((archetype) =>
    archetype.archetypeId.includes('female')
  );
  if (pitZone && femaleArchetype) {
    samples.push(makeSample({
      sceneGrammarArtifact,
      archetype: femaleArchetype,
      zone: pitZone,
      sampleMode: 'invalid-test',
      suffix: String(samples.length + 1).padStart(3, '0'),
      invalidPrompt: 'Female spectator in a large period picture hat, oil-stained mechanic coat, goggles, standing in the pit as a casual viewer.'
    }));
  }

  return MetagrinderSamplePromptsArtifactSchema.parse({
    inputId: sceneGrammarArtifact.inputId,
    samples
  });
}

module.exports = {
  buildSamplePromptsArtifact,
  selectArchetypeForZone
};

const {
  MetagrinderPsgV2FileSchema
} = require('../../types/metagrinder.runtime.js');

function editState(now) {
  return {
    isEditing: false,
    editBuffer: null,
    lastEditTimestamp: now,
    validationErrors: [],
    isDirty: false
  };
}

function textNode({ id, label, value, x, y, now, tags = [] }) {
  return {
    id,
    type: 'TextBlock',
    position: { x, y },
    data: {
      value,
      editState: editState(now),
      isValid: true,
      multiline: true
    },
    label,
    tags
  };
}

function weightedChoiceNode({ id, label, choices, x, y, now, tags = [] }) {
  return {
    id,
    type: 'WeightedChoice',
    position: { x, y },
    data: {
      value: choices,
      choices,
      editState: editState(now),
      normalizeWeights: true,
      showPercentages: true,
      allowAddRemove: true
    },
    label,
    tags
  };
}

function buildSceneGrammarPsg({ sceneGrammarArtifact, now = () => new Date().toISOString() }) {
  const timestamp = now();
  const archetypeChoices = sceneGrammarArtifact.archetypes.map((archetype) => ({
    id: archetype.archetypeId,
    text: archetype.promptText,
    weight: archetype.weightRange
      ? Math.max(1, Number(((archetype.weightRange.min + archetype.weightRange.max) / 2).toFixed(2)))
      : 1
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

  const nodes = [
    textNode({
      id: 'scene-context',
      label: 'Scene Context',
      value: sceneGrammarArtifact.sceneContext.summary,
      x: 80,
      y: 80,
      now: timestamp,
      tags: ['scene-grammar', 'context']
    }),
    weightedChoiceNode({
      id: 'archetype-choice',
      label: 'Archetype Choice',
      choices: archetypeChoices,
      x: 80,
      y: 260,
      now: timestamp,
      tags: ['scene-grammar', 'archetypes']
    }),
    weightedChoiceNode({
      id: 'location-choice',
      label: 'Location Choice',
      choices: locationChoices.length > 0 ? locationChoices : [{ id: 'scene', text: 'scene-compatible location', weight: 1 }],
      x: 80,
      y: 460,
      now: timestamp,
      tags: ['scene-grammar', 'location']
    }),
    weightedChoiceNode({
      id: 'environment-choice',
      label: 'Environment Choice',
      choices: environmentChoices.length > 0 ? environmentChoices : [{ id: 'environment', text: 'source-consistent environment', weight: 1 }],
      x: 80,
      y: 660,
      now: timestamp,
      tags: ['scene-grammar', 'environment']
    }),
    {
      id: 'prompt-compose',
      type: 'Concat',
      position: { x: 520, y: 420 },
      data: {
        value: {
          separator: ', ',
          trimInputs: true
        },
        editState: editState(timestamp)
      },
      label: 'Prompt Compose',
      tags: ['scene-grammar', 'compose']
    },
    {
      id: 'prompt-output',
      type: 'Output',
      position: { x: 860, y: 420 },
      data: {
        value: '{input}',
        editState: editState(timestamp)
      },
      label: 'Prompt Output',
      tags: ['scene-grammar', 'output']
    }
  ];

  const edges = [
    { id: 'edge-context-compose', source: 'scene-context', target: 'prompt-compose', targetHandle: 'input1' },
    { id: 'edge-archetype-compose', source: 'archetype-choice', target: 'prompt-compose', targetHandle: 'input2' },
    { id: 'edge-location-compose', source: 'location-choice', target: 'prompt-compose', targetHandle: 'input3' },
    { id: 'edge-environment-compose', source: 'environment-choice', target: 'prompt-compose', targetHandle: 'input4' },
    { id: 'edge-compose-output', source: 'prompt-compose', target: 'prompt-output' }
  ];

  return MetagrinderPsgV2FileSchema.parse({
    fileType: 'psg',
    formatVersion: '2.0.0',
    metadata: {
      name: `${sceneGrammarArtifact.sceneContext.title} Scene Grammar`,
      description: 'Compiled from Metagrinder scene grammar.',
      createdAt: timestamp,
      lastModified: timestamp,
      author: 'Metagrinder'
    },
    graph: {
      nodes,
      edges
    }
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

  const nodes = [
    textNode({
      id: `${branchId}-context`,
      label: `${branchLabel} Context`,
      value: `${branchLabel} compile-time branch generated from accepted scene grammar rules.`,
      x: 80,
      y: 80,
      now: timestamp,
      tags: ['scene-grammar', 'branch', branchId]
    }),
    weightedChoiceNode({
      id: `${branchId}-choice`,
      label: `${branchLabel} Choice`,
      choices: safeChoices,
      x: 80,
      y: 260,
      now: timestamp,
      tags: ['scene-grammar', 'branch', branchId]
    }),
    {
      id: `${branchId}-output`,
      type: 'Output',
      position: { x: 500, y: 260 },
      data: {
        value: '{input}',
        editState: editState(timestamp)
      },
      label: `${branchLabel} Output`,
      tags: ['scene-grammar', 'branch', branchId]
    }
  ];

  const edges = [
    { id: `${branchId}-edge-context-choice`, source: `${branchId}-context`, target: `${branchId}-choice` },
    { id: `${branchId}-edge-choice-output`, source: `${branchId}-choice`, target: `${branchId}-output` }
  ];

  return MetagrinderPsgV2FileSchema.parse({
    fileType: 'psg',
    formatVersion: '2.0.0',
    metadata: {
      name: `${sceneGrammarArtifact.sceneContext.title} ${branchLabel}`,
      description: 'Compile-time branch graph generated from Metagrinder scene grammar.',
      createdAt: timestamp,
      lastModified: timestamp,
      author: 'Metagrinder'
    },
    graph: { nodes, edges }
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

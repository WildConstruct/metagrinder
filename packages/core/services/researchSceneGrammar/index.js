const {
  MetagrinderSceneGrammarArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'record';
}

function mergeUniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function combinedText(ingestArtifact) {
  return ingestArtifact.chunks.map((chunk) => chunk.text).join('\n');
}

function chunksMatching(ingestArtifact, keywords) {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return ingestArtifact.chunks.filter((chunk) => {
    const text = `${chunk.sectionLabel || ''}\n${chunk.text}`.toLowerCase();
    return normalizedKeywords.some((keyword) => text.includes(keyword));
  });
}

function chunkIdsFor(ingestArtifact, keywords) {
  return chunksMatching(ingestArtifact, keywords).map((chunk) => chunk.chunkId);
}

function sourceInputIdsFor(ingestArtifact, sourceChunkIds) {
  return mergeUniqueStrings(
    ingestArtifact.chunks
      .filter((chunk) => sourceChunkIds.includes(chunk.chunkId))
      .map((chunk) => chunk.sourceInputId)
  );
}

function parseWeightRangeFromText(text, fallbackLabel) {
  const weightMatch = text.match(/(?:weight|share|baseline|adult men|adult women|children|working|middle|affluent)[^0-9]{0,32}(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*%/i);
  if (!weightMatch) {
    if (/half to three[- ]fifths|half to 3\/5|three[- ]fifths/i.test(text)) {
      return {
        label: fallbackLabel,
        min: 50,
        max: 60,
        unit: 'percent',
        confidence: 'medium'
      };
    }
    if (/one[- ]fifth to one[- ]third|fifth to a third/i.test(text)) {
      return {
        label: fallbackLabel,
        min: 20,
        max: 33,
        unit: 'percent',
        confidence: 'medium'
      };
    }
    if (/rare in number|sparse|visually significant|visually important/i.test(text)) {
      return {
        label: fallbackLabel,
        min: 5,
        max: 8,
        unit: 'percent',
        confidence: 'low'
      };
    }
    return undefined;
  }

  return {
    label: fallbackLabel,
    min: Number(weightMatch[1]),
    max: Number(weightMatch[2]),
    unit: 'percent',
    confidence: 'medium'
  };
}

function buildWeightRange({ label, min, max, sourceInputIds, sourceChunkIds, confidence = 'medium' }) {
  return {
    label,
    min,
    max,
    unit: 'percent',
    sourceInputIds,
    sourceChunkIds,
    confidence
  };
}

function extractAttributesFromText(text, candidateItems) {
  const normalized = String(text || '').toLowerCase();
  return candidateItems.filter((item) => normalized.includes(item.toLowerCase()));
}

function focusedSliceForDefinition(sourceText, definition) {
  const fullText = String(sourceText || '');
  const lower = fullText.toLowerCase();
  const starts = definition.keywords
    .map((keyword) => lower.indexOf(keyword.toLowerCase()))
    .filter((index) => index >= 0);
  if (starts.length === 0) {
    return fullText;
  }

  const start = Math.min(...starts);
  const endMarkers = [
    ...[...ARCHETYPE_DEFINITIONS, ...GENERIC_ARCHETYPE_DEFINITIONS]
      .filter((candidate) => candidate.archetypeId !== definition.archetypeId)
      .flatMap((candidate) => [candidate.label, ...candidate.keywords]),
    'location-zone logic',
    'negative constraints',
    'environmental modifiers',
    'visual reference'
  ];
  const ends = endMarkers
    .map((marker) => lower.indexOf(marker.toLowerCase(), start + 8))
    .filter((index) => index > start);
  const end = ends.length > 0 ? Math.min(...ends) : fullText.length;
  return fullText.slice(start, end).trim();
}

const ARCHETYPE_DEFINITIONS = [
  {
    archetypeId: 'middle_class_spectator',
    label: 'Middle-class spectator',
    keywords: ['middle-class spectator', 'respectable', 'clerk', 'businessman'],
    role: 'spectator',
    genderPresentation: 'male',
    classBand: 'middle',
    promptText: 'adult spectator in formal public daywear with suit, shirt, tie, hat, and restrained period styling',
    fallbackWeight: [50, 60]
  },
  {
    archetypeId: 'heat_adjusted_spectator',
    label: 'Heat-adjusted spectator',
    keywords: ['heat-adjusted', 'shirtsleeves', 'jacket removed', 'suspenders'],
    role: 'spectator',
    genderPresentation: 'male',
    classBand: 'lower_middle',
    promptText: 'adult spectator adapted to heat with shirt sleeves, suspenders, hat, dusty shoes, and jacket removed or carried',
    fallbackWeight: [20, 30]
  },
  {
    archetypeId: 'working_class_trackside',
    label: 'Working-class trackside spectator',
    keywords: ['working-class trackside', 'working-class', 'flat cap', 'work boots'],
    role: 'spectator',
    genderPresentation: 'male',
    classBand: 'working',
    promptText: 'working-class spectator in worn trousers, shirt, suspenders, practical shoes, and less polished styling',
    fallbackWeight: [10, 15]
  },
  {
    archetypeId: 'affluent_spectator',
    label: 'Affluent or club spectator',
    keywords: ['affluent', 'club spectator', 'linen suit', 'panama'],
    role: 'spectator',
    genderPresentation: 'male',
    classBand: 'affluent',
    promptText: 'affluent spectator with cleaner silhouette, light suit, polished shoes, and refined accessories',
    fallbackWeight: [5, 10]
  },
  {
    archetypeId: 'female_middle_class_spectator',
    label: 'Female middle-class spectator',
    keywords: ['female spectator', 'women', 'shirtwaist', 'large hat'],
    role: 'spectator',
    genderPresentation: 'female',
    classBand: 'middle',
    promptText: 'female spectator in long skirt or dress, blouse, large hat, gloves or parasol, placed in social viewing zones',
    fallbackWeight: [5, 8]
  },
  {
    archetypeId: 'child_or_teen_spectator',
    label: 'Child or teen spectator',
    keywords: ['children', 'teens', 'boys', 'girls'],
    role: 'child',
    genderPresentation: 'child',
    classBand: 'family',
    promptText: 'child or teen spectator accompanying adults, dressed in period-appropriate youth clothing',
    fallbackWeight: [2, 6]
  },
  {
    archetypeId: 'underrepresented_middle_class_spectator',
    label: 'Underrepresented middle-class spectator',
    keywords: ['african american', 'not make black', 'not reduce black', 'representation'],
    role: 'spectator',
    genderPresentation: 'male',
    classBand: 'middle',
    raceEthnicityContext: 'underrepresented_local_community',
    promptText: 'well-dressed underrepresented community spectator with the same class variation and spectator behavior as comparable public attendees',
    fallbackWeight: [3, 8]
  },
  {
    archetypeId: 'worker_official_pit_role',
    label: 'Worker or official role',
    keywords: ['worker', 'official', 'pit', 'mechanic', 'driver', 'press'],
    role: 'worker',
    genderPresentation: 'male',
    classBand: 'working',
    promptText: 'worker, official, mechanic, driver, or press role in controlled work areas with practical workwear and source-supported tools',
    fallbackWeight: [3, 8]
  }
];

const GENERIC_ARCHETYPE_DEFINITIONS = [
  {
    archetypeId: 'market_vendor',
    label: 'Market vendor',
    keywords: ['market vendor', 'vendor', 'stall keeper', 'stall-keeper'],
    role: 'vendor',
    genderPresentation: 'mixed',
    classBand: 'working',
    promptText: 'market vendor managing goods at a stall with practical clothing, apron, ledger, baskets, and source-supported trade props',
    fallbackWeight: [35, 45]
  },
  {
    archetypeId: 'market_shopper',
    label: 'Market shopper',
    keywords: ['market shopper', 'shopper', 'town buyer', 'buyer'],
    role: 'shopper',
    genderPresentation: 'mixed',
    classBand: 'mixed',
    promptText: 'town shopper comparing goods, carrying a basket or purse, dressed for ordinary public market activity',
    fallbackWeight: [30, 40]
  },
  {
    archetypeId: 'guild_messenger',
    label: 'Guild messenger',
    keywords: ['guild messenger', 'messenger', 'runner', 'courier'],
    role: 'messenger',
    genderPresentation: 'mixed',
    classBand: 'working',
    promptText: 'guild messenger moving through the market with satchel, sealed note, and practical travel clothing',
    fallbackWeight: [10, 15]
  },
  {
    archetypeId: 'foreign_trader',
    label: 'Foreign trader',
    keywords: ['foreign trader', 'outsider trader', 'visiting trader'],
    role: 'trader',
    genderPresentation: 'mixed',
    classBand: 'merchant',
    raceEthnicityContext: 'underrepresented_local_community',
    promptText: 'visiting or outsider trader shown as a full commercial participant with varied merchant status and ordinary market behavior',
    fallbackWeight: [5, 10]
  }
];

const LOCATION_DEFINITIONS = [
  ['grandstand', 'Grandstand', 'seated or dense social viewing area with more complete outfits and family groups'],
  ['rail', 'Rail or fence', 'track-edge viewing zone with more adult men, shirtsleeves, and lower-middle or working-class spectators'],
  ['pit', 'Pit or official area', 'controlled work zone for officials, mechanics, drivers, press, and support roles'],
  ['infield', 'Infield or grounds', 'broader public space with looser posture and mixed casual viewing'],
  ['walkway', 'Walkway or concession approach', 'movement zone with people passing, clustering, carrying programs, or pausing'],
  ['stalls', 'Stalls', 'market stall zone with vendors, shoppers, baskets, hanging goods, and close negotiation'],
  ['gate', 'Gate', 'market entry zone with arrivals, guards, messengers, carts, and directional movement'],
  ['fountain', 'Fountain', 'central social zone with shoppers pausing, children nearby, water carriers, and public conversation']
];

function buildBehaviorStates(ingestArtifact) {
  const behaviorDefs = [
    ['watching_track', ['watching', 'scanned', 'watching track'], 'watching the central action with focused attention'],
    ['leaning', ['leaning', 'leaned', 'rail'], 'leaning at a rail or edge to see better'],
    ['walking_group', ['walking', 'group', 'clusters', 'clustered'], 'moving or clustering in small public groups'],
    ['seated_viewing', ['seated', 'grandstand'], 'seated in a denser viewing area'],
    ['working_or_official', ['official', 'pit', 'mechanic', 'driver'], 'performing work, official, mechanical, or support duties'],
    ['selling_goods', ['selling', 'vendor', 'stall keeper', 'weighing'], 'selling, weighing, arranging, or guarding goods in a public market'],
    ['buying_or_bargaining', ['buying', 'shopper', 'bargaining', 'buyer'], 'comparing goods, bargaining, and moving between stalls'],
    ['message_running', ['messenger', 'runner', 'courier'], 'moving quickly through a crowd while carrying a message or satchel']
  ];

  return behaviorDefs
    .map(([behaviorId, keywords, promptText]) => ({
      behaviorId,
      label: behaviorId.split('_').join(' '),
      promptText,
      sourceChunkIds: chunkIdsFor(ingestArtifact, keywords)
    }))
    .filter((behavior) => behavior.sourceChunkIds.length > 0);
}

function buildEnvironmentalModifiers(ingestArtifact) {
  const modifierDefs = [
    ['heat_state', ['heat', 'hot', 'sweat', 'shirtsleeves'], 'heat adaptation visible in loosened dress, jacket removal, and practical comfort choices'],
    ['dust_soiling', ['dust', 'dusty', 'soiled'], 'dust accumulation on shoes, hems, trouser cuffs, and lower garments'],
    ['bright_daylight', ['sun', 'daylight', 'bright'], 'bright outdoor daylight with hard visibility and squinting'],
    ['smoke_or_haze', ['smoke', 'haze', 'gasoline'], 'light atmospheric haze from dust, smoke, fuel, or industrial activity'],
    ['mud_state', ['mud', 'rain', 'wet'], 'mud, wet hems, and slippery paving influence stance, footwear, and garment edges'],
    ['crowded_morning', ['morning crowd', 'crowded morning', 'market morning'], 'busy morning market density with blocked sightlines and overlapping public movement']
  ];

  return modifierDefs
    .map(([modifierId, keywords, promptText]) => ({
      modifierId,
      label: modifierId.split('_').join(' '),
      promptText,
      sourceChunkIds: chunkIdsFor(ingestArtifact, keywords)
    }))
    .filter((modifier) => modifier.sourceChunkIds.length > 0);
}

function buildWardrobeSystem(ingestArtifact) {
  const wardrobeDefs = [
    ['formal_daywear', ['sack suit', 'suit', 'waistcoat', 'tie'], ['sack suit', 'waistcoat', 'white shirt', 'tie']],
    ['heat_adjusted_daywear', ['shirtsleeves', 'suspenders', 'jacket removed'], ['white shirt', 'suspenders', 'jacket removed', 'dark trousers']],
    ['hat_system', ['boater', 'flat cap', 'panama', 'bowler'], ['straw boater', 'flat cap', 'Panama hat', 'bowler']],
    ['female_public_daywear', ['shirtwaist', 'long skirt', 'large hat', 'parasol'], ['shirtwaist blouse', 'long skirt', 'large hat', 'gloves', 'parasol']],
    ['work_or_official_wear', ['dust coat', 'goggles', 'mechanic', 'official'], ['dust coat', 'cap', 'goggles', 'work gloves']],
    ['market_workwear', ['apron', 'wool tunic', 'head cloth', 'ledger'], ['linen apron', 'wool tunic', 'head cloth', 'belt pouch', 'ledger']],
    ['market_public_wear', ['hooded cloak', 'simple veil', 'basket', 'purse'], ['hooded cloak', 'simple veil', 'basket', 'purse', 'plain shoes']]
  ];

  return wardrobeDefs
    .map(([wardrobeId, keywords, items]) => ({
      wardrobeId,
      label: wardrobeId.split('_').join(' '),
      items,
      avoidItems: [],
      sourceChunkIds: chunkIdsFor(ingestArtifact, keywords)
    }))
    .filter((wardrobe) => wardrobe.sourceChunkIds.length > 0);
}

function buildPropsAndAccessories(ingestArtifact) {
  const propDefs = [
    ['spectator_accessories', ['parasol', 'cane', 'gloves', 'pocket watch', 'program'], ['parasol', 'cane', 'gloves', 'pocket watch', 'program']],
    ['work_area_tools', ['clipboard', 'timing sheet', 'goggles', 'work gloves'], ['clipboard', 'timing sheet', 'goggles', 'work gloves']],
    ['weather_comfort_objects', ['umbrella', 'scarf', 'muff'], ['umbrella', 'scarf', 'muff']],
    ['market_goods', ['basket', 'scales', 'fish crate', 'herb bundle', 'ledger'], ['basket', 'scales', 'fish crate', 'herb bundle', 'ledger']],
    ['messenger_objects', ['satchel', 'sealed note', 'guild token'], ['satchel', 'sealed note', 'guild token']]
  ];

  return propDefs
    .map(([wardrobeId, keywords, items]) => ({
      wardrobeId,
      label: wardrobeId.split('_').join(' '),
      items,
      avoidItems: [],
      sourceChunkIds: chunkIdsFor(ingestArtifact, keywords)
    }))
    .filter((entry) => entry.sourceChunkIds.length > 0);
}

function buildVisualReferenceSets(ingestArtifact, archetypes) {
  const chunks = chunksMatching(ingestArtifact, ['visual reference', 'image reference', 'caption:']);
  return chunks.map((chunk, index) => {
    const linkedArchetypeIds = archetypes
      .filter((archetype) => {
        const text = chunk.text.toLowerCase();
        return text.includes(archetype.label.toLowerCase().split(' ')[0]) ||
          text.includes('boater') ||
          text.includes('spectator');
      })
      .map((archetype) => archetype.archetypeId)
      .slice(0, 3);

    return {
      referenceId: `${ingestArtifact.inputId}_visual_reference_${String(index + 1).padStart(3, '0')}`,
      kind: 'image-reference',
      path: `references/${ingestArtifact.inputId}-${String(index + 1).padStart(3, '0')}.jpg`,
      caption: chunk.text.replace(/^visual references?:?/i, '').trim(),
      supports: chunk.text
        .split(/[.;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 5),
      linkedArchetypeIds,
      rightsProfile: 'reference-only',
      sourceChunkIds: [chunk.chunkId]
    };
  });
}

function buildArchetypes(ingestArtifact, wardrobeSystem, behaviorStates) {
  const text = combinedText(ingestArtifact).toLowerCase();
  const archetypes = [...ARCHETYPE_DEFINITIONS, ...GENERIC_ARCHETYPE_DEFINITIONS]
    .filter((definition) => definition.keywords.some((keyword) => text.includes(keyword)))
    .map((definition) => {
      const sourceChunkIds = chunkIdsFor(ingestArtifact, definition.keywords);
      const sourceInputIds = sourceInputIdsFor(ingestArtifact, sourceChunkIds);
      const broadSourceText = chunksMatching(ingestArtifact, definition.keywords)
        .map((chunk) => chunk.text)
        .join(' ');
      const sourceText = focusedSliceForDefinition(broadSourceText, definition);
      const parsedWeight = parseWeightRangeFromText(sourceText, definition.label);
      const [fallbackMin, fallbackMax] = definition.fallbackWeight;
      const dominantAttributes = extractAttributesFromText(sourceText, [
        'straw boater',
        'dark suit',
        'mid-tone suit',
        'white shirt',
        'tie',
        'leather shoes',
        'suspenders',
        'rolled sleeves',
        'flat cap',
        'work boots',
        'linen suit',
        'Panama hat',
        'large hat',
        'long skirt',
        'shirtwaist blouse',
        'parasol',
        'period-appropriate youth clothing',
        'linen apron',
        'wool tunic',
        'head cloth',
        'basket',
        'scales',
        'satchel',
        'sealed note',
        'hooded cloak',
        'simple veil'
      ]);
      const optionalAttributes = extractAttributesFromText(sourceText, [
        'waistcoat',
        'hat band',
        'jacket carried',
        'bow tie',
        'worn clothing',
        'gloves',
        'cane',
        'family group',
        'ledger',
        'fish crate',
        'herb bundle',
        'guild token',
        'purse'
      ]);
      const behaviorRefs = behaviorStates
        .filter((behavior) => behavior.sourceChunkIds.some((chunkId) => sourceChunkIds.includes(chunkId)))
        .map((behavior) => behavior.behaviorId);

      return {
        archetypeId: definition.archetypeId,
        label: definition.label,
        summary: sourceText || definition.promptText,
        role: definition.role,
        genderPresentation: definition.genderPresentation,
        classBand: definition.classBand,
        raceEthnicityContext: definition.raceEthnicityContext,
        weightRange: buildWeightRange({
          label: definition.label,
          min: parsedWeight ? parsedWeight.min : fallbackMin,
          max: parsedWeight ? parsedWeight.max : fallbackMax,
          sourceInputIds,
          sourceChunkIds,
          confidence: parsedWeight ? 'medium' : 'low'
        }),
        dominantAttributes,
        optionalAttributes,
        wardrobeRefs: wardrobeSystem
          .filter((wardrobe) => wardrobe.sourceChunkIds.some((chunkId) => sourceChunkIds.includes(chunkId)))
          .map((wardrobe) => wardrobe.wardrobeId),
        behaviorRefs,
        locationZoneRefs: LOCATION_DEFINITIONS
          .filter(([zoneId]) => sourceText.toLowerCase().includes(zoneId))
          .map(([zoneId]) => zoneId),
        promptText: definition.promptText,
        sourceInputIds,
        sourceChunkIds,
        confidence: sourceChunkIds.length > 0 ? 'medium' : 'low'
      };
    });

  if (archetypes.length === 0) {
    const sourceChunkIds = ingestArtifact.chunks.slice(0, 2).map((chunk) => chunk.chunkId);
    archetypes.push({
      archetypeId: 'generic_scene_participant',
      label: 'Generic scene participant',
      summary: 'Fallback participant derived from available research.',
      role: 'participant',
      genderPresentation: 'mixed',
      classBand: 'unspecified',
      weightRange: buildWeightRange({
        label: 'Generic scene participant',
        min: 100,
        max: 100,
        sourceInputIds: sourceInputIdsFor(ingestArtifact, sourceChunkIds),
        sourceChunkIds,
        confidence: 'low'
      }),
      dominantAttributes: [],
      optionalAttributes: [],
      wardrobeRefs: [],
      behaviorRefs: [],
      locationZoneRefs: [],
      promptText: 'scene participant consistent with the source research',
      sourceInputIds: sourceInputIdsFor(ingestArtifact, sourceChunkIds),
      sourceChunkIds,
      confidence: 'low'
    });
  }

  return archetypes;
}

function buildLocationZones(ingestArtifact) {
  return LOCATION_DEFINITIONS
    .filter(([zoneId, label]) => {
      const text = combinedText(ingestArtifact).toLowerCase();
      return text.includes(zoneId) || text.includes(label.toLowerCase());
    })
    .map(([zoneId, label, promptText]) => {
      const sourceChunkIds = chunkIdsFor(ingestArtifact, [zoneId, label.toLowerCase()]);
      return {
        zoneId,
        label,
        promptText,
        demographicDistributionRefs: [`${zoneId}_distribution`],
        archetypeBiases: [],
        sourceChunkIds
      };
    });
}

function buildDemographicDistributions(ingestArtifact, locationZones) {
  const globalChunkIds = chunkIdsFor(ingestArtifact, ['adult men', 'adult women', 'children', 'demographic']);
  const sourceInputIds = sourceInputIdsFor(ingestArtifact, globalChunkIds);
  const globalDistribution = {
    distributionId: 'visible_population_distribution',
    label: 'Visible population distribution',
    appliesToRefs: ['populationModel.visible_crowd'],
    sourceChunkIds: globalChunkIds,
    entries: [
      buildWeightRange({ label: 'adult_men', min: 82, max: 90, sourceInputIds, sourceChunkIds: globalChunkIds }),
      buildWeightRange({ label: 'adult_women', min: 6, max: 12, sourceInputIds, sourceChunkIds: globalChunkIds }),
      buildWeightRange({ label: 'children_and_teens', min: 2, max: 6, sourceInputIds, sourceChunkIds: globalChunkIds })
    ]
  };

  const zoneDistributions = locationZones.map((zone) => {
    const sourceChunkIds = zone.sourceChunkIds;
    const zoneSourceInputIds = sourceInputIdsFor(ingestArtifact, sourceChunkIds);
    const entries = zone.zoneId === 'rail'
      ? [
          buildWeightRange({ label: 'adult_men', min: 90, max: 96, sourceInputIds: zoneSourceInputIds, sourceChunkIds }),
          buildWeightRange({ label: 'adult_women', min: 1, max: 5, sourceInputIds: zoneSourceInputIds, sourceChunkIds })
        ]
      : zone.zoneId === 'grandstand'
        ? [
            buildWeightRange({ label: 'adult_men', min: 75, max: 85, sourceInputIds: zoneSourceInputIds, sourceChunkIds }),
            buildWeightRange({ label: 'adult_women', min: 10, max: 18, sourceInputIds: zoneSourceInputIds, sourceChunkIds }),
            buildWeightRange({ label: 'children_and_teens', min: 3, max: 7, sourceInputIds: zoneSourceInputIds, sourceChunkIds })
          ]
        : zone.zoneId === 'pit'
          ? [
              buildWeightRange({ label: 'worker_official_driver_mechanic_roles', min: 98, max: 100, sourceInputIds: zoneSourceInputIds, sourceChunkIds })
            ]
          : [];

    return {
      distributionId: `${zone.zoneId}_distribution`,
      label: `${zone.label} distribution`,
      appliesToRefs: [`locationZones.${zone.zoneId}`],
      sourceChunkIds,
      entries
    };
  });

  return [globalDistribution, ...zoneDistributions];
}

function buildCompatibilityRules(ingestArtifact, locationZones) {
  const rules = [];
  const addZoneRule = (zoneId, label, effects) => {
    const sourceChunkIds = chunkIdsFor(ingestArtifact, [zoneId, label.toLowerCase()]);
    if (sourceChunkIds.length === 0) return;
    rules.push({
      ruleId: `${zoneId}_bias_rule`,
      label,
      condition: {
        field: 'location_zone',
        operator: 'equals',
        value: zoneId
      },
      effects,
      sourceChunkIds,
      confidence: 'medium'
    });
  };

  if (locationZones.some((zone) => zone.zoneId === 'rail')) {
    addZoneRule('rail', 'Rail zones bias adult men and heat adjustment', [
      { action: 'increase', target: 'adult_men' },
      { action: 'increase', target: 'shirtsleeves' },
      { action: 'decrease', target: 'children' },
      { action: 'decrease', target: 'affluent_women' }
    ]);
  }
  if (locationZones.some((zone) => zone.zoneId === 'grandstand')) {
    addZoneRule('grandstand', 'Grandstand zones bias family and complete outfits', [
      { action: 'increase', target: 'adult_women' },
      { action: 'increase', target: 'children' },
      { action: 'increase', target: 'complete_outfits' },
      { action: 'decrease', target: 'dirty_workwear' }
    ]);
  }
  if (locationZones.some((zone) => zone.zoneId === 'pit')) {
    addZoneRule('pit', 'Pit zones force work and official roles', [
      { action: 'force', target: 'worker_or_official_roles' },
      { action: 'increase', target: 'dust_coats_caps_goggles' },
      { action: 'exclude', target: 'casual_viewer_only' }
    ]);
  }
  if (locationZones.some((zone) => zone.zoneId === 'infield')) {
    addZoneRule('infield', 'Infield zones allow broader public mix', [
      { action: 'allow', target: 'family_groups' },
      { action: 'increase', target: 'looser_posture' },
      { action: 'bias-toward', target: 'casual_public_viewing' }
    ]);
  }
  if (locationZones.some((zone) => zone.zoneId === 'stalls')) {
    addZoneRule('stalls', 'Market stalls bias vendors and shoppers', [
      { action: 'increase', target: 'market_vendor' },
      { action: 'increase', target: 'market_shopper' },
      { action: 'requires', target: 'market_goods' },
      { action: 'decrease', target: 'running_movement' }
    ]);
  }
  if (locationZones.some((zone) => zone.zoneId === 'gate')) {
    addZoneRule('gate', 'Market gates bias arrival and messenger movement', [
      { action: 'increase', target: 'guild_messenger' },
      { action: 'allow', target: 'foreign_trader' },
      { action: 'bias-toward', target: 'arrival_or_departure' }
    ]);
  }
  if (locationZones.some((zone) => zone.zoneId === 'fountain')) {
    addZoneRule('fountain', 'Fountain zones bias social pausing', [
      { action: 'increase', target: 'market_shopper' },
      { action: 'allow', target: 'children' },
      { action: 'bias-toward', target: 'conversation' }
    ]);
  }

  const ethicalChunkIds = chunkIdsFor(ingestArtifact, ['not make black', 'not reduce', 'service role only', 'ethical', 'avoid reducing', 'do not depict', 'outsiders only as thieves']);
  if (ethicalChunkIds.length > 0) {
    rules.push({
      ruleId: 'ethical_representation_not_worker_only',
      label: 'Underrepresented groups must not collapse into worker-only roles',
      condition: {
        field: 'race_ethnicity_context',
        operator: 'exists',
        value: 'underrepresented_local_community'
      },
      effects: [
        { action: 'allow', target: 'middle_class_spectator' },
        { action: 'allow', target: 'working_class_spectator' },
        { action: 'avoid', target: 'service_role_only' },
        { action: 'avoid', target: 'outsider_criminal_only' }
      ],
      sourceChunkIds: ethicalChunkIds,
      confidence: 'medium'
    });
  }

  return rules;
}

function buildNegativeConstraints(ingestArtifact, compatibilityRules) {
  const constraints = [];
  const addConstraint = (constraintId, label, keywords, text, constraintType = 'negative') => {
    const sourceChunkIds = chunkIdsFor(ingestArtifact, keywords);
    if (sourceChunkIds.length === 0) return;
    constraints.push({
      constraintId,
      label,
      text,
      constraintType,
      appliesTo: constraintId === 'avoid_worker_only_representation'
        ? ['race_ethnicity_context.underrepresented_local_community', 'archetypes', 'role_sampling']
        : [],
      enforcement: constraintId === 'avoid_worker_only_representation'
        ? {
            avoid: ['service_role_only'],
            allow: [
              'middle_class_spectator',
              'working_class_spectator',
              'worker',
              'family_member'
            ],
            force: [],
            exclude: []
          }
        : constraintId === 'avoid_modern_artifacts'
          ? {
              avoid: ['t-shirt', 'jersey', 'baseball cap', 'shorts', 'modern sunglasses'],
              allow: [],
              force: [],
              exclude: ['modern_fan_artifacts']
            }
          : undefined,
      enforcedByRuleIds: constraintId === 'avoid_worker_only_representation'
        ? compatibilityRules
            .filter((rule) => rule.ruleId === 'ethical_representation_not_worker_only' ||
              rule.sourceChunkIds.some((chunkId) => sourceChunkIds.includes(chunkId)))
            .map((rule) => rule.ruleId)
        : compatibilityRules
            .filter((rule) => rule.sourceChunkIds.some((chunkId) => sourceChunkIds.includes(chunkId)))
            .map((rule) => rule.ruleId),
      sourceChunkIds,
      confidence: 'medium'
    });
  };

  addConstraint('avoid_modern_artifacts', 'Avoid modern artifacts', ['no modern', 'modern artifacts', 't-shirts', 'baseball caps'], 'Avoid modern fan clothing, branded jerseys, T-shirts, shorts, modern sunglasses, and baseball caps.', 'modern-artifact-risk');
  addConstraint('avoid_overbroad_variation', 'Avoid overbroad variation', ['randomize too broadly', 'low variance', 'high uniformity'], 'Do not randomize so broadly that the crowd loses its tight historical silhouette.', 'negative');
  addConstraint('avoid_incompatible_wardrobe', 'Avoid incompatible wardrobe mixing', ['incompatible', 'avoid mixing', 'panama', 'working-class'], 'Avoid incompatible class, wardrobe, and location combinations unless sourced as an exception.', 'compatibility');
  addConstraint('avoid_worker_only_representation', 'Avoid worker-only representation', ['not make black', 'not reduce', 'avoid reducing', 'service role only'], 'Do not reduce underrepresented groups to workers or service roles only; allow middle-class spectator, working-class spectator, worker, and family-member variants where spatially plausible.', 'ethical-historical-representation');
  addConstraint('avoid_wrong_era_silhouette', 'Avoid wrong-era silhouette', ['too victorian', 'frock coats', 'top hats', 'bustle'], 'Avoid wrong-era silhouettes and theatrical period cliches.', 'modern-artifact-risk');
  addConstraint('avoid_unbalanced_location_gender', 'Avoid unbalanced location placement', ['overpopulating women at the rail', 'rail is overwhelmingly men'], 'Do not overpopulate women in rail or controlled work zones without source support.', 'compatibility');
  addConstraint('avoid_modern_market_artifacts', 'Avoid modern market artifacts', ['plastic crates', 'modern signage', 'electric lamps'], 'Avoid plastic crates, modern signage, electric lamps, and modern vendor uniforms.', 'modern-artifact-risk');
  addConstraint('avoid_noble_only_market', 'Avoid noble-only market crowd', ['not only nobles', 'avoid noble-only', 'too noble'], 'Do not convert the market crowd into only nobles or court figures; preserve working vendors, shoppers, messengers, and mixed public roles.', 'negative');
  addConstraint('avoid_outsider_criminal_only', 'Avoid outsider criminal-only representation', ['outsiders only as thieves', 'foreign traders only as criminals', 'ethical'], 'Do not depict foreign traders or outsiders only as thieves or criminals; keep them as ordinary commercial participants unless a source supports otherwise.', 'ethical-historical-representation');

  return constraints;
}

function buildSceneGrammarArtifact({
  ingestArtifact,
  extractArtifact,
  classifyArtifact,
  synthesizeArtifact,
  sourceModeArtifact
}) {
  const sourceInputIds = ingestArtifact.sourceInputs.map((source) => source.sourceInputId);
  const behaviorStates = buildBehaviorStates(ingestArtifact);
  const environmentalModifiers = buildEnvironmentalModifiers(ingestArtifact);
  const wardrobeSystem = buildWardrobeSystem(ingestArtifact);
  const propsAndAccessories = buildPropsAndAccessories(ingestArtifact);
  const archetypes = buildArchetypes(ingestArtifact, wardrobeSystem, behaviorStates);
  const locationZones = buildLocationZones(ingestArtifact);
  const demographicDistributions = buildDemographicDistributions(ingestArtifact, locationZones);
  const compatibilityRules = buildCompatibilityRules(ingestArtifact, locationZones);
  const negativeConstraints = buildNegativeConstraints(ingestArtifact, compatibilityRules);
  const visualReferenceSets = buildVisualReferenceSets(ingestArtifact, archetypes);

  const evidence = extractArtifact.claims.map((claim) => ({
    evidenceId: claim.claimId,
    text: claim.text,
    claimType: claim.claimType || claim.category,
    attributionMode: claim.attributionMode,
    confidence: claim.confidence,
    sourceInputIds: claim.sourceInputIds,
    sourceChunkIds: claim.sourceChunkIds
  }));

  const baselineWeights = archetypes
    .map((archetype) => archetype.weightRange)
    .filter(Boolean);

  const reviewFlags = [];
  if (sourceModeArtifact && sourceModeArtifact.chunkModes.some((entry) => entry.modes.includes('ethical-constraint'))) {
    reviewFlags.push('ethical-constraint-detected');
  }
  if (visualReferenceSets.length > 0) {
    reviewFlags.push('visual-reference-routing-manifest-only');
  }
  if (synthesizeArtifact.promptFragments.length < 4) {
    reviewFlags.push('sparse-prompt-fragment-coverage');
  }

  return MetagrinderSceneGrammarArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    sceneContext: {
      contextId: `${ingestArtifact.inputId}_scene_context`,
      title: ingestArtifact.title,
      researchKind: ingestArtifact.researchKind,
      summary: `Scene grammar compiled from ${ingestArtifact.chunks.length} source chunks and ${extractArtifact.claims.length} extracted claims.`,
      sourceInputIds,
      sourceChunkIds: ingestArtifact.chunks.map((chunk) => chunk.chunkId)
    },
    sourceLinks: ingestArtifact.sourceInputs.map((source) => ({
      sourceInputId: source.sourceInputId,
      title: source.title,
      path: source.path
    })),
    evidence,
    populationModel: {
      modelId: `${ingestArtifact.inputId}_population_model`,
      label: 'Visible scene population model',
      baselineWeights,
      notes: [
        'Weights are deterministic first-pass grammar hints and require review before promotion.',
        `Classified ${classifyArtifact.collections.conceptClusterBuckets.length} concept buckets into scene grammar inputs.`
      ],
      sourceChunkIds: mergeUniqueStrings(baselineWeights.flatMap((weight) => weight.sourceChunkIds))
    },
    archetypes,
    demographicDistributions,
    wardrobeSystem,
    groomingAndHair: [],
    propsAndAccessories,
    locationZones,
    behaviorStates,
    environmentalModifiers,
    visualReferenceSets,
    compatibilityRules,
    negativeConstraints,
    uncertainties: extractArtifact.openQuestions.map((question) => question.text),
    reviewFlags
  });
}

module.exports = {
  buildSceneGrammarArtifact,
  slugify
};

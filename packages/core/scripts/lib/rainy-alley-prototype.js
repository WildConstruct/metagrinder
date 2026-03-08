const fs = require('fs');
const path = require('path');

const {
  CameraPassManifestSchema,
  GraphMatchReportSchema,
  LumaAdapterContractSchema,
  MetaballManifestSchema,
  ModelConditioningPayloadSchema,
  PacketAttributionManifestSchema,
  PatchProposalSchema,
  PromptGraphManifestSchema,
  RenderTextPacketSchema,
  SemanticScenePackageSchema,
  SuppressedGraphNodesReportSchema,
  WitnessRenderManifestSchema,
  WorldSemanticFieldSchema
} = require('../../types/metagrinder.runtime.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseFile(schema, filePath, label) {
  try {
    return schema.parse(readJson(filePath));
  } catch (error) {
    throw new Error(`${label} failed validation at ${filePath}: ${error.message}`);
  }
}

function resolveFixturePath(baseDir, relativePath) {
  const resolvedPath = path.resolve(baseDir, relativePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Missing referenced artifact: ${relativePath}`);
  }
  return resolvedPath;
}

function centerOfBounds(bounds) {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2
  };
}

function recordPosition(record) {
  if (record.recordType === 'SemanticPoint' || record.recordType === 'SemanticSplat') {
    return record.worldPosition;
  }
  return centerOfBounds(record.bounds);
}

function computeDistance(position, cameraPosition) {
  const dx = position.x - cameraPosition.x;
  const dy = position.y - cameraPosition.y;
  const dz = position.z - cameraPosition.z;
  return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
}

function isInFrontOfCamera(position, cameraPosition) {
  return position.z <= cameraPosition.z;
}

function isWithinViewWindow(position, cameraPosition, resolution) {
  const dz = Math.abs(position.z - cameraPosition.z);
  const depth = Math.max(dz, 0.001);
  const aspect = resolution.width / resolution.height;
  const horizontalLimit = depth * aspect;
  const verticalLimit = depth;
  const dx = Math.abs(position.x - cameraPosition.x);
  const dy = Math.abs(position.y - cameraPosition.y);

  return dx <= horizontalLimit && dy <= verticalLimit;
}

function computeDistanceFactor(distance, distanceBias) {
  return 1 / (1 + (distance * Math.max(distanceBias, 0.01)));
}

function estimateScreenCoverage(record, position, cameraPosition, resolution) {
  const distance = Math.max(computeDistance(position, cameraPosition), 0.001);
  const distanceScale = 1 / (distance * distance);

  if (record.recordType === 'SemanticPoint') {
    const radius = record.influenceRadius || 0.5;
    return Math.min(1, radius * distanceScale * 24);
  }

  if (record.recordType === 'SemanticSplat') {
    const radius = record.radius || 0.5;
    return Math.min(1, radius * distanceScale * 20);
  }

  const width = Math.abs(record.bounds.max.x - record.bounds.min.x);
  const height = Math.abs(record.bounds.max.y - record.bounds.min.y);
  const area = Math.max(width * height, 0.25);
  const normalizedArea = area / Math.max(resolution.width * resolution.height, 1);
  return Math.min(1, Math.max(normalizedArea * 100000, area * distanceScale * 8));
}

const LOD_ORDER = {
  lod0: 0,
  lod1: 1,
  lod2: 2
};

function maxLod(left, right) {
  return LOD_ORDER[left] >= LOD_ORDER[right] ? left : right;
}

function pickSemanticLod(rankedRecords, promptGraphLodPolicy) {
  if (rankedRecords.length === 0) {
    return {
      semanticLod: 'lod0',
      semanticBudget: {
        maxEntries: 4,
        strategy: 'coarse'
      }
    };
  }

  const policy = promptGraphLodPolicy || {
    thresholds: {
      lod0MinDistance: 5.5,
      lod1MinDistance: 3.25,
      lod2MaxDistance: 3.25
    },
    budgets: {
      lod0: {
        maxEntries: 6,
        strategy: 'coarse'
      },
      lod1: {
        maxEntries: 10,
        strategy: 'balanced'
      },
      lod2: {
        maxEntries: 16,
        strategy: 'fine'
      }
    }
  };

  const nearestDistance = rankedRecords[0].distance;
  if (nearestDistance <= policy.thresholds.lod2MaxDistance) {
    return {
      semanticLod: 'lod2',
      semanticBudget: policy.budgets.lod2
    };
  }
  if (nearestDistance <= policy.thresholds.lod0MinDistance) {
    return {
      semanticLod: 'lod1',
      semanticBudget: policy.budgets.lod1
    };
  }

  return {
    semanticLod: 'lod0',
    semanticBudget: policy.budgets.lod0
  };
}

function describeRecordAtLod(record, semanticLod) {
  const joined = joinedRecordText(record);

  if (semanticLod === 'lod0') {
    if (joined.includes('brick') || joined.includes('wall')) {
      return [{ bucket: 'dominant_surfaces', text: 'brick wall' }];
    }
    if (joined.includes('rain') || joined.includes('damp')) {
      return [{ bucket: 'environmental_conditions', text: 'rainy alley conditions' }];
    }
    return [{
      bucket: 'optional_background_context',
      text: record.labels.length > 0 ? record.labels[0] : record.id
    }];
  }

  if (semanticLod === 'lod1') {
    const descriptions = [];
    if (joined.includes('brick') || joined.includes('wall')) {
      descriptions.push({
        bucket: 'dominant_surfaces',
        text: 'rain-darkened brick wall'
      });
    }
    if (joined.includes('wet') || joined.includes('leak')) {
      descriptions.push({
        bucket: 'localized_effects',
        text: 'wet wall leak zone'
      });
    }
    if (joined.includes('rain')) {
      descriptions.push({
        bucket: 'environmental_conditions',
        text: 'wind-driven rain'
      });
    }
    return descriptions;
  }

  return buildDescriptions(record);
}

function getEffectiveRecordLod(record, packetLod) {
  const overrideMinLod = record.semanticLodOverride?.minLod;
  if (!overrideMinLod) {
    return packetLod;
  }
  return maxLod(packetLod, overrideMinLod);
}

function joinedRecordText(record) {
  return [
    ...record.labels,
    ...record.utdgRefs,
    ...record.effectRefs,
    ...record.responseProfileRefs,
    ...record.environmentalControllerRefs
  ].join(' ').toLowerCase();
}

function buildDescriptions(record) {
  const joined = joinedRecordText(record);
  const descriptions = [];

  if (joined.includes('brick') || joined.includes('wall')) {
    descriptions.push({
      bucket: 'dominant_surfaces',
      text: record.recordType === 'SemanticRegion'
        ? 'left alley brick wall'
        : 'rain-darkened brick wall on the left side of the alley'
    });
  }

  if (
    joined.includes('wet') ||
    joined.includes('leak') ||
    joined.includes('soot') ||
    joined.includes('runoff')
  ) {
    descriptions.push({
      bucket: 'localized_effects',
      text: joined.includes('leak')
        ? 'wet brick leak zone with directional runoff streaks'
        : 'localized surface weathering and runoff'
    });
  }

  if (
    joined.includes('rain') ||
    joined.includes('fog') ||
    joined.includes('mist') ||
    joined.includes('damp')
  ) {
    descriptions.push({
      bucket: 'environmental_conditions',
      text: joined.includes('rain')
        ? 'wind-driven rain moving left-to-right and downward'
        : 'damp atmospheric conditions'
    });
  }

  if (record.narrativeWeight >= 1) {
    descriptions.push({
      bucket: 'hero_details',
      text: joined.includes('wet')
        ? 'foreground wet patch with darkened mortar and reflective highlights'
        : 'camera-relevant surface detail'
    });
  }

  if (descriptions.length === 0) {
    descriptions.push({
      bucket: 'optional_background_context',
      text: record.labels.length > 0 ? record.labels.join(', ') : record.id
    });
  }

  return descriptions;
}

function getCameraPreset(cameraId) {
  const presets = {
    cam_alley_master: { position: { x: 2, y: 2, z: 0 } },
    cam_alley_alt_01: { position: { x: 3.5, y: 2.2, z: 0.75 } }
  };

  return presets[cameraId] || presets.cam_alley_master;
}

function findWitnessRenderForCamera(metaball, fixtureDir, cameraId) {
  const match = (metaball.witnessRenders || [])
    .map((entry) => ({
      entry,
      manifest: parseFile(
        WitnessRenderManifestSchema,
        resolveFixturePath(fixtureDir, entry.path),
        `Witness render manifest ${entry.path}`
      )
    }))
    .find(({ manifest }) => manifest.cameraId === cameraId);

  return match ? match.manifest : null;
}

function loadSemanticScenePackage(metaball, fixtureDir) {
  if (!metaball.semanticScenePackages || metaball.semanticScenePackages.length === 0) {
    return null;
  }

  const entry = metaball.semanticScenePackages[0];
  return parseFile(
    SemanticScenePackageSchema,
    resolveFixturePath(fixtureDir, entry.path),
    `Semantic scene package ${entry.path}`
  );
}

function loadPatchProposals(metaball, fixtureDir) {
  return (metaball.patchProposals || []).map((entry) =>
    parseFile(
      PatchProposalSchema,
      resolveFixturePath(fixtureDir, entry.path),
      `Patch proposal ${entry.path}`
    )
  );
}

function loadPromptGraph(metaball, fixtureDir) {
  if (!metaball.promptGraphs || metaball.promptGraphs.length === 0) {
    return null;
  }

  const entry = metaball.promptGraphs[0];
  return parseFile(
    PromptGraphManifestSchema,
    resolveFixturePath(fixtureDir, entry.path),
    `Prompt graph ${entry.path}`
  );
}

function graphNodeTypeToBucket(nodeType) {
  const mapping = {
    surface: 'dominant_surfaces',
    'localized-effect': 'localized_effects',
    environment: 'environmental_conditions',
    'hero-detail': 'hero_details',
    'background-context': 'optional_background_context'
  };

  return mapping[nodeType];
}

function findGraphTextsForRecord(record, promptGraph, semanticLod, metrics) {
  if (!promptGraph) {
    return [];
  }

  return promptGraph.nodes
    .map((node) => {
      const matchedSpatialRefs = node.spatialRefs.filter((ref) => ref === record.id);
      const matchedSemanticRefs = node.semanticRefs.filter((ref) =>
        record.utdgRefs.includes(ref) ||
        record.localizedIntentRefs.includes(ref) ||
        record.effectRefs.includes(ref) ||
        record.responseProfileRefs.includes(ref)
      );

      return {
        node,
        matchedSpatialRefs,
        matchedSemanticRefs
      };
    })
    .filter(({ matchedSpatialRefs, matchedSemanticRefs }) =>
      matchedSpatialRefs.length > 0 || matchedSemanticRefs.length > 0
    )
    .filter(({ node }) => {
      if (node.forceInclude) {
        return true;
      }
      const coverageOk = node.minScreenCoverage === undefined ||
        metrics.screenCoverageEstimate >= node.minScreenCoverage;
      const influenceOk = node.minSemanticInfluence === undefined ||
        metrics.semanticInfluence >= node.minSemanticInfluence;
      return coverageOk && influenceOk;
    })
    .flatMap((node) => {
      const bucket = graphNodeTypeToBucket(node.node.nodeType);
      const texts = node.node.textVariants[semanticLod] || [];
      return texts.map((text) => ({
        bucket,
        text,
        source: 'prompt-graph',
        sourceNodeId: node.node.nodeId,
        matchType: node.matchedSpatialRefs.length > 0 ? 'spatial' : 'semantic',
        matchedRefs: node.matchedSpatialRefs.length > 0 ? node.matchedSpatialRefs : node.matchedSemanticRefs,
        screenCoverageEstimate: metrics.screenCoverageEstimate,
        semanticInfluence: metrics.semanticInfluence,
        forceInclude: node.node.forceInclude,
        narrativePriority: node.node.narrativePriority,
        priorityWeight: node.node.priorityWeight
      }));
    });
}

function buildPromotionSummary(scenePackage, patchProposals) {
  if (!scenePackage) {
    return null;
  }

  return {
    packageId: scenePackage.packageId,
    promotedRegionRefs: scenePackage.sceneRegions.map((region) => region.regionId),
    proposedPatchIds: patchProposals.map((proposal) => proposal.proposalId),
    adjustmentHandles: scenePackage.adjustmentHandles,
    utdgMatches: scenePackage.utdgMatches
  };
}

function buildGraphMatchReport(promptGraph, cameraId, packetId, packetAttribution) {
  if (!promptGraph) {
    return null;
  }

  const entries = packetAttribution
    .filter((entry) => entry.source === 'prompt-graph' && entry.graphNodeId && entry.recordId)
    .reduce((accumulator, entry) => {
      const key = [
        entry.recordId,
        entry.graphNodeId,
        entry.semanticLod,
        entry.bucket,
        entry.matchType
      ].join('|');

      if (!accumulator[key]) {
        accumulator[key] = {
          recordId: entry.recordId,
          graphNodeId: entry.graphNodeId,
          semanticLod: entry.semanticLod,
          matchType: entry.matchType,
          matchedRefs: entry.matchedRefs || [],
          screenCoverageEstimate: entry.screenCoverageEstimate,
          semanticInfluence: entry.semanticInfluence,
          bucket: entry.bucket,
          selectedText: []
        };
      }

      accumulator[key].selectedText.push(entry.text);
      return accumulator;
    }, {});

  return GraphMatchReportSchema.parse({
    graphId: promptGraph.graphId,
    cameraId,
    packetId,
    entries: Object.values(entries)
  });
}

function buildSuppressedGraphNodesReport(promptGraph, cameraId, packetId, entries) {
  if (!promptGraph) {
    return null;
  }

  return SuppressedGraphNodesReportSchema.parse({
    graphId: promptGraph.graphId,
    cameraId,
    packetId,
    entries
  });
}

function runCameraQuery(field, queryConfig, cameraPosition) {
  return field.records
    .map((record) => {
      const position = recordPosition(record);
      const distance = computeDistance(position, cameraPosition);
      const inFront = isInFrontOfCamera(position, cameraPosition);
      const inViewWindow = isWithinViewWindow(
        position,
        cameraPosition,
        queryConfig.resolution
      );
      const visible = inFront && inViewWindow;
      const distanceFactor = computeDistanceFactor(distance, queryConfig.distanceBias);
      const screenCoverageEstimate = estimateScreenCoverage(
        record,
        position,
        cameraPosition,
        queryConfig.resolution
      );
      const semanticWeight = record.importanceWeight * record.visibilityWeight;
      const semanticInfluence = semanticWeight * screenCoverageEstimate;
      const score = visible
        ? (
            semanticInfluence * queryConfig.semanticInfluenceBias +
            record.narrativeWeight * queryConfig.narrativePriorityBias +
            distanceFactor
          )
        : 0;

      return {
        record,
        position,
        distance,
        inFront,
        inViewWindow,
        visible,
        distanceFactor,
        screenCoverageEstimate,
        semanticInfluence,
        score
      };
    })
    .filter((entry) => entry.visible)
    .sort((left, right) => right.score - left.score)
    .slice(0, queryConfig.maxRecords);
}

function buildRenderTextPacket(field, queryConfig, rankedRecords, scenePackage, patchProposals, promptGraph) {
  const { semanticLod, semanticBudget } = pickSemanticLod(
    rankedRecords,
    queryConfig.promptGraphLodPolicy
  );
  const compaction = queryConfig.promptGraphLodPolicy?.compaction || {
    preserveHeroDetails: true,
    heroNarrativeThreshold: 1,
    preserveLocalizedEffectsInWideShots: false
  };
  const packet = {
    packetId: `generated_${field.fieldId}_${queryConfig.cameraId}`,
    generatedFromFieldId: field.fieldId,
    cameraId: queryConfig.cameraId,
    semanticLod,
    semanticBudget,
    dominant_surfaces: [],
    localized_effects: [],
    environmental_conditions: [],
    hero_details: [],
    optional_background_context: []
  };
  const packetAttribution = [];
  const suppressedGraphNodes = [];
  const bucketLimits = {
    dominant_surfaces: 1,
    localized_effects: Math.max(1, Math.ceil(semanticBudget.maxEntries * 0.25)),
    environmental_conditions: Math.max(1, Math.ceil(semanticBudget.maxEntries * 0.2)),
    hero_details: Math.max(1, Math.ceil(semanticBudget.maxEntries * 0.2)),
    optional_background_context: Math.max(1, Math.ceil(semanticBudget.maxEntries * 0.15))
  };
  const bucketCounts = {
    dominant_surfaces: 0,
    localized_effects: 0,
    environmental_conditions: 0,
    hero_details: 0,
    optional_background_context: 0
  };
  let packetEntryCount = 0;

  const selectedRecords = rankedRecords.filter((entry, index) => {
    if (index < Math.min(queryConfig.maxPacketEntries, semanticBudget.maxEntries)) {
      return true;
    }
    return semanticLod === 'lod0' && entry.record.semanticLodOverride?.forceIncludeInWideShots === true;
  });

  selectedRecords.forEach((entry) => {
    const effectiveLod = getEffectiveRecordLod(entry.record, semanticLod);
    const graphTexts = findGraphTextsForRecord(entry.record, promptGraph, effectiveLod, {
      screenCoverageEstimate: entry.screenCoverageEstimate,
      semanticInfluence: entry.semanticInfluence
    });
    const descriptions = graphTexts.length > 0
      ? [...graphTexts].sort((left, right) => {
          const leftScore = (left.narrativePriority * left.priorityWeight) + left.semanticInfluence;
          const rightScore = (right.narrativePriority * right.priorityWeight) + right.semanticInfluence;
          return rightScore - leftScore;
        })
      : describeRecordAtLod(entry.record, effectiveLod);

    descriptions.forEach((description) => {
      const { bucket, text } = description;
      if (
        bucket === 'localized_effects' &&
        semanticLod === 'lod0' &&
        !compaction.preserveLocalizedEffectsInWideShots &&
        !entry.record.semanticLodOverride?.forceIncludeInWideShots
      ) {
        return;
      }
      if (graphTexts.length > 0 && packetEntryCount >= semanticBudget.maxEntries && !description.forceInclude) {
        suppressedGraphNodes.push({
          recordId: entry.record.id,
          graphNodeId: description.sourceNodeId,
          semanticLod: effectiveLod,
          bucket,
          selectedText: [text],
          suppressionReason: 'packet-budget',
          screenCoverageEstimate: description.screenCoverageEstimate,
          semanticInfluence: description.semanticInfluence,
          narrativePriority: description.narrativePriority,
          priorityWeight: description.priorityWeight
        });
        return;
      }
      if (graphTexts.length > 0 && bucketCounts[bucket] >= bucketLimits[bucket] && !description.forceInclude) {
        suppressedGraphNodes.push({
          recordId: entry.record.id,
          graphNodeId: description.sourceNodeId,
          semanticLod: effectiveLod,
          bucket,
          selectedText: [text],
          suppressionReason: 'bucket-budget',
          screenCoverageEstimate: description.screenCoverageEstimate,
          semanticInfluence: description.semanticInfluence,
          narrativePriority: description.narrativePriority,
          priorityWeight: description.priorityWeight
        });
        return;
      }
      if (!packet[bucket].includes(text)) {
        packet[bucket].push(text);
        bucketCounts[bucket] += 1;
        packetEntryCount += 1;
        const graphMatch = graphTexts.find((item) => item.bucket === bucket && item.text === text);
        packetAttribution.push({
          text,
          bucket,
          source: graphMatch ? 'prompt-graph' : 'heuristic',
          recordId: entry.record.id,
          semanticLod: effectiveLod,
          graphNodeId: graphMatch?.sourceNodeId,
          matchType: graphMatch?.matchType,
          matchedRefs: graphMatch?.matchedRefs || [],
          screenCoverageEstimate: graphMatch?.screenCoverageEstimate,
          semanticInfluence: graphMatch?.semanticInfluence
        });
      }
    });

    if (
      compaction.preserveHeroDetails &&
      entry.record.narrativeWeight >= compaction.heroNarrativeThreshold &&
      entry.record.semanticLodOverride?.preserveHeroDetailsAboveNarrativeWeight !== undefined &&
      entry.record.narrativeWeight >= entry.record.semanticLodOverride.preserveHeroDetailsAboveNarrativeWeight
    ) {
      const heroText = 'hero semantic detail preserved under prompt-budget compaction';
      if (!packet.hero_details.includes(heroText)) {
        packet.hero_details.push(heroText);
        packetAttribution.push({
          text: heroText,
          bucket: 'hero_details',
          source: 'compaction-policy',
          recordId: entry.record.id,
          semanticLod: effectiveLod,
          graphNodeId: null,
          matchType: 'narrative-threshold',
          matchedRefs: [],
          screenCoverageEstimate: entry.screenCoverageEstimate,
          semanticInfluence: entry.semanticInfluence
        });
      }
    }
  });

  if (packet.optional_background_context.length === 0) {
    packet.optional_background_context.push('narrow alley with damp atmospheric conditions');
  }

  if (scenePackage && semanticLod !== 'lod0') {
    scenePackage.adjustmentHandles.slice(0, 2).forEach((handle) => {
      const detail = `adjustable ${handle} control available from semantic backfill`;
      if (!packet.hero_details.includes(detail)) {
        packet.hero_details.push(detail);
      }
    });
  }

  patchProposals.forEach((proposal) => {
    if (proposal.targetType === 'wall-continuation') {
      const context = semanticLod === 'lod0'
        ? 'off-camera wall continuation available'
        : 'proposed off-camera brick wall continuation available for relensing';
      if (!packet.optional_background_context.includes(context)) {
        packet.optional_background_context.push(context);
        packetAttribution.push({
          text: context,
          bucket: 'optional_background_context',
          source: 'patch-proposal',
          recordId: null,
          semanticLod,
          graphNodeId: null,
          matchType: proposal.targetType,
          matchedRefs: proposal.targetRefs,
          screenCoverageEstimate: undefined,
          semanticInfluence: undefined
        });
      }
    }
  });

  return {
    packet: RenderTextPacketSchema.parse(packet),
    packetAttribution,
    suppressedGraphNodes
  };
}

function buildCameraPassManifest(metaball, field, queryConfig, renderTextPacket, witnessRender) {
  return CameraPassManifestSchema.parse({
    cameraPassId: `generated_${metaball.metaballId}_${queryConfig.cameraId}`,
    metaballId: metaball.metaballId,
    cameraId: queryConfig.cameraId,
    worldSemanticFieldId: field.fieldId,
    renderTextPacketId: renderTextPacket.packetId,
    inputArtifacts: [
      metaball.worldSemanticField?.path || 'world-semantic-field.json',
      witnessRender?.renderPath || 'witness-render.png',
      witnessRender?.depthPath || 'depth-pass.exr',
      witnessRender?.normalPath || 'world-normal-pass.exr'
    ],
    outputArtifacts: [
      'generated-render-text-packet.json',
      'generated-camera-pass-manifest.json',
      'generated-model-conditioning-payload.json',
      'generated-luma-adapter-contract.json'
    ],
    queryConfig,
    taskMode: 'image-modify-prep',
    generatedAt: new Date().toISOString()
  });
}

function buildModelConditioningPayload(renderTextPacket, witnessRender, scenePackage) {
  const notes = ['Use witness render for composition lock'];
  if (scenePackage) {
    notes.push('Semantic scene package supplied reverse-analysis adjustment handles.');
  }

  return ModelConditioningPayloadSchema.parse({
    taskMode: 'image-modify-prep',
    renderTextPacket,
    conditioningAssets: {
      witnessRender: witnessRender?.renderPath || 'preview-control-image.png',
      semanticMask: 'semantic-mask.png',
      localizedEffectMask: 'localized-effect-mask.png',
      depthPass: witnessRender?.depthPath || 'depth-pass.exr',
      worldNormalPass: witnessRender?.normalPath || 'world-normal-pass.exr'
    },
    styleRefs: [],
    notes
  });
}

function buildLumaAdapterContract(metaball, cameraPassManifest, modelConditioningPayload) {
  const packet = modelConditioningPayload.renderTextPacket;
  const promptSections = [
    ...packet.dominant_surfaces,
    ...packet.localized_effects,
    ...packet.environmental_conditions,
    ...packet.hero_details
  ].filter(Boolean);

  return LumaAdapterContractSchema.parse({
    adapterId: `generated_luma_${cameraPassManifest.cameraPassId}`,
    provider: 'luma',
    mode: 'image-modify',
    prompt: promptSections.join(', '),
    modifyImage: modelConditioningPayload.conditioningAssets.witnessRender,
    styleRefs: modelConditioningPayload.styleRefs,
    characterRefs: [],
    metadata: {
      renderTextPacketId: packet.packetId,
      cameraPassId: cameraPassManifest.cameraPassId,
      metaballId: metaball.metaballId,
      notes: ['Use semantic mask and witness render as upstream control assets']
    }
  });
}

function buildDebugScores(rankedRecords) {
  return rankedRecords.map((entry) => ({
    id: entry.record.id,
    recordType: entry.record.recordType,
    labels: entry.record.labels,
    score: Number(entry.score.toFixed(4)),
    distance: Number(entry.distance.toFixed(4)),
    inFront: entry.inFront,
    inViewWindow: entry.inViewWindow,
    distanceFactor: Number(entry.distanceFactor.toFixed(4)),
    screenCoverageEstimate: Number(entry.screenCoverageEstimate.toFixed(4)),
    semanticInfluence: Number(entry.semanticInfluence.toFixed(4)),
    importanceWeight: entry.record.importanceWeight,
    narrativeWeight: entry.record.narrativeWeight,
    visibilityWeight: entry.record.visibilityWeight
  }));
}

function writeAndValidateGeneratedOutputs(outputDir, outputs) {
  ensureDir(outputDir);

  const files = [
    ['generated-render-text-packet.json', outputs.renderTextPacket, RenderTextPacketSchema],
    ['generated-camera-pass-manifest.json', outputs.cameraPassManifest, CameraPassManifestSchema],
    ['generated-model-conditioning-payload.json', outputs.modelConditioningPayload, ModelConditioningPayloadSchema],
    ['generated-luma-adapter-contract.json', outputs.lumaAdapterContract, LumaAdapterContractSchema],
    ['generated-packet-attribution.json', outputs.packetAttributionManifest, PacketAttributionManifestSchema]
  ];

  if (outputs.graphMatchReport) {
    files.push(['generated-graph-match-report.json', outputs.graphMatchReport, GraphMatchReportSchema]);
  }
  if (outputs.suppressedGraphNodesReport) {
    files.push(['generated-suppressed-graph-nodes-report.json', outputs.suppressedGraphNodesReport, SuppressedGraphNodesReportSchema]);
  }

  files.forEach(([fileName, value]) => {
    writeJson(path.join(outputDir, fileName), value);
  });

  writeJson(path.join(outputDir, 'debug-camera-query.json'), outputs.debugCameraQuery);
  if (outputs.promotionSummary) {
    writeJson(path.join(outputDir, 'generated-promotion-summary.json'), outputs.promotionSummary);
  }

  files.forEach(([fileName, , schema]) => {
    parseFile(schema, path.join(outputDir, fileName), `Generated artifact ${fileName}`);
  });
}

function loadRainyAlleyRuntime(fixtureDir) {
  const metaballPath = path.resolve(fixtureDir, 'spicy-metaball.json');
  const metaball = parseFile(MetaballManifestSchema, metaballPath, 'Metaball manifest');
  const worldSemanticFieldPath = resolveFixturePath(fixtureDir, metaball.worldSemanticField.path);
  const worldSemanticField = parseFile(
    WorldSemanticFieldSchema,
    worldSemanticFieldPath,
    'World semantic field'
  );

  const semanticScenePackage = loadSemanticScenePackage(metaball, fixtureDir);
  const patchProposals = loadPatchProposals(metaball, fixtureDir);
  const promptGraph = loadPromptGraph(metaball, fixtureDir);

  return {
    metaball,
    worldSemanticField,
    semanticScenePackage,
    patchProposals,
    promptGraph
  };
}

function runRainyAlleyPrototype({ fixtureDir, outputDir, cameraId, cameraPosition }) {
  const {
    metaball,
    worldSemanticField,
    semanticScenePackage,
    patchProposals,
    promptGraph
  } = loadRainyAlleyRuntime(fixtureDir);
  const resolvedCameraId = cameraId || metaball.viewQueryConfig.cameraId;
  const queryConfig = {
    ...metaball.viewQueryConfig,
    cameraId: resolvedCameraId,
    promptGraphLodPolicy: metaball.promptGraphLodPolicy
  };
  const resolvedCameraPosition = cameraPosition || getCameraPreset(resolvedCameraId).position;
  const witnessRender = findWitnessRenderForCamera(metaball, fixtureDir, resolvedCameraId);
  const rankedRecords = runCameraQuery(worldSemanticField, queryConfig, resolvedCameraPosition);
  const { packet: renderTextPacket, packetAttribution, suppressedGraphNodes } = buildRenderTextPacket(
    worldSemanticField,
    queryConfig,
    rankedRecords,
    semanticScenePackage,
    patchProposals,
    promptGraph
  );
  const cameraPassManifest = buildCameraPassManifest(
    metaball,
    worldSemanticField,
    queryConfig,
    renderTextPacket,
    witnessRender
  );
  const modelConditioningPayload = buildModelConditioningPayload(
    renderTextPacket,
    witnessRender,
    semanticScenePackage
  );
  const lumaAdapterContract = buildLumaAdapterContract(
    metaball,
    cameraPassManifest,
    modelConditioningPayload
  );
  const packetAttributionManifest = PacketAttributionManifestSchema.parse({
    packetId: renderTextPacket.packetId,
    cameraId: resolvedCameraId,
    entries: packetAttribution
  });
  const graphMatchReport = buildGraphMatchReport(
    promptGraph,
    resolvedCameraId,
    renderTextPacket.packetId,
    packetAttribution
  );
  const suppressedGraphNodesReport = buildSuppressedGraphNodesReport(
    promptGraph,
    resolvedCameraId,
    renderTextPacket.packetId,
    suppressedGraphNodes
  );
  const promotionSummary = buildPromotionSummary(semanticScenePackage, patchProposals);
  const debugCameraQuery = {
    cameraId: resolvedCameraId,
    cameraPosition: resolvedCameraPosition,
    witnessRenderId: witnessRender?.witnessRenderId,
    rankedRecords: buildDebugScores(rankedRecords),
    packetAttribution
  };

  writeAndValidateGeneratedOutputs(outputDir, {
    renderTextPacket,
    cameraPassManifest,
    modelConditioningPayload,
    lumaAdapterContract,
    packetAttributionManifest,
    graphMatchReport,
    suppressedGraphNodesReport,
    debugCameraQuery,
    promotionSummary
  });

  return {
    metaball,
    worldSemanticField,
    semanticScenePackage,
    patchProposals,
    promptGraph,
    witnessRender,
    rankedRecords,
    renderTextPacket,
    cameraPassManifest,
    modelConditioningPayload,
    lumaAdapterContract,
    packetAttributionManifest,
    graphMatchReport,
    suppressedGraphNodesReport,
    debugCameraQuery,
    promotionSummary
  };
}

module.exports = {
  loadRainyAlleyRuntime,
  runRainyAlleyPrototype,
  runCameraQuery,
  buildRenderTextPacket,
  buildCameraPassManifest,
  buildModelConditioningPayload,
  buildLumaAdapterContract
};

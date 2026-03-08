const SOURCE_NODE_TYPE_MAP = {
  WeightedChoice: 'WeightedChoice',
  weightedChoice: 'WeightedChoice',
  enhancedBranching: 'WeightedChoice',
  enhancedBranchingNode: 'WeightedChoice',
  TextBlock: 'TextBlock',
  textBlock: 'TextBlock',
  Concat: 'Concat',
  concat: 'Concat',
  Output: 'Output',
  output: 'Output',
  Variable: 'Variable',
  variable: 'Variable',
  SetVariable: 'SetVariable',
  setVariable: 'SetVariable',
  GetVariable: 'GetVariable',
  getVariable: 'GetVariable',
  Include: 'Include',
  include: 'Include'
};

const WRAPPER_NODE_TYPES = new Set([
  'enhancedBoundingBox',
  'EnhancedBoundingBox',
  'boundingBox',
  'fragmentContainer'
]);

const ROOT_NODE_FIELDS = new Set([
  'id',
  'type',
  'name',
  'description',
  'x',
  'y',
  'position',
  'options',
  'template',
  'value',
  'data',
  'width',
  'height',
  'style',
  'parentNode',
  'extent',
  'expandParent',
  'selected',
  'dragging',
  'resizing',
  'measured',
  'sourcePosition',
  'targetPosition',
  'zIndex'
]);

const STRIPPED_NODE_DATA_FIELDS = new Set([
  'nodeType',
  'fragmentRegionIds',
  'fragmentImported',
  'fragmentSource',
  'fragmentRegions',
  'regionCount',
  'nodeCount',
  'width',
  'height',
  'isCollapsed',
  'locked',
  'ports',
  'backgroundColor',
  'opacity',
  'borderColor',
  'borderStyle',
  'borderWidth',
  'title',
  'description',
  'position',
  'parentNode',
  'extent',
  'expandParent',
  'style',
  'selected',
  'dragging',
  'resizing',
  'measured'
]);

const GENERIC_HANDLE_IDS = new Set([
  '',
  'input',
  'output',
  'source',
  'target',
  'main',
  'main-output'
]);

const REGION_ROOT_FIELDS = new Set([
  'id',
  'name',
  'label',
  'nodes',
  'nodeIds',
  'color',
  'color_comment',
  'description',
  'metadata',
  'ports',
  'type',
  'x',
  'y',
  'width',
  'height',
  'data'
]);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function addChange(changes, change) {
  changes.add(change);
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function normalizePsgLikeData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const normalized = { ...data };

  if (normalized.region && !normalized.regions && !normalized.version) {
    normalized.version = normalized.metadata?.version || '1.0.0';
    normalized.regions = [normalized.region];
    delete normalized.region;
  }

  if (Array.isArray(normalized.groups) && !normalized.regions) {
    normalized.regions = normalized.groups.map((group, index) => ({
      id:
        typeof group?.id === 'string' && group.id.length > 0
          ? group.id
          : `region-${index + 1}`,
      name:
        typeof group?.label === 'string' && group.label.length > 0
          ? group.label
          : typeof group?.name === 'string' && group.name.length > 0
            ? group.name
            : `Region ${index + 1}`,
      color: group?.color,
      nodes: Array.isArray(group?.nodeIds)
        ? group.nodeIds
        : Array.isArray(group?.nodes)
          ? group.nodes
          : [],
      description: group?.description,
      metadata: group?.metadata
    }));
    delete normalized.groups;
  }

  if (typeof normalized.name !== 'string' || normalized.name.length === 0) {
    normalized.name =
      normalized.metadata?.name ||
      normalized.metadata?.title ||
      normalized.description ||
      'Untitled Fragment';
  }

  if (!Array.isArray(normalized.edges)) {
    normalized.edges = [];
  }

  if (Array.isArray(normalized.nodes)) {
    normalized.nodes = normalized.nodes.map((node, index) => ({
      ...node,
      x:
        typeof node?.x === 'number'
          ? node.x
          : typeof node?.position?.x === 'number'
            ? node.position.x
            : 100,
      y:
        typeof node?.y === 'number'
          ? node.y
          : typeof node?.position?.y === 'number'
            ? node.position.y
            : 100 + index * 180
    }));
  }

  if (Array.isArray(normalized.regions)) {
    normalized.regions = normalized.regions.map((region, index) => ({
      ...region,
      id:
        typeof region?.id === 'string' && region.id.length > 0
          ? region.id
          : `region-${index + 1}`,
      name:
        typeof region?.name === 'string' && region.name.length > 0
          ? region.name
          : typeof region?.label === 'string' && region.label.length > 0
            ? region.label
            : `Region ${index + 1}`,
      nodes: Array.isArray(region?.nodes)
        ? region.nodes
        : Array.isArray(region?.nodeIds)
          ? region.nodeIds
          : []
    }));
  }

  if (normalized.type && normalized.type !== 'psglib') {
    delete normalized.type;
  }

  return normalized;
}

function getCanonicalNodeType(type) {
  if (typeof type !== 'string' || type.length === 0) {
    return null;
  }
  if (WRAPPER_NODE_TYPES.has(type)) {
    return '__WRAPPER__';
  }
  return SOURCE_NODE_TYPE_MAP[type] || null;
}

function sanitizeNodeData(data) {
  const sanitized = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!STRIPPED_NODE_DATA_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  });
  return sanitized;
}

function getAdditionalNodeFields(node) {
  const extra = {};
  Object.entries(node).forEach(([key, value]) => {
    if (!ROOT_NODE_FIELDS.has(key)) {
      extra[key] = value;
    }
  });
  return extra;
}

function getAdditionalRegionFields(region) {
  const extra = {};
  Object.entries(region).forEach(([key, value]) => {
    if (!REGION_ROOT_FIELDS.has(key)) {
      extra[key] = value;
    }
  });
  return extra;
}

function tryParseWeightedChoiceValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeNode(node, index, changes) {
  const reasons = [];
  if (!isRecord(node)) {
    reasons.push(`node ${index + 1} is not an object`);
    return { reasons };
  }

  if (typeof node.id !== 'string' || node.id.trim().length === 0) {
    reasons.push(`node ${index + 1} is missing a string id`);
    return { reasons };
  }

  const canonicalType = getCanonicalNodeType(node.type);
  if (canonicalType === '__WRAPPER__') {
    reasons.push(
      `node ${node.id} uses editor wrapper type ${String(node.type)}`
    );
    return { reasons };
  }
  if (!canonicalType) {
    reasons.push(`node ${node.id} has unknown node type ${String(node.type)}`);
    return { reasons };
  }

  if (canonicalType !== node.type) {
    addChange(changes, 'normalized node types');
  }

  const hadPositionObject = isRecord(node.position);
  const output = {
    id: node.id,
    type: canonicalType,
    ...getAdditionalNodeFields(node)
  };

  if (typeof node.name === 'string' && node.name.trim().length > 0) {
    output.name = node.name;
  }
  if (
    typeof node.description === 'string' &&
    node.description.trim().length > 0
  ) {
    output.description = node.description;
  }

  const x =
    typeof node.x === 'number'
      ? node.x
      : hadPositionObject && typeof node.position?.x === 'number'
        ? node.position.x
        : 100;
  const y =
    typeof node.y === 'number'
      ? node.y
      : hadPositionObject && typeof node.position?.y === 'number'
        ? node.position.y
        : 100 + index * 180;

  output.x = x;
  output.y = y;

  if (
    hadPositionObject ||
    typeof node.x !== 'number' ||
    typeof node.y !== 'number'
  ) {
    addChange(changes, 'normalized node positions to top-level x/y');
  }

  if (
    node.parentNode !== undefined ||
    node.extent !== undefined ||
    node.expandParent !== undefined ||
    node.width !== undefined ||
    node.height !== undefined ||
    node.style !== undefined
  ) {
    addChange(changes, 'removed editor-only node fields');
  }

  const data = sanitizeNodeData(
    isRecord(node.data) ? deepClone(node.data) : {}
  );

  if (canonicalType === 'WeightedChoice') {
    const topLevelOptions = Array.isArray(node.options)
      ? deepClone(node.options)
      : undefined;
    const dataOptions = Array.isArray(data.options)
      ? deepClone(data.options)
      : undefined;
    const dataValueOptions = tryParseWeightedChoiceValue(data.value);

    let canonicalOptions = topLevelOptions;
    if (!canonicalOptions && dataOptions) {
      canonicalOptions = dataOptions;
      addChange(changes, 'hoisted data.options to options');
    }
    if (!canonicalOptions && dataValueOptions) {
      canonicalOptions = deepClone(dataValueOptions);
      addChange(changes, 'hoisted data.value to options');
    }

    if (
      topLevelOptions &&
      dataOptions &&
      stableStringify(topLevelOptions) !== stableStringify(dataOptions)
    ) {
      reasons.push(`node ${node.id} has conflicting options and data.options`);
      return { reasons };
    }

    if (
      topLevelOptions &&
      dataValueOptions &&
      stableStringify(topLevelOptions) !== stableStringify(dataValueOptions)
    ) {
      reasons.push(`node ${node.id} has conflicting options and data.value`);
      return { reasons };
    }

    if (canonicalOptions) {
      output.options = canonicalOptions;
    }

    delete data.options;
    delete data.value;
  }

  if (canonicalType === 'TextBlock') {
    const topLevelValue =
      typeof node.value === 'string' ? node.value : undefined;
    const dataText = typeof data.text === 'string' ? data.text : undefined;
    const dataValue = typeof data.value === 'string' ? data.value : undefined;
    const canonicalValue = topLevelValue ?? dataText ?? dataValue;

    if (
      topLevelValue !== undefined &&
      dataText !== undefined &&
      dataText !== topLevelValue
    ) {
      reasons.push(`node ${node.id} has conflicting value and data.text`);
      return { reasons };
    }

    if (
      topLevelValue !== undefined &&
      dataValue !== undefined &&
      dataValue !== topLevelValue
    ) {
      reasons.push(`node ${node.id} has conflicting value and data.value`);
      return { reasons };
    }

    if (canonicalValue !== undefined) {
      output.value = canonicalValue;
      if (
        topLevelValue === undefined &&
        (dataText !== undefined || dataValue !== undefined)
      ) {
        addChange(changes, 'hoisted TextBlock text to top-level value');
      }
    }

    delete data.text;
    delete data.value;
  }

  if (canonicalType === 'Output') {
    const topLevelTemplate =
      typeof node.template === 'string' ? node.template : undefined;
    const topLevelValue =
      typeof node.value === 'string' ? node.value : undefined;
    const dataTemplate =
      typeof data.template === 'string' ? data.template : undefined;
    const dataValue = typeof data.value === 'string' ? data.value : undefined;

    if (
      topLevelTemplate !== undefined &&
      topLevelValue !== undefined &&
      topLevelTemplate !== topLevelValue
    ) {
      reasons.push(`node ${node.id} has conflicting template and value`);
      return { reasons };
    }

    const canonicalTemplate =
      topLevelTemplate ?? topLevelValue ?? dataTemplate ?? dataValue;

    if (canonicalTemplate !== undefined) {
      output.template = canonicalTemplate;
      if (
        topLevelTemplate === undefined &&
        (topLevelValue !== undefined ||
          dataTemplate !== undefined ||
          dataValue !== undefined)
      ) {
        addChange(changes, 'normalized Output payloads to top-level template');
      }
    }

    delete data.template;
    delete data.value;
  }

  if (canonicalType === 'Concat') {
    const topLevelValue =
      typeof node.value === 'string' ? node.value : undefined;
    const dataSeparator =
      typeof data.separator === 'string' ? data.separator : undefined;
    const dataValue = typeof data.value === 'string' ? data.value : undefined;
    const canonicalValue = topLevelValue ?? dataSeparator ?? dataValue;

    if (canonicalValue !== undefined) {
      output.value = canonicalValue;
      if (
        topLevelValue === undefined &&
        (dataSeparator !== undefined || dataValue !== undefined)
      ) {
        addChange(changes, 'normalized Concat payloads to top-level value');
      }
    }

    delete data.separator;
    delete data.value;
  }

  if (Object.keys(data).length > 0) {
    output.data = data;
  }

  return { node: output, reasons };
}

function normalizeEdges(edgesInput, nodeTypesById, changes) {
  const reasons = [];
  const sourceEdges = Array.isArray(edgesInput) ? edgesInput : [];
  const incomingByTarget = new Map();

  sourceEdges.forEach((edge, index) => {
    if (isRecord(edge) && typeof edge.target === 'string') {
      const existing = incomingByTarget.get(edge.target) || [];
      existing.push({ index, edge });
      incomingByTarget.set(edge.target, existing);
    }
  });

  const concatAssignments = new Map();
  incomingByTarget.forEach(entries => {
    const targetType = nodeTypesById.get(entries[0]?.edge?.target);
    if (targetType !== 'Concat') {
      return;
    }

    if (entries.length > 2) {
      reasons.push(
        `concat target ${entries[0].edge.target} has more than 2 incoming edges`
      );
      return;
    }

    const used = new Set();
    entries.forEach(({ edge }) => {
      const handle =
        typeof edge.targetHandle === 'string' ? edge.targetHandle : undefined;
      if (handle === 'input1' || handle === 'input2') {
        if (used.has(handle)) {
          reasons.push(
            `concat target ${edge.target} has duplicate ${handle} handles`
          );
          return;
        }
        used.add(handle);
      }
    });

    if (reasons.length > 0) {
      return;
    }

    const available = ['input1', 'input2'].filter(handle => !used.has(handle));

    entries.forEach(({ index, edge }) => {
      const handle =
        typeof edge.targetHandle === 'string' ? edge.targetHandle : undefined;
      if (handle === 'input1' || handle === 'input2') {
        concatAssignments.set(index, handle);
        return;
      }
      if (handle === undefined || GENERIC_HANDLE_IDS.has(handle)) {
        const next = available.shift();
        concatAssignments.set(index, next);
        if (next) {
          addChange(changes, 'normalized concat target handles');
        }
        return;
      }
      reasons.push(
        `edge ${edge.id || index + 1} has unsupported concat target handle ${handle}`
      );
    });
  });

  if (reasons.length > 0) {
    return { reasons };
  }

  const edges = [];

  sourceEdges.forEach((edge, index) => {
    if (!isRecord(edge)) {
      reasons.push(`edge ${index + 1} is not an object`);
      return;
    }
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      reasons.push(`edge ${edge.id || index + 1} is missing source or target`);
      return;
    }

    const sourceType = nodeTypesById.get(edge.source);
    const targetType = nodeTypesById.get(edge.target);
    if (!sourceType || !targetType) {
      reasons.push(
        `edge ${edge.id || index + 1} references an unknown node id`
      );
      return;
    }

    const output = {
      id:
        typeof edge.id === 'string' && edge.id.trim().length > 0
          ? edge.id
          : `edge-${index + 1}`,
      source: edge.source,
      target: edge.target
    };

    if (typeof edge.id !== 'string' || edge.id.trim().length === 0) {
      addChange(changes, 'generated missing edge ids');
    }

    const sourceHandle =
      typeof edge.sourceHandle === 'string' ? edge.sourceHandle : undefined;
    const targetHandle =
      typeof edge.targetHandle === 'string' ? edge.targetHandle : undefined;

    if (sourceHandle && /^branch-\d+$/.test(sourceHandle)) {
      if (sourceType !== 'WeightedChoice') {
        reasons.push(
          `edge ${output.id} uses branch handle on non-WeightedChoice source`
        );
        return;
      }
      output.sourceHandle = sourceHandle;
    } else if (
      sourceHandle !== undefined &&
      !GENERIC_HANDLE_IDS.has(sourceHandle)
    ) {
      reasons.push(
        `edge ${output.id} has unsupported source handle ${sourceHandle}`
      );
      return;
    } else if (sourceHandle !== undefined) {
      addChange(changes, 'removed stale handle ids');
    }

    if (targetType === 'Concat') {
      const assignedHandle = concatAssignments.get(index);
      if (!assignedHandle) {
        reasons.push(
          `edge ${output.id} could not be assigned a deterministic concat target handle`
        );
        return;
      }
      output.targetHandle = assignedHandle;
    } else if (targetType === 'Output') {
      if (targetHandle !== undefined) {
        addChange(changes, 'removed stale handle ids');
      }
    } else if (
      targetHandle !== undefined &&
      !GENERIC_HANDLE_IDS.has(targetHandle)
    ) {
      reasons.push(
        `edge ${output.id} has unsupported target handle ${targetHandle}`
      );
      return;
    } else if (targetHandle !== undefined) {
      addChange(changes, 'removed stale handle ids');
    }

    edges.push(output);
  });

  if (reasons.length > 0) {
    return { reasons };
  }

  return { edges, reasons };
}

function normalizeRegions(regionsInput, changes) {
  const reasons = [];
  if (!Array.isArray(regionsInput) || regionsInput.length === 0) {
    return { regions: undefined, reasons };
  }

  const regions = regionsInput.map((region, index) => {
    if (!isRecord(region)) {
      reasons.push(`region ${index + 1} is not an object`);
      return null;
    }

    const output = {
      ...getAdditionalRegionFields(region)
    };
    const regionData = isRecord(region.data) ? region.data : undefined;

    const id =
      typeof region.id === 'string' && region.id.trim().length > 0
        ? region.id
        : `region-${index + 1}`;
    const name =
      typeof region.name === 'string' && region.name.trim().length > 0
        ? region.name
        : typeof region.label === 'string' && region.label.trim().length > 0
          ? region.label
          : typeof regionData?.label === 'string' &&
              regionData.label.trim().length > 0
            ? regionData.label
            : `Region ${index + 1}`;
    const nodes = Array.isArray(region.nodes)
      ? region.nodes
      : Array.isArray(region.nodeIds)
        ? region.nodeIds
        : [];

    if (
      !Array.isArray(nodes) ||
      nodes.some(nodeId => typeof nodeId !== 'string')
    ) {
      reasons.push(`region ${id} has non-string node ids`);
      return null;
    }

    if (typeof region.id !== 'string' || region.id.trim().length === 0) {
      addChange(changes, 'normalized region ids');
    }
    if (
      !(typeof region.name === 'string' && region.name.trim().length > 0) &&
      !(typeof region.label === 'string' && region.label.trim().length > 0) &&
      !(
        typeof regionData?.label === 'string' &&
        regionData.label.trim().length > 0
      )
    ) {
      addChange(changes, 'normalized region names');
    }
    if (Array.isArray(region.nodeIds) && !Array.isArray(region.nodes)) {
      addChange(changes, 'normalized region nodeIds -> nodes');
    }
    if (
      region.type !== undefined ||
      region.x !== undefined ||
      region.y !== undefined ||
      region.width !== undefined ||
      region.height !== undefined ||
      regionData !== undefined
    ) {
      addChange(changes, 'normalized region fields to semantic shape');
    }

    output.id = id;
    output.name = name;
    if (typeof region.color === 'string') {
      output.color = region.color;
    } else if (typeof regionData?.color === 'string') {
      output.color = regionData.color;
    }
    if (typeof region.color_comment === 'string') {
      output.color_comment = region.color_comment;
    }
    output.nodes = Array.from(new Set(nodes));
    if (typeof region.description === 'string') {
      output.description = region.description;
    } else if (typeof regionData?.description === 'string') {
      output.description = regionData.description;
    }
    if (isRecord(region.metadata) && Object.keys(region.metadata).length > 0) {
      output.metadata = region.metadata;
    } else if (regionData && Object.keys(regionData).length > 0) {
      const liftedMetadata = {};
      Object.entries(regionData).forEach(([key, value]) => {
        if (!['label', 'color', 'description', 'collapsed'].includes(key)) {
          liftedMetadata[key] = value;
        }
      });
      if (Object.keys(liftedMetadata).length > 0) {
        output.metadata = liftedMetadata;
      }
    }
    if (Array.isArray(region.ports)) {
      output.ports = region.ports;
    }
    return output;
  });

  if (reasons.length > 0) {
    return { reasons };
  }

  return {
    regions: regions.filter(region => region !== null),
    reasons
  };
}

function repairPsgContent(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return {
      status: 'unsafe',
      changes: [],
      reasons: [
        error instanceof Error
          ? `invalid JSON: ${error.message}`
          : 'invalid JSON'
      ]
    };
  }

  if (!isRecord(parsed)) {
    return {
      status: 'unsafe',
      changes: [],
      reasons: ['top-level PSG value must be an object']
    };
  }

  if (
    isRecord(parsed.graph) ||
    parsed.fileType === 'psg' ||
    typeof parsed.formatVersion === 'string' ||
    isRecord(parsed.settings)
  ) {
    return {
      status: 'skipped',
      changes: [],
      reasons: [
        'appears to be an editor-project PSG shape, not a fragment PSG file'
      ]
    };
  }

  const changes = new Set();
  const preNormalized = deepClone(parsed);

  if (isRecord(preNormalized.region) && !Array.isArray(preNormalized.regions)) {
    preNormalized.regions = [preNormalized.region];
    delete preNormalized.region;
    addChange(changes, 'normalized region -> regions');
  }

  const normalizedInput = normalizePsgLikeData(preNormalized);

  if (Array.isArray(parsed.groups) && !Array.isArray(parsed.regions)) {
    addChange(changes, 'normalized groups -> regions');
  }
  if (!Array.isArray(parsed.edges)) {
    addChange(changes, 'ensured edges defaults to []');
  }

  if (!Array.isArray(normalizedInput.nodes)) {
    return {
      status: 'unsafe',
      changes: Array.from(changes),
      reasons: ['nodes must be an array']
    };
  }

  const nameFallback =
    typeof normalizedInput.name === 'string' &&
    normalizedInput.name.trim().length > 0
      ? normalizedInput.name
      : typeof normalizedInput.metadata?.name === 'string' &&
          normalizedInput.metadata.name.trim().length > 0
        ? normalizedInput.metadata.name
        : typeof normalizedInput.metadata?.title === 'string' &&
            normalizedInput.metadata.title.trim().length > 0
          ? normalizedInput.metadata.title
          : undefined;

  if (!nameFallback) {
    return {
      status: 'unsafe',
      changes: Array.from(changes),
      reasons: ['missing top-level name and no metadata.name/title fallback']
    };
  }

  if (
    !(
      typeof normalizedInput.name === 'string' &&
      normalizedInput.name.trim().length > 0
    )
  ) {
    addChange(changes, 'added top-level name from metadata fallback');
  }

  const normalizedNodes = [];
  const nodeReasons = [];
  normalizedInput.nodes.forEach((node, index) => {
    const result = normalizeNode(node, index, changes);
    if (result.reasons.length > 0) {
      nodeReasons.push(...result.reasons);
      return;
    }
    if (result.node) {
      normalizedNodes.push(result.node);
    }
  });

  if (nodeReasons.length > 0) {
    return {
      status: 'unsafe',
      changes: Array.from(changes),
      reasons: nodeReasons
    };
  }

  const nodeTypesById = new Map(
    normalizedNodes.map(node => [node.id, node.type])
  );

  const normalizedEdgesResult = normalizeEdges(
    Array.isArray(normalizedInput.edges) ? normalizedInput.edges : [],
    nodeTypesById,
    changes
  );
  if (
    normalizedEdgesResult.reasons.length > 0 ||
    !normalizedEdgesResult.edges
  ) {
    return {
      status: 'unsafe',
      changes: Array.from(changes),
      reasons: normalizedEdgesResult.reasons
    };
  }

  const normalizedRegionsResult = normalizeRegions(
    normalizedInput.regions,
    changes
  );
  if (normalizedRegionsResult.reasons.length > 0) {
    return {
      status: 'unsafe',
      changes: Array.from(changes),
      reasons: normalizedRegionsResult.reasons
    };
  }

  const metadata = isRecord(normalizedInput.metadata)
    ? deepClone(normalizedInput.metadata)
    : undefined;

  const additionalTopLevel = {};
  Object.entries(normalizedInput).forEach(([key, value]) => {
    if (
      ![
        'version',
        'name',
        'description',
        'metadata',
        'nodes',
        'edges',
        'regions'
      ].includes(key)
    ) {
      additionalTopLevel[key] = value;
    }
  });

  const normalizedDocument = {
    version:
      typeof normalizedInput.version === 'string' &&
      normalizedInput.version.trim().length > 0
        ? normalizedInput.version
        : '1.0.0',
    name: nameFallback,
    ...additionalTopLevel
  };

  if (
    !(
      typeof normalizedInput.version === 'string' &&
      normalizedInput.version.trim().length > 0
    )
  ) {
    addChange(changes, 'added version 1.0.0');
  }

  if (
    typeof normalizedInput.description === 'string' &&
    normalizedInput.description.length > 0
  ) {
    normalizedDocument.description = normalizedInput.description;
  }
  if (metadata && Object.keys(metadata).length > 0) {
    normalizedDocument.metadata = metadata;
  }
  normalizedDocument.nodes = normalizedNodes;
  normalizedDocument.edges = normalizedEdgesResult.edges;
  if (
    normalizedRegionsResult.regions &&
    normalizedRegionsResult.regions.length > 0
  ) {
    normalizedDocument.regions = normalizedRegionsResult.regions;
  }

  const orderedDocument = {
    version: normalizedDocument.version,
    name: normalizedDocument.name
  };

  Object.entries(normalizedDocument).forEach(([key, value]) => {
    if (
      ![
        'version',
        'name',
        'description',
        'metadata',
        'nodes',
        'edges',
        'regions'
      ].includes(key)
    ) {
      orderedDocument[key] = value;
    }
  });

  if (normalizedDocument.description !== undefined) {
    orderedDocument.description = normalizedDocument.description;
  }
  if (normalizedDocument.metadata !== undefined) {
    orderedDocument.metadata = normalizedDocument.metadata;
  }
  orderedDocument.nodes = normalizedDocument.nodes;
  orderedDocument.edges = normalizedDocument.edges;
  if (normalizedDocument.regions !== undefined) {
    orderedDocument.regions = normalizedDocument.regions;
  }

  const changeList = Array.from(changes);
  if (changeList.length === 0) {
    return {
      status: 'canonical',
      changes: [],
      reasons: [],
      normalizedData: orderedDocument
    };
  }

  return {
    status: 'rewritten',
    changes: changeList,
    reasons: [],
    normalizedData: orderedDocument,
    normalizedContent: `${JSON.stringify(orderedDocument, null, 2)}\n`
  };
}

function isPsgRepairSafeStatus(status) {
  return status === 'canonical' || status === 'rewritten';
}

module.exports = {
  isPsgRepairSafeStatus,
  repairPsgContent
};

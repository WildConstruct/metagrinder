const {
  MetagrinderBriefAnalysisArtifactSchema,
  MetagrinderCodexParseRequestArtifactSchema,
  MetagrinderCodexParseResultArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'record';
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function uniqueRecords(records, key) {
  const seen = new Set();
  return (records || []).filter((record) => {
    const value = record?.[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function provenanceFromRecord(record, fallbackChunkIds = []) {
  return {
    sourceInputIds: record?.sourceInputIds || [],
    sourceChunkIds: record?.sourceChunkIds || fallbackChunkIds,
    excerptText: record?.excerptText || record?.summary || record?.text || record?.description || '',
    attributionMode: record?.attributionMode || 'paraphrased',
    confidence: record?.confidence || 'low',
    validationStatus: record?.validationStatus || 'seed_unverified'
  };
}

function compactChunk(chunk) {
  return {
    chunkId: chunk.chunkId,
    sourceInputId: chunk.sourceInputId,
    sectionLabel: chunk.sectionLabel || '',
    text: chunk.text.slice(0, 2200)
  };
}

function buildCodexParseOutputSchemaArtifact({ inputId }) {
  return {
    inputId,
    schemaVersion: '0.1.0',
    artifactName: 'codex-parse-result.json',
    requiredTopLevelFields: [
      'inputId',
      'analysisMode',
      'mainSubject',
      'subcategoryCandidates',
      'subcategoryEvidenceChecks',
      'subcategoryCharacteristics',
      'weightedGroups',
      'rules',
      'constraints',
      'examples',
      'citations',
      'researchGaps',
      'graphAssemblyPlan',
      'coverage'
    ],
    provenanceRequiredFields: [
      'sourceInputIds',
      'sourceChunkIds',
      'excerptText',
      'attributionMode',
      'confidence',
      'validationStatus'
    ],
    notes: [
      'Return JSON only. Do not claim pasted citations are verified.',
      'Do not invent subcategories that lack text evidence; mark weak or contradicted candidates clearly.',
      'Use generic labels from the source text. Do not force a crowd, scene, or PSG interpretation when the brief is not scene-like.',
      'Graph assembly plan should describe candidate prompt graph nodes and edges, not mutate any accepted grammar artifact.'
    ],
    jsonSchema: {
      type: 'object',
      required: [
        'inputId',
        'analysisMode',
        'mainSubject',
        'subcategoryCandidates',
        'subcategoryEvidenceChecks',
        'subcategoryCharacteristics',
        'weightedGroups',
        'rules',
        'constraints',
        'examples',
        'citations',
        'researchGaps',
        'graphAssemblyPlan',
        'coverage'
      ],
      properties: {
        inputId: { type: 'string' },
        analysisMode: { const: 'codex-semantic' },
        mainSubject: { type: 'object' },
        subcategoryCandidates: { type: 'array' },
        subcategoryEvidenceChecks: { type: 'array' },
        subcategoryCharacteristics: { type: 'array' },
        weightedGroups: { type: 'array' },
        rules: { type: 'array' },
        constraints: { type: 'array' },
        examples: { type: 'array' },
        citations: { type: 'array' },
        researchGaps: { type: 'array' },
        graphAssemblyPlan: { type: 'object' },
        coverage: { type: 'array' }
      }
    },
    exampleRecordShape: {
      subcategoryCandidates: [{
        subcategoryId: 'source_label_slug',
        label: 'Label from source text',
        parentSubjectId: 'main_subject',
        supportStatus: 'supported | weak | contradicted | inferred',
        evidenceSummary: 'Why this is or is not a valid component of the main subject.',
        sourceInputIds: [],
        sourceChunkIds: [],
        excerptText: '',
        attributionMode: 'direct | paraphrased | inferred',
        confidence: 'low | medium | high',
        validationStatus: 'supported | weak | contradicted | needs_review'
      }]
    }
  };
}

function buildCodexParseRequestArtifact({ ingestArtifact, structuredBriefSeedArtifact }) {
  const inputId = ingestArtifact.inputId;
  return MetagrinderCodexParseRequestArtifactSchema.parse({
    inputId,
    requestVersion: '0.1.0',
    taskTitle: 'Metagrinder Codex semantic parse',
    instructions: [
      'Identify the main subject of the research/design brief.',
      'Identify subcategories/components of that subject and validate them against the source text.',
      'Extract sub-characteristics, weights/ranges, conditional rules, constraints, examples, implementation fields, citations, and research gaps.',
      'Mark pasted citations as unverified references unless separately reviewed or retrieved.',
      'Return only structured JSON matching codex-parse-output.schema.json.',
      'Do not mutate accepted-scene-grammar.json, source-claims.json, grammar-revisions.json, or any accepted artifact.'
    ],
    sourceInputs: ingestArtifact.sourceInputs.map((source) => ({
      sourceInputId: source.sourceInputId,
      title: source.title,
      path: source.path
    })),
    chunks: ingestArtifact.chunks.map(compactChunk),
    seedArtifactPath: 'structured-brief.seed.json',
    outputContractPath: 'codex-parse-output.schema.json',
    expectedOutputPath: 'codex-parse-result.json',
    seedSummary: {
      entities: structuredBriefSeedArtifact.entities.length,
      weightedGroups: structuredBriefSeedArtifact.weightedGroups.length,
      rules: structuredBriefSeedArtifact.rules.length,
      constraints: structuredBriefSeedArtifact.constraints.length,
      citations: structuredBriefSeedArtifact.citations.length
    }
  });
}

function buildCodexParseRequestMarkdown({ codexParseRequestArtifact }) {
  const lines = [
    '# Metagrinder Codex Semantic Parse Task',
    '',
    'You are parsing a dense research/design brief for Metagrinder. The deterministic parser only produced a seed index. Your job is semantic extraction and validation.',
    '',
    '## Required Output',
    '',
    'Return JSON matching `codex-parse-output.schema.json`. When used by the Workbench runner, the Workbench writes the returned JSON to `codex-parse-result.json` after validation.',
    '',
    '## Instructions',
    '',
    ...codexParseRequestArtifact.instructions.map((instruction) => `- ${instruction}`),
    '',
    '## Source Chunks',
    ''
  ];
  codexParseRequestArtifact.chunks.forEach((chunk) => {
    lines.push(`### ${chunk.chunkId} — ${chunk.sectionLabel || chunk.sourceInputId}`);
    lines.push('');
    lines.push('```text');
    lines.push(chunk.text);
    lines.push('```');
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
}

function seedMainSubject({ ingestArtifact }) {
  const title = ingestArtifact.title || ingestArtifact.sourceInputs[0]?.title || ingestArtifact.inputId;
  const firstChunk = ingestArtifact.chunks[0];
  return {
    subjectId: `${ingestArtifact.inputId}_main_subject`,
    label: title,
    subjectType: ingestArtifact.researchKind === 'unknown' ? 'brief' : ingestArtifact.researchKind,
    summary: firstChunk?.text?.slice(0, 500) || title,
    ...provenanceFromRecord({
      sourceInputIds: ingestArtifact.sourceInputs.map((source) => source.sourceInputId),
      sourceChunkIds: firstChunk ? [firstChunk.chunkId] : [],
      excerptText: firstChunk?.text?.slice(0, 1000) || title,
      confidence: 'low'
    })
  };
}

function buildBriefAnalysisFromSeed({ ingestArtifact, structuredBriefSeedArtifact }) {
  const mainSubject = seedMainSubject({ ingestArtifact });
  const subcategoryCandidates = structuredBriefSeedArtifact.entities.map((entity) => ({
    subcategoryId: entity.entityId,
    label: entity.label,
    parentSubjectId: mainSubject.subjectId,
    supportStatus: 'weak',
    evidenceSummary: entity.summary,
    ...provenanceFromRecord(entity)
  }));
  const subcategoryCharacteristics = structuredBriefSeedArtifact.attributeClusters.map((cluster) => ({
    characteristicId: cluster.clusterId,
    subcategoryId: subcategoryCandidates.find((candidate) =>
      cluster.sourceChunkIds.some((chunkId) => candidate.sourceChunkIds.includes(chunkId))
    )?.subcategoryId,
    label: cluster.label,
    characteristicType: cluster.category,
    values: cluster.items,
    ...provenanceFromRecord(cluster)
  }));
  const weightedGroups = structuredBriefSeedArtifact.weightedGroups.map((weight) => ({
    weightId: weight.weightId,
    label: weight.label,
    min: weight.min,
    max: weight.max,
    unit: weight.unit,
    appliesTo: weight.appliesTo,
    ...provenanceFromRecord(weight)
  }));
  const rules = structuredBriefSeedArtifact.rules.map((rule) => ({
    ruleId: rule.ruleId,
    label: rule.label,
    conditionText: rule.conditionText,
    effects: rule.effects,
    ...provenanceFromRecord(rule)
  }));
  const constraints = structuredBriefSeedArtifact.constraints.map((constraint) => ({
    constraintId: constraint.constraintId,
    label: constraint.label,
    constraintType: constraint.constraintType,
    text: constraint.text,
    ...provenanceFromRecord(constraint)
  }));
  const examples = structuredBriefSeedArtifact.examples.map((example) => ({
    exampleId: example.exampleId,
    label: example.label,
    exampleType: example.exampleType,
    text: example.text,
    ...provenanceFromRecord(example)
  }));
  const citations = structuredBriefSeedArtifact.citations.map((citation) => ({
    citationId: citation.citationId,
    label: citation.label,
    url: citation.url,
    citationText: citation.citationText,
    verificationStatus: 'unverified-pasted-citation',
    ...provenanceFromRecord(citation)
  }));
  const researchGaps = structuredBriefSeedArtifact.openQuestions.map((question) => ({
    gapId: question.questionId,
    label: question.text.slice(0, 90),
    reason: 'Seed parser found an open question or uncertainty that needs semantic review.',
    recommendedAction: 'review-or-research',
    ...provenanceFromRecord(question)
  }));
  const graphAssemblyPlan = {
    readiness: subcategoryCandidates.length > 0 ? 'needs_codex_review' : 'not_ready',
    nodes: subcategoryCandidates.slice(0, 20).map((candidate) => ({
      nodeId: slugify(candidate.label),
      label: candidate.label,
      nodeType: 'candidate-subcategory',
      sourceRecordIds: [candidate.subcategoryId],
      reviewStatus: 'needs_review'
    })),
    edges: [],
    notes: [
      'Seed-only graph plan is an index of candidate components. Import a Codex parse result before treating it as semantic analysis.'
    ]
  };
  return MetagrinderBriefAnalysisArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    analysisMode: 'seed-only',
    sourceInputIds: ingestArtifact.sourceInputs.map((source) => source.sourceInputId),
    mainSubject,
    subjectType: mainSubject.subjectType,
    subcategoryCandidates,
    subcategoryEvidenceChecks: subcategoryCandidates.map((candidate) => ({
      checkId: `${candidate.subcategoryId}_evidence_check`,
      subcategoryId: candidate.subcategoryId,
      supportStatus: candidate.supportStatus,
      supportingExcerptIds: candidate.sourceChunkIds,
      contradictingExcerptIds: [],
      assessment: 'Seed parser found text evidence, but semantic validation requires Codex review.',
      ...provenanceFromRecord(candidate)
    })),
    subcategoryCharacteristics,
    weightedGroups,
    rules,
    constraints,
    examples,
    implementationFields: structuredBriefSeedArtifact.implementationFields.map((field) => ({
      fieldId: field.fieldId,
      name: field.name,
      label: field.label,
      valueHint: field.valueHint,
      ...provenanceFromRecord(field)
    })),
    citations,
    researchGaps,
    graphAssemblyPlan,
    coverage: [
      ...structuredBriefSeedArtifact.coverage,
      {
        category: 'codexSemanticValidation',
        status: 'not_found',
        count: 0,
        note: 'No codex-parse-result.json has been imported for this run.'
      }
    ]
  });
}

function normalizeCodexParseResult({ ingestArtifact, codexParseResult }) {
  const parsed = MetagrinderCodexParseResultArtifactSchema.parse(codexParseResult);
  return MetagrinderBriefAnalysisArtifactSchema.parse({
    ...parsed,
    inputId: parsed.inputId || ingestArtifact.inputId,
    analysisMode: 'codex-semantic',
    sourceInputIds: parsed.sourceInputIds && parsed.sourceInputIds.length > 0
      ? parsed.sourceInputIds
      : ingestArtifact.sourceInputs.map((source) => source.sourceInputId),
    subjectType: parsed.subjectType || parsed.mainSubject?.subjectType || 'brief',
    coverage: [
      ...(parsed.coverage || []),
      {
        category: 'codexSemanticValidation',
        status: 'extracted',
        count: 1,
        note: 'codex-parse-result.json was produced by Codex and used for semantic projection.'
      }
    ]
  });
}

function buildProjectionStructuredBriefFromAnalysis({ structuredBriefSeedArtifact, briefAnalysisArtifact }) {
  if (!briefAnalysisArtifact || briefAnalysisArtifact.analysisMode === 'seed-only') {
    return structuredBriefSeedArtifact;
  }
  const entities = (briefAnalysisArtifact.subcategoryCandidates || [])
    .filter((candidate) => ['supported', 'inferred'].includes(candidate.supportStatus))
    .map((candidate) => ({
      entityId: candidate.subcategoryId,
      label: candidate.label,
      entityKind: 'role',
      summary: candidate.evidenceSummary || candidate.excerptText,
      attributeRefs: [],
      weightRefs: (briefAnalysisArtifact.weightedGroups || [])
        .filter((weight) => (weight.appliesTo || '').toLowerCase() === candidate.label.toLowerCase())
        .map((weight) => weight.weightId),
      ruleRefs: [],
      sourceInputIds: candidate.sourceInputIds,
      sourceChunkIds: candidate.sourceChunkIds,
      excerptText: candidate.excerptText,
      attributionMode: candidate.attributionMode,
      confidence: candidate.confidence
    }));
  const weightedGroups = (briefAnalysisArtifact.weightedGroups || []).map((weight) => ({
    weightId: weight.weightId,
    label: weight.label,
    min: weight.min,
    max: weight.max,
    unit: weight.unit,
    appliesTo: weight.appliesTo || weight.label,
    sourceInputIds: weight.sourceInputIds,
    sourceChunkIds: weight.sourceChunkIds,
    excerptText: weight.excerptText,
    attributionMode: weight.attributionMode,
    confidence: weight.confidence
  }));
  const attributeClusters = (briefAnalysisArtifact.subcategoryCharacteristics || []).map((item) => ({
    clusterId: item.characteristicId,
    label: item.label,
    category: item.characteristicType === 'behavior' || item.characteristicType === 'modifier'
      ? item.characteristicType
      : 'wardrobe-or-attribute',
    items: item.values || [],
    sourceInputIds: item.sourceInputIds,
    sourceChunkIds: item.sourceChunkIds,
    excerptText: item.excerptText,
    attributionMode: item.attributionMode,
    confidence: item.confidence
  }));
  return {
    ...structuredBriefSeedArtifact,
    entities: uniqueRecords([...entities, ...structuredBriefSeedArtifact.entities], 'entityId'),
    weightedGroups: uniqueRecords([...weightedGroups, ...structuredBriefSeedArtifact.weightedGroups], 'weightId'),
    attributeClusters: uniqueRecords([...attributeClusters, ...structuredBriefSeedArtifact.attributeClusters], 'clusterId'),
    rules: briefAnalysisArtifact.rules.length > 0 ? briefAnalysisArtifact.rules : structuredBriefSeedArtifact.rules,
    constraints: briefAnalysisArtifact.constraints.length > 0 ? briefAnalysisArtifact.constraints : structuredBriefSeedArtifact.constraints,
    examples: briefAnalysisArtifact.examples.length > 0 ? briefAnalysisArtifact.examples : structuredBriefSeedArtifact.examples,
    citations: briefAnalysisArtifact.citations.length > 0 ? briefAnalysisArtifact.citations : structuredBriefSeedArtifact.citations,
    coverage: briefAnalysisArtifact.coverage
  };
}

module.exports = {
  buildBriefAnalysisFromSeed,
  buildCodexParseOutputSchemaArtifact,
  buildCodexParseRequestArtifact,
  buildCodexParseRequestMarkdown,
  buildProjectionStructuredBriefFromAnalysis,
  normalizeCodexParseResult
};

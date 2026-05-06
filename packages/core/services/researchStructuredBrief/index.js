const {
  MetagrinderStructuredBriefArtifactSchema
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

function sentenceSplit(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sourceInputIdsFor(ingestArtifact, chunkIds) {
  return unique(ingestArtifact.chunks
    .filter((chunk) => chunkIds.includes(chunk.chunkId))
    .map((chunk) => chunk.sourceInputId));
}

function baseRecord({ ingestArtifact, chunk, excerpt, confidence = 'medium' }) {
  return {
    sourceInputIds: sourceInputIdsFor(ingestArtifact, [chunk.chunkId]),
    sourceChunkIds: [chunk.chunkId],
    excerptText: excerpt.trim().slice(0, 1200),
    attributionMode: 'paraphrased',
    confidence
  };
}

function parseWeightRange(text) {
  const normalized = String(text || '').replace(/[–—]/g, '-');
  const range = normalized.match(/~?\s*(\d+(?:\.\d+)?)\s*(?:-|to)\s*~?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]), unit: 'percent', confidence: 'medium' };
  }
  const single = normalized.match(/~?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (single) {
    const value = Number(single[1]);
    return { min: value, max: value, unit: 'percent', confidence: 'medium' };
  }
  const lower = normalized.toLowerCase();
  if (/dominant|overwhelming|baseline|most common|high\b/.test(lower)) return { min: 60, max: 90, unit: 'weight', confidence: 'low' };
  if (/very common|common|medium\b/.test(lower)) return { min: 20, max: 50, unit: 'weight', confidence: 'low' };
  if (/sparse|rare|low\b|occasional|near-zero/.test(lower)) return { min: 1, max: 10, unit: 'weight', confidence: 'low' };
  return undefined;
}

function cleanLabel(value) {
  return String(value || '')
    .replace(/^#+\s*/, '')
    .replace(/^[-*]\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^[A-Z][.)]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/[::]\s*$/, '')
    .trim();
}


function dedupeRepeatedLabel(value) {
  const label = cleanLabel(value);
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const left = words.slice(0, half).join(' ').toLowerCase();
    const right = words.slice(half).join(' ').toLowerCase();
    if (left === right) return words.slice(0, half).join(' ');
  }
  return label;
}
function headingFromChunk(chunk) {
  const text = chunk.text.trim();
  const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) || '';
  if (/^#{1,4}\s+/.test(firstLine)) return cleanLabel(firstLine);
  if (/^\d+\.\s+/.test(firstLine)) return cleanLabel(firstLine);
  if (/^#{0,3}\s*[A-Z][.)]\s+/.test(firstLine)) return cleanLabel(firstLine);
  return chunk.sectionLabel ? cleanLabel(chunk.sectionLabel) : '';
}

function inferEntityKind(text) {
  const lower = text.toLowerCase();
  if (/archetype|spectator|vendor|shopper|worker|official|driver|mechanic|role|agent|participant|specimen|class/.test(lower)) return 'archetype';
  if (/zone|area|location|grandstand|rail|pit|infield|gate|stall|fountain/.test(lower)) return 'zone-or-context';
  return 'concept';
}

function extractKeyValueWeight(line) {
  const match = line.match(/["']?([^"':{}]+)["']?\s*:\s*["']?([^"'{}]+%[^"'{}]*)["']?/);
  if (!match) return null;
  return { label: cleanLabel(match[1]), valueText: match[2] };
}

function extractWeightedGroups(ingestArtifact) {
  const weightedGroups = [];
  ingestArtifact.chunks.forEach((chunk) => {
    sentenceSplit(chunk.text).forEach((line) => {
      const kv = extractKeyValueWeight(line);
      const range = parseWeightRange(kv ? kv.valueText : line);
      if (!range) return;
      const labelMatch = kv ? { label: kv.label } : line.match(/^[-*]?\s*([^::\n]{3,90}?)(?:\s*\([^)]*\))?\s*(?::|--|-|is|=)?\s*~?\s*\d/i);
      const label = dedupeRepeatedLabel(labelMatch?.label || labelMatch?.[1] || headingFromChunk(chunk) || 'weighted group');
      if (!label || /weight|share|baseline/i.test(label) && label.length < 12) return;
      weightedGroups.push({
        weightId: `${ingestArtifact.inputId}_weight_${String(weightedGroups.length + 1).padStart(3, '0')}`,
        label,
        min: range.min,
        max: range.max,
        unit: range.unit,
        appliesTo: headingFromChunk(chunk) || label,
        ...baseRecord({ ingestArtifact, chunk, excerpt: line, confidence: range.confidence })
      });
    });
  });
  return weightedGroups;
}

function extractEntities(ingestArtifact, weightedGroups) {
  const entities = [];
  const seen = new Set();
  ingestArtifact.chunks.forEach((chunk) => {
    const heading = headingFromChunk(chunk);
    const lower = chunk.text.toLowerCase();
    const hasStructure = /weight|share|baseline|archetype|specimen|role|agent|participant|clothing|behavior|wardrobe|attributes?/i.test(chunk.text);
    if (heading && hasStructure && heading.length <= 90) {
      const key = heading.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        entities.push({
          entityId: `${ingestArtifact.inputId}_entity_${String(entities.length + 1).padStart(3, '0')}`,
          label: heading,
          entityKind: inferEntityKind(`${heading}\n${chunk.text}`),
          summary: chunk.text.slice(0, 700),
          attributeRefs: [],
          weightRefs: weightedGroups.filter((weight) => weight.sourceChunkIds.includes(chunk.chunkId)).map((weight) => weight.weightId),
          ruleRefs: [],
          ...baseRecord({ ingestArtifact, chunk, excerpt: chunk.text })
        });
      }
    }
    sentenceSplit(chunk.text).forEach((line) => {
      const match = line.match(/^[-*]\s*(?:\*\*)?([^:*]{3,80}?)(?:\*\*)?\s*[::]/);
      if (!match) return;
      const label = cleanLabel(match[1]);
      if (!/(spectator|vendor|worker|official|driver|mechanic|role|agent|participant|zone|area|context|group|class|specimen)/i.test(label)) return;
      const key = label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      entities.push({
        entityId: `${ingestArtifact.inputId}_entity_${String(entities.length + 1).padStart(3, '0')}`,
        label,
        entityKind: inferEntityKind(line),
        summary: line,
        attributeRefs: [],
        weightRefs: weightedGroups.filter((weight) => weight.excerptText === line || weight.label.toLowerCase() === label.toLowerCase()).map((weight) => weight.weightId),
        ruleRefs: [],
        ...baseRecord({ ingestArtifact, chunk, excerpt: line })
      });
    });
    if (/fields?:|schema|each .* these fields|give every/i.test(lower)) {
      entities.push({
        entityId: `${ingestArtifact.inputId}_entity_${String(entities.length + 1).padStart(3, '0')}`,
        label: heading || 'Implementation field model',
        entityKind: 'schema-field-set',
        summary: chunk.text.slice(0, 700),
        attributeRefs: [],
        weightRefs: [],
        ruleRefs: [],
        ...baseRecord({ ingestArtifact, chunk, excerpt: chunk.text })
      });
    }
  });
  return entities;
}

function extractAttributeClusters(ingestArtifact) {
  const clusters = [];
  ingestArtifact.chunks.forEach((chunk) => {
    const heading = headingFromChunk(chunk);
    const lower = `${heading}\n${chunk.text}`.toLowerCase();
    let category = null;
    if (/wardrobe|clothing|wear|hat|suit|shirt|props?|accessor/.test(lower)) category = 'wardrobe-or-attribute';
    if (/behavior|attention|pose|walking|leaning|watching|working/.test(lower)) category = category || 'behavior';
    if (/environment|modifier|dust|heat|weather|sweat|lighting/.test(lower)) category = category || 'modifier';
    if (!category) return;
    const items = sentenceSplit(chunk.text)
      .flatMap((line) => line.match(/^[-*]\s+(.+)/) ? [cleanLabel(line)] : [])
      .filter((item) => item.length > 2 && item.length < 120)
      .slice(0, 16);
    if (items.length === 0 && !/(wardrobe|clothing|environment|behavior|modifier)/i.test(heading)) return;
    clusters.push({
      clusterId: `${ingestArtifact.inputId}_attribute_cluster_${String(clusters.length + 1).padStart(3, '0')}`,
      label: heading || category,
      category,
      items: items.length > 0 ? items : sentenceSplit(chunk.text).slice(0, 6),
      ...baseRecord({ ingestArtifact, chunk, excerpt: chunk.text })
    });
  });
  return clusters;
}

function extractRules(ingestArtifact) {
  const rules = [];
  const effectRegex = /(increase|decrease|force|allow|avoid|exclude|requires?|bias(?:ed)? toward|bias(?:ed)? away from)\s+\[?([^\]\n.;{}]+)/ig;
  ingestArtifact.chunks.forEach((chunk) => {
    sentenceSplit(chunk.text).forEach((line) => {
      const lower = line.toLowerCase();
      const isRule = /\bif\b|increase|decrease|force|allow|avoid|exclude|requires?|bias/.test(lower) && (/:|\{|\}|->|then|if_/.test(lower));
      if (!isRule) return;
      const effects = [];
      let match;
      while ((match = effectRegex.exec(line)) !== null) {
        const action = match[1].toLowerCase().replace(/s$/, '').replace(/biased? toward/, 'bias-toward').replace(/biased? away from/, 'bias-away-from').replace(/ /g, '-');
        effects.push({ action: action === 'require' ? 'requires' : action, target: cleanLabel(match[2]).slice(0, 120) });
      }
      rules.push({
        ruleId: `${ingestArtifact.inputId}_rule_${String(rules.length + 1).padStart(3, '0')}`,
        label: cleanLabel(line.slice(0, 90)) || 'Conditional rule',
        conditionText: line.match(/if[_\s-]?([^:{]+)(?::|then|\{)/i)?.[1]?.trim() || 'structured condition',
        effects,
        ...baseRecord({ ingestArtifact, chunk, excerpt: line, confidence: effects.length > 0 ? 'medium' : 'low' })
      });
    });
  });
  return rules;
}

function extractConstraints(ingestArtifact) {
  const constraints = [];
  ingestArtifact.chunks.forEach((chunk) => {
    sentenceSplit(chunk.text).forEach((line) => {
      if (!/\b(avoid|do not|don't|should not|must not|prevent|enforce|never)\b/i.test(line)) return;
      constraints.push({
        constraintId: `${ingestArtifact.inputId}_constraint_${String(constraints.length + 1).padStart(3, '0')}`,
        label: cleanLabel(line.slice(0, 80)),
        constraintType: /race|black|african|ethnic|outsider|representation/i.test(line) ? 'ethical' : 'negative',
        text: line,
        ...baseRecord({ ingestArtifact, chunk, excerpt: line })
      });
    });
  });
  return constraints;
}

function extractZonesOrContexts(ingestArtifact, weightedGroups) {
  const zones = [];
  const seen = new Set();
  ingestArtifact.chunks.forEach((chunk) => {
    const heading = headingFromChunk(chunk);
    const lower = `${heading}\n${chunk.text}`.toLowerCase();
    const zoneLike = /zone|location|context|area|grandstand|rail|pit|infield|walkway|gate|stall|fountain|region|setting/.test(lower);
    if (!zoneLike) return;
    const label = heading && heading.length <= 80 ? dedupeRepeatedLabel(heading) : dedupeRepeatedLabel((chunk.text.split('\n').find((line) => /:/.test(line)) || 'context').split(':')[0]);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) return;
    seen.add(key);
    zones.push({
      contextId: `${ingestArtifact.inputId}_context_${String(zones.length + 1).padStart(3, '0')}`,
      label,
      contextKind: /zone|location|area|grandstand|rail|pit|infield|walkway|gate|stall|fountain/.test(lower) ? 'location-zone' : 'context',
      description: chunk.text.slice(0, 700),
      weightRefs: weightedGroups.filter((weight) => weight.sourceChunkIds.includes(chunk.chunkId)).map((weight) => weight.weightId),
      ruleRefs: [],
      ...baseRecord({ ingestArtifact, chunk, excerpt: chunk.text })
    });
  });
  return zones;
}

function extractExamples(ingestArtifact) {
  const examples = [];
  ingestArtifact.chunks.forEach((chunk) => {
    const heading = headingFromChunk(chunk);
    sentenceSplit(chunk.text).forEach((line) => {
      if (!/(example|prompt|specimen|variant|catalog photography|reference image)/i.test(`${heading}\n${line}`)) return;
      examples.push({
        exampleId: `${ingestArtifact.inputId}_example_${String(examples.length + 1).padStart(3, '0')}`,
        label: heading || 'Example',
        exampleType: /prompt/i.test(line) ? 'prompt' : /specimen|reference image|catalog/i.test(line) ? 'specimen' : 'example',
        text: line,
        ...baseRecord({ ingestArtifact, chunk, excerpt: line })
      });
    });
  });
  return examples;
}

function extractImplementationFields(ingestArtifact) {
  const fields = [];
  const seen = new Set();
  ingestArtifact.chunks.forEach((chunk) => {
    const inFieldChunk = /fields?:|schema|give every|json/i.test(chunk.text);
    if (!inFieldChunk) return;
    const matches = [...chunk.text.matchAll(/["']?([a-zA-Z][a-zA-Z0-9_ -]{1,60})["']?\s*:\s*["']?([^,"'{}\n]+(?:\|[^,"'{}\n]+)*)["']?/g)];
    matches.forEach((match) => {
      const label = cleanLabel(match[1]);
      const name = slugify(label);
      if (!name || seen.has(chunk.chunkId + ":" + name)) return;
      seen.add(chunk.chunkId + ":" + name);
      const excerpt = match[0].replace(/[,{}]$/, "").trim();
      fields.push({
        fieldId: ingestArtifact.inputId + "_field_" + String(fields.length + 1).padStart(3, "0"),
        name,
        label,
        valueHint: cleanLabel(match[2] || ""),
        ...baseRecord({ ingestArtifact, chunk, excerpt })
      });
    });
  });
  return fields;
}
function extractCitations(ingestArtifact) {
  const citations = [];
  ingestArtifact.chunks.forEach((chunk) => {
    const markdownRefs = [...chunk.text.matchAll(/\[([^\]]+)\]:\s*(https?:\/\/\S+)\s*(.*)/g)];
    markdownRefs.forEach((match) => {
      citations.push({
        citationId: `${ingestArtifact.inputId}_citation_${String(citations.length + 1).padStart(3, '0')}`,
        label: match[1],
        url: match[2].replace(/[)>]+$/, ''),
        citationText: match[3].trim(),
        verificationStatus: 'unverified-pasted-citation',
        ...baseRecord({ ingestArtifact, chunk, excerpt: match[0], confidence: 'low' })
      });
    });
    const inlineUrls = [...chunk.text.matchAll(/https?:\/\/[^\s)\]]+/g)];
    inlineUrls.forEach((match) => {
      if (citations.some((citation) => citation.url === match[0])) return;
      citations.push({
        citationId: `${ingestArtifact.inputId}_citation_${String(citations.length + 1).padStart(3, '0')}`,
        label: 'Inline URL',
        url: match[0],
        citationText: match[0],
        verificationStatus: 'unverified-pasted-citation',
        ...baseRecord({ ingestArtifact, chunk, excerpt: match[0], confidence: 'low' })
      });
    });
  });
  return citations;
}

function buildCoverage({ entities, weightedGroups, attributeClusters, rules, constraints, zonesOrContexts, modifiers, examples, implementationFields, citations }) {
  const specs = [
    ['entities', entities.length],
    ['weightedGroups', weightedGroups.length],
    ['attributeClusters', attributeClusters.length],
    ['rules', rules.length],
    ['constraints', constraints.length],
    ['zonesOrContexts', zonesOrContexts.length],
    ['modifiers', modifiers.length],
    ['examples', examples.length],
    ['implementationFields', implementationFields.length],
    ['citations', citations.length]
  ];
  return specs.map(([category, count]) => ({
    category,
    status: count > 0 ? 'extracted' : 'not_found',
    count,
    note: count > 0 ? 'Detected from source text structure.' : 'No matching generic structure found in the source text.'
  }));
}

function buildStructuredBriefArtifact({ ingestArtifact }) {
  const weightedGroups = extractWeightedGroups(ingestArtifact);
  const entities = extractEntities(ingestArtifact, weightedGroups);
  const attributeClusters = extractAttributeClusters(ingestArtifact);
  const rules = extractRules(ingestArtifact);
  const constraints = extractConstraints(ingestArtifact);
  const zonesOrContexts = extractZonesOrContexts(ingestArtifact, weightedGroups);
  const examples = extractExamples(ingestArtifact);
  const implementationFields = extractImplementationFields(ingestArtifact);
  const citations = extractCitations(ingestArtifact);
  const modifiers = attributeClusters.filter((cluster) => cluster.category === 'modifier').map((cluster, index) => ({
    modifierId: `${ingestArtifact.inputId}_modifier_${String(index + 1).padStart(3, '0')}`,
    label: cluster.label,
    modifierType: 'environment-or-condition',
    text: cluster.excerptText,
    sourceInputIds: cluster.sourceInputIds,
    sourceChunkIds: cluster.sourceChunkIds,
    excerptText: cluster.excerptText,
    attributionMode: cluster.attributionMode,
    confidence: cluster.confidence
  }));
  const openQuestions = ingestArtifact.chunks
    .flatMap((chunk) => sentenceSplit(chunk.text)
      .filter((line) => /\?$|missing|unknown|needs?|next level|if you want/i.test(line))
      .map((line, index) => ({
        questionId: `${chunk.chunkId}_open_${index + 1}`,
        text: line,
        ...baseRecord({ ingestArtifact, chunk, excerpt: line, confidence: 'low' })
      })));

  return MetagrinderStructuredBriefArtifactSchema.parse({
    inputId: ingestArtifact.inputId,
    sourceInputIds: ingestArtifact.sourceInputs.map((source) => source.sourceInputId),
    entities,
    weightedGroups,
    attributeClusters,
    rules,
    constraints,
    zonesOrContexts,
    modifiers,
    examples,
    implementationFields,
    citations,
    openQuestions,
    coverage: buildCoverage({ entities, weightedGroups, attributeClusters, rules, constraints, zonesOrContexts, modifiers, examples, implementationFields, citations })
  });
}

module.exports = {
  buildStructuredBriefArtifact,
  parseWeightRange,
  slugify
};

const SCAFFOLD_PATTERN = /\b(if|when)\s+supported\b|needs?\s+reviewed|semantic choices|attribute choices/i;
const LEAD_PATTERN = /^(an?|male|female|who is|with|wearing|carrying|holding|showing|standing|leaning|watching|walking|seated|bareheaded)\b/i;

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function titleCaseLooksAwkward(text) {
  return /\bwho is an? [A-Z][a-z]+(?:-[A-Z][a-z]+|\s+[A-Z][a-z]+)\b/.test(text) &&
    !/\b(African American|Black Indianapolis|Indianapolis|European|U\.S\.|WWI)\b/.test(text);
}

function choiceFindings(axis, choice, axisChoiceTexts) {
  const findings = [];
  const text = normalizeText(choice.text);
  if (SCAFFOLD_PATTERN.test(text)) {
    findings.push({
      findingId: `${choice.choiceId}_scaffold`,
      severity: 'error',
      findingType: 'scaffold-phrase',
      choiceId: choice.choiceId,
      axisId: axis.axisId,
      sampleSeed: null,
      text,
      message: 'Choice text contains internal review scaffolding instead of prompt language.'
    });
  }
  if (!LEAD_PATTERN.test(text)) {
    findings.push({
      findingId: `${choice.choiceId}_missing_lead`,
      severity: 'warning',
      findingType: 'missing-phrase-lead',
      choiceId: choice.choiceId,
      axisId: axis.axisId,
      sampleSeed: null,
      text,
      message: 'Choice text does not start like a composable prompt phrase.'
    });
  }
  if (titleCaseLooksAwkward(text)) {
    findings.push({
      findingId: `${choice.choiceId}_title_case`,
      severity: 'warning',
      findingType: 'title-case-label',
      choiceId: choice.choiceId,
      axisId: axis.axisId,
      sampleSeed: null,
      text,
      message: 'Choice text appears to include a title-case label inside a sentence.'
    });
  }
  if (/[.;:,]$/.test(text)) {
    findings.push({
      findingId: `${choice.choiceId}_dangling_punctuation`,
      severity: 'warning',
      findingType: 'dangling-punctuation',
      choiceId: choice.choiceId,
      axisId: axis.axisId,
      sampleSeed: null,
      text,
      message: 'Choice text ends with punctuation that may compose poorly.'
    });
  }
  const duplicateCount = axisChoiceTexts.filter((candidate) =>
    candidate.toLowerCase() === text.toLowerCase()
  ).length;
  if (duplicateCount > 1) {
    findings.push({
      findingId: `${choice.choiceId}_duplicate`,
      severity: 'warning',
      findingType: 'duplicate-choice-text',
      choiceId: choice.choiceId,
      axisId: axis.axisId,
      sampleSeed: null,
      text,
      message: 'Choice text duplicates another option in the same axis.'
    });
  }
  return findings;
}

function sampleFindings(sample) {
  const text = normalizeText(sample.outputText);
  const findings = [];
  if (SCAFFOLD_PATTERN.test(text)) {
    findings.push({
      findingId: `sample_${sample.seed}_scaffold`,
      severity: 'error',
      findingType: 'sample-scaffold-phrase',
      choiceId: null,
      axisId: null,
      sampleSeed: sample.seed,
      text,
      message: 'Sample output contains review scaffolding.'
    });
  }
  if (!/\bwho is\b/.test(text) || !/\b(wearing|with|carrying|showing|standing|leaning|watching|walking|seated|bareheaded)\b/.test(text)) {
    findings.push({
      findingId: `sample_${sample.seed}_low_cohesion`,
      severity: 'warning',
      findingType: 'low-sentence-cohesion',
      choiceId: null,
      axisId: null,
      sampleSeed: sample.seed,
      text,
      message: 'Sample output is missing either a role phrase or descriptive attribute phrase.'
    });
  }
  if (/\b(male|female)\s+(male|female)\b/i.test(text) || /\badult adult\b/i.test(text)) {
    findings.push({
      findingId: `sample_${sample.seed}_repetition`,
      severity: 'warning',
      findingType: 'repeated-age-sex-token',
      choiceId: null,
      axisId: null,
      sampleSeed: sample.seed,
      text,
      message: 'Sample output repeats age or sex tokens awkwardly.'
    });
  }
  return findings;
}

function buildPsgReadabilityReviewArtifact({
  inputId,
  flightArtifact,
  semanticChoiceGraphArtifact,
  createdAt = new Date().toISOString(),
  codexStatus = 'not-run',
  appliedRewriteCount = 0
}) {
  if (!flightArtifact?.samples) {
    throw new Error('psg-output-flight.json is required for readability review.');
  }
  if (!semanticChoiceGraphArtifact?.axes) {
    throw new Error('semantic-choice-graph.json is required for readability review.');
  }
  const choiceLevelFindings = semanticChoiceGraphArtifact.axes.flatMap((axis) => {
    const texts = (axis.choices || []).map((choice) => normalizeText(choice.text));
    return (axis.choices || []).flatMap((choice) => choiceFindings(axis, choice, texts));
  });
  const sampleLevelFindings = flightArtifact.samples.flatMap(sampleFindings);
  const findings = [...choiceLevelFindings, ...sampleLevelFindings];
  return {
    inputId: inputId || flightArtifact.inputId,
    artifactType: 'psg-readability-review',
    createdAt,
    graphPath: flightArtifact.graphPath,
    graphHash: flightArtifact.graphHash,
    semanticChoiceGraphHash: flightArtifact.semanticChoiceGraphHash,
    sampleCount: flightArtifact.sampleCount,
    readabilityStatus: findings.length > 0 ? 'needs-sweetening' : 'flight-ready',
    codexStatus,
    appliedRewriteCount,
    findingCounts: findings.reduce((counts, finding) => ({
      ...counts,
      [finding.findingType]: (counts[finding.findingType] || 0) + 1
    }), {}),
    findings
  };
}

function buildCodexSweetenRequestArtifact({
  inputId,
  flightArtifact,
  reviewArtifact,
  semanticChoiceGraphArtifact,
  createdAt = new Date().toISOString()
}) {
  const choices = (semanticChoiceGraphArtifact.axes || []).flatMap((axis) =>
    (axis.choices || []).map((choice) => ({
      axisId: axis.axisId,
      axisLabel: axis.label,
      choiceId: choice.choiceId,
      text: choice.text,
      weight: choice.weight
    }))
  );
  return {
    inputId,
    artifactType: 'codex-sweeten-request',
    createdAt,
    expectedOutputPath: 'codex-sweeten-result.json',
    strictRules: [
      'Rewrite only existing choice text.',
      'Return rewrites keyed by choiceId.',
      'Do not add, remove, reorder, or reweight choices.',
      'Do not change axes, edges, citations, claims, revisions, accepted grammar, or evidence.',
      'Keep text as short composable prompt fragments that read well when concatenated.'
    ],
    graphPath: flightArtifact.graphPath,
    graphHash: flightArtifact.graphHash,
    semanticChoiceGraphHash: flightArtifact.semanticChoiceGraphHash,
    samples: flightArtifact.samples,
    findings: reviewArtifact.findings,
    choices
  };
}

function buildCodexSweetenRequestMarkdown({ requestArtifact }) {
  const lines = [
    '# Metagrinder PSG Readability Sweetening Task',
    '',
    'You are improving wording for a Prompt Spaghetti graph generated by Metagrinder.',
    'The graph structure is already fixed. Your job is only to rewrite awkward choice text so sampled outputs read like coherent prompt sentences.',
    '',
    '## Required Output',
    '',
    'Return JSON only with this shape:',
    '',
    '```json',
    '{ "inputId": "string", "rewrites": [{ "choiceId": "string", "beforeText": "string", "afterText": "string", "reason": "string" }] }',
    '```',
    '',
    '## Hard Rules',
    '',
    ...requestArtifact.strictRules.map((rule) => `- ${rule}`),
    '',
    '## Current Choices',
    '',
    '```json',
    JSON.stringify(requestArtifact.choices, null, 2),
    '```',
    '',
    '## Readability Findings',
    '',
    '```json',
    JSON.stringify(requestArtifact.findings, null, 2),
    '```',
    '',
    '## Sample Outputs',
    '',
    ...requestArtifact.samples.map((sample) => `- Seed ${sample.seed}: ${sample.outputText}`),
    '',
    'Return only the JSON object. Omit rewrites for choices that are already good.'
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  buildCodexSweetenRequestArtifact,
  buildCodexSweetenRequestMarkdown,
  buildPsgReadabilityReviewArtifact
};

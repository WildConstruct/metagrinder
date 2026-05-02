const {
  MetagrinderAgentRunArtifactSchema
} = require('../../types/metagrinder.runtime.js');

function buildAgentRunsArtifact({
  inputId,
  createdAt,
  runs
}) {
  return MetagrinderAgentRunArtifactSchema.parse({
    inputId,
    createdAt,
    runs: (runs || []).map((run, index) => ({
      runId: run.runId || `${inputId}_agent_run_${String(index + 1).padStart(3, '0')}`,
      passName: run.passName,
      mode: run.mode || 'deterministic',
      strategyVersion: run.strategyVersion || 'ralph-loop-1',
      inputArtifactIds: run.inputArtifactIds || [],
      outputArtifactIds: run.outputArtifactIds || [],
      warnings: run.warnings || []
    }))
  });
}

function buildDefaultAgentRunsArtifact({
  inputId,
  createdAt,
  includeMockWeb = true
}) {
  const passNames = [
    ['source-mode', ['ingest.json'], ['source-mode-artifact']],
    ['scene-grammar', ['ingest.json', 'extract.json', 'classify.json', 'synthesize.json'], ['scene-grammar.json']],
    ['gap-analysis', ['scene-grammar.json'], ['research-gaps.json']],
    ['query-plan', ['research-gaps.json'], ['research-query-plan.json']],
    ['sampler', ['scene-grammar.json'], ['sample-prompts.json']],
    ['plausibility-evaluate', ['scene-grammar.json', 'sample-prompts.json'], ['scene-grammar-evaluation.json', 'plausibility-review.json']],
    ['psg-v2-compiler', ['scene-grammar.json'], ['scene-grammar.psg']]
  ];

  if (includeMockWeb) {
    passNames.splice(4, 0, ['mock-web-research', ['research-query-plan.json'], ['web-research-results.json'], 'mock-adapter']);
  }

  return buildAgentRunsArtifact({
    inputId,
    createdAt,
    runs: passNames.map(([passName, inputArtifactIds, outputArtifactIds, mode]) => ({
      passName,
      mode: mode || 'deterministic',
      inputArtifactIds,
      outputArtifactIds
    }))
  });
}

module.exports = {
  buildAgentRunsArtifact,
  buildDefaultAgentRunsArtifact
};

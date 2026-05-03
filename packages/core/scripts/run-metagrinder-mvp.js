const path = require('path');

const { runMetagrinderMvp } = require('./lib/metagrinder-mvp.js');

function main() {
  const args = process.argv.slice(2);
  const outputDirFlagIndex = args.indexOf('--output-dir');
  const titleFlagIndex = args.indexOf('--title');
  const revisionStateFileFlagIndex = args.indexOf('--revision-state-file');
  const compileGrammarFlagIndex = args.indexOf('--compile-grammar');
  const webResearchModeFlagIndex = args.indexOf('--web-research-mode');
  const retrievalPolicyFileFlagIndex = args.indexOf('--retrieval-policy-file');
  const sourceIntakeApprovalFileFlagIndex = args.indexOf('--source-intake-approval-file');
  const sourceClaimReviewFileFlagIndex = args.indexOf('--source-claim-review-file');
  const retrievalCacheDirFlagIndex = args.indexOf('--retrieval-cache-dir');
  const maxQueriesTotalFlagIndex = args.indexOf('--max-queries-total');
  const maxQueriesPerGapFlagIndex = args.indexOf('--max-queries-per-gap');
  const maxResultsPerQueryFlagIndex = args.indexOf('--max-results-per-query');
  const allowedSourceTypesFlagIndex = args.indexOf('--allowed-source-types');
  const allowedDomainsFlagIndex = args.indexOf('--allowed-domains');
  const blockedDomainsFlagIndex = args.indexOf('--blocked-domains');
  const blockedSourceTypesFlagIndex = args.indexOf('--blocked-source-types');
  const liveProviderFlagIndex = args.indexOf('--live-provider');
  const providerConfigFileFlagIndex = args.indexOf('--provider-config-file');
  const providerTimeoutMsFlagIndex = args.indexOf('--provider-timeout-ms');
  const providerMaxRetriesFlagIndex = args.indexOf('--provider-max-retries');
  const applyAcceptedRevisions = args.includes('--apply-accepted-revisions');
  const enableLiveRetrieval = args.includes('--enable-live-retrieval');
  const valueFlagIndexes = new Set([
    outputDirFlagIndex,
    titleFlagIndex,
    revisionStateFileFlagIndex,
    compileGrammarFlagIndex,
    webResearchModeFlagIndex,
    retrievalPolicyFileFlagIndex,
    sourceIntakeApprovalFileFlagIndex,
    sourceClaimReviewFileFlagIndex,
    retrievalCacheDirFlagIndex,
    maxQueriesTotalFlagIndex,
    maxQueriesPerGapFlagIndex,
    maxResultsPerQueryFlagIndex,
    allowedSourceTypesFlagIndex,
    allowedDomainsFlagIndex,
    blockedDomainsFlagIndex,
    blockedSourceTypesFlagIndex,
    liveProviderFlagIndex,
    providerConfigFileFlagIndex,
    providerTimeoutMsFlagIndex,
    providerMaxRetriesFlagIndex
  ].filter((index) => index >= 0));
  const inputPaths = args.filter((arg, index) => {
    if (arg.startsWith('--')) {
      return false;
    }
    if (valueFlagIndexes.has(index - 1)) {
      return false;
    }
    return true;
  });
  const outputDirArg = outputDirFlagIndex >= 0 ? args[outputDirFlagIndex + 1] : undefined;
  const titleArg = titleFlagIndex >= 0 ? args[titleFlagIndex + 1] : undefined;
  const revisionStateFileArg = revisionStateFileFlagIndex >= 0
    ? args[revisionStateFileFlagIndex + 1]
    : undefined;
  const compileGrammarArg = compileGrammarFlagIndex >= 0
    ? args[compileGrammarFlagIndex + 1]
    : undefined;
  const webResearchModeArg = webResearchModeFlagIndex >= 0
    ? args[webResearchModeFlagIndex + 1]
    : undefined;
  const retrievalPolicyFileArg = retrievalPolicyFileFlagIndex >= 0
    ? args[retrievalPolicyFileFlagIndex + 1]
    : undefined;
  const sourceIntakeApprovalFileArg = sourceIntakeApprovalFileFlagIndex >= 0
    ? args[sourceIntakeApprovalFileFlagIndex + 1]
    : undefined;
  const sourceClaimReviewFileArg = sourceClaimReviewFileFlagIndex >= 0
    ? args[sourceClaimReviewFileFlagIndex + 1]
    : undefined;
  const retrievalCacheDirArg = retrievalCacheDirFlagIndex >= 0
    ? args[retrievalCacheDirFlagIndex + 1]
    : undefined;
  const maxQueriesTotalArg = maxQueriesTotalFlagIndex >= 0
    ? Number(args[maxQueriesTotalFlagIndex + 1])
    : undefined;
  const maxQueriesPerGapArg = maxQueriesPerGapFlagIndex >= 0
    ? Number(args[maxQueriesPerGapFlagIndex + 1])
    : undefined;
  const maxResultsPerQueryArg = maxResultsPerQueryFlagIndex >= 0
    ? Number(args[maxResultsPerQueryFlagIndex + 1])
    : undefined;
  const allowedSourceTypesArg = allowedSourceTypesFlagIndex >= 0
    ? args[allowedSourceTypesFlagIndex + 1].split(',').map((entry) => entry.trim()).filter(Boolean)
    : undefined;
  const liveProviderArg = liveProviderFlagIndex >= 0
    ? args[liveProviderFlagIndex + 1]
    : undefined;
  const providerConfigFileArg = providerConfigFileFlagIndex >= 0
    ? args[providerConfigFileFlagIndex + 1]
    : undefined;
  const providerTimeoutMsArg = providerTimeoutMsFlagIndex >= 0
    ? Number(args[providerTimeoutMsFlagIndex + 1])
    : undefined;
  const providerMaxRetriesArg = providerMaxRetriesFlagIndex >= 0
    ? Number(args[providerMaxRetriesFlagIndex + 1])
    : undefined;
  const allowedDomainsArg = allowedDomainsFlagIndex >= 0
    ? args[allowedDomainsFlagIndex + 1].split(',').map((entry) => entry.trim()).filter(Boolean)
    : undefined;
  const blockedDomainsArg = blockedDomainsFlagIndex >= 0
    ? args[blockedDomainsFlagIndex + 1].split(',').map((entry) => entry.trim()).filter(Boolean)
    : undefined;
  const blockedSourceTypesArg = blockedSourceTypesFlagIndex >= 0
    ? args[blockedSourceTypesFlagIndex + 1].split(',').map((entry) => entry.trim()).filter(Boolean)
    : undefined;

  if (inputPaths.length === 0) {
    throw new Error(
      'Usage: node scripts/run-metagrinder-mvp.js <input-a.txt> [input-b.txt ...] [--output-dir <dir>] [--title <title>] [--revision-state-file <path>] [--apply-accepted-revisions] [--compile-grammar base|accepted] [--web-research-mode off|mock|dry-run|cache-replay|live-candidate-only] [--enable-live-retrieval] [--live-provider unavailable|fixture-live|generic-search|generic-http-search] [--provider-config-file <path>] [--provider-timeout-ms <n>] [--provider-max-retries <n>] [--allowed-domains <domains>] [--blocked-domains <domains>] [--blocked-source-types <types>]'
    );
  }

  const outputDir = outputDirArg || path.resolve(
    __dirname,
    '../tests/output/metagrinder/mvp'
  );

  const result = runMetagrinderMvp({
    inputPath: inputPaths[0],
    inputPaths,
    outputDir,
    title: titleArg,
    revisionStateFilePath: revisionStateFileArg,
    applyAcceptedRevisions,
    compileGrammar: compileGrammarArg,
    webResearchMode: webResearchModeArg,
    retrievalPolicyFilePath: retrievalPolicyFileArg,
    sourceIntakeApprovalFilePath: sourceIntakeApprovalFileArg,
    sourceClaimReviewFilePath: sourceClaimReviewFileArg,
    retrievalCacheDir: retrievalCacheDirArg,
    maxQueriesTotal: maxQueriesTotalArg,
    maxQueriesPerGap: maxQueriesPerGapArg,
    maxResultsPerQuery: maxResultsPerQueryArg,
    allowedSourceTypes: allowedSourceTypesArg,
    allowedDomains: allowedDomainsArg,
    blockedDomains: blockedDomainsArg,
    blockedSourceTypes: blockedSourceTypesArg,
    enableLiveRetrieval,
    liveProvider: liveProviderArg,
    providerConfigFilePath: providerConfigFileArg,
    providerTimeoutMs: providerTimeoutMsArg,
    providerMaxRetries: providerMaxRetriesArg
  });

  console.log(`Generated ingest artifact for ${result.ingestArtifact.inputId} in ${result.outputDir}`);
}

main();

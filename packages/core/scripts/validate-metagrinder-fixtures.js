const fs = require('fs');
const path = require('path');

const {
  CameraPassManifestSchema,
  CanonicalUtdgRecordSchema,
  LumaAdapterContractSchema,
  MetaballManifestSchema,
  ModelConditioningPayloadSchema,
  GraphMatchReportSchema,
  PacketAttributionManifestSchema,
  PatchProposalSchema,
  PromptGraphManifestSchema,
  SemanticScenePackageSchema,
  SuppressedGraphNodesReportSchema,
  RenderTextPacketSchema,
  ResearchPackageManifestSchema,
  UtdgCandidatesFileSchema,
  UtdgSubmissionManifestSchema,
  WitnessRenderManifestSchema,
  WorldSemanticFieldSchema
} = require('../types/metagrinder.runtime.js');

const FIXTURE_DIR = path.join(__dirname, '..', 'tests', 'fixtures', 'metagrinder');

const readJson = filename =>
  JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, filename), 'utf-8'));

const validators = [
  ['research-package.json', ResearchPackageManifestSchema],
  ['utdg-submission.json', UtdgSubmissionManifestSchema],
  ['utdg-candidates.json', UtdgCandidatesFileSchema],
  ['world-semantic-field.json', WorldSemanticFieldSchema],
  ['render-text-packet.json', RenderTextPacketSchema],
  ['camera-pass-manifest.json', CameraPassManifestSchema],
  ['model-conditioning-payload.json', ModelConditioningPayloadSchema],
  ['luma-adapter-contract.json', LumaAdapterContractSchema],
  ['spicy-metaball.json', MetaballManifestSchema],
  ['semantic-scene-package.json', SemanticScenePackageSchema],
  ['patch-proposal.json', PatchProposalSchema],
  ['prompt-graph.json', PromptGraphManifestSchema],
  ['packet-attribution.json', PacketAttributionManifestSchema],
  ['graph-match-report.json', GraphMatchReportSchema],
  ['suppressed-graph-nodes-report.json', SuppressedGraphNodesReportSchema],
  ['witness-render-manifest.json', WitnessRenderManifestSchema],
  ['witness-render-manifest-alt.json', WitnessRenderManifestSchema]
];

const canonicalExample = {
  id: 'utdg:archetype:rain-darkened-brick-wall',
  entityType: 'Archetype',
  label: 'rain-darkened brick wall',
  summary: 'A brick wall archetype with darkened wet response and directional streaking.',
  externalIds: {
    institutionRecordId: 'museum:brick:001'
  },
  provenanceRefs: ['utdg:evidence:ev_brick_01'],
  evidenceRefs: ['utdg:evidence:ev_brick_01'],
  rightsProfile: 'reference-only',
  sourceRights: 'Institution Terms',
  contributionTerms: 'platform-community-commons',
  rightsConfidence: 'medium',
  commercialAllowed: false,
  reviewStatus: 'approved',
  createdFromSubmissionId: 'usub_demo_001'
};

let failed = false;

for (const [filename, schema] of validators) {
  try {
    schema.parse(readJson(filename));
    console.log(`PASS ${filename}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${filename}`);
    console.error(error.errors || error);
  }
}

try {
  CanonicalUtdgRecordSchema.parse(canonicalExample);
  console.log('PASS canonical-utdg-record example');
} catch (error) {
  failed = true;
  console.error('FAIL canonical-utdg-record example');
  console.error(error.errors || error);
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log('All Metagrinder fixtures validated successfully.');
}

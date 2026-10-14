/**
 * Thin workbench (S4.2).
 * Operator-state write boundary; ERA generative-shift view; parse reuse default.
 */

export {
  GENERATED_ARTIFACT_BASENAMES,
  OPERATOR_STATE_DIR,
  operatorStateRelativePath,
  resolveOperatorWritePath,
  assertRejectsGeneratedWrites,
  isOperatorWritableRelativePath,
  WriteBoundaryError
} from './write-boundary';

export { decideParseReuse, type ParseReuseDecision } from './parse-reuse';
export { computeEraShiftView, svgArchetypeShareDelta, type EraShiftView } from './era-plot';
export {
  handleHealth,
  handleListRuns,
  handleGetManifest,
  handleGetEra,
  handleParseReuse,
  handleWriteOperatorState,
  handleForbiddenWrite,
  handleReadOperatorState,
  type WorkbenchConfig,
  type HandlerResult
} from './handler';
export { createWorkbenchServer, startWorkbenchServer } from './server';

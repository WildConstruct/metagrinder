const { execFileSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function runNodeScript(relativePath, args = []) {
  execFileSync(
    process.execPath,
    [path.join(repoRoot, relativePath), ...args],
    {
      cwd: repoRoot,
      stdio: 'inherit'
    }
  );
}

runNodeScript('experiments/epic4-autoresearch/make-heuristic-run.js');
runNodeScript('experiments/epic4-autoresearch/make-semantic-run.js');
runNodeScript('experiments/epic4-autoresearch/evaluate.js', [
  'experiments/epic4-autoresearch/runs/heuristic-baseline'
]);
runNodeScript('experiments/epic4-autoresearch/evaluate.js', [
  'experiments/epic4-autoresearch/runs/semantic-baseline'
]);
runNodeScript('experiments/epic4-autoresearch/compare-runs.js', [
  'experiments/epic4-autoresearch/runs/heuristic-baseline',
  'experiments/epic4-autoresearch/runs/semantic-baseline'
]);

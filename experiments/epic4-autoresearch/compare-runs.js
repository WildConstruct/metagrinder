const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function byId(results) {
  return new Map(results.map((result) => [result.id, result]));
}

function compareBriefs(left, right) {
  const delta = right.score - left.score;
  if (delta > 0) {
    return 'improved';
  }
  if (delta < 0) {
    return 'regressed';
  }
  return 'unchanged';
}

function formatProblems(problems) {
  return problems.length > 0
    ? problems.join('; ')
    : 'none';
}

function main() {
  const leftRunArg = process.argv[2];
  const rightRunArg = process.argv[3];

  if (!leftRunArg || !rightRunArg) {
    throw new Error(
      'Usage: node experiments/epic4-autoresearch/compare-runs.js <left-run-dir> <right-run-dir>'
    );
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const leftRunDir = path.resolve(repoRoot, leftRunArg);
  const rightRunDir = path.resolve(repoRoot, rightRunArg);
  const leftReport = loadJson(path.join(leftRunDir, 'evaluation-report.json'));
  const rightReport = loadJson(path.join(rightRunDir, 'evaluation-report.json'));

  const leftById = byId(leftReport.results);
  const rightById = byId(rightReport.results);

  const improved = [];
  const regressed = [];
  const unchanged = [];

  for (const [id, left] of leftById.entries()) {
    const right = rightById.get(id);
    if (!right) {
      continue;
    }

    const row = {
      id,
      leftScore: left.score,
      rightScore: right.score,
      leftMode: left.actualMode,
      rightMode: right.actualMode,
      leftProblems: left.problems,
      rightProblems: right.problems
    };

    const verdict = compareBriefs(left, right);
    if (verdict === 'improved') {
      improved.push(row);
    } else if (verdict === 'regressed') {
      regressed.push(row);
    } else {
      unchanged.push(row);
    }
  }

  const summaryLines = [
    '# Epic 4 Run Comparison',
    '',
    `Left run: \`${leftReport.runDir}\``,
    `Right run: \`${rightReport.runDir}\``,
    '',
    `Score delta: ${rightReport.totalScore - leftReport.totalScore} (${leftReport.totalScore} -> ${rightReport.totalScore})`,
    '',
    '## Improved Briefs',
    improved.length > 0
      ? improved.map((entry) => `- ${entry.id}: ${entry.leftScore} -> ${entry.rightScore}; mode ${entry.leftMode} -> ${entry.rightMode}; right problems: ${formatProblems(entry.rightProblems)}`).join('\n')
      : '- none',
    '',
    '## Regressed Briefs',
    regressed.length > 0
      ? regressed.map((entry) => `- ${entry.id}: ${entry.leftScore} -> ${entry.rightScore}; mode ${entry.leftMode} -> ${entry.rightMode}; right problems: ${formatProblems(entry.rightProblems)}`).join('\n')
      : '- none',
    '',
    '## Unchanged Briefs',
    unchanged.length > 0
      ? unchanged.map((entry) => `- ${entry.id}: ${entry.rightScore}; mode ${entry.rightMode}; right problems: ${formatProblems(entry.rightProblems)}`).join('\n')
      : '- none'
  ];

  const report = {
    leftRun: leftReport.runDir,
    rightRun: rightReport.runDir,
    leftScore: leftReport.totalScore,
    rightScore: rightReport.totalScore,
    scoreDelta: rightReport.totalScore - leftReport.totalScore,
    improved,
    regressed,
    unchanged
  };

  fs.writeFileSync(
    path.join(rightRunDir, 'comparison-report.json'),
    JSON.stringify(report, null, 2)
  );
  fs.writeFileSync(
    path.join(rightRunDir, 'comparison-report.md'),
    `${summaryLines.join('\n')}\n`
  );

  console.log(summaryLines.join('\n'));
}

main();

const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readMaybeJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return loadJson(filePath);
}

function hasNonEmptyReasons(modeDetection) {
  return Boolean(
    modeDetection &&
    Array.isArray(modeDetection.reasons) &&
    modeDetection.reasons.some((reason) => String(reason || '').trim().length > 0)
  );
}

function joinText(values) {
  return (values || [])
    .map((value) => String(value || '').toLowerCase())
    .join('\n');
}

function intersects(left, right) {
  const rightSet = new Set(right || []);
  return (left || []).some((value) => rightSet.has(value));
}

function countIntersections(left, right) {
  const rightSet = new Set(right || []);
  return (left || []).filter((value) => rightSet.has(value)).length;
}

function rationaleHasExpectedSignals(modeDetection, brief) {
  const reasonText = joinText(modeDetection && modeDetection.reasons);
  return (brief.expected_rationale_any || []).some((term) => reasonText.includes(term.toLowerCase()));
}

function rationaleArtifactsHaveExpectedSignals(modeDetection, categoryHypothesis, brief) {
  const modeText = joinText(modeDetection && modeDetection.reasons);
  const categoryText = joinText(
    categoryHypothesis && Array.isArray(categoryHypothesis.categories)
      ? categoryHypothesis.categories.map((entry) => entry.rationale)
      : []
  );
  const combinedText = `${modeText}\n${categoryText}`;
  return (brief.expected_rationale_any || []).some((term) => combinedText.includes(term.toLowerCase()));
}

function confidenceIsExpected(modeDetection, brief) {
  if (!modeDetection || !modeDetection.confidence) {
    return false;
  }
  return (brief.expected_confidence_any || []).includes(modeDetection.confidence);
}

function hasOverconfidentTightGap(modeDetection) {
  if (!modeDetection || modeDetection.confidence !== 'high') {
    return false;
  }
  const candidates = Array.isArray(modeDetection.candidateKinds)
    ? modeDetection.candidateKinds
    : [];
  const top = candidates[0];
  const second = candidates[1];
  if (!top || !second || top.score <= 0) {
    return false;
  }
  return second.score >= top.score * 0.8;
}

function warningHasExpectedSignals(warnings, brief) {
  const warningText = joinText(warnings);
  return (brief.expected_warning_any || []).some((term) => warningText.includes(term.toLowerCase()));
}

function scoreBrief({ brief, outputDir, scoring }) {
  const modeDetection = readMaybeJson(path.join(outputDir, 'mode-detection.json'));
  const categoryHypothesis = readMaybeJson(path.join(outputDir, 'category-hypothesis.json'));
  const assumptionReview = readMaybeJson(path.join(outputDir, 'assumption-review.json'));

  const problems = [];
  const breakdown = {
    mode: 0,
    focus: 0,
    rationale: 0,
    warnings: 0
  };
  let score = 0;

  if (!modeDetection) {
    problems.push('missing mode-detection.json');
  } else if (modeDetection.researchKind === brief.expected_mode) {
    score += scoring.mode_correct;
    breakdown.mode += scoring.mode_correct;
  } else if ((brief.acceptable_modes || []).includes(modeDetection.researchKind)) {
    score += scoring.mode_acceptable;
    breakdown.mode += scoring.mode_acceptable;
    problems.push(`accepted alternate mode: ${modeDetection.researchKind}`);
  } else {
    problems.push(`unexpected mode: ${modeDetection.researchKind}`);
  }

  const recommendedFocus = categoryHypothesis && Array.isArray(categoryHypothesis.recommendedFocus)
    ? categoryHypothesis.recommendedFocus
    : [];
  const focusHits = recommendedFocus.filter((label) => brief.expected_focus_any.includes(label)).length;
  const focusScore = Math.min(focusHits, scoring.focus_hit_cap);
  score += focusScore;
  breakdown.focus += focusScore;
  if (focusHits === 0) {
    problems.push('no expected focus labels surfaced');
  }
  if (intersects(recommendedFocus.slice(0, 2), brief.expected_focus_primary || [])) {
    score += scoring.focus_primary_bonus;
    breakdown.focus += scoring.focus_primary_bonus;
  } else {
    problems.push('top focus ordering missed expected primary labels');
  }

  if (hasNonEmptyReasons(modeDetection)) {
    score += scoring.rationale_nonempty;
    breakdown.rationale += scoring.rationale_nonempty;
  } else {
    problems.push('missing usable rationale');
  }
  if (modeDetection && categoryHypothesis && rationaleArtifactsHaveExpectedSignals(modeDetection, categoryHypothesis, brief)) {
    score += scoring.rationale_specificity_bonus;
    breakdown.rationale += scoring.rationale_specificity_bonus;
  } else {
    problems.push('rationale did not surface expected evidence signals');
  }

  if (confidenceIsExpected(modeDetection, brief)) {
    score += scoring.confidence_calibrated;
    breakdown.rationale += scoring.confidence_calibrated;
  } else {
    problems.push(`confidence was not in expected range: ${modeDetection ? modeDetection.confidence : 'missing'}`);
  }
  if (hasOverconfidentTightGap(modeDetection)) {
    score -= scoring.candidate_gap_penalty;
    breakdown.rationale -= scoring.candidate_gap_penalty;
    problems.push('confidence was too strong relative to a close secondary candidate');
  }

  const warnings = assumptionReview && Array.isArray(assumptionReview.warnings)
    ? assumptionReview.warnings
    : [];
  const warningTolerance = brief.warning_tolerance || 'medium';
  const expectsWarnings = (brief.expected_warning_any || []).length > 0;
  if (expectsWarnings) {
    if (warnings.length > 0 && warningHasExpectedSignals(warnings, brief)) {
      score += scoring.warning_expected_hit;
      breakdown.warnings += scoring.warning_expected_hit;
    } else {
      problems.push('expected warning signals were missing');
    }
  }
  if (warningTolerance === 'low' && warnings.length > 1) {
    score -= scoring.warning_overflow_penalty;
    breakdown.warnings -= scoring.warning_overflow_penalty;
    problems.push('warning precision too low for a low-warning brief');
  }

  return {
    id: brief.id,
    expectedMode: brief.expected_mode,
    actualMode: modeDetection ? modeDetection.researchKind : null,
    recommendedFocus,
    warningCount: warnings.length,
    breakdown,
    score,
    maxScore: scoring.max_per_brief,
    problems
  };
}

function main() {
  const runDirArg = process.argv[2];
  if (!runDirArg) {
    throw new Error('Usage: node experiments/epic4-autoresearch/evaluate.js <run-dir>');
  }

  const repoRoot = path.resolve(__dirname, '..', '..');
  const judgments = loadJson(path.join(__dirname, 'judgments.json'));
  const runDir = path.resolve(repoRoot, runDirArg);

  const results = judgments.briefs.map((brief) => {
    const outputDir = path.join(runDir, brief.id);
    return scoreBrief({
      brief,
      outputDir,
      scoring: judgments.scoring
    });
  });

  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const totalMax = results.reduce((sum, result) => sum + result.maxScore, 0);
  const report = {
    runDir: path.relative(repoRoot, runDir),
    totalScore,
    totalMax,
    results
  };

  fs.writeFileSync(
    path.join(runDir, 'evaluation-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main();

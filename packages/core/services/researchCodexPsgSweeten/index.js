function choiceIndex(semanticChoiceGraphArtifact) {
  const index = new Map();
  (semanticChoiceGraphArtifact.axes || []).forEach((axis, axisIndex) => {
    (axis.choices || []).forEach((choice, choiceIndexInAxis) => {
      index.set(choice.choiceId, {
        axis,
        choice,
        axisIndex,
        choiceIndex: choiceIndexInAxis
      });
    });
  });
  return index;
}

function cleanRewriteText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function validateSweetenResult({ resultArtifact, semanticChoiceGraphArtifact }) {
  if (!resultArtifact || typeof resultArtifact !== 'object' || Array.isArray(resultArtifact)) {
    throw new Error('Codex sweeten result must be a JSON object.');
  }
  if (!Array.isArray(resultArtifact.rewrites)) {
    throw new Error('Codex sweeten result must include a rewrites array.');
  }
  const choices = choiceIndex(semanticChoiceGraphArtifact);
  return resultArtifact.rewrites.map((rewrite, index) => {
    if (!rewrite || typeof rewrite !== 'object' || Array.isArray(rewrite)) {
      throw new Error(`Rewrite ${index + 1} must be an object.`);
    }
    const choice = choices.get(rewrite.choiceId);
    if (!choice) {
      throw new Error(`Rewrite references unknown choiceId: ${rewrite.choiceId}`);
    }
    const beforeText = cleanRewriteText(rewrite.beforeText);
    const currentText = cleanRewriteText(choice.choice.text);
    const afterText = cleanRewriteText(rewrite.afterText);
    if (beforeText !== currentText) {
      throw new Error(`Rewrite beforeText mismatch for ${rewrite.choiceId}.`);
    }
    if (!afterText) {
      throw new Error(`Rewrite afterText is empty for ${rewrite.choiceId}.`);
    }
    if (afterText.length > 120) {
      throw new Error(`Rewrite afterText is too long for ${rewrite.choiceId}.`);
    }
    return {
      choiceId: rewrite.choiceId,
      axisId: choice.axis.axisId,
      beforeText: currentText,
      afterText,
      reason: cleanRewriteText(rewrite.reason || 'Readability improvement.')
    };
  });
}

function applySweetenRewrites({ semanticChoiceGraphArtifact, rewrites }) {
  const byChoiceId = new Map(rewrites.map((rewrite) => [rewrite.choiceId, rewrite]));
  let appliedRewriteCount = 0;
  const nextArtifact = {
    ...semanticChoiceGraphArtifact,
    axes: (semanticChoiceGraphArtifact.axes || []).map((axis) => ({
      ...axis,
      choices: (axis.choices || []).map((choice) => {
        const rewrite = byChoiceId.get(choice.choiceId);
        if (!rewrite) return choice;
        appliedRewriteCount += 1;
        return {
          ...choice,
          text: rewrite.afterText
        };
      })
    })),
    warnings: [
      ...(semanticChoiceGraphArtifact.warnings || []),
      ...(appliedRewriteCount > 0 ? [{
        code: 'choice-text-sweetened',
        severity: 'info',
        message: `${appliedRewriteCount} semantic choice text value(s) were sweetened for readability.`,
        relatedAxisIds: [...new Set(rewrites.map((rewrite) => rewrite.axisId))],
        relatedChoiceIds: rewrites.map((rewrite) => rewrite.choiceId)
      }] : [])
    ]
  };
  return {
    semanticChoiceGraphArtifact: nextArtifact,
    appliedRewriteCount,
    appliedRewrites: rewrites
  };
}

module.exports = {
  applySweetenRewrites,
  validateSweetenResult
};

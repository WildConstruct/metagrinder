function mergeUniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function classifyChunk(chunk) {
  const text = `${chunk.sectionLabel || ''}\n${chunk.text}`.toLowerCase();
  const modes = [chunk.chunkKind || 'unknown'];

  if (text.includes('visual reference') || text.includes('image reference') || text.includes('caption:')) {
    modes.push('visual-reference-caption');
  }
  if (text.includes('avoid') || text.includes('do not') || text.includes('negative constraint')) {
    modes.push('negative-constraint');
  }
  if (text.includes('ethical') || text.includes('not reduce') || text.includes('not make') || text.includes('representation')) {
    modes.push('ethical-constraint');
  }
  if (text.includes('sample prompt') || text.includes('example prompt')) {
    modes.push('sample-output');
  }
  if (text.includes('weight:') || /\b\d+\s*-\s*\d+\s*%/.test(text)) {
    modes.push('generation-rule');
  }
  if (text.includes('if ') || text.includes(' increase ') || text.includes(' decrease ') || text.includes(' force ')) {
    modes.push('generation-rule');
  }

  return mergeUniqueStrings(modes);
}

function buildSourceModeArtifact({ ingestArtifact }) {
  return {
    inputId: ingestArtifact.inputId,
    chunkModes: ingestArtifact.chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      sourceInputId: chunk.sourceInputId,
      modes: classifyChunk(chunk)
    }))
  };
}

module.exports = {
  buildSourceModeArtifact,
  classifyChunk
};

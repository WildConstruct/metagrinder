import { ingestText } from '../ingest';
import { buildGrammarPrompt } from './index';

test('[S-R1c] grammar requests expose the input identity owning each cited chunk', () => {
  const sourcePackage = ingestText({
    runId: 'r', inputId: 'i', createdAt: '2026-10-13T12:00:00.000Z',
    sources: [{ rawText: 'A workshop contains wooden benches.' }, { rawText: 'A courtyard contains linen awnings.' }]
  });
  const prompt = buildGrammarPrompt(sourcePackage);
  for (const chunk of sourcePackage.chunks) {
    expect(prompt).toContain(`[${chunk.chunkId}] (sourceInputId: ${chunk.sourceInputId})`);
  }
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { RunStore } from './store';

test('[AC-2.2c.4] output replacement is explicit while existing stage callers keep merge semantics', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-stage-output-set-'));
  try {
    const store = RunStore.create({ baseDir: root, runId: 'outputs', inputId: 'scene', parserVersion: '0.1.0' });
    store.setStageState('ordinary', 'complete', { outputArtifacts: ['first.json'] });
    store.setStageState('ordinary', 'complete', { outputArtifacts: ['second.json'] });
    expect(store.getManifest().stages.find((entry) => entry.stage === 'ordinary')!.outputArtifacts)
      .toEqual(['first.json', 'second.json']);
    store.setStageState('compile', 'complete', { outputArtifacts: ['old.psg'] });
    const replacement = { outputArtifacts: ['current.psg'], replaceOutputArtifacts: true };
    store.setStageState('compile', 'complete', replacement);
    expect(RunStore.open(store.runDir).getManifest().stages.find((entry) => entry.stage === 'compile')!.outputArtifacts)
      .toEqual(['current.psg']);
    store.setStageState('compile', 'complete', { ...replacement, outputArtifacts: [] });
    expect(store.getManifest().stages.find((entry) => entry.stage === 'compile')!.outputArtifacts).toEqual([]);
  } finally {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('stage test cleanup escaped root');
    fs.rmSync(root, { recursive: true, force: true });
  }
});

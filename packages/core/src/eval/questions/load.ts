import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ResearchQuestionScenarioSchema,
  type ResearchQuestionScenario
} from '../../schemas/research-question-scenario';

export const DEV_SCENARIOS_DIR = path.join(__dirname, 'scenarios', 'dev');
export const BASELINES_PATH = path.join(__dirname, 'baselines.json');
export const HOLDOUT_ENV = 'METAGRINDER_QUESTION_HOLDOUT_DIR';

export function loadScenarioFile(filePath: string): ResearchQuestionScenario {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return ResearchQuestionScenarioSchema.parse(raw);
}

export function loadDevScenarios(dir: string = DEV_SCENARIOS_DIR): ResearchQuestionScenario[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`dev scenarios dir missing: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => loadScenarioFile(path.join(dir, f)));
}

/**
 * Holdout scenarios live outside the repo (operator-owned).
 * Never invent holdout gold when the env is unset.
 */
export function loadHoldoutScenarios(envDir?: string): ResearchQuestionScenario[] {
  const dir = envDir ?? process.env[HOLDOUT_ENV];
  if (!dir || dir.trim().length === 0) {
    throw new Error(
      `Holdout scenarios require ${HOLDOUT_ENV} pointing at an external directory. ` +
        'See packages/core/src/eval/questions/holdout/README.md'
    );
  }
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs)) {
    throw new Error(`Holdout dir does not exist: ${abs}`);
  }
  const files = fs.readdirSync(abs).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    throw new Error(`Holdout dir has no .json scenarios: ${abs}`);
  }
  const scenarios = files.map((f) => loadScenarioFile(path.join(abs, f)));
  for (const s of scenarios) {
    if (s.split !== 'holdout') {
      throw new Error(`Holdout scenario ${s.scenarioId} must have split:"holdout"`);
    }
  }
  return scenarios;
}

export type BaselineFile = {
  version: string;
  notes?: string;
  dev?: {
    deterministic?: {
      composite: number;
      recallAtK: number;
      precisionAtK: number;
      antiRate: number;
      scenarioCount: number;
      lockedAt: string;
    };
  };
  holdout?: {
    deterministic?: {
      composite: number;
      lockedAt: string;
      approvedBy?: string;
    };
  };
};

export function loadBaselines(filePath: string = BASELINES_PATH): BaselineFile | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as BaselineFile;
}

export function writeBaselines(data: BaselineFile, filePath: string = BASELINES_PATH): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

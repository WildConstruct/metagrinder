import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CANONICAL_DIR = path.join(REPO_ROOT, 'contracts/json-schema');
const CHECKER = path.join(REPO_ROOT, 'contracts/check_json_schema_consumable.py');

function copiedContracts(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metagrinder-contract-smoke-'));
  fs.cpSync(CANONICAL_DIR, dir, { recursive: true });
  return dir;
}

function runSmoke(dir: string) {
  const python = process.env.METAGRINDER_VERIFY_PYTHON?.trim() || process.env.PYTHON
    || (process.platform === 'win32' ? 'python' : 'python3');
  return spawnSync(python, ['-O', CHECKER, '--schema-dir', dir], { encoding: 'utf8', windowsHide: true });
}

function changeSchema(dir: string, name: string, change: (schema: ReturnType<typeof JSON.parse>) => void): void {
  const target = path.join(dir, `${name}.schema.json`);
  const schema = JSON.parse(fs.readFileSync(target, 'utf8'));
  change(schema);
  fs.writeFileSync(target, JSON.stringify(schema));
}

describe('stdlib Python contract smoke', () => {
  test('checks every generated family under optimized Python', () => {
    const dir = copiedContracts();
    const result = runSmoke(dir);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.schema.json'))) {
      expect(result.stdout).toContain(`OK ${name.slice(0, -'.schema.json'.length)}:`);
    }
  });

  test.each(['wrong-const', 'wrong-enum', 'missing-discriminator'] as const)(
    'rejects %s even when Python assertions are disabled',
    (kind) => {
      const dir = copiedContracts();
      changeSchema(dir, 'utdg-candidates', (schema) => {
        const artifact = schema.definitions['utdg-candidates'].properties.artifact;
        delete artifact.const;
        delete artifact.enum;
        if (kind === 'wrong-const') artifact.const = 'different-family';
        if (kind === 'wrong-enum') artifact.enum = ['different-family'];
      });
      const result = runSmoke(dir);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('utdg-candidates');
      expect(result.stderr).toContain('discriminator');
    }
  );

  test.each(['missing-pointer', 'missing-file'] as const)('rejects %s local references', (kind) => {
    const dir = copiedContracts();
    changeSchema(dir, 'source-package', (schema) => {
      schema.definitions['source-package'].properties.unresolved = {
        $ref: kind === 'missing-pointer' ? '#/definitions/not-present' : 'missing.schema.json#/definitions/missing'
      };
    });
    const result = runSmoke(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('reference');
  });

  test('resolves valid relative-file JSON pointers without a third-party validator', () => {
    const dir = copiedContracts();
    changeSchema(dir, 'source-package', (schema) => {
      schema.definitions['source-package'].properties.linkedProvenance = {
        $ref: 'provenance.schema.json#/definitions/provenance'
      };
    });
    expect(runSmoke(dir).status).toBe(0);
  });

  test('checks references transitively through referenced local schema documents', () => {
    const dir = copiedContracts();
    fs.writeFileSync(path.join(dir, 'linked.json'), JSON.stringify({
      definitions: { linked: { $ref: '#/definitions/not-present' } }
    }));
    changeSchema(dir, 'source-package', (schema) => {
      schema.definitions['source-package'].properties.linked = { $ref: 'linked.json#/definitions/linked' };
    });
    const result = runSmoke(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('reference');
    expect(result.stderr).toContain('linked.json');
  });
});

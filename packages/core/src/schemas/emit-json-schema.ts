import * as fs from 'node:fs';
import * as path from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ARTIFACT_SCHEMAS } from './registry';
import { ProvenanceSchema } from './provenance';

/**
 * Emits draft-07 JSON Schema for every registered artifact family into
 * contracts/json-schema/ so non-TS consumers (Image_Prep_Research Python
 * validators, WildConstructBrain PowerShell probes) share one contract source.
 *
 * Run: pnpm --filter @promptscape/core codegen:json-schema
 * Known limit: zod .refine() rules (span end>=start, weighted max>=min) do not
 * survive translation — cross-field checks remain TS-side; consumers get shapes.
 */

export const DEFAULT_CONTRACT_DIR = path.resolve(__dirname, '../../../../contracts/json-schema');

/** The registry and schemas are the sole authority for canonical contract files. */
export function generatedContractFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  const emitted: string[] = [];
  const families = { ...ARTIFACT_SCHEMAS, provenance: ProvenanceSchema };
  for (const [name, schema] of Object.entries(families)) {
    if (name === 'accepted-scene-grammar') continue;
    const fileName = `${name}.schema.json`;
    files[fileName] = `${JSON.stringify(zodToJsonSchema(schema, { name, $refStrategy: 'none' }), null, 2)}\n`;
    emitted.push(fileName);
  }
  files['INDEX.md'] = [
    '# Metagrinder JSON Schema Contracts',
    '',
    'Generated from `packages/core/src/schemas/` — do not edit by hand.',
    'Regenerate: `pnpm --filter @promptscape/core codegen:json-schema`',
    '`accepted-scene-grammar` shares `scene-grammar.schema.json` (grammarTarget discriminates).',
    '',
    ...emitted.map((f) => `- ${f}`),
    ''
  ].join('\n');
  return files;
}

const normalizedLineEndings = (text: string): string => text.replace(/\r\n/g, '\n');

export function emitJsonSchemas(options: { outputDir?: string; check?: boolean } = {}): {
  outputDir: string;
  schemaCount: number;
} {
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_CONTRACT_DIR);
  const files = generatedContractFiles();
  if (options.check) {
    const failures: string[] = [];
    for (const [fileName, canonical] of Object.entries(files)) {
      const target = path.join(outputDir, fileName);
      if (!fs.existsSync(target)) failures.push(`missing ${fileName}`);
      else if (normalizedLineEndings(fs.readFileSync(target, 'utf8')) !== normalizedLineEndings(canonical)) {
        failures.push(`changed ${fileName}`);
      }
    }
    if (fs.existsSync(outputDir)) {
      for (const name of fs.readdirSync(outputDir)) {
        if (name.endsWith('.schema.json') && files[name] === undefined) failures.push(`orphan ${name}`);
      }
    }
    if (failures.length > 0) throw new Error(`JSON Schema parity failed:\n${failures.join('\n')}`);
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
    for (const [fileName, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(outputDir, fileName), content, 'utf8');
    }
  }
  return { outputDir, schemaCount: Object.keys(files).filter((name) => name.endsWith('.schema.json')).length };
}

export function codegenMain(argv: string[]): number {
  let check = false;
  let outputDir: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--check') check = true;
    else if (arg === '--output-dir') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error('--output-dir requires a directory');
      outputDir = value;
    } else throw new Error(`unknown codegen argument: ${arg}`);
  }
  const result = emitJsonSchemas({ check, ...(outputDir !== undefined ? { outputDir } : {}) });
  process.stdout.write(`${check ? 'checked' : 'emitted'} ${result.schemaCount} schemas -> ${result.outputDir}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = codegenMain(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

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

const outDir = path.resolve(__dirname, '../../../../contracts/json-schema');
fs.mkdirSync(outDir, { recursive: true });

const families = {
  ...ARTIFACT_SCHEMAS,
  provenance: ProvenanceSchema
};

const emitted: string[] = [];
for (const [name, schema] of Object.entries(families)) {
  if (name === 'accepted-scene-grammar') continue; // alias of scene-grammar
  const jsonSchema = zodToJsonSchema(schema, { name, $refStrategy: 'none' });
  const filePath = path.join(outDir, `${name}.schema.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(jsonSchema, null, 2)}\n`, 'utf8');
  emitted.push(`${name}.schema.json`);
}

fs.writeFileSync(
  path.join(outDir, 'INDEX.md'),
  [
    '# Metagrinder JSON Schema Contracts',
    '',
    'Generated from `packages/core/src/schemas/` — do not edit by hand.',
    'Regenerate: `pnpm --filter @promptscape/core codegen:json-schema`',
    '`accepted-scene-grammar` shares `scene-grammar.schema.json` (grammarTarget discriminates).',
    '',
    ...emitted.map((f) => `- ${f}`),
    ''
  ].join('\n'),
  'utf8'
);

console.log(`emitted ${emitted.length} schemas -> ${outDir}`);

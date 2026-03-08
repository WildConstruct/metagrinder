import {
  readPsg,
  writePsg,
  fromLegacyGraph,
  roundTripTest,
  PSGErrorType,
  PSGValidationError
} from '../utils/psgCodec';
import type { PSGFile, Graph } from '../types/graph';
import * as fs from 'fs';
import * as path from 'path';

describe('psgCodec', () => {
  describe('AC E1: Valid read tests', () => {
    test('readPsg parses valid PSG file', () => {
      const validPsg: PSGFile = {
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test-123',
          name: 'Test Graph',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: {
          nodes: [{ id: 'n1', type: 'Start' }],
          edges: []
        }
      };

      const text = JSON.stringify(validPsg);
      const result = readPsg(text);
      expect(result).toEqual(validPsg);
    });

    test('readPsg parses fixture: valid-psg-1.json', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'valid-psg-1.json');
      const text = fs.readFileSync(fixturePath, 'utf-8');
      const result = readPsg(text);
      expect(result.meta.id).toBe('test-graph-1');
      expect(result.graph.nodes).toHaveLength(3);
      expect(result.graph.edges).toHaveLength(2);
    });

    test('readPsg parses fixture: valid-psg-2.json', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'valid-psg-2.json');
      const text = fs.readFileSync(fixturePath, 'utf-8');
      const result = readPsg(text);
      expect(result.meta.id).toBe('minimal-graph');
      expect(result.graph.nodes).toHaveLength(0);
      expect(result.graph.edges).toHaveLength(0);
    });
  });

  describe('AC A2, E1: Invalid read with structured errors', () => {
    test('readPsg throws PSGError with paths for invalid schema', () => {
      const invalidJson = JSON.stringify({
        version: '1.0',
        kind: 'graph',
        meta: { name: 'Missing ID' },
        graph: { nodes: [], edges: [] }
      });

      expect(() => readPsg(invalidJson)).toThrow(PSGValidationError);
      try {
        readPsg(invalidJson);
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.MISSING_REQUIRED_FIELDS);
          expect(e.error.message).toContain('required');
          expect(e.error.details).toBeDefined();
          expect(e.error.suggestions).toBeDefined();
          const suggestions = e.error.suggestions ?? [];
          expect(suggestions.length).toBeGreaterThan(0);
        }
      }
    });

    test('readPsg throws INVALID_JSON for malformed JSON', () => {
      const malformedJson = '{ broken json }';

      expect(() => readPsg(malformedJson)).toThrow(PSGValidationError);
      try {
        readPsg(malformedJson);
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.INVALID_JSON);
          expect(e.error.message).toBe('Invalid JSON syntax');
        }
      }
    });

    test('readPsg validates fixture: invalid-psg-missing-required.json', () => {
      const fixturePath = path.join(
        __dirname,
        'fixtures',
        'invalid-psg-missing-required.json'
      );
      const text = fs.readFileSync(fixturePath, 'utf-8');

      expect(() => readPsg(text)).toThrow(PSGValidationError);
      try {
        readPsg(text);
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.MISSING_REQUIRED_FIELDS);
        }
      }
    });

    test('readPsg validates fixture: invalid-psg-wrong-type.json', () => {
      const fixturePath = path.join(
        __dirname,
        'fixtures',
        'invalid-psg-wrong-type.json'
      );
      const text = fs.readFileSync(fixturePath, 'utf-8');

      expect(() => readPsg(text)).toThrow(PSGValidationError);
    });
  });

  describe('Security: Security validation tests', () => {
    test('readPsg detects security violations - prototype pollution', () => {
      const maliciousObj = {
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test',
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: {
          nodes: [
            {
              id: 'n1',
              type: 'Node',
              data: {
                constructor: { name: 'malicious' }
              }
            }
          ],
          edges: []
        }
      };
      const maliciousJson = JSON.stringify(maliciousObj);

      expect(() => readPsg(maliciousJson)).toThrow(PSGValidationError);
      try {
        readPsg(maliciousJson);
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.SECURITY_VIOLATION);
          expect(e.error.message).toContain('Dangerous property');
        }
      }
    });

    test('readPsg detects security violations - XSS patterns', () => {
      const xssJson = JSON.stringify({
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test',
          name: '<script>alert("XSS")</script>',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: { nodes: [], edges: [] }
      });

      expect(() => readPsg(xssJson)).toThrow(PSGValidationError);
      try {
        readPsg(xssJson);
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.SECURITY_VIOLATION);
          expect(e.error.message).toContain('XSS');
        }
      }
    });

    test('readPsg validates file size limits', () => {
      const largeContent = 'x'.repeat(100);
      const json = JSON.stringify({
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test',
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: { nodes: [], edges: [] }
      });

      expect(() => readPsg(json, { maxFileSize: 50 })).toThrow(
        PSGValidationError
      );
      try {
        readPsg(json, { maxFileSize: 50 });
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.FILE_TOO_LARGE);
          expect(e.error.message).toContain('exceeds maximum');
        }
      }
    });

    test('readPsg validates data consistency - invalid edge references', () => {
      const inconsistentJson = JSON.stringify({
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test',
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: {
          nodes: [{ id: 'n1', type: 'Start' }],
          edges: [{ id: 'e1', source: 'n1', target: 'nonexistent' }]
        }
      });

      expect(() => readPsg(inconsistentJson)).toThrow(PSGValidationError);
      try {
        readPsg(inconsistentJson);
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.type).toBe(PSGErrorType.INVALID_EDGE_DATA);
          expect(e.error.message).toContain('non-existent');
        }
      }
    });
  });

  describe('AC B1, B2: Serialization tests', () => {
    test('writePsg outputs stable, pretty-printed JSON (2-space indent)', () => {
      const psg: PSGFile = {
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test',
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: { nodes: [], edges: [] }
      };

      const output = writePsg(psg);
      expect(output).toContain('  "version"');
      expect(output).toContain('  "kind"');
      expect(output.split('\n')[0]).toBe('{');
    });

    test('writePsg round-trip maintains equality', () => {
      const psg: PSGFile = {
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'id-123',
          name: 'Sample Graph',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          tags: ['demo']
        },
        graph: {
          nodes: [
            { id: 'n1', type: 'Start' },
            { id: 'n2', type: 'End' }
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2' }]
        },
        extras: {
          previewUrl: 'https://example.com/prev.png',
          thumbSeed: 'seed'
        }
      };

      const serialized = writePsg(psg);
      const deserialized = readPsg(serialized);
      expect(deserialized).toEqual(psg);
      // Test that re-serializing produces valid JSON (field order may differ)
      const reserialized = writePsg(deserialized);
      const reDeserialized = readPsg(reserialized);
      expect(reDeserialized).toEqual(psg);
    });
  });

  describe('AC C1, C2: Legacy migration tests', () => {
    test('fromLegacyGraph migrates preserving nodes/edges', () => {
      const legacyGraph: Graph = {
        nodes: [{ id: 'legacy-1', type: 'Output', label: 'Legacy Node' }],
        edges: [],
        settings: { oldFormat: true }
      };

      const migrated = fromLegacyGraph('Migrated Graph', legacyGraph, {
        idFactory: () => 'uuid-fixed-1234',
        now: () => '2024-01-02T03:04:05.000Z'
      });

      expect(migrated.version).toBe('1.0');
      expect(migrated.kind).toBe('graph');
      expect(migrated.meta.name).toBe('Migrated Graph');
      expect(migrated.meta.id).toBe('uuid-fixed-1234');
      expect(migrated.meta.createdAt).toBe('2024-01-02T03:04:05.000Z');
      expect(migrated.meta.updatedAt).toBe('2024-01-02T03:04:05.000Z');
      expect(migrated.graph.nodes).toEqual(legacyGraph.nodes);
      expect(migrated.graph.edges).toEqual(legacyGraph.edges);
      expect(migrated.graph.settings).toEqual(legacyGraph.settings);

      const serialized = writePsg(migrated);
      const parsed = readPsg(serialized);
      expect(parsed).toEqual(migrated);
    });

    test('fromLegacyGraph processes fixture: legacy-graph.json', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'legacy-graph.json');
      const text = fs.readFileSync(fixturePath, 'utf-8');
      const legacyGraph = JSON.parse(text) as Graph;

      const migrated = fromLegacyGraph('Legacy Migration', legacyGraph);

      expect(migrated.graph.nodes).toHaveLength(1);
      expect(migrated.graph.nodes[0].id).toBe('legacy-1');
      expect(migrated.graph.nodes[0].type).toBe('Output');
      expect(migrated.graph.settings).toEqual({ oldFormat: true });

      const validated = readPsg(writePsg(migrated));
      expect(validated.graph.nodes).toEqual(migrated.graph.nodes);
    });
  });

  describe('AC E2: Test names clearly map to ACs', () => {
    test('[AC-A1] Schema enforces required fields', () => {
      const missingVersion = JSON.stringify({
        kind: 'graph',
        meta: {
          id: 'test',
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: { nodes: [], edges: [] }
      });

      expect(() => readPsg(missingVersion)).toThrow(PSGValidationError);
    });

    test('[AC-A2] readPsg provides structured error with paths', () => {
      const invalid = JSON.stringify({ version: '1.0' });

      try {
        readPsg(invalid);
        fail('Should have thrown');
      } catch (e) {
        if (e instanceof PSGValidationError) {
          expect(e.error.details).toBeDefined();
          expect(e.error.details.paths).toBeDefined();
        }
      }
    });

    test('[AC-B1] writePsg uses 2-space indentation', () => {
      const psg: PSGFile = {
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'test',
          name: 'Test',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        graph: { nodes: [], edges: [] }
      };

      const output = writePsg(psg);
      const lines = output.split('\n');
      const indentedLine = lines.find(l => l.startsWith('  '));
      expect(indentedLine).toBeDefined();
      if (!indentedLine) {
        throw new Error('Expected indented line to exist in PSG output');
      }
      expect(indentedLine.startsWith('  ')).toBe(true);
      expect(indentedLine.startsWith('    ')).toBe(false);
    });

    test('[AC-B2] Round-trip preserves data', () => {
      const original: PSGFile = {
        version: '1.0',
        kind: 'graph',
        meta: {
          id: 'round-trip-test',
          name: 'Round Trip Test',
          description: 'Testing round-trip',
          tags: ['test', 'round-trip'],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          author: { id: 'author-1', name: 'Test Author' }
        },
        graph: {
          nodes: [
            { id: 'n1', type: 'Start', label: 'Start', data: { x: 0 } },
            { id: 'n2', type: 'End', label: 'End', data: { x: 100 } }
          ],
          edges: [{ id: 'e1', source: 'n1', target: 'n2', label: 'Edge 1' }],
          layout: { type: 'horizontal' },
          settings: { grid: true }
        },
        extras: {
          previewUrl: 'https://example.com/preview.png',
          thumbSeed: 'seed-123',
          custom: 'value'
        }
      };

      expect(roundTripTest(original)).toBe(true);
    });

    test('[AC-C1] fromLegacyGraph returns valid PSGFile', () => {
      const legacy: Graph = {
        nodes: [{ id: 'n1', type: 'Node' }],
        edges: []
      };

      const result = fromLegacyGraph('Legacy', legacy);

      expect(() => writePsg(result)).not.toThrow();
      expect(() => readPsg(writePsg(result))).not.toThrow();
    });

    test('[AC-C2] Migration preserves graph structure', () => {
      const legacy: Graph = {
        nodes: [
          { id: 'a', type: 'TypeA', label: 'Node A' },
          { id: 'b', type: 'TypeB', label: 'Node B' }
        ],
        edges: [{ id: 'e1', source: 'a', target: 'b', label: 'Connection' }],
        layout: { orientation: 'vertical' },
        settings: { snapToGrid: true }
      };

      const migrated = fromLegacyGraph('Preserved', legacy);

      expect(migrated.graph.nodes).toEqual(legacy.nodes);
      expect(migrated.graph.edges).toEqual(legacy.edges);
      expect(migrated.graph.layout).toEqual(legacy.layout);
      expect(migrated.graph.settings).toEqual(legacy.settings);
    });
  });
});

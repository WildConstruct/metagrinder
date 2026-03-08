# PSG File Format Version 2.0 Specification

## Overview

The PSG (Prompt Spaghetti Graph) file format is a JSON-based format for storing prompt generation graphs with full support for inline editing. Version 2.0 introduces comprehensive edit state tracking, enhanced node data structures, and improved metadata for Epic 1 requirements.

## File Extension

- **Extension**: `.psg`
- **MIME Type**: `application/x-promptspaghetti-graph`
- **Format**: JSON

## Top-Level Structure

```json
{
  "fileType": "psg",
  "formatVersion": "2.0.0",
  "metadata": { ... },
  "settings": { ... },
  "graph": { ... },
  "medievalDemo": { ... },  // Optional
  "plugins": { ... },       // Optional
  "customNodeTypes": { ... }, // Optional
  "checksum": "...",        // Optional
  "compressed": false,      // Optional
  "encryption": { ... }     // Optional
}
```

## Core Components

### 1. Metadata

Project metadata contains information about the graph file:

```json
{
  "name": "Project Name",
  "description": "Optional description",
  "version": "1.0.0",
  "createdAt": "2025-08-01T10:00:00.000Z",
  "lastModified": "2025-08-01T10:00:00.000Z",
  "lastModifiedBy": "user@example.com",
  "author": "Author Name",
  "collaborators": ["user1", "user2"],
  "tags": ["tag1", "tag2"],
  "category": "character-generator",
  "thumbnail": "base64-or-url",
  "fileFormatVersion": "2.0.0",
  "isTemplate": false,
  "templateCategory": "category",
  "demoContent": false
}
```

### 2. Settings

Project settings control editor behavior and execution:

```json
{
  "autoSave": true,
  "autoSaveInterval": 30,
  "undoStackSize": 50,
  "gridEnabled": true,
  "gridSize": 20,
  "snapToGrid": false,
  "showMinimap": true,
  "theme": "auto",
  "inlineEditingEnabled": true,
  "autoFocusOnCreate": true,
  "showValidationInline": true,
  "editOnDoubleClick": true,
  "execution": {
    "defaultSeed": 12345,
    "timeout": 5000,
    "maxDepth": 100,
    "enableCaching": true,
    "parallelExecution": false
  },
  "enableAnimations": true,
  "renderOptimization": true,
  "lazyLoadNodes": false
}
```

### 3. Graph Structure

The graph contains nodes, edges, and state:

```json
{
  "nodes": [ ... ],
  "edges": [ ... ],
  "state": { ... }
}
```

## Node Types

### Base Node Structure

All nodes share this base structure:

```json
{
  "id": "unique-id",
  "type": "NodeType",
  "position": { "x": 100, "y": 100 },
  "size": { "width": 200, "height": 100 },  // Optional
  "style": { ... },                         // Optional
  "data": { ... },                          // Type-specific
  "label": "Display Name",                  // Optional
  "description": "Node description",        // Optional
  "tags": ["tag1", "tag2"],
  "createdAt": "2025-08-01T10:00:00.000Z",
  "updatedAt": "2025-08-01T10:00:00.000Z",
  "lastExecutionTime": 45,                  // Optional, in ms
  "executionCount": 10,                     // Optional
  "errorCount": 0                           // Optional
}
```

### Edit State

All node data includes edit state for inline editing:

```json
{
  "editState": {
    "isEditing": false,
    "editBuffer": null,
    "lastEditTimestamp": "2025-08-01T10:00:00.000Z",
    "validationErrors": [],
    "isDirty": false
  }
}
```

### Node Type: TextBlock

Simple text content node:

```json
{
  "type": "TextBlock",
  "data": {
    "value": "Text content here",
    "editState": { ... },
    "isValid": true,
    "isLocked": false,
    "previewMode": "auto",
    "maxLength": 500,
    "multiline": true,
    "placeholder": "Enter text..."
  }
}
```

### Node Type: WeightedChoice

Weighted random selection node:

```json
{
  "type": "WeightedChoice",
  "data": {
    "value": [
      {
        "id": "option-1",
        "text": "Option text",
        "weight": 50,
        "color": "#ff6b6b"
      }
    ],
    "editState": { ... },
    "normalizeWeights": true,
    "showPercentages": true,
    "allowAddRemove": true,
    "minOptions": 2,
    "maxOptions": 10
  }
}
```

### Node Type: Concat

String concatenation node:

```json
{
  "type": "Concat",
  "data": {
    "value": {
      "separator": " ",
      "trimInputs": true
    },
    "editState": { ... }
  }
}
```

### Node Type: Variable

Variable storage and reference node:

```json
{
  "type": "Variable",
  "data": {
    "value": {
      "name": "variable_name",
      "defaultValue": "default",
      "currentValue": "current"
    },
    "editState": { ... },
    "variableType": "string",
    "scope": "local"
  }
}
```

## Edge Structure

Connections between nodes:

```json
{
  "id": "edge-id",
  "source": "source-node-id",
  "target": "target-node-id",
  "sourceHandle": "output", // Optional
  "targetHandle": "input", // Optional
  "type": "default",
  "animated": false,
  "style": {
    "stroke": "#000000",
    "strokeWidth": 2,
    "strokeDasharray": "5,5"
  },
  "label": "Connection Label", // Optional
  "data": {} // Optional custom data
}
```

## Graph State

Current editor state:

```json
{
  "selectedNodes": ["node-1", "node-2"],
  "selectedEdges": ["edge-1"],
  "copiedNodes": [],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  },
  "editingNodeId": "node-3",
  "focusedNodeId": "node-3",
  "isExecuting": false,
  "lastExecutionId": "exec-123",
  "executionResults": { ... }
}
```

## Medieval Demo Support

Optional section for demo content:

```json
{
  "medievalDemo": {
    "presets": [
      {
        "id": "preset-1",
        "name": "Hero Generator",
        "description": "Generate heroic characters",
        "nodeData": {
          "node-id": { "value": ... }
        }
      }
    ],
    "examples": [
      {
        "id": "example-1",
        "title": "Basic Character",
        "prompt": "Generate a character",
        "expectedOutput": ["Output 1", "Output 2"]
      }
    ]
  }
}
```

## Version Compatibility

### Version 2.0.0 (Current)

- Full inline editing support
- Enhanced metadata
- Edit state tracking
- Medieval demo support

### Version 1.x (Legacy)

- Basic graph structure
- Limited metadata
- No inline editing support
- Can be migrated to 2.0

## Migration from v1 to v2

When opening a v1 file:

1. All nodes receive default edit states
2. Metadata is expanded with default values
3. Settings are enhanced with inline editing options
4. Format version is updated to 2.0.0

## Validation

The format uses Zod schemas for validation:

```typescript
import { validatePsgFileV2 } from '@core/schemas/psgSchemaV2';

const result = validatePsgFileV2(fileData);
if (result.success) {
  // Valid PSG file
  const psgData = result.data;
} else {
  // Invalid file
  console.error(result.errors);
}
```

## Best Practices

1. **Always validate** files before processing
2. **Preserve unknown fields** for forward compatibility
3. **Update timestamps** when modifying nodes
4. **Clear edit buffers** when saving
5. **Validate node connections** to prevent cycles
6. **Use meaningful IDs** for debugging

## Example Files

See the `packages/core/schemas/examples/` directory for complete examples:

- `simple-graph.psg.json` - Basic character generator
- `variable-graph.psg.json` - Quest generator with variables

## Future Extensions

The format supports extensibility through:

- `plugins` object for plugin-specific data
- `customNodeTypes` for user-defined nodes
- `encryption` for secure storage
- Additional metadata fields

## File Size Considerations

- Typical small graph: 5-10 KB
- Medium graph (50 nodes): 20-50 KB
- Large graph (200+ nodes): 100-500 KB
- Compression can reduce size by 60-80%

## Security Considerations

1. **Validate all inputs** before execution
2. **Sanitize text content** to prevent injection
3. **Limit graph complexity** to prevent DOS
4. **Use checksums** for integrity verification
5. **Support encryption** for sensitive content

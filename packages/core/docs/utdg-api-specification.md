# UTDG API Specification v1.0

## Overview

This document defines the API specifications for Universal Texture Description Graph (UTDG) integration with Wild Construct ecosystem components. The API enables historical data integration, constraint validation, and VFX pipeline compatibility.

## Base Configuration

```yaml
api:
  version: 'v1'
  baseUrl: 'https://api.wildconstruct.com/utdg/v1'
  authentication: 'OAuth 2.0 / API Key'
  contentType: 'application/json'
  rateLimit: 1000/hour
```

## Authentication

### OAuth 2.0 Flow

```typescript
interface AuthenticationConfig {
  type: 'oauth2' | 'apikey';
  oauth2?: {
    clientId: string;
    clientSecret: string;
    scope: string[];
    tokenEndpoint: string;
    refreshEndpoint: string;
  };
  apiKey?: {
    header: string;
    value: string;
  };
}
```

## Core API Endpoints

### 1. Historical Data Query API

#### GET /historical/query

Query historical databases for period-accurate content.

**Request Parameters:**

```typescript
interface HistoricalQueryRequest {
  era: {
    name: string;
    startYear: number;
    endYear: number;
  };
  region?: string[];
  category: 'clothing' | 'architecture' | 'materials' | 'patterns' | 'all';
  filters?: {
    socialClass?: 'nobility' | 'merchant' | 'peasant' | 'clergy';
    occasion?: 'daily' | 'ceremonial' | 'military' | 'religious';
    gender?: 'male' | 'female' | 'unisex';
    age?: 'child' | 'adult' | 'elderly';
  };
  accuracyLevel?: 'high' | 'medium' | 'creative';
  limit?: number;
  offset?: number;
}
```

**Response:**

```typescript
interface HistoricalQueryResponse {
  data: HistoricalItem[];
  metadata: {
    total: number;
    limit: number;
    offset: number;
    accuracyScore: number;
    sources: string[];
  };
  performance: {
    queryTime: number;
    cacheHit: boolean;
  };
}

interface HistoricalItem {
  id: string;
  name: string;
  description: string;
  era: Era;
  region: string[];
  category: string;
  metadata: {
    authenticity: number; // 0-1
    source: string;
    verified: boolean;
    tags: string[];
  };
  properties: {
    materials?: string[];
    colors?: string[];
    patterns?: string[];
    construction?: string[];
  };
  relationships: {
    compatible: string[];
    incompatible: string[];
    variations: string[];
  };
}
```

### 2. Constraint Validation API

#### POST /validation/constraints

Validate historical accuracy of content combinations.

**Request:**

```typescript
interface ConstraintValidationRequest {
  items: HistoricalItem[];
  context: {
    era: Era;
    region: string;
    scenario: string;
    accuracyLevel: 'strict' | 'moderate' | 'creative';
  };
  rules?: CustomConstraintRule[];
}
```

**Response:**

```typescript
interface ConstraintValidationResponse {
  valid: boolean;
  overallScore: number; // 0-1
  violations: ConstraintViolation[];
  suggestions: ConstraintSuggestion[];
  metadata: {
    rulesApplied: number;
    processingTime: number;
  };
}

interface ConstraintViolation {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  items: string[];
  message: string;
  suggestion?: string;
}
```

### 3. UTDG Node Management API

#### POST /utdg/nodes

Create or update UTDG nodes.

**Request:**

```typescript
interface UTDGNodeRequest {
  nodes: UTDGNodeData[];
  context: {
    projectId: string;
    version: string;
    metadata: ProjectMetadata;
  };
}

interface UTDGNodeData {
  id?: string;
  type: 'material' | 'texture' | 'pattern' | 'style' | 'composite';
  content: string;
  historicalData: HistoricalItem;
  metadata: NodeMetadata;
  relationships: NodeRelationships;
}
```

**Response:**

```typescript
interface UTDGNodeResponse {
  nodes: UTDGNode[];
  validation: ValidationResult;
  performance: PerformanceMetrics;
}
```

#### GET /utdg/nodes/{nodeId}

Retrieve specific UTDG node with historical context.

**Response:**

```typescript
interface UTDGNodeDetails {
  node: UTDGNode;
  historicalContext: HistoricalContext;
  relationships: EnrichedRelationships;
  validationStatus: ValidationStatus;
}
```

### 4. VFX Export API

#### POST /export/vfx

Export UTDG graph for VFX pipeline integration.

**Request:**

```typescript
interface VFXExportRequest {
  graphId: string;
  format: 'json' | 'xml' | 'yaml' | 'csv';
  target: 'maya' | 'blender' | 'houdini' | 'unreal' | 'unity' | 'generic';
  options: {
    includeMetadata: boolean;
    includeRelationships: boolean;
    includeValidation: boolean;
    compression: boolean;
  };
  vfxMetadata: VFXPipelineMetadata;
}
```

**Response:**

```typescript
interface VFXExportResponse {
  exportId: string;
  downloadUrl: string;
  format: string;
  size: number;
  metadata: ExportMetadata;
  expiration: string; // ISO date
}
```

### 5. Wild Construct System Integration API

#### POST /integration/systems

Register and configure Wild Construct system integrations.

**Request:**

```typescript
interface SystemIntegrationRequest {
  system: 'crowdcontrol' | 'backdrop' | 'meteor' | 'maestro';
  config: SystemConfiguration;
  endpoints: SystemEndpoint[];
  authentication: AuthenticationConfig;
}
```

**Response:**

```typescript
interface SystemIntegrationResponse {
  integrationId: string;
  status: 'active' | 'inactive' | 'error';
  capabilities: SystemCapability[];
  healthCheck: HealthCheckResult;
}
```

#### GET /integration/systems/{systemId}/status

Check integration health and performance.

**Response:**

```typescript
interface SystemStatusResponse {
  system: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  metrics: {
    responseTime: number;
    successRate: number;
    errorRate: number;
    availability: number;
  };
  issues: SystemIssue[];
}
```

### 6. Data Pipeline API

#### POST /pipeline/execute

Execute UTDG data processing pipeline.

**Request:**

```typescript
interface PipelineExecutionRequest {
  pipeline: {
    id: string;
    stages: PipelineStage[];
    config: PipelineConfig;
  };
  input: {
    historicalQuery: HistoricalQueryRequest;
    constraints: ConstraintRule[];
    vfxRequirements: VFXRequirements;
  };
  options: {
    async: boolean;
    notifications: boolean;
    caching: boolean;
  };
}
```

**Response:**

```typescript
interface PipelineExecutionResponse {
  executionId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stages: StageStatus[];
  output?: PipelineOutput;
  metrics: ExecutionMetrics;
}
```

## WebSocket API for Real-time Updates

### Connection

```typescript
// WebSocket endpoint
ws://api.wildconstruct.com/utdg/v1/ws

// Authentication via query parameter
ws://api.wildconstruct.com/utdg/v1/ws?token={auth_token}
```

### Event Types

```typescript
interface WebSocketEvent {
  type:
    | 'constraint_violation'
    | 'validation_complete'
    | 'export_ready'
    | 'system_status';
  data: any;
  timestamp: string;
  sessionId: string;
}
```

## Error Handling

### Standard Error Response

```typescript
interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId: string;
  };
  suggestion?: string;
  documentation?: string;
}
```

### Error Codes

- `INVALID_ERA`: Era specification is invalid or unsupported
- `CONSTRAINT_VIOLATION`: Historical constraints violated
- `DATA_NOT_FOUND`: Requested historical data not available
- `SYSTEM_UNAVAILABLE`: Wild Construct system temporarily unavailable
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `AUTHENTICATION_FAILED`: Authentication credentials invalid
- `VALIDATION_FAILED`: Data validation failed
- `EXPORT_ERROR`: VFX export generation failed

## Rate Limiting

```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number; // Seconds
}

// HTTP Headers
// X-RateLimit-Limit: 1000
// X-RateLimit-Remaining: 999
// X-RateLimit-Reset: 1640995200
```

## Caching Strategy

### Cache Headers

```typescript
interface CacheHeaders {
  'Cache-Control': 'max-age=3600'; // 1 hour for historical data
  ETag: string;
  'Last-Modified': string;
  'X-Cache-Status': 'hit' | 'miss' | 'stale';
}
```

### Cache Keys

- Historical queries: `historical:{era}:{region}:{category}:{hash}`
- Validation results: `validation:{items_hash}:{context_hash}`
- UTDG nodes: `utdg:node:{nodeId}:{version}`

## Performance Specifications

### Response Time SLAs

- Historical queries: < 2 seconds (95th percentile)
- Constraint validation: < 500ms (95th percentile)
- VFX export: < 30 seconds (95th percentile)
- System integration calls: < 1 second (95th percentile)

### Availability

- API availability: 99.9% uptime
- Historical data availability: 99.5%
- Real-time features: 99.0%

## API Versioning

### Version Strategy

- URL-based versioning: `/v1/`, `/v2/`
- Backward compatibility for at least 12 months
- Deprecation notices 90 days before removal
- Migration guides for breaking changes

### Version Information

```typescript
interface APIVersion {
  version: string;
  releaseDate: string;
  deprecationDate?: string;
  supportedUntil: string;
  changes: string[];
  migrationGuide?: string;
}
```

This API specification provides comprehensive integration capabilities while maintaining flexibility for future enhancements and Wild Construct ecosystem expansion.

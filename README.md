# 🍝 Prompt Spaghetti: The Revenge

> Fork note: this worktree is being pruned into a Metagrinder/UTDG/PSG-focused
> implementation fork. See `FORK_SCOPE.md` for the retained surface area and
> recommended entrypoints.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![React](https://img.shields.io/badge/react-18.3-blue)](https://reactjs.org/)
[![Demo](https://img.shields.io/badge/demo-live-ff69b4)](https://promptscape-graph.vercel.app)

> **Professional Film Industry Content Generation Tool**
>
> A powerful node-based visual editor for creating deterministic prompt generation graphs. Designed specifically for film production pipelines, VFX workflows, and creative development teams. Build complex branching narratives, character generators, and scene descriptions with an intuitive drag-and-drop interface, then execute them with reproducible results.

![Prompt Spaghetti Editor](docs/images/editor-screenshot.png)
_Visual node-based editor for professional content creation_

## 🎬 Why Prompt Spaghetti?

- **Film Industry Focus**: Built by filmmakers for filmmakers
- **Pipeline Ready**: Integrates with Maya, Houdini, Nuke workflows
- **Deterministic Output**: Perfect for VFX shot descriptions and continuity
- **Team Collaboration**: Share presets across departments
- **Professional Polish**: Cinema 4D-level interface quality

## 🚀 Features

- **Visual Graph Editor**: Drag-and-drop interface powered by React-Flow
- **Deterministic Execution**: Same graph + seed = identical output every time
- **6 Core Node Types**: WeightedChoice, Concat, Output, Include, SetVariable, GetVariable
- **Real-time Preview**: Generate 5 prompt variants instantly
- **Export/Import**: Compatible with existing Randomizer Engine bundles
- **CLI Support**: Batch execution for automation and CI/CD
- **Performance Optimized**: Handle large graphs with virtualization
- **TypeScript**: Full type safety with Zod schema validation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Client      │    │   Server/API    │    │      CLI        │
│  (React+Vite)   │◄──►│   (Fastify)     │◄──►│   (Node.js)     │
│  Port: 3000     │    │  Port: 8000     │    │   Batch Exec    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Packages/Core   │
                    │ (Shared Logic)  │
                    │ Types, Schemas  │
                    │ Runtime Engine  │
                    └─────────────────┘
```

### Repository Structure

```
promptscape-graph/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   └── ...
│   └── package.json
├── server/                # Node.js Fastify API
│   ├── src/
│   │   ├── engine.ts      # Graph execution engine
│   │   ├── exporter.ts    # Bundle conversion
│   │   └── index.ts       # API routes
│   └── package.json
├── packages/
│   ├── core/              # Shared TypeScript library
│   │   ├── runtime/       # Execution engine
│   │   ├── GraphEditor.tsx
│   │   ├── graphSchema.ts
│   │   └── ...
│   └── cli/               # Command-line interface
│       ├── cli.js
│       └── package.json
├── api/                   # Vercel serverless functions
│   ├── preview.js
│   ├── export.js
│   └── health.js
├── docs/                  # Documentation
│   ├── prd.md
│   ├── architecture.md
│   ├── deployment.md
│   └── ...
└── tests/                 # Cross-package tests
    ├── performance/
    └── integration/
```

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/WildConstruct/prompt_spaghetti_the_revenge.git
cd prompt_spaghetti_the_revenge

# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

This will start:

- **Client**: http://localhost:3000 (React UI)
- **Server**: http://localhost:8000 (API)

### Development with DevContainer

For the best development experience:

1. Open in VS Code or Windsurf
2. Install Dev Containers extension
3. Reopen in container when prompted
4. Run `pnpm dev` in the integrated terminal

## 📖 Usage

Related documentation:

- Supabase storage setup: `docs/setup/supabase-storage.md`
- In-app file browser epic stories: `docs/stories/`

### Creating Your First Graph

1. **Open the Editor**: Navigate to http://localhost:3000
2. **Add Nodes**: Drag node types from the left palette onto the canvas
3. **Connect Nodes**: Click and drag from output handles to input handles
4. **Configure Nodes**: Click a node to edit its properties in the right sidebar
5. **Preview**: Click "Preview" to generate 5 sample outputs
6. **Export**: Use "Save as JSON" to export your graph

### Node Types

| Node Type          | Description                               | Example Use Case                       |
| ------------------ | ----------------------------------------- | -------------------------------------- |
| **WeightedChoice** | Randomly selects from weighted options    | Choose between different prompt styles |
| **Concat**         | Combines multiple inputs with a separator | Join subject + verb + object           |
| **Output**         | Marks the final output point              | Terminal node for completed prompts    |
| **Include**        | References another graph/bundle           | Modular prompt components              |
| **SetVariable**    | Stores a value for later use              | Remember user's chosen style           |
| **GetVariable**    | Retrieves a stored value                  | Use previously set style               |

### Command Line Interface

```bash
# Execute a graph from the command line
npx promptgraph exec my-graph.json --seed 1234

# Output a specific number of variants
npx promptgraph exec my-graph.json --count 10

# Use random seed
npx promptgraph exec my-graph.json --random
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test suites
pnpm test -- packages/core
pnpm test -- --testNamePattern="GraphEditor"

# Run performance tests
pnpm test:performance
```

### Test Coverage Requirements

- **Global**: 80% minimum coverage
- **Core Engine**: 90% minimum coverage
- **Critical Paths**: 95% minimum coverage

## 🚀 Deployment

### Production Deployment

The application is deployed on Vercel with automatic deployments:

- **Production**: https://promptscape-graph.vercel.app
- **Staging**: https://promptscape-graph-staging.vercel.app

### Manual Deployment

```bash
# Deploy to Vercel
npm install -g vercel
vercel login
vercel --prod
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
ENABLE_CORRECTIONS=true
VITE_API_BASE_URL=http://localhost:8000

# Supabase (Storage for .psg)
# Choose the pair matching your build tool (Next.js-style or Vite-style)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Feature flags
NEXT_PUBLIC_FEATURE_SUPABASE=1   # set 0 to disable Supabase features globally
NEXT_PUBLIC_FEATURE_DEV_USER=0   # set 1 to enable local dev userId stub
```

## 📦 Graph Manifest & Demo Graphs

- **Public graphs folder**: `packages/asset-browser/public/graphs/`
- **Add demo graphs**: drop `*.psg` files into that folder.
- **Generate manifest**: creates `public/graphs/manifest.json` used by the Asset Browser.

```bash
# From repo root
pnpm run generate:manifest

# Or build the package (runs prebuild -> generator)
pnpm --filter @prompt/asset-browser build
```

- **Runtime**: `packages/asset-browser/src/services/GraphManifestLoader.ts` loads `/graphs/manifest.json`.
- **Validation**: the generator validates `.psg` via `packages/core/utils/psgCodec.ts` when available; invalid files are skipped with warnings.
- **Sample demos included**: `city-plaza.psg`, `forest-path.psg`, `medieval-market.psg` in `packages/asset-browser/public/graphs/`.
- **CI**: see workflow step "Generate graph manifest" in `.github/workflows/ci.yml`.

### Tips: Demos, Local Files, Supabase

- **Open demos**: uses `/graphs/manifest.json` from the public folder.
- **Open local files**: load `.psg` directly via the file dialog (no manifest needed).
- **Save locally**: exports `.psg` to your machine.
- **Save to Supabase**: requires `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` or `VITE_SUPABASE_URL/ANON_KEY` set; bucket path convention `users/{userId}/graphs/*`.
- For bucket/policy setup, see `docs/setup/supabase-storage.md`.

## 📊 Performance

### Benchmarks

| Metric                            | Target   | Current |
| --------------------------------- | -------- | ------- |
| Graph execution (5 variants)      | < 1s     | 0.3s    |
| Large graph rendering (250 nodes) | > 30 FPS | 45 FPS  |
| Memory usage                      | < 500MB  | 280MB   |
| Bundle size                       | < 5MB    | 2.8MB   |

### Optimization Features

- **React.memo**: Prevents unnecessary re-renders
- **Canvas Virtualization**: Handles 1000+ nodes efficiently
- **Debounced Operations**: Reduces computation overhead
- **Bundle Splitting**: Faster initial load times

## 🔧 Development

### Code Quality

```bash
# Linting
pnpm lint

# Type checking
pnpm typecheck

# Formatting
pnpm format

# Pre-commit hooks
pnpm prepare
```

### Architecture Decisions

- **Monorepo**: Single repo with multiple packages for easier development
- **TypeScript**: Full type safety and better developer experience
- **Zod**: Runtime validation and type inference
- **React-Flow**: Proven solution for node-based editors
- **Fastify**: High-performance API server
- **Vercel**: Serverless deployment with edge functions

## 🔒 Security & Env

- Server headers: adds `X-Frame-Options=DENY`, `X-Content-Type-Options=nosniff`, `Referrer-Policy=no-referrer`, and a conservative `Permissions-Policy` on all API responses. Netlify adds matching headers for the SPA.
- CSP (Netlify): tightened `script-src` to `'self'` only; inline styles temporarily allowed for admin. Remove `'unsafe-inline'` for styles after migrating admin styles to external CSS or nonces.
- CSP (Netlify): global `style-src` still includes `'unsafe-inline'` due to SPA inline styles. For `/admin/*`, we serve external CSS/JS and apply stricter CSP (no inline styles/scripts).
- CORS: configure allowed origins via `CORS_ORIGINS` (comma-separated). Defaults include `http://localhost:3000`, `http://localhost:5173`, `https://ps.wildconstruct.com`, and `APP_ORIGIN` if set.
- Rate limiting: per-IP token bucket applied to files API, LLM parse/complete, and admin metrics.
- Request limits: set `BODY_LIMIT_BYTES` (default `1000000`) to cap request body size.
- LLM timeout: set `LLM_TIMEOUT_MS` (default `20000`) to abort long external calls.
- Health: `/health` and `/api/healthz` endpoints return `{ status: 'ok' }`.
- Files test UI: a small dev-only tester appears in GraphControls Settings to exercise `/api/files/*`. It is hidden in production builds.

## 🤝 Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes
4. **Test** thoroughly: `pnpm test`
5. **Commit** with conventional commits: `git commit -m "feat: add amazing feature"`
6. **Push** to your fork: `git push origin feature/amazing-feature`
7. **Create** a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Add tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

### Issue Reporting

- Use the issue templates
- Include steps to reproduce
- Add screenshots for UI issues
- Mention your environment details

## Repo Structure and Conventions

- `packages/` — main workspaces (active development)
- `sandboxes/` — ad‑hoc demos, debug scripts, and manual test harnesses moved from the repo root to reduce clutter. Not part of CI/builds. See `sandboxes/README.md`.
- `scripts/maintenance/` — helper scripts for local maintenance, diagnostics, refactors (e.g., `fix-*.js`, `analyze-*.js`). Not used by CI/builds. See `scripts/maintenance/README.md`.
- `scripts/build/` — historical build scripts (e.g., `netlify-build-*.sh`). Prefer `package.json` scripts and CI workflows. See `scripts/build/README.md`.
- `legacy/` — reserved for deprecated code; to be populated in a later cleanup. Active builds exclude legacy paths.

Active checks

- TypeScript and ESLint are scoped to active code via `tsconfig.active.json` and the Husky pre-commit hook.
- CI uses `.github/workflows/active-checks.yml` for push/PR and `.github/workflows/legacy-scan.yml` for scheduled warn-only scans.

Local backlog

- Non-GitHub tasks tracked in `docs/qa/local-backlog.md` (e.g., Proposal C: Legacy Quarantine).

## 📝 Documentation

### Core Documentation

- **[Product Requirements](docs/prd.md)**: Complete feature specifications
- **[Architecture Guide](docs/architecture.md)**: Technical architecture overview
- **[API Documentation](docs/api_contract.md)**: API endpoints and schemas
- **[Deployment Guide](docs/deployment.md)**: Production deployment instructions
- **[Performance Guide](docs/PERF.md)**: Performance optimization details

### User Guides

- **[Content Authoring](docs/content_authoring.md)**: How to create effective prompt graphs
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions
- **[Migration Guide](docs/migration.md)**: Upgrading from previous versions

## 📄 License

**This is proprietary software.** All rights reserved by Wild Construct.

For licensing inquiries, please contact:

- **Brian Behm**, CEO and Head Creative
- **Wild Construct**
- **Email**: wildconstruct@wildconstruct.com

See the [LICENSE](LICENSE) file for full terms.

## 🎯 Use Cases

### Film Production

- **Script Development**: Generate dialogue variations and scene descriptions
- **Casting**: Create detailed character profiles and backstories
- **VFX Planning**: Standardize shot descriptions and technical notes
- **Marketing**: Generate taglines, synopses, and social media content

### Game Development

- **NPC Generation**: Create diverse character personalities
- **Quest Design**: Build branching narrative structures
- **World Building**: Generate location descriptions and lore
- **Dialogue Trees**: Design complex conversation systems

## 🏢 About Wild Construct

Wild Construct is pioneering the next generation of creative tools for the film industry. Our suite of professional applications bridges the gap between traditional filmmaking and cutting-edge AI technology.

## 📞 Contact

- **Business Inquiries**: Brian Behm - wildconstruct@wildconstruct.com
- **Technical Support**: [GitHub Issues](https://github.com/WildConstruct/prompt_spaghetti_the_revenge/issues)
- **Documentation**: See our [Obsidian Vault](docs/obsidian-vault/)
- **Examples**: Check the [examples/](examples/) directory

---

**© 2024-2025 Wild Construct. All Rights Reserved.**

_Professional tools for professional creators._

## Deploying to Netlify (Option A: Proxy /api)

This app is configured to use relative API paths in production and have Netlify proxy them to your backend.

1. Netlify redirect (already added in `netlify.toml`)

```
[[redirects]]
  from = "/api/*"
  to = "http://ps.wildconstruct.com:8000/api/:splat" # UPDATE to your backend
  status = 200
  force = true

# Optional: expose backend admin via app domain (requires backend auth)
[[redirects]]
  from = "/admin/*"
  to = "http://ps.wildconstruct.com:8000/admin/:splat"
  status = 200
  force = true
```

2. Client env (Netlify UI → Site settings → Build & deploy → Environment)

- `VITE_SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `<anon key>`
- Do NOT set `VITE_API_URL` (keep requests relative so the redirect handles routing)

3. Backend CORS

On the backend, include your app origin in `CORS_ORIGINS` (comma-separated list):

```
CORS_ORIGINS="https://ps.wildconstruct.com"
```

4. Alternate (Option B)

If you prefer absolute API calls, set `VITE_API_URL` to your backend origin and remove the Netlify redirect. Ensure CORS is configured accordingly.

## Supabase RLS Policies (Storage + Tables)

Enable Row Level Security (RLS) on all tables and define policies to scope data to the authenticated user. For Storage, scope each object path by user id to prevent cross-tenant access.

Example policies for the `graphs` bucket on `storage.objects` (Postgres SQL):

```
-- Enable RLS (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Helper: first path segment equals auth.uid()
-- storage.foldername(name) returns text[] of path segments

-- READ own files
CREATE POLICY "storage_read_own_graphs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'graphs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT own files (must write to a folder named by the user id)
CREATE POLICY "storage_insert_own_graphs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'graphs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE own files
CREATE POLICY "storage_update_own_graphs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'graphs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'graphs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE own files
CREATE POLICY "storage_delete_own_graphs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'graphs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

For app tables, add similar policies (e.g., `user_id = auth.uid()`) and prefer UUID primary keys.

## Security Hardening (Quick Guide)

The repo includes initial hardening and a checklist to continue:

- Secrets and keys: Service role keys only on the server; client uses anon key.
- Rate limits: LLM completion has a token bucket; extend to other sensitive endpoints as needed.
- Input validation: zod schemas added to files API; expand across routes.
- PII redaction: LLM requests run through a privacy filter on the server.
- CSP headers: baseline CSP set in `netlify.toml` (tighten as willing).
- Admin: form parser added; test buttons for Supabase/OpenRouter; delete-key confirmation.

See `docs/security-hardening.md` for a prioritized checklist and mapping to this codebase.

# Trigger rebuild Wed, Sep 10, 2025 2:50:26 PM

# Cache bust 1757537991

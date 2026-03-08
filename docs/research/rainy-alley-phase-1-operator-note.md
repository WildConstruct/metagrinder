# Rainy Alley Phase 1 Operator Note

_Last updated: 2026-03-07_

## 1. Purpose

This note explains how to run the Rainy Alley Phase 1 slice without reading the full research stack.

## 2. Command

Run from:

- [packages/core](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/packages/core)

Command:

```bash
npm run run:rainy-alley-prototype
```

## 3. What It Does

The script:

1. loads the rainy alley metaball fixture
2. resolves the linked world semantic field
3. runs a simplified camera query
4. generates a render text packet
5. generates a camera pass manifest
6. generates a model-conditioning payload
7. generates a Luma adapter contract
8. validates the generated JSON artifacts after writing them

## 4. Output Location

Generated files are written to:

- [packages/core/tests/output/metagrinder/rainy-alley](/mnt/c/Users/Owner/CascadeProjects/prompt-spaghetti/packages/core/tests/output/metagrinder/rainy-alley)

Expected files:

- `generated-render-text-packet.json`
- `generated-camera-pass-manifest.json`
- `generated-model-conditioning-payload.json`
- `generated-luma-adapter-contract.json`
- `debug-camera-query.json`

## 5. What To Inspect

Check:

- whether the render text packet reads like camera-aware material/environment guidance
- whether ranked records in `debug-camera-query.json` are sensible
- whether the model-conditioning payload references the expected control assets
- whether the Luma adapter prompt reads like structured guidance rather than generic prompt filler

## 6. Known Limits

This Phase 1 slice does not include:

- image-derived reconstruction
- advanced occlusion
- semantic mask generation
- real witness render generation
- live Luma API submission

It is a contract-and-runtime proof, not a production integration.

## 7. Validation Behavior

The runtime validates generated JSON outputs after they are written:

- `generated-render-text-packet.json`
- `generated-camera-pass-manifest.json`
- `generated-model-conditioning-payload.json`
- `generated-luma-adapter-contract.json`

If one of those artifacts is malformed, the script should fail instead of silently leaving a bad output set behind.

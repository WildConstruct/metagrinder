# Perspective Witness Renderer Spec

_Last updated: 2026-03-07_

## 1. Purpose

This document defines a low-cost render layer for generating alternate-angle witness views from a rough semantic world base.

The purpose is speed, continuity, and guidance.

It is not intended to replace final rendering.

## 2. Core Idea

Use lightweight rendering techniques to create:

- low-resolution surface appearance
- perspective-aware reprojection
- rough material continuity
- camera-change previews

This helps the system avoid starting from zero for every new angle.

## 3. Inputs

The witness renderer may consume:

- semantic splats
- proxy geometry
- semantic regions
- world semantic field
- rough depth
- rough normal data
- projected or baked low-res texture data

## 4. Output Types

Expected outputs:

- witness RGB render
- witness depth
- witness normal
- semantic overlay
- candidate camera pass helper image

## 5. Candidate Techniques

The renderer can draw on known game/render patterns such as:

- projected textures
- camera reprojection
- proxy mesh rendering
- billboards or impostors
- splat rendering
- low-res baked materials

The right answer is likely a hybrid, not one technique only.

## 6. Main Job

The witness renderer should provide enough continuity that:

- perspective shifts feel grounded
- scene extension is easier
- reverse-analysis refinements have a better substrate
- downstream model edits stay compositionally coherent

## 7. Design Principle

The witness layer is a helper surface.

Its value is:

- speed
- spatial continuity
- semantic alignment

not beauty.

## 8. Relationship To Camera Pass Service

The perspective witness renderer should feed the camera pass workflow by providing:

- witness render image
- witness depth
- witness normal
- optional semantic overlays

These become inputs to:

- render text packet generation
- model-conditioning payloads
- relensing workflows

## 9. Relationship To Progressive Recovery

This renderer is the bridge between rough world state and the next refinement pass.

It allows the system to:

- look from a new angle
- inspect continuity gaps
- create patch proposals
- improve the world base iteratively

## 10. Recommended v1 Scope

For the first version:

- one proxy scene
- one alternate camera
- witness RGB output
- optional depth helper output

That is enough to prove the loop.

## 11. Success Criteria

The witness renderer is successful if:

1. alternate views are spatially coherent enough to be useful
2. the output helps patch generation or relensing
3. the cost is much lower than a full render attempt

## 12. Recommendation

Treat this as a perspective-aware preview subsystem.

That framing keeps it practical and avoids overclaiming.

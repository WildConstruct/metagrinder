# Rainy Alley Demo Plan

_Last updated: 2026-03-07_

## 1. Purpose

This document defines the first end-to-end demo scenario for Semantic World Authoring.

The demo should show:

- a prebuilt or proxy alley world
- semantic authoring on top of it
- environmental logic
- camera-conditioned packet generation
- downstream image-modify conditioning

## 2. Demo Story

A filmmaker has a rainy alley environment and wants to:

- mark the left brick wall as rain-reactive
- define a leak source and soot zone
- create a rain volume across the alley
- move the camera and let the system automatically determine what semantic context matters

## 3. Demo Components

### Base world

- alley proxy geometry or witness scene

### Semantic records

- left wall region
- leak point
- soot region above doorway
- alley rain volume

### UTDG references

- brick archetype
- rain-darkened brick archetype
- wetness modifier
- soot modifier
- brick rain response profile

### Graph bindings

- wetness logic block
- rain controller
- leak-localized override

## 4. Demo Camera States

### Shot A

Medium alley view showing left wall and doorway.

Expected packet emphasis:

- dominant wet brick wall
- soot above doorway
- alley rain conditions

### Shot B

Closer view on leak zone.

Expected packet emphasis:

- localized reflective wet patch
- darkened mortar
- directional runoff streaks

### Shot C

Wider shot including ground and wall.

Expected packet emphasis:

- damp corridor
- wall response
- pooled ground wetness if available

## 5. Authoring Actions To Demonstrate

1. draw a semantic region on the left wall
2. place a semantic point for the leak source
3. place a semantic volume for alley rain
4. attach wetness/rain graph logic
5. adjust one slider on the rain controller
6. move the camera and regenerate packet

## 6. Outputs To Show

- witness render
- semantic overlay view
- world semantic field visualization
- render text packet
- semantic mask
- preview control image
- downstream Luma adapter payload

## 7. Demo Goal

The viewer should understand:

"This system is not just prompting an image model. It is reading a semantically described world and preparing a camera-aware control bundle."

## 8. Recommendation

Keep the demo visually simple and semantically strong.

The point is clarity of the system loop, not maximum visual complexity.

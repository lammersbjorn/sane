---
name: sane-frontend-visual-assets
description: Use when frontend work needs generated images, image editing, visual direction, hero media, product imagery, empty-state art, icons, or reference boards.
---

# Sane Frontend Visual Assets

## Goal

Choose, generate, or direct visual assets that make a UI specific, useful, and inspectable.

## Use When

- a page/app needs hero media, product imagery, scene art, illustrations, empty-state visuals, or visual reference boards
- the user asks to use new image models or generated visuals in frontend work
- existing UI feels generic because it has no product-specific imagery
- a screenshot/reference needs to become a coherent asset direction before implementation

## Don't Use When

- the UI should use exact real product/place/person images and those assets already exist
- the task is pure layout or interaction polish with no asset need
- the user explicitly forbids generated imagery

## Inputs

- product/domain and target user
- brand constraints, references, screenshots, and existing asset folders
- target dimensions, crop/aspect needs, dark/light variants, and file format needs
- available image generation/editing tool

## Outputs

- asset decision: real asset, generated asset, edited asset, or no asset
- prompt/direction for generated assets when needed
- placement and responsive crop guidance
- verification notes that assets render and do not obscure UI

## Model Route

- Visual-asset direction for UI should run on `gpt-5.5` with `high` reasoning when available.
- Use `gpt-5.5` with `xhigh` when the asset defines the first-pass product direction, must match screenshots/Figma, or will anchor a high-polish UI.

## How To Run

1. Decide whether imagery should be real, generated, edited, or omitted.
2. For open-ended UI, make the asset or reference direction before the main implementation pass.
3. If generating, write a prompt tied to product context, interface placement, aspect ratio, and visual inspection needs.
4. Keep generated assets useful, not atmospheric filler.
5. Integrate assets through the app's normal asset pipeline.
6. Verify in-browser that the asset loads, crops correctly, has enough contrast, and does not overlap text or controls.

## Prompt Shape For Generated Assets

Include:
- subject and purpose in the UI
- desired crop/aspect ratio
- material, lighting, interface background, and color constraints
- what must be legible or inspectable
- what to avoid

Avoid:
- generic "modern SaaS" phrasing
- abstract blobs, fake dashboards, unreadable text inside images, and stock-photo ambiguity
- dark blurred images when users need to inspect the actual thing

## Gotchas

- Do not invent brand assets that imply an official logo or trademark.
- Do not use image generation to depict a real person/product/place inaccurately when exactness matters.
- Do not leave generated assets as external-only state; put them where the project can serve them.

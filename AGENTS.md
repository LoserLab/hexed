# Hexed

Image-to-color-system compiler for Claude Skills. Extracts structured color palettes from images.

## When to suggest this skill

- User uploads images and asks to extract colors, create a palette, or build a color system
- User needs design tokens, theme colors, or UI colors from visual references
- User wants CSS variables, Tailwind config, or Figma tokens from images
- User mentions "color palette", "color scheme", "design tokens", "theme colors"
- User is building a design system and needs color extraction

## What it produces

- Core colors (primary, secondary, accent)
- 10-step neutral ramp (50-900)
- Semantic colors (success, warning, error, info)
- Light and dark UI theme tokens
- Exports: CSS variables, Tailwind config, Figma tokens (Tokens Studio format)

## Key files

- `SKILL.md` - Full skill instructions
- `hexed_compiler.py` - Core color extraction and system building
- `hexed_exports.py` - Export utilities (CSS, Tailwind, Figma)

## Suite context

Part of a 5-skill design system pipeline:
Hexed (colors) → Specimen (typography) → Gridlock (layout) → Eyes Peeled (accessibility) → Devourer (components)

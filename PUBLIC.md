{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # Hexed\
\
Hexed is an image-to-color-system compiler.\
\
It accepts one or more images and returns a structured color system suitable for UI design, product themes, and design tokens. The output is deterministic and exportable into common formats.\
\
This skill does not generate copy, layouts, or branding concepts. It only produces color systems derived from visual input.\
\
---\
\
## What This Skill Does\
\
Given an uploaded image, Hexed:\
\
- Samples pixel data at a normalized resolution\
- Extracts dominant and representative colors\
- Produces a structured color system including:\
  - Core colors (primary, secondary, accent)\
  - Neutral ramp\
  - Semantic colors (success, warning, error, info)\
  - Light and dark UI theme tokens\
\
The result is intended for direct use in design systems and front-end tooling.\
\
---\
\
## Input\
\
- 1\'965 image files\
- Any common image format (PNG, JPG, WebP)\
- Images can be photos, screenshots, illustrations, or moodboards\
\
No metadata or prompts are required beyond the image upload.\
\
---\
\
## Output\
\
Hexed returns a JSON object containing:\
\
- `color_system` \'96 the compiled color system\
- Optional debug data describing image processing and sampling\
\
The color system structure is stable and designed for downstream automation.\
\
---\
\
## Supported Exports\
\
Hexed supports exporting the compiled color system into:\
\
- CSS variables\
- Tailwind theme configuration\
- Figma-compatible token JSON\
\
Exports are generated on demand from the compiled color system.\
\
---\
\
## Intended Use\
\
This skill is useful for:\
\
- Designers creating UI themes from visual references\
- Developers generating design tokens from imagery\
- Teams aligning colors across product, marketing, and UI\
- Automating color extraction in pipelines or agents\
\
---\
\
## Notes\
\
- Hexed is image-agnostic. There is no assumed style or aesthetic.\
- Outputs prioritize usability over artistic interpretation.\
- No accounts, UI, or persistent storage are required.\
\
---\
\
Hexed is designed to be composed into larger workflows rather than used as a standalone application.\
Created by Heathen [x.com/heathenft]}
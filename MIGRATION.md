# Migration Guide: Next.js → Python Claude Skill

## What Changed

This document shows how your Next.js API was converted to a Python Claude skill.

## Architecture Comparison

### Before (Next.js)
```
next-app/
├── app/
│   ├── api/
│   │   └── compile/route.ts       # Main API endpoint
│   ├── export/route.ts            # Generic export endpoint
│   └── export/
│       ├── css/route.ts           # CSS export
│       ├── tailwind/route.ts      # Tailwind export
│       └── figma/route.ts         # Figma export
└── package.json
```

### After (Python Skill)
```
hexed-skill/
├── SKILL.md                       # Claude instructions
├── hexed_compiler.py              # Core logic (replaces api/compile)
├── hexed_exports.py               # All exports in one file
└── test_hexed.py                  # Testing utilities
```

## Code Conversions

### Image Processing

**Before (Next.js with Sharp):**
```typescript
import sharp from "sharp";

const bytes = Buffer.from(await file.arrayBuffer());
const resizedBytes = await sharp(bytes)
  .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside" })
  .toBuffer();

const { data, info } = await sharp(resizedBytes)
  .raw()
  .toBuffer({ resolveWithObject: true });
```

**After (Python with Pillow):**
```python
from PIL import Image
import numpy as np

with Image.open(image_path) as img:
    img.thumbnail((MAX_DIM, MAX_DIM), Image.Resampling.LANCZOS)
    data = np.array(img)
    pixels = data.reshape(-1, 3)
```

### Color Distance Calculation

**Before (TypeScript):**
```typescript
function dist2(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}
```

**After (Python):**
```python
def color_distance_squared(
    c1: Tuple[int, int, int], 
    c2: Tuple[int, int, int]
) -> float:
    dr = c1[0] - c2[0]
    dg = c1[1] - c2[1]
    db = c1[2] - c2[2]
    return dr * dr + dg * dg + db * db
```

### Histogram Bucketing

**Before (TypeScript):**
```typescript
const BUCKET = 24;
const hist = new Map<string, { r: number; g: number; b: number; count: number }>();

for (let i = 0; i < data.length; i += channels) {
  const br = Math.round(r / BUCKET) * BUCKET;
  const bg = Math.round(g / BUCKET) * BUCKET;
  const bb = Math.round(b / BUCKET) * BUCKET;
  const key = `${br},${bg},${bb}`;
  // ... counting logic
}
```

**After (Python with NumPy):**
```python
BUCKET_SIZE = 24
bucketed = (opaque_pixels // BUCKET_SIZE) * BUCKET_SIZE
unique_colors, counts = np.unique(bucketed, axis=0, return_counts=True)
sorted_indices = np.argsort(counts)[::-1]
ranked_colors = unique_colors[sorted_indices]
```

### CSS Export

**Before (TypeScript):**
```typescript
function toCssVars(cs: ColorSystem) {
  const lines: string[] = [];
  if (assertHex(primary)) lines.push(`  --color-primary: ${primary};`);
  // ...
  return `:root {\n${lines.join("\n")}\n}\n`;
}
```

**After (Python):**
```python
def export_css_variables(color_system: Dict[str, Any]) -> str:
    lines = ["/* hexed export: css_variables */"]
    if primary:
        lines.append(f"  --color-primary: {primary};")
    # ...
    return ":root {\n" + "\n".join(lines[1:]) + "\n}\n"
```

## Key Differences

### 1. API vs Function Calls

**Before**: HTTP POST requests to `/api/compile`
**After**: Direct Python function calls

```python
# No HTTP, just import and call
from hexed_compiler import compile_from_images
result = compile_from_images(image_paths)
```

### 2. File Handling

**Before**: FormData with multipart/form-data
**After**: Direct file paths

```python
# Images come from user uploads
image_paths = ['/mnt/user-data/uploads/image.png']
```

### 3. Response Format

**Before**: NextResponse.json() with HTTP status codes
**After**: Python dictionaries

```python
return {
    "ok": True,
    "color_system": {...},
    "debug": {...}
}
```

### 4. Error Handling

**Before**: HTTP error responses (400, 413, etc.)
**After**: Return dicts with error info

```python
if len(image_paths) > 5:
    return {
        "ok": False,
        "error": "too_many_images",
        "message": "Maximum 5 images"
    }
```

## Performance Notes

### Memory Usage
- **Next.js**: Sharp handles large files efficiently
- **Python**: Pillow + NumPy are also efficient, but keep MAX_DIM=768

### Speed
- **Next.js**: Fast for single requests
- **Python**: Similar speed, NumPy operations are vectorized

### Concurrency
- **Next.js**: Handles concurrent requests via Node.js
- **Python Skill**: Runs in isolated Claude sessions (no concurrency needed)

## What Stayed the Same

✅ **Algorithm**: Exact same color extraction logic
✅ **Output Structure**: Identical JSON structure
✅ **Export Formats**: Same CSS, Tailwind, Figma outputs
✅ **Color System**: Same core/semantic/neutral structure

## What Improved

✨ **Simpler**: No HTTP layer, no routing
✨ **Self-contained**: Everything in 3 Python files
✨ **Native to Claude**: Direct integration with Claude's computer
✨ **Type hints**: Python type hints for better clarity

## Migration Checklist

If you want to add features from your Next.js version:

- [ ] Port any custom color extraction modes
- [ ] Add any additional export formats you created
- [ ] Update SKILL.md with new features
- [ ] Test with your original test images
- [ ] Update version number

## Future Enhancements

Consider adding (not in Next.js version):

1. **Color harmony analysis** - Complementary, analogous, triadic
2. **Accessibility checking** - WCAG contrast ratios
3. **Color interpolation** - Generate gradients between colors
4. **Advanced clustering** - k-means or DBSCAN for better color extraction
5. **Perceptual color spaces** - LAB or LCH for more accurate distance

## Questions?

The core logic is preserved - if something worked in Next.js, it should work the same way in Python. The main difference is the interface: HTTP API → Python functions.

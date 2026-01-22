"""
Hexed Color System Compiler
Extracts colors from images and builds structured color systems.
"""

import io
import json
from datetime import datetime
from typing import List, Dict, Any, Tuple
from PIL import Image
import numpy as np


MAX_DIM = 768
BUCKET_SIZE = 24  # Color quantization bucket size
MIN_COLOR_DISTANCE = 40  # Minimum distance between picked colors


def clamp_byte(n: int) -> int:
    """Clamp value to valid byte range (0-255)."""
    return max(0, min(255, n))


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """Convert RGB values to hex color string."""
    rr = f"{clamp_byte(r):02x}"
    gg = f"{clamp_byte(g):02x}"
    bb = f"{clamp_byte(b):02x}"
    return f"#{rr}{gg}{bb}".upper()


def color_distance_squared(c1: Tuple[int, int, int], c2: Tuple[int, int, int]) -> float:
    """Calculate squared Euclidean distance between two RGB colors."""
    dr = c1[0] - c2[0]
    dg = c1[1] - c2[1]
    db = c1[2] - c2[2]
    return dr * dr + dg * dg + db * db


def process_image(image_path: str, filename: str) -> Dict[str, Any]:
    """
    Process a single image and extract color information.
    
    Returns debug info including:
    - Average color
    - Sample colors
    - Draft palette (top 8 distinct colors)
    """
    # Open and get metadata
    with Image.open(image_path) as img:
        original_format = img.format
        original_size = img.size
        original_mode = img.mode
        
        # Convert to RGB if needed
        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGB')
        
        # Resize to bound computation
        img.thumbnail((MAX_DIM, MAX_DIM), Image.Resampling.LANCZOS)
        resized_size = img.size
        
        # Convert to numpy array
        if img.mode == 'RGBA':
            data = np.array(img)
            rgb_data = data[:, :, :3]
            alpha = data[:, :, 3]
            # Mask for non-transparent pixels
            opaque_mask = alpha > 0
        else:
            data = np.array(img)
            rgb_data = data
            opaque_mask = np.ones(img.size[::-1], dtype=bool)
        
        # Flatten for easier processing
        pixels = rgb_data.reshape(-1, 3)
        opaque_pixels = pixels[opaque_mask.flatten()]
        
        if len(opaque_pixels) == 0:
            # Fully transparent image, use all pixels
            opaque_pixels = pixels
        
        # Calculate average color
        avg_color = tuple(map(int, np.mean(opaque_pixels, axis=0)))
        avg_hex = rgb_to_hex(*avg_color)
        
        # Sample 10 evenly-spaced pixels
        sample_indices = np.linspace(0, len(opaque_pixels) - 1, min(10, len(opaque_pixels)), dtype=int)
        samples = [tuple(map(int, opaque_pixels[i])) for i in sample_indices]
        sample_hex = [rgb_to_hex(*s) for s in samples]
        
        # Build histogram with bucketing
        bucketed = (opaque_pixels // BUCKET_SIZE) * BUCKET_SIZE
        bucketed = bucketed.astype(np.uint8)
        
        # Count occurrences
        unique_colors, counts = np.unique(bucketed, axis=0, return_counts=True)
        
        # Sort by frequency
        sorted_indices = np.argsort(counts)[::-1]
        ranked_colors = unique_colors[sorted_indices]
        
        # Pick top distinct colors
        picked_colors = []
        for color in ranked_colors:
            if len(picked_colors) >= 8:
                break
            
            color_tuple = tuple(map(int, color))
            
            # Check if sufficiently different from already picked colors
            is_distinct = all(
                color_distance_squared(color_tuple, picked) >= MIN_COLOR_DISTANCE ** 2
                for picked in picked_colors
            )
            
            if is_distinct:
                picked_colors.append(color_tuple)
        
        draft_palette_hex = [rgb_to_hex(*c) for c in picked_colors]
        
        return {
            "filename": filename,
            "format": original_format,
            "input": {
                "width": original_size[0],
                "height": original_size[1],
                "mode": original_mode
            },
            "resized": {
                "width": resized_size[0],
                "height": resized_size[1]
            },
            "avg_hex": avg_hex,
            "avg_rgb": {"r": avg_color[0], "g": avg_color[1], "b": avg_color[2]},
            "sample_hex": sample_hex,
            "sample_rgb": [{"r": s[0], "g": s[1], "b": s[2]} for s in samples],
            "draft_palette_hex": draft_palette_hex,
            "pixels": {
                "width": resized_size[0],
                "height": resized_size[1],
                "used_pixel_count": len(opaque_pixels)
            }
        }


def build_color_system(
    debug_images: List[Dict[str, Any]],
    mode: str = "ui_first"
) -> Dict[str, Any]:
    """
    Build a complete color system from processed image data.
    
    Args:
        debug_images: List of processed image debug info
        mode: Either "ui_first" or "brand_first"
    
    Returns:
        Complete color system structure
    """
    # Extract palette from first image
    first_image = debug_images[0]
    palette = first_image.get("draft_palette_hex", [])
    
    def pick(index: int, fallback: str) -> str:
        """Pick color from palette or use fallback."""
        return palette[index] if index < len(palette) else fallback
    
    color_system = {
        "version": "1.0",
        "meta": {
            "id": "cs_generated",
            "mode": mode,
            "source": {
                "image_count": len(debug_images),
                "max_dim": MAX_DIM,
                "notes": "generated from uploaded images"
            },
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "engine": {
                "name": "hexed",
                "engine_version": "0.2.0"
            }
        },
        "colors": {
            "core": {
                "primary": {"hex": pick(5, "#3B6EF5"), "space": "srgb"},
                "secondary": {"hex": pick(3, "#1CC7A1"), "space": "srgb"},
                "accent": {"hex": pick(4, "#FF4D6D"), "space": "srgb"}
            },
            "neutrals": {
                "ramp": [
                    {"step": 50, "hex": "#F7F8FA"},
                    {"step": 100, "hex": "#EDF0F4"},
                    {"step": 200, "hex": "#D8DEE8"},
                    {"step": 300, "hex": "#C3CCDA"},
                    {"step": 400, "hex": "#A5B1C5"},
                    {"step": 500, "hex": "#7E8AA3"},
                    {"step": 600, "hex": "#5C667D"},
                    {"step": 700, "hex": "#3F475A"},
                    {"step": 800, "hex": "#2A2F3D"},
                    {"step": 900, "hex": "#151825"}
                ],
                "intent": "cool_neutral"
            },
            "semantic": {
                "success": {"hex": "#1DB954", "space": "srgb"},
                "warning": {"hex": "#F5A623", "space": "srgb"},
                "error": {"hex": "#E02424", "space": "srgb"},
                "info": {"hex": pick(5, "#3B6EF5"), "space": "srgb"}
            }
        },
        "ui": {
            "themes": {
                "light": {
                    "background": {"hex": "#F7F8FA"},
                    "surface": {"hex": "#FFFFFF"},
                    "surface_muted": {"hex": "#EDF0F4"},
                    "text": {"hex": "#151825"},
                    "text_muted": {"hex": "#3F475A"},
                    "border": {"hex": "#D8DEE8"},
                    "focus": {"hex": pick(5, "#3B6EF5")},
                    "primary": {"hex": pick(5, "#3B6EF5")},
                    "primary_on": {"hex": "#FFFFFF"},
                    "secondary": {"hex": pick(3, "#1CC7A1")},
                    "secondary_on": {"hex": "#0B1B16"},
                    "accent": {"hex": pick(4, "#FF4D6D")},
                    "accent_on": {"hex": "#2A0B12"},
                    "success": {"hex": "#1DB954"},
                    "warning": {"hex": "#F5A623"},
                    "error": {"hex": "#E02424"}
                },
                "dark": {
                    "background": {"hex": "#151825"},
                    "surface": {"hex": "#1D2233"},
                    "surface_muted": {"hex": "#2A2F3D"},
                    "text": {"hex": "#F7F8FA"},
                    "text_muted": {"hex": "#C3CCDA"},
                    "border": {"hex": "#3F475A"},
                    "focus": {"hex": pick(5, "#3B6EF5")},
                    "primary": {"hex": pick(5, "#3B6EF5")},
                    "primary_on": {"hex": "#FFFFFF"},
                    "secondary": {"hex": pick(3, "#1CC7A1")},
                    "secondary_on": {"hex": "#04110E"},
                    "accent": {"hex": pick(4, "#FF4D6D")},
                    "accent_on": {"hex": "#1A070C"},
                    "success": {"hex": "#1DB954"},
                    "warning": {"hex": "#F5A623"},
                    "error": {"hex": "#E02424"}
                }
            }
        },
        "validation": {
            "wcag": {
                "standard": "WCAG2.2",
                "text_size_assumption": "normal",
                "target": "AA",
                "pairs": [],
                "failures": []
            },
            "print": {
                "method": "approx",
                "warnings": []
            }
        },
        "exports": {
            "available": ["css_variables", "tailwind_config", "figma_tokens_json"],
            "notes": "Exports generated on demand."
        }
    }
    
    return color_system


def compile_from_images(
    image_paths: List[str],
    mode: str = "ui_first"
) -> Dict[str, Any]:
    """
    Main entry point: compile color system from image files.
    
    Args:
        image_paths: List of paths to image files (1-5 images)
        mode: "ui_first" or "brand_first"
    
    Returns:
        Dict with keys: ok, debug, color_system, received
    """
    if len(image_paths) == 0:
        return {
            "ok": False,
            "error": "missing_images",
            "message": "Provide 1-5 image paths"
        }
    
    if len(image_paths) > 5:
        return {
            "ok": False,
            "error": "too_many_images",
            "message": "Maximum 5 images allowed"
        }
    
    # Process all images
    debug_images = []
    for path in image_paths:
        try:
            import os
            filename = os.path.basename(path)
            debug_info = process_image(path, filename)
            debug_images.append(debug_info)
        except Exception as e:
            return {
                "ok": False,
                "error": "image_processing_failed",
                "message": f"Failed to process {path}: {str(e)}"
            }
    
    # Build color system
    color_system = build_color_system(debug_images, mode)
    
    return {
        "ok": True,
        "received": [
            {
                "filename": img["filename"],
                "format": img["format"],
                "input": img["input"]
            }
            for img in debug_images
        ],
        "debug": {
            "images": debug_images
        },
        "color_system": color_system
    }


if __name__ == "__main__":
    # Test with command line
    import sys
    if len(sys.argv) < 2:
        print("Usage: python hexed_compiler.py <image1> [image2] [image3] ...")
        sys.exit(1)
    
    result = compile_from_images(sys.argv[1:])
    print(json.dumps(result, indent=2))

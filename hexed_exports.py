"""
Hexed Export Utilities
Convert color systems to various formats: CSS, Tailwind, Figma tokens.
"""

import json
import re
from typing import Dict, Any, Optional


def is_valid_hex(value: Any) -> bool:
    """Check if value is a valid hex color string."""
    if not isinstance(value, str):
        return False
    return bool(re.match(r'^#[0-9A-Fa-f]{6}$', value))


def safe_var_name(name: str) -> str:
    """Convert name to safe CSS variable name."""
    return re.sub(r'[^a-z0-9_-]', '-', name.lower())


def get_hex_value(obj: Any) -> Optional[str]:
    """Extract hex value from various object formats."""
    if isinstance(obj, str):
        return obj if is_valid_hex(obj) else None
    if isinstance(obj, dict) and 'hex' in obj:
        return obj['hex'] if is_valid_hex(obj['hex']) else None
    return None


def export_css_variables(color_system: Dict[str, Any]) -> str:
    """
    Export color system as CSS variables.
    
    Returns CSS string with :root and theme-specific variable definitions.
    """
    lines = ["/* hexed export: css_variables */"]
    
    colors = color_system.get('colors', {})
    
    # Core colors
    core = colors.get('core', {})
    primary = get_hex_value(core.get('primary'))
    secondary = get_hex_value(core.get('secondary'))
    accent = get_hex_value(core.get('accent'))
    
    if primary:
        lines.append(f"  --color-primary: {primary};")
    if secondary:
        lines.append(f"  --color-secondary: {secondary};")
    if accent:
        lines.append(f"  --color-accent: {accent};")
    
    # Semantic colors
    semantic = colors.get('semantic', {})
    for key in ['success', 'warning', 'error', 'info']:
        hex_val = get_hex_value(semantic.get(key))
        if hex_val:
            lines.append(f"  --color-{key}: {hex_val};")
    
    # Neutral ramp
    ramp = colors.get('neutrals', {}).get('ramp', [])
    for item in ramp:
        if isinstance(item, dict):
            step = item.get('step')
            hex_val = item.get('hex')
            if step is not None and is_valid_hex(hex_val):
                lines.append(f"  --neutral-{step}: {hex_val};")
    
    # Build root block
    root_block = ":root {\n" + "\n".join(lines[1:]) + "\n}\n" if len(lines) > 1 else ":root {\n  /* no vars generated */\n}\n"
    
    # Theme-specific tokens
    ui_themes = color_system.get('ui', {}).get('themes', {})
    light_theme = ui_themes.get('light', {})
    dark_theme = ui_themes.get('dark', {})
    
    light_lines = []
    for key, value in light_theme.items():
        hex_val = get_hex_value(value)
        if hex_val:
            light_lines.append(f"  --{safe_var_name(key)}: {hex_val};")
    
    dark_lines = []
    for key, value in dark_theme.items():
        hex_val = get_hex_value(value)
        if hex_val:
            dark_lines.append(f"  --{safe_var_name(key)}: {hex_val};")
    
    light_block = ""
    if light_lines:
        light_block = '\n/* Suggested mapping */\n[data-theme="light"] {\n' + "\n".join(light_lines) + "\n}\n"
    
    dark_block = ""
    if dark_lines:
        dark_block = '\n[data-theme="dark"] {\n' + "\n".join(dark_lines) + "\n}\n"
    
    return root_block + light_block + dark_block


def export_tailwind_config(color_system: Dict[str, Any]) -> str:
    """
    Export color system as Tailwind config.
    
    Returns JavaScript module string that can be merged into tailwind.config.js
    """
    colors = color_system.get('colors', {})
    
    config_colors = {}
    
    # Core colors
    core = colors.get('core', {})
    primary = get_hex_value(core.get('primary'))
    secondary = get_hex_value(core.get('secondary'))
    accent = get_hex_value(core.get('accent'))
    
    if primary:
        config_colors['primary'] = primary
    if secondary:
        config_colors['secondary'] = secondary
    if accent:
        config_colors['accent'] = accent
    
    # Semantic colors
    semantic = colors.get('semantic', {})
    for key in ['success', 'warning', 'error', 'info']:
        hex_val = get_hex_value(semantic.get(key))
        if hex_val:
            config_colors[key] = hex_val
    
    # Neutral ramp
    ramp = colors.get('neutrals', {}).get('ramp', [])
    neutral_ramp = {}
    for item in ramp:
        if isinstance(item, dict):
            step = item.get('step')
            hex_val = item.get('hex')
            if step is not None and is_valid_hex(hex_val):
                neutral_ramp[str(step)] = hex_val
    
    if neutral_ramp:
        config_colors['neutral'] = neutral_ramp
    
    config = {
        "theme": {
            "extend": {
                "colors": config_colors
            }
        }
    }
    
    return f"""// hexed export: tailwind_config
export default {json.dumps(config, indent=2)};
"""


def export_figma_tokens(color_system: Dict[str, Any]) -> Dict[str, Any]:
    """
    Export color system as Figma-compatible token JSON.
    
    Returns dict structure compatible with Tokens Studio for Figma.
    """
    colors = color_system.get('colors', {})
    ui = color_system.get('ui', {})
    meta = color_system.get('meta', {})
    
    tokens = {
        "$metadata": {
            "name": "Hexed",
            "generated_at": meta.get('generated_at', ''),
            "engine": meta.get('engine'),
            "mode": meta.get('mode'),
            "version": color_system.get('version')
        },
        "colors": {
            "core": {},
            "semantic": {},
            "neutrals": {},
            "ui": {
                "light": {},
                "dark": {}
            }
        }
    }
    
    # Core colors
    core = colors.get('core', {})
    for key, value in core.items():
        hex_val = get_hex_value(value)
        if hex_val:
            tokens['colors']['core'][key] = {
                "value": hex_val,
                "type": "color"
            }
    
    # Semantic colors
    semantic = colors.get('semantic', {})
    for key, value in semantic.items():
        hex_val = get_hex_value(value)
        if hex_val:
            tokens['colors']['semantic'][key] = {
                "value": hex_val,
                "type": "color"
            }
    
    # Neutral ramp
    ramp = colors.get('neutrals', {}).get('ramp', [])
    for item in ramp:
        if isinstance(item, dict):
            step = item.get('step')
            hex_val = item.get('hex')
            if step is not None and is_valid_hex(hex_val):
                tokens['colors']['neutrals'][str(step)] = {
                    "value": hex_val,
                    "type": "color"
                }
    
    # UI themes
    themes = ui.get('themes', {})
    light = themes.get('light', {})
    dark = themes.get('dark', {})
    
    for key, value in light.items():
        hex_val = get_hex_value(value)
        if hex_val:
            tokens['colors']['ui']['light'][key] = {
                "value": hex_val,
                "type": "color"
            }
    
    for key, value in dark.items():
        hex_val = get_hex_value(value)
        if hex_val:
            tokens['colors']['ui']['dark'][key] = {
                "value": hex_val,
                "type": "color"
            }
    
    return {
        "ok": True,
        "export": {
            "format": "figma_tokens_json",
            "filename": "hexed.tokens.json"
        },
        "tokens": tokens
    }


if __name__ == "__main__":
    # Test with sample color system
    sample_system = {
        "version": "1.0",
        "colors": {
            "core": {
                "primary": {"hex": "#3B6EF5"},
                "secondary": {"hex": "#1CC7A1"},
                "accent": {"hex": "#FF4D6D"}
            }
        }
    }
    
    print("=== CSS Variables ===")
    print(export_css_variables(sample_system))
    
    print("\n=== Tailwind Config ===")
    print(export_tailwind_config(sample_system))
    
    print("\n=== Figma Tokens ===")
    print(json.dumps(export_figma_tokens(sample_system), indent=2))

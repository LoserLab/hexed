# Installing Hexed

Hexed is available as a Claude Skill for use in conversations with Claude.

## For Users

### Install from Claude Skills Marketplace

1. Go to [claude.ai](https://claude.ai)
2. Navigate to **Settings** → **Skills**
3. Search for **"Hexed"**
4. Click **"Add Skill"**
5. Start a new conversation and upload images

### Usage

Once installed, simply:
1. Upload 1-5 images (PNG, JPG, or WebP)
2. Ask Claude to extract colors: *"Extract colors from these images"*
3. Request your preferred export format: *"Give me CSS variables"*

## For Developers

### Running Locally

If you want to use Hexed outside of Claude:

```bash
# Clone the repository
git clone https://github.com/yourusername/hexed-skill.git
cd hexed-skill

# Install dependencies
pip install pillow numpy

# Run on your images
python test_hexed.py path/to/image1.png path/to/image2.jpg
```

### Integration

```python
from hexed_compiler import compile_from_images
from hexed_exports import export_css_variables

# Process images
result = compile_from_images(['image1.png', 'image2.jpg'])

if result['ok']:
    color_system = result['color_system']
    
    # Export to CSS
    css = export_css_variables(color_system)
    print(css)
```

## Requirements

- Python 3.8+
- Pillow (PIL)
- NumPy

All dependencies are included in Claude's environment.

## Support

- **Issues**: [GitHub Issues]TBA
- **Documentation**: See [README.md](README.md)
- **Author**: [@heathenft](https://x.com/heathenft)

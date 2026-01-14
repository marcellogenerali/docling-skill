# DoclingConverter

A streamlined Claude Code skill for converting documents to markdown using [Docling](https://github.com/docling-project/docling). Pure Docling output with page-organized external images.

## Design Philosophy

This skill prioritizes simplicity and reliability:
- ✅ Pure Docling conversion (no post-processing)
- ✅ Predictable output (same input = same output)
- ✅ Zero API costs (no LLM calls)
- ✅ Fast processing (native Docling speed)
- ✅ Scalable image organization (page-based folders for knowledge bases)

## Features

- **Multi-format support**: PDF, DOCX, XLSX, HTML, Markdown, images (PNG, JPG, TIFF)
- **Page-organized images**: Images saved in page-based subdirectories for easy navigation
- **Knowledge base ready**: Scales efficiently to hundreds of images
- **Structure preservation**: Tables, lists, code blocks, hyperlinks, ASCII art
- **Clean metadata**: YAML frontmatter with document metrics
- **Pure Docling output**: No LLM processing, fast and predictable
- **Local processing**: Zero API costs, all conversion happens locally

## Image Organization

Images are automatically organized by page number:

```
document-images/
  page-001/
    image-001.png
    image-002.png
  page-002/
    image-003.png
```

This structure:
- Makes it easy to find images by page
- Scales efficiently to hundreds of images
- Provides clear context for each image
- Perfect for converting entire knowledge bases

## Prerequisites

### 1. Docling CLI (Required)

```bash
pip install "docling>=2.67.0"
```

Verify installation:
```bash
docling --version
```

### 2. Bun Runtime (Required)

```bash
curl -fsSL https://bun.sh/install | bash
```

## Installation

### Quick Install (User-level)

```bash
git clone https://github.com/yourusername/docling-skill.git
cd docling-skill
./install.sh
```

### Manual Install

```bash
# Clone the repository
git clone https://github.com/yourusername/docling-skill.git
cd docling-skill

# Copy to Claude Code skills directory
mkdir -p ~/.claude/skills
cp -r DoclingConverter ~/.claude/skills/

# Install dependencies
cd ~/.claude/skills/DoclingConverter
bun install
```

### Session-only Install

For testing without permanent installation:

```bash
# From the repository root
cd DoclingConverter && bun install && cd ..

# Then reference directly in prompts:
# "Use bun run /path/to/docling-skill/DoclingConverter/Tools/Convert.ts"
```

## Usage

### Slash Command

```
/docling report.pdf
```

### Natural Language

```
Convert report.pdf to markdown
Convert document.docx to markdown
Convert scanned.pdf using OCR
```

### Direct Tool Invocation

```bash
# Basic conversion
bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts document.pdf

# With options
bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts document.pdf --ocr

# Custom assets directory
bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts document.pdf --assets-dir custom-images
```

### Options

| Option | Description |
|--------|-------------|
| `--output, -o <path>` | Custom output path |
| `--assets-dir <path>` | Custom assets directory (default: {name}-images/) |
| `--ocr` | Force OCR processing for scanned documents |
| `--vlm` | Use Vision Language Model pipeline |
| `--help, -h` | Show help |

## Output Format

Converted files include YAML frontmatter with metadata:

```yaml
---
title: "Document Title"
source_file: "document.pdf"
source_format: "pdf"
source_hash: "sha256:..."
source_size_bytes: 12345
converted_at: "2026-01-14T10:30:00Z"
converter: "docling"
converter_version: "2.67.0"
skill_version: "5.0.0"
page_count: 12
word_count: 5420
image_count: 8
---

# Document Content

[Converted markdown content with page-organized external images]

Example image reference:
![Image 1](./document-images/page-001/image-001.png)
```

## Supported Formats

- **Documents**: PDF, DOCX, XLSX
- **Web**: HTML
- **Markup**: Markdown
- **Images**: PNG, JPG, JPEG, TIFF

## Project Structure

```
docling-skill/
├── DoclingConverter/           # Claude Code skill
│   ├── SKILL.md               # Skill manifest
│   ├── VERSION                # Current version
│   ├── package.json           # Dependencies
│   ├── Tools/
│   │   └── Convert.ts         # Main conversion tool
│   └── Lib/
│       ├── Types.ts           # TypeScript interfaces
│       ├── DoclingClient.ts   # Docling CLI wrapper
│       ├── ImageProcessor.ts  # Image extraction/saving
│       └── MetadataBuilder.ts # YAML frontmatter builder
├── install.sh                 # Installation script
├── .gitignore
└── README.md
```

## Development

### Running Tests

```bash
cd DoclingConverter
bun run Tools/Convert.ts --help
bun run Tools/Convert.ts /path/to/test.pdf
```

### Modifying the Skill

1. Edit files in `DoclingConverter/`
2. Test locally with direct bun invocation
3. Copy updated skill to `~/.claude/skills/DoclingConverter/`

## Troubleshooting

### "Docling CLI not found"

Ensure docling is in your PATH:
```bash
# Check if docling is accessible
which docling || echo "Not found"

# If installed via pip but not in PATH, add to shell config:
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
```

### "Unsupported format"

Check that your file format is supported (PDF, DOCX, XLSX, HTML, MD, PNG, JPG, TIFF).

## Version History

- **5.0.0** (Current) - Always use external images with page-based organization
- **4.1.0** - Removed PowerPoint support, streamlined codebase
- **4.0.0** - Added external images mode with `--external-images` flag
- **3.0.0** - Simplified to pure Docling output, removed LLM processing
- **2.0.0** - PRD for LLM-enhanced version (not fully implemented)
- **1.x** - Initial prototypes

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with various document types
5. Submit a pull request

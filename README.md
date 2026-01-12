# DoclingConverter

A Claude Code skill for converting documents to AI-embedding-ready markdown using [Docling](https://github.com/docling-project/docling).

## Features

- **Multi-format support**: PDF, DOCX, PPTX, XLSX, HTML, MD, images (PNG, JPG, TIFF), and audio (WAV, MP3, VTT)
- **Compressed images**: Base64-embedded images with Sharp compression (max 1200px, 80% JPEG quality)
- **AI-generated descriptions**: Image descriptions via Ollama InternVL3_5 or Claude Haiku fallback
- **Automatic translation**: All non-English content translated to English while preserving technical terms
- **Rich metadata**: YAML frontmatter with document identity, content metrics, and chunking hints
- **Batch processing**: Convert entire directories with resume capability

## Prerequisites

### 1. Docling CLI (Required)

```bash
pip3 install "docling>=2.67.0"
```

Verify installation:
```bash
docling --version
```

### 2. Bun Runtime (Required)

```bash
curl -fsSL https://bun.sh/install | bash
```

### 3. Ollama (Optional - for local image descriptions)

```bash
# Install Ollama
brew install ollama

# Pull the vision model
ollama pull blaifu/internVL3_5:4B
```

### 4. Anthropic API Key (Optional - for translation and Haiku fallback)

```bash
export ANTHROPIC_API_KEY="your-key-here"
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
Process all documents in /docs folder
Convert presentation.pptx using OCR
```

### Direct Tool Invocation

```bash
# Basic conversion
bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts document.pdf

# With options
bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts document.pdf --ocr --output ./output/

# Batch processing
bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts --batch ./documents/
```

### Options

| Option | Description |
|--------|-------------|
| `--output, -o <path>` | Custom output path |
| `--ocr` | Force OCR processing for scanned documents |
| `--vlm` | Use Vision Language Model pipeline |
| `--lang <code>` | Source language hint (e.g., "de", "fr", "it") |
| `--batch` | Process entire directory |
| `--help, -h` | Show help |

## Output Format

Converted files are saved with `.converted.md` extension and include:

```yaml
---
title: "Document Title"
source_file: "document.pdf"
source_format: pdf
converted_at: "2024-01-15T10:30:00Z"
converter: docling
page_count: 12
word_count: 5420
has_images: true
image_count: 8
has_tables: true
table_count: 3
translated_to: en
# ... additional metadata
---

# Document Content

[Converted markdown content with embedded images]

---
*Converted with DoclingConverter v2.0.0*
```

## Project Structure

```
docling-skill/
├── DoclingConverter/           # Claude Code skill
│   ├── SKILL.md               # Skill manifest
│   ├── package.json           # Dependencies
│   ├── tsconfig.json          # TypeScript config
│   ├── Tools/
│   │   └── Convert.ts         # Main conversion tool
│   ├── Lib/
│   │   ├── Types.ts           # TypeScript interfaces
│   │   ├── DoclingClient.ts   # Docling CLI wrapper
│   │   ├── ImageProcessor.ts  # Sharp image compression
│   │   ├── DescriptionGenerator.ts  # AI image descriptions
│   │   ├── Translator.ts      # LLM translation
│   │   └── MetadataBuilder.ts # YAML frontmatter builder
│   └── Workflows/
│       ├── Convert.md         # Single file workflow
│       └── BatchConvert.md    # Batch processing workflow
├── PRD.md                     # Product requirements
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

# If installed via pip3 but not in PATH, add to shell config:
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
```

### "Sharp installation failed"

Sharp requires native dependencies:
```bash
# macOS
xcode-select --install

# Then reinstall
cd ~/.claude/skills/DoclingConverter && bun install
```

### "Translation skipped: ANTHROPIC_API_KEY not set"

Set your API key:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Images not described

Either:
1. Start Ollama: `ollama serve`
2. Pull the model: `ollama pull blaifu/internVL3_5:4B`
3. Or set ANTHROPIC_API_KEY for Claude Haiku fallback

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with various document types
5. Submit a pull request

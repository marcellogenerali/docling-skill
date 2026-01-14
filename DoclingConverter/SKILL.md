---
name: DoclingConverter
description: Convert documents to markdown with Docling. USE WHEN user mentions convert document OR docling OR PDF to markdown OR extract text from PDF OR DOCX OR /docling.
invocation: /docling
---

# DoclingConverter

Streamlined document conversion using [Docling](https://github.com/docling-project/docling). Converts PDF, DOCX, XLSX, HTML, and images into markdown with page-organized external images.

## Features

- Converts documents to markdown using Docling natively
- Images saved as external PNG files organized by page
- Page-based folder structure (ideal for knowledge bases with hundreds of images)
- Minimal YAML frontmatter with document metadata
- No LLM processing required

## Usage

```bash
bun run $PAI_DIR/skills/DoclingConverter/Tools/Convert.ts <file_path> [options]
```

**Options:**
- `--output, -o <path>` - Custom output path
- `--assets-dir <path>` - Custom assets directory (default: {name}-images/)
- `--ocr` - Force OCR processing
- `--vlm` - Use Vision Language Model pipeline
- `--help, -h` - Show help

## Image Organization

Images are automatically saved in page-based subdirectories:
```
document-images/
  page-001/
    image-001.png
    image-002.png
  page-002/
    image-003.png
```

This structure:
- Makes it easy to navigate to specific pages
- Scales efficiently to hundreds of images
- Provides clear context for each image

## Examples

```
User: "Convert report.pdf to markdown"
-> bun run Convert.ts report.pdf
-> Output: report.md + report-images/ directory

User: "/docling document.docx"
-> bun run Convert.ts document.docx
-> Output: document.md + document-images/ directory

User: "Convert scanned.pdf using OCR"
-> bun run Convert.ts scanned.pdf --ocr
-> Output: scanned.md + scanned-images/ directory
```

## Supported Formats

PDF, DOCX, XLSX, HTML, Markdown, PNG, JPG, TIFF

## Output

- YAML frontmatter (title, source, hash, page/word/image counts)
- Markdown content with preserved structure
- External images in page-organized directories with relative paths

## Dependencies

**Required:** Python with `docling>=2.67.0`

```bash
pip install "docling>=2.67.0"
```

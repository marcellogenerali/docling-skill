# DoclingConverter Skill - Product Requirements Document

**Version:** 5.0.0
**Date:** 2026-01-14
**Status:** IMPLEMENTED

---

## Executive Summary

A streamlined Claude Code skill that converts documents from various formats into clean, structured markdown files using the Docling library. Pure Docling output with no LLM processing, featuring page-organized external images and comprehensive metadata for downstream processing.

---

## Problem Statement

When converting documents to markdown, users need:

1. **Format support** - Documents exist in PDF, DOCX, XLSX, HTML, and image formats
2. **Structure preservation** - Tables, code blocks, formulas, and reading order must be maintained
3. **Metadata tracking** - Standardized way to track document origin and processing info
4. **Scalable image organization** - Page-based folders for easy navigation and knowledge base conversion
5. **Clean output** - No unnecessary processing, pure Docling conversion

---

## Solution Overview

The `DoclingConverter` skill provides a streamlined command to convert any supported document into clean markdown with:

- Preserved document structure (tables, code, formulas, lists, hyperlinks)
- Page-organized external images (scales to hundreds of images)
- Clean YAML frontmatter metadata with document metrics
- Pure Docling output (no LLM processing overhead)
- ASCII art detection and preservation

---

## Supported Input Formats

| Format   | Extensions                           | Notes                                      |
| -------- | ------------------------------------ | ------------------------------------------ |
| PDF      | `.pdf`                              | Advanced layout understanding, OCR support |
| Word     | `.docx`                             | Full formatting preservation               |
| Excel    | `.xlsx`                             | Table extraction                           |
| HTML     | `.html`, `.htm`                   | Web page conversion                        |
| Markdown | `.md`                               | Re-processing/normalization                |
| Images   | `.png`, `.jpg`, `.jpeg`, `.tiff` | OCR-based extraction                       |

---

## Output Specification

### Output Location

- **Default:** Same directory as input file
- **Naming:** `<original_name>.md` (no .converted suffix)
- **Override:** User can specify custom output path via `--output` flag

### Image Handling

**Page-organized external images:** Images saved to page-based subdirectories with relative paths

### Markdown File Structure

```markdown
---
title: "Document Title"
source_file: "original_document.pdf"
source_format: "pdf"
source_hash: "sha256:abc123..."
source_size_bytes: 2458923
converted_at: "2026-01-14T10:30:00Z"
converter: "docling"
converter_version: "2.67.0"
skill_version: "5.0.0"
pipeline_used: "standard"
page_count: 15
word_count: 4523
image_count: 8
table_count: 4
list_count: 15
---

# Document Title

Content with **formatting** preserved, tables, lists, and hyperlinks maintained.

## Section with Image

![Image 1](./document-images/page-001/image-001.png)

## Section with Table

| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |

## Section with Code

```python
def example():
    return "Code blocks preserved"
```

## Section with List

- List item 1
- List item 2
- List item 3
```

### External Images Mode

When using `--external-images`, images are saved to `{document-name}-images/` directory:

```markdown
![Image 1](document-name-images/image_001.png)
![Image 2](document-name-images/image_002.png)
```

---

## Technical Architecture

### Design Principles

1. **Zero LLM dependencies** - Pure Docling conversion, no API calls
2. **Predictable output** - Same input always produces same output
3. **No hidden costs** - No API usage or compute charges
4. **Fast processing** - Native Docling speed without LLM overhead
5. **Flexible images** - User choice between embedded or external

---

## Skill Interface

### Trigger Conditions

The skill activates when the user explicitly requests document conversion:

- "Convert this PDF to markdown"
- "Convert document.docx"
- "/docling report.pdf"
- "Convert scanned.pdf using OCR"

### Primary Command

```bash
bun run Convert.ts <file_path> [options]
```

### Command-line Options

| Option                    | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `--output, -o <path>`    | Custom output path (default: same directory)       |
| `--external-images`      | Save images as files instead of embedding          |
| `--assets-dir <path>`    | Custom assets directory (default: {name}-images/)  |
| `--ocr`                  | Force OCR processing for scanned documents         |
| `--vlm`                  | Use Vision Language Model pipeline                 |
| `--help, -h`             | Show help message                                  |

### Usage Examples

```bash
# Basic conversion (embedded images)
bun run Convert.ts report.pdf

# Custom output path
bun run Convert.ts document.docx --output /output/doc.md

# External images
bun run Convert.ts report.pdf --external-images

# Custom assets directory
bun run Convert.ts report.pdf --external-images --assets-dir ./my-images

# OCR for scanned documents
bun run Convert.ts scanned.pdf --ocr
```

---

## Technical Stack

### Runtime Environment

- **Runtime:** Bun
- **Language:** TypeScript
- **Docling Interface:** CLI wrapper (`docling` command)
- **Image Processing:** External files saved in page-based subdirectories

### Dependencies

```json
{
  "dependencies": {
    "execa": "^9.0.0"
  },
  "devDependencies": {
    "@types/bun": "^1.3.5"
  }
}
```

System requirements:

```bash
# Python (for Docling CLI)
pip install docling>=2.67.0

# Bun runtime
curl -fsSL https://bun.sh/install | bash
```

### Skill Structure

```
DoclingConverter/
├── SKILL.md                      # Skill definition
├── VERSION                       # Version tracking
├── package.json                  # Dependencies
├── Tools/
│   └── Convert.ts                # Main conversion tool
└── Lib/
    ├── DoclingClient.ts          # Docling CLI wrapper
    ├── ImageProcessor.ts         # Image extraction/saving
    ├── MetadataBuilder.ts        # YAML frontmatter builder
    └── Types.ts                  # TypeScript interfaces
```

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    Convert.ts                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. VALIDATE                                            │
│     ├─ Check file exists                                │
│     ├─ Check format supported                           │
│     └─ Check docling installed                          │
│                                                         │
│  2. CONVERT (Docling CLI)                               │
│     └─ $ docling {input} --to json                      │
│                                                         │
│  3. PROCESS IMAGES                                      │
│     └─ Save to page-based subdirectories                │
│        (e.g., {name}-images/page-001/image-001.png)     │
│                                                         │
│  4. BUILD MARKDOWN                                      │
│     ├─ Traverse document tree recursively               │
│     ├─ Render elements in correct order                 │
│     ├─ Preserve structure (tables, lists, code)         │
│     ├─ Detect ASCII art (box drawing chars)             │
│     └─ Insert image references (external paths)         │
│                                                         │
│  5. GENERATE METADATA                                   │
│     └─ Compute frontmatter fields from docling output   │
│                                                         │
│  6. ASSEMBLE & WRITE                                    │
│     └─ Frontmatter + markdown → {input_name}.md         │
│                                                         │
│  7. CLEANUP                                             │
│     └─ Remove temporary docling files                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Image Processing

### Page-Organized External Images

Images are always saved as separate PNG files organized by page number:

```bash
document.md
document-images/
  ├── page-001/
  │   ├── image-001.png
  │   └── image-002.png
  ├── page-002/
  │   └── image-003.png
  └── page-003/
      ├── image-004.png
      └── image-005.png
```

Markdown references use relative paths with page context:

```markdown
![Image 1](./document-images/page-001/image-001.png)
![Image 2](./document-images/page-001/image-002.png)
![Image 3](./document-images/page-002/image-003.png)
```

**Advantages:**
- Smaller markdown files
- Easy navigation to specific pages
- Scales efficiently to hundreds of images
- Better for version control
- Clear context for each image (page number)
- Ideal for knowledge base conversion
- Images can be optimized separately

**Technical Details:**
- Page numbers extracted from Docling provenance data
- Page directories zero-padded (page-001, page-002, ...)
- Image filenames globally indexed (image-001, image-002, ...)
- Falls back to page-001 if no page information available

---

## Error Handling

| Error              | Behavior                              | Exit Code |
| ------------------ | ------------------------------------- | --------- |
| File not found     | Display error, exit                   | 1         |
| Unsupported format | Display error, exit                   | 1         |
| Docling not found  | Display installation instructions     | 1         |
| Docling failure    | Display docling error output          | 1         |
| Image extraction   | Log warning, continue without images  | 0         |
| Write failure      | Display error message                 | 1         |

---

## Success Criteria

1. **Format Support** - Successfully converts PDF, DOCX, XLSX, HTML, Markdown, and images
2. **Structure Preservation** - Tables, code blocks, lists, and headings render correctly
3. **Image Organization** - Page-based folder structure works reliably
4. **Metadata Accuracy** - Frontmatter fields populated correctly from docling output
5. **Performance** - Fast processing (typically under 30 seconds for standard documents)
6. **Reliability** - Consistent output for same input
7. **Error Messages** - Clear, actionable error messages
8. **Zero Dependencies** - No LLM APIs or external services required
9. **ASCII Art** - Box drawing characters preserved in code blocks
10. **Hyperlinks** - Links from source documents preserved

---

## Implementation Status

**Version:** 5.0.0
**Status:** ✅ IMPLEMENTED

### What Changed in v5.0.0

**Changed:**
- Images always saved externally (removed embedded mode)
- Page-based folder organization for images
- Removed `--external-images` flag (always enabled)

**Why:**
- Better scalability for knowledge base conversion
- Easier navigation with page-based folders
- Smaller markdown files
- Clearer image context with page numbers

### What Changed from v2.0.0

**Removed:**
- LLM-based image descriptions (internVL/Claude Haiku)
- Automatic translation to English
- Complex metadata (semantic hints, chunking recommendations)
- PowerPoint/PPTX support
- Batch processing with state management
- Audio/subtitle support
- Embedded image mode (v5.0.0)

**Added:**
- External images mode with page organization (v5.0.0)
- Custom assets directory option
- ASCII art detection and preservation
- Simplified, predictable output
- Zero API costs

**Design Philosophy:**
- Pure Docling conversion without post-processing
- Page-organized external images for scalability
- Fast, predictable, no hidden costs
- Simpler codebase, easier maintenance

---

## Version History

- **5.0.0** (2026-01-14) - Current version, always use external images with page-based organization
- **4.1.0** - Removed PowerPoint support
- **4.0.0** - Added external images mode
- **3.0.0** - Simplified to vanilla Docling output, removed LLM processing
- **2.0.0** - PRD for LLM-enhanced version (not fully implemented)
- **1.x** - Initial prototypes

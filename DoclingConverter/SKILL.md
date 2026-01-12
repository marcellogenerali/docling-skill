---
name: DoclingConverter
description: Convert documents to AI-embedding-ready markdown with Docling. USE WHEN user mentions convert document OR docling OR PDF to markdown OR process document for embedding OR extract text from PDF OR DOCX OR PPTX OR batch convert documents OR /docling.
invocation: /docling
---

# DoclingConverter

Document conversion skill using [Docling](https://github.com/docling-project/docling) for parsing PDF, DOCX, PPTX, XLSX, HTML, images, and audio into structured, embedding-ready markdown with rich metadata.

## Features

- Converts 10+ document formats (PDF, DOCX, PPTX, XLSX, HTML, MD, images, audio, VTT)
- Compressed base64-embedded images with AI-generated descriptions
- Automatic translation to English
- Rich YAML frontmatter optimized for chunking/embedding pipelines
- Batch processing with resume capability

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Convert** | "convert document", "docling", single file path | `Workflows/Convert.md` |
| **BatchConvert** | "convert all", "batch convert", directory path | `Workflows/BatchConvert.md` |

## Tool

Single consolidated tool:

```bash
bun run $PAI_DIR/skills/DoclingConverter/Tools/Convert.ts <file_path> [options]
```

**Options:**
- `--output, -o <path>` - Custom output path (default: same directory)
- `--ocr` - Force OCR processing
- `--vlm` - Use Vision Language Model pipeline
- `--lang <code>` - Source language hint (e.g., "de", "fr")
- `--batch` - Process directory of files
- `--help, -h` - Show help

## Examples

**Example 1: Convert single PDF**
```
User: "Convert report.pdf to markdown"
-> Invokes Convert workflow
-> Runs Docling CLI, processes images, generates metadata
-> Returns report.converted.md in same directory
```

**Example 2: Batch convert folder**
```
User: "Convert all PDFs in /docs folder"
-> Invokes BatchConvert workflow
-> Processes sequentially with progress tracking
-> Creates .docling-work/ for resume capability
```

**Example 3: Convert with OCR**
```
User: "Convert scanned.pdf using OCR"
-> Invokes Convert workflow with --ocr flag
-> Uses Docling's OCR pipeline
-> Returns converted markdown
```

**Example 4: Use slash command**
```
User: "/docling presentation.pptx"
-> Invokes Convert workflow
-> Converts PowerPoint to markdown with slide structure
```

## Output Format

Converted files include:
- YAML frontmatter with document identity, processing info, content metrics
- Preserved structure (headings, tables, code blocks, lists)
- Compressed base64 images with contextual descriptions
- Conversion footer with provenance

## Dependencies

**System:**
- Python with `docling>=2.67.0`
- Optional: Ollama with `blaifa/InternVL3_5:4B` for local image descriptions

**Node (auto-installed):**
- sharp, ollama, @anthropic-ai/sdk, yaml, execa

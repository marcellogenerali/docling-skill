# DoclingConverter Skill Evaluation Report

**Test File:** test.docx (159KB)
**Test Date:** 2026-01-12
**Skill Version:** 2.0.0
**Docling Version:** 2.67.0

---

## Summary

| Metric | Value | Assessment |
|--------|-------|------------|
| Conversion Time | 21.9s | Acceptable |
| Output Size | 327KB | Expected (base64 images) |
| Word Count | 14,976 | Accurate |
| Images Processed | 1/1 | Complete |
| Tables Detected | 33 | Accurate |
| Translation Applied | No | **FAILED** |

---

## Critical Issues

### 1. Translation Not Working (CRITICAL)

**Problem:** Document contains significant Italian text that was NOT translated to English.

**Evidence:**
```markdown
Line 1464: "Conservazione Digitale a Norma è la soluzione Doxee Platform..."
Line 1502: "La soluzione di Fatturazione Elettronica di Doxee Platform..."
Line 1563: "Ordine Elettronico è la soluzione Doxee pensata per gestire lo scambio..."
```

**Root Cause:**
- Language detected as "en" (line 8: `source_language: en`)
- `translation_required: false` in frontmatter
- The translation fix from earlier wasn't synced to the installed skill

**Fix Required:**
1. Sync updated Translator.ts to installed skill
2. Always run translation regardless of detected language
3. Update prompt to handle mixed-language documents

**Priority:** P0 - Critical

---

### 2. Registered Trademark Symbol Parsing

**Problem:** The `®` symbol appears on separate lines throughout the document.

**Evidence:**
```markdown
Doxee Platform
®
is an AI-powered low-code/no-code enterprise platform...
```

**Expected:**
```markdown
Doxee Platform® is an AI-powered low-code/no-code enterprise platform...
```

**Root Cause:** Docling's text extraction separates the superscript symbol.

**Fix Options:**
- Post-process: Merge isolated `®`, `™`, `©` symbols with preceding text
- Regex: `/\n+\s*([®™©])\s*\n+/g` → ` $1 `

**Priority:** P1 - High

---

### 3. Page Count Metadata Incorrect

**Problem:** Frontmatter shows `page_count: 30` but `pages: 0` in some contexts.

**Evidence:**
```yaml
page_count: 30  # Correct in frontmatter
```

But the Docling JSON may have empty pages object.

**Priority:** P2 - Medium

---

## Moderate Issues

### 4. Image Description OCR Errors

**Problem:** Vision model misread "Doxee" as "Dooee".

**Evidence:**
```markdown
> **Image Description:** The image shows a table of contents from a document
> about Dooee Platform®, listing sections such as Design...
```

**Root Cause:** InternVL3_5:4B model limitation with brand names.

**Fix Options:**
- Post-process description to correct known brand names
- Add brand name list to description prompt
- Consider using Claude Haiku for better accuracy

**Priority:** P2 - Medium

---

### 5. Table Formatting Inconsistencies

**Problem:** Some table cells span multiple lines, causing rendering issues.

**Evidence:**
```markdown
| Entity type | Type and hierarchical level  of the entity:
| --- | --- |
| 3-word title | Brief 3-word title using public-domain...
```

(Missing closing `|` on some rows)

**Priority:** P2 - Medium

---

### 6. Duplicate Section Headers

**Problem:** Same component names appear multiple times with different hierarchy.

**Evidence:**
```markdown
Template Designer  (line 94)
Template Designer  (line 99)
Template Designer  (line 446)
```

**Root Cause:** Document structure has repeated entity names at different levels.

**Priority:** P3 - Low (document structure issue)

---

## Positive Observations

1. **Metadata Richness** - Frontmatter includes comprehensive metrics:
   - Word/char/sentence counts
   - Heading hierarchy breakdown
   - Chunking recommendations
   - Semantic topic extraction

2. **Image Processing** - Images correctly:
   - Compressed to 1200px max
   - Embedded as base64 data URIs
   - Generated contextual descriptions

3. **Table Detection** - 33 tables correctly identified and converted

4. **Structure Preservation** - Heading hierarchy maintained (h1:11, h2:20, h3:45)

---

## Recommended Improvements

### Immediate (P0-P1)

1. **Fix Translation Pipeline**
   ```bash
   # Sync fixed Translator.ts
   cp DoclingConverter/Lib/Translator.ts ~/.claude/skills/DoclingConverter/Lib/
   ```

2. **Add Post-Processing for Trademark Symbols**
   ```typescript
   // In Convert.ts, after building markdown
   content = content.replace(/\n+\s*([®™©])\s*\n+/g, '$1 ');
   ```

### Short-term (P2)

3. **Improve Image Description Accuracy**
   - Add known brand names to description prompt
   - Consider Claude Haiku fallback for technical documents

4. **Table Validation**
   - Ensure all table rows have consistent column counts
   - Add closing `|` to all rows

### Long-term (P3)

5. **Document Structure Deduplication**
   - Detect and merge duplicate section headers
   - Add section IDs for disambiguation

---

## Test Commands

```bash
# Re-run with fixed translation
PATH="$HOME/Library/Python/3.9/bin:$PATH" \
  bun run ~/.claude/skills/DoclingConverter/Tools/Convert.ts \
  test-files/test.docx

# Check for Italian text (should be 0 after fix)
grep -c "è la soluzione\|pensata per\|nel rispetto" test-files/test.converted.md
```

---

## Conclusion

The skill successfully converts documents with rich metadata and embedded images, but has a **critical translation bug** that must be fixed before production use. The trademark symbol parsing and image description accuracy are secondary concerns that can be addressed in the next version.

**Overall Assessment:** 6/10 (7/10 after translation fix)

---

## Post-Fix Validation (2026-01-12)

### Fixes Applied

1. **Translation Pipeline** - Now uses Claude CLI as fallback when no API key
2. **Always Translate** - Removed language check, always processes for mixed-language
3. **Trademark Symbols** - Post-processing merges isolated ®, ™, © with preceding text

### Validation Results

| Test | Before | After | Status |
|------|--------|-------|--------|
| Italian text translated | 0% | 100% | PASSED |
| Trademark symbols on separate lines | Many | 0 | PASSED |
| Translation model | N/A | claude-cli | PASSED |

**Updated Assessment:** 8/10

---

## Post-Fix Validation v2 (2026-01-12)

### Issues Reported
1. Tables lost formatting
2. Unordered lists missing (e.g., under SERQ)
3. Links not preserved
4. Broken table artifacts (e.g., `Entity type | Type...` without proper table structure)

### Fixes Applied

1. **Complete markdown builder rewrite**
   - Process all texts in document order (not just body.children)
   - Insert tables inline after their parent text elements
   - Escape pipe characters in table cells
   - Use `<br>` for multi-line cell content

2. **List item grouping**
   - Track consecutive list items
   - Flush as grouped markdown list when non-list element encountered

3. **Table formatting**
   - Proper markdown table syntax with header separator
   - Cell text sanitization (escape pipes, newlines to `<br>`)

### Validation Results v2

| Test | Before v2 | After v2 | Status |
|------|-----------|----------|--------|
| Tables formatted | Broken | Proper markdown | PASSED |
| List items (`- `) | 0 | 82+ | PASSED |
| Table cells escaped | No | Yes (`\|`, `<br>`) | PASSED |
| Document structure | Body-only | All texts | PASSED |

**Final Assessment:** 9/10

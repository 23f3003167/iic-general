# AI Communication Evaluation Pipeline - Team Guide

> This version is viewer-safe (no Mermaid dependency) and renders cleanly in basic Markdown preview tools.

---

## 1) Folder Purpose (Quick Reference)

| Folder | What it stores | Typical examples | Lifecycle |
|--------|---------------|-----------------|------------|
| `downloads/` | Temporary media fetched from Google Drive | `*.mp4`, `*.mp3` | Deleted after each module in orchestrated runs |
| `transcripts/` | Plain text transcripts used for scoring/audit | `<file_id>.txt` | Deleted after each module in orchestrated runs |
| `sarvam_outputs/` | Raw Sarvam ASR JSON output | `<file_id>.mp4.json`, `<file_id>.mp3.json` | Deleted after each module in orchestrated runs |
| `json/` | Final module result artifacts (scores/feedback/status) | `self_intro_<id>.json`, `email_writing_row_<row>.json` | Deleted after each module in orchestrated runs |
| `scripts/` | Source code (orchestration + modules + scoring) | `evaluate_student.py`, `run_*.py` | Persistent |

---

## 2) Finalized ML Pipeline (High-Level)

```text
[Google Sheet Row: inputs]
                |
                v
      [scripts/evaluate_student.py]
                |
     +--------------------------+------------------------+-----------------------+
     |                          |                        |                       |
     v                          v                        v                       v
 [Self Intro]          [Listening & Speaking]    [Listening & Writing]     [Email Writing]
run_self_intro.py      run_listening_speaking.py  run_listening_writing.py  run_email_writing.py
     |                          |
     | (media only: C, D)       |
     v
[Drive download -> Sarvam ASR -> Indic-to-Latin normalization]
                |
                v
     [Module scoring + feedback generation]
                |
                v
   [Write scores/feedback/status to Google Sheet]
                |
                v
 [Cleanup: downloads/, transcripts/, sarvam_outputs/, json/]
```

---

## 3) Runtime Sequence (Step-by-Step)

1. Run command:

```bash
python scripts/evaluate_student.py <sheet_id> <row>
```

2. Orchestrator reads row data (`A–F`) from the `Evaluation` sheet.
3. For each available input:

- **Self-Intro (C)**  
  Video → ASR → Normalize → Score → Write `H/J/K/G`

- **Listening & Speaking (D)**  
  Audio → ASR → Normalize → Score → Write `I/L/M/G`

- **Listening & Writing (E)**  
  Text → Score → Write `N/O/G`

- **Email Writing (F)**  
  Text → Score → Write `P/Q/G`

4. After each module, artifacts are deleted to prevent cross-student leakage.
5. Summary is printed in terminal.

---

## 4) Module-to-Column Mapping

| Module | Input column | Output columns | Notes |
|--------|-------------|---------------|-------|
| Self-Intro | C (Drive video) | H transcript, J score, K feedback, G status | Includes feature extraction + content validation |
| Listening & Speaking | D (Drive audio) | I transcript, L score, M feedback, G status | Uses ASR + rubric scoring |
| Listening & Writing | E (text) | N score, O feedback, G status | No ASR needed |
| Email Writing | F (text) | P score, Q feedback, G status | No ASR needed |

---

## 5) Contamination Issue and Final Fix

### What Caused the Issue

- Old files remained in `sarvam_outputs/`.
- Earlier logic could read stale JSON when multiple files existed.
- Cleanup previously missed suffix patterns like `.mp3.json` and `.mp4.json`.

### What Is Fixed Now

1. `scripts/evaluate_student.py` cleanup now removes:

- `downloads/<file_id>.*`
- `transcripts/<file_id>.txt`
- `sarvam_outputs/<file_id>.*`
- Corresponding `json/*` module output

2. `scripts/transcribe.py` selection is deterministic:

- First preference: exact `<input_filename>.json`
- Fallback: latest modified JSON

✅ Result: each student evaluation uses only its own ASR output.

---

## 6) Artifact Lifecycle Per Row

```text
Input read
   -> (Optional) media download
   -> (Optional) ASR
   -> (Optional) script normalization
   -> scoring
   -> sheet writeback
   -> cleanup
```

---

## 7) Operational Best Practices

- Use only `scripts/evaluate_student.py` in production.
- Avoid long manual runs of individual module scripts without cleanup.
- Keep `scripts/credentials.json` private.
- Share sheet access with service account email.
- If debugging, temporarily disable cleanup — but re-enable for normal operation.

---

## 8) Key Code Files

- `scripts/evaluate_student.py` — Orchestration + cleanup  
- `scripts/transcribe.py` — ASR backend abstraction (Sarvam default)  
- `scripts/run_self_intro.py` — Self-intro pipeline  
- `scripts/run_listening_speaking.py` — Listening/Speaking pipeline  
- `scripts/run_listening_writing.py` — Listening/Writing pipeline  
- `scripts/run_email_writing.py` — Email-writing pipeline  

---

# 9) Scoring Rubrics by Module

---

## Module 1: Self-Intro (40 Marks)

| Criterion | Score Range | Evaluation Criteria |
|------------|------------|---------------------|
| Content & Organization | 0–10 | 3 pts: <60 words<br>6 pts: 60–100 words<br>10 pts: 100–180 words<br>7 pts: >180 words |
| Fluency | 0–10 | 3 pts: >15% fillers<br>5 pts: 10–15%<br>7 pts: 6–10%<br>9 pts: 3–6%<br>10 pts: <3% |
| Language Quality | 0–10 | 4 pts: <80 WPM<br>7 pts: 80–110<br>10 pts: 110–160<br>8 pts: 160–190<br>5 pts: >190 |
| Delivery & Confidence | 0–10 | Based on fillers + WPM balance |
| **Total** | **40** | Sum of all criteria |

---

## Module 2: Listening & Speaking (19 Marks)

| Criterion | Score Range | Evaluation Criteria |
|------------|------------|---------------------|
| Listening Comprehension | 0–5 | ≥2 theme keywords |
| Opinion Clarity | 0–5 | Clear stance + support |
| Argument Support | 0–5 | Reasoning + elaboration markers |
| Delivery & Coherence | 0–5 | Structured speech |
| **Total** | **20** | Sum of all criteria |

---

## Module 3: Listening & Writing (17 Marks)

| Criterion | Score Range | Evaluation Criteria |
|------------|------------|---------------------|
| Listening Comprehension | 0–5 | ≥3 core themes |
| Summarization Quality | 0–5 | Main argument captured |
| Organization | 0–5 | Paragraphs + transitions |
| Language Quality | 0–5 | Grammar + clarity |
| **Total** | **20** | Sum of all criteria |

⚠ Opinion phrases like "I think", "I believe" must NOT appear in summary.

---

## Module 4: Email Writing (18 Marks)

| Criterion | Score Range | Evaluation Criteria |
|------------|------------|---------------------|
| Content Completeness | 0–5 | Invitation + benefits + services + date/time/location |
| Format & Structure | 0–5 | Subject + greeting + closing + paragraphs |
| Clarity & Persuasiveness | 0–5 | Persuasive language + CTA + benefit framing |
| Language Quality | 0–5 | Professional tone + grammar |
| **Total** | **20** | Sum of all criteria |

---

## 10) Script Normalization Logic

Sarvam may return mixed scripts (Latin + Devanagari).

Example:

**Raw ASR Output:**
```
"helo evarivana, ai ema paramanamda samamtara" + Devanagari characters
```

**After Normalization:**
```
"helo evarivana, ai ema paramanamda samamtara"
```

- All text converted to Latin.
- Phonetic form preserved.
- No translation performed.
- Exactly what was spoken is retained.

### Why This Matters

Scoring module searches for semantic patterns.

Example:

System searches for:
```
"my name"
```

Student says (phonetic):
```
"ai ema"
```

Phonetic match detected ✓  
Content credit awarded correctly.

---

## 2-Minute Demo Talk Track

> We read one student row from Google Sheets and dynamically execute only the modules that have inputs. Media responses go through Sarvam ASR and script normalization so mixed Indic scripts become Latin text without translation. Each module scores with its own rubric and writes marks plus feedback back to dedicated sheet columns. Finally, we clean all temporary artifacts so one student’s files never leak into the next evaluation.

---

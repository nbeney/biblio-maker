/*
 * Characterization tests.
 *
 * These do NOT assert "correct" output in an absolute sense. They pin down the
 * CURRENT behaviour of the parser against the real-world fixtures so that any
 * future change to parser.js that shifts the results becomes visible in the
 * diff. If you intentionally improve the parser, update the snapshot/baseline
 * numbers below and review the change.
 *
 * The human-curated bibliography (test-bibliography-2.txt) is used only as a
 * *reference target* to report overlap, since it is edited by hand and cannot
 * be reproduced mechanically.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../parser.js';
const { parseFootnote, generateBibliography } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const footnotes = fs
  .readFileSync(path.join(ROOT, 'test-footnotes-2.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

describe('footnote fixture — shape', () => {
  it('loads the expected number of footnotes', () => {
    // Baseline: update if the fixture file changes.
    expect(footnotes.length).toBe(46);
  });

  it('classifies each footnote into a known kind', () => {
    const kinds = {};
    for (const f of footnotes) {
      const k = parseFootnote(f).kind;
      kinds[k] = (kinds[k] || 0) + 1;
    }
    // Snapshot of the current classification distribution.
    expect(kinds).toMatchSnapshot();
  });

  it('parses a stable count of bibliographic references', () => {
    const parsedCount = footnotes.filter((f) => parseFootnote(f).parsed).length;
    // Baseline number — intentionally characterizing current behaviour.
    expect(parsedCount).toMatchSnapshot();
  });
});

describe('bibliography generation — characterization', () => {
  it('produces a stable bibliography snapshot', () => {
    const { text } = generateBibliography(footnotes);
    expect(text).toMatchSnapshot();
  });

  it('produces stable structured entries', () => {
    const { entries } = generateBibliography(footnotes);
    const summary = entries.map((e) => ({ author: e.author, works: e.works.length }));
    expect(summary).toMatchSnapshot();
  });
});

describe('overlap with the human-curated bibliography (reference only)', () => {
  // Extract surnames (first comma-delimited token, lowercased) from both the
  // generated output and the human file, and report overlap. This is reported
  // as a snapshot so we can watch it improve/regress, not asserted to be 100%.
  function surnames(lines) {
    const out = new Set();
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('—') || line.startsWith('•') || line.endsWith(':')) continue;
      const m = line.match(/^([A-Za-zÀ-ÿ'’-]+),/);
      if (m) out.add(m[1].toLowerCase());
    }
    return out;
  }

  it('reports surname overlap as a baseline metric', () => {
    const { text } = generateBibliography(footnotes);
    const generated = surnames(text.split('\n'));

    const humanLines = fs
      .readFileSync(path.join(ROOT, 'test-bibliography-2.txt'), 'utf8')
      .split('\n');
    const human = surnames(humanLines);

    const matched = [...generated].filter((s) => human.has(s)).sort();
    const metric = {
      generatedAuthors: generated.size,
      humanAuthors: human.size,
      matchedAuthors: matched.length,
      matched,
    };
    expect(metric).toMatchSnapshot();
  });
});

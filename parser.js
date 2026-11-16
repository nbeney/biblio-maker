/*
 * BiblioMaker — footnote parsing & bibliography generation (pure, testable core).
 *
 * This module is environment-agnostic: it runs in the browser (loaded via a
 * plain <script> tag, attaching to window.BiblioMaker) and in Node/Vitest
 * (via module.exports). It has NO DOM or filesystem dependencies.
 *
 * The footnote grammar we target (from real data) is roughly:
 *
 *   <Author>. <Title>[, ed. <Editor>] (<Publisher>, <Year>)[, <locator>].
 *   <Author>. ‘<Article>’, in <Journal> (<vol.no, Year>) <locator>.
 *
 * Many footnotes are NOT bibliographic references at all:
 *   - "Ibid, Book I, line 16, p. 3."           (cross-reference)
 *   - "Paradise Lost, Book I, lines 1-26, p.3" (short-title cross-reference)
 *   - "OED, 'ambition', def. I.1."             (reference-work shorthand)
 *   - "Barbara Lewalski helpfully identifies…"  (free prose)
 *
 * parseFootnote() returns a structured result for every footnote, flagging
 * whether it was recognised as a bibliographic reference (parsed === true).
 */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;           // Node / Vitest
  }
  root.BiblioMaker = api;           // Browser (window.BiblioMaker)
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Markers that mean "this footnote is a cross-reference / shorthand, not a
  // full bibliographic entry". Checked case-insensitively at the start.
  const CROSS_REF_PREFIXES = ['ibid', 'ibid.', 'paradise lost', 'oed'];

  // Strip a trailing locator ("p. 3", "pp. 83-4", "line 41", "Book IX", etc.)
  // and any trailing punctuation. Returns the cleaned string.
  function stripTrailingLocator(s) {
    let out = s.trim();
    // Remove trailing period/comma/semicolon noise first.
    out = out.replace(/[.,;\s]+$/, '');
    return out;
  }

  // Normalise whitespace.
  function squish(s) {
    return s.replace(/\s+/g, ' ').trim();
  }

  // Extract the first 3-4 digit year from a string, if any.
  function findYear(s) {
    const m = s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return m ? m[1] : '';
  }

  /*
   * parseFootnote(raw) -> {
   *   raw, parsed, author, title, publisher, year,
   *   kind: 'book' | 'article' | 'crossref' | 'prose' | 'reference-work'
   * }
   *
   * parsed === true only when we could pull out at least an author + title.
   */
  function parseFootnote(raw) {
    const text = squish(String(raw == null ? '' : raw));
    const result = {
      raw: String(raw == null ? '' : raw).trim(),
      parsed: false,
      author: '',
      title: '',
      publisher: '',
      year: '',
      kind: 'prose',
    };
    if (!text) return result;

    const lower = text.toLowerCase();

    // Reference works like "OED, 'ambition', def. I.1."
    if (lower.startsWith('oed')) {
      result.kind = 'reference-work';
      return result;
    }

    // Cross-references: "Ibid, …" or a bare short-title like "Paradise Lost, …"
    for (const pref of CROSS_REF_PREFIXES) {
      if (lower === pref || lower.startsWith(pref + ',') || lower.startsWith(pref + ' ')) {
        // "Paradise Lost (…)" with parens could still be a real entry the first
        // time, but in this corpus the full entry uses "Milton, John. Paradise
        // Lost …", so a bare leading short-title is treated as a cross-ref.
        if (pref !== 'paradise lost' || !/^paradise lost\b.*\(/i.test(text)) {
          result.kind = 'crossref';
          return result;
        }
      }
    }

    // A real reference needs the "Author. Title" shape: a period followed by a
    // space, where the author part is not just an initial (len > 1, no trailing
    // single-letter abbreviation like "J.").
    const sep = findAuthorTitleSplit(text);
    if (sep === -1) {
      // No "Author. Title" split -> prose footnote.
      result.kind = 'prose';
      return result;
    }

    const author = squish(text.slice(0, sep));
    let rest = squish(text.slice(sep + 1)); // after the period

    // Title runs up to the first parenthesis (publisher/year group) or, for
    // articles, up to ", in <Journal>".
    const parenIdx = rest.indexOf('(');
    let title, inside, tailAfterParen = '';

    if (parenIdx !== -1) {
      title = squish(rest.slice(0, parenIdx));
      const close = rest.indexOf(')', parenIdx);
      inside = close !== -1 ? rest.slice(parenIdx + 1, close) : rest.slice(parenIdx + 1);
      tailAfterParen = close !== -1 ? rest.slice(close + 1) : '';
    } else {
      // No parentheses at all -> not enough to be a confident reference.
      title = rest;
      inside = '';
    }

    // Clean the title: drop a trailing ", in <Journal>" / ", ed. …" / locator.
    title = title.replace(/,\s*in\s+.+$/i, '');       // ", in The Sewanee Review"
    title = title.replace(/,\s*ed\.\s+.+$/i, '');      // ", ed. John Leonard"
    title = stripTrailingLocator(title);
    title = title.replace(/,$/, '').trim();

    // Publisher + year live inside the parentheses: "Penguin Books, 2003",
    // "Oxford: Oxford University Press, 2011", or a journal "vol. 10, no. 1, 1976".
    const year = findYear(inside) || findYear(tailAfterParen);
    let publisher = inside;
    if (year) {
      publisher = inside.replace(new RegExp('[,;]?\\s*' + year + '\\s*.*$'), '').trim();
    }
    publisher = publisher.replace(/^[,;\s]+|[,;\s]+$/g, '');

    if (!author || !title) {
      result.kind = 'prose';
      return result;
    }

    result.parsed = true;
    result.author = author;
    result.title = title;
    result.publisher = publisher;
    result.year = year;
    // Journal articles have a quoted title; books don't.
    result.kind = /^[‘'"“]/.test(squish(rest)) ? 'article' : 'book';
    return result;
  }

  // Lowercase "function words" that should never appear in an author segment.
  // Their presence signals that the leading text is prose, not a name.
  const PROSE_WORDS = new Set([
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'in', 'on', 'of', 'to',
    'and', 'or', 'but', 'with', 'for', 'as', 'by', 'from', 'between', 'their',
    'his', 'her', 'its', 'helpfully', 'cites', 'identifies', 'illuminate',
    'comparison', 'relationship',
  ]);

  // Find the index of the period that separates "Author. Title".
  // Returns -1 if there is no plausible split.
  //
  // Rules (tightened to reject prose that merely *contains* a parenthesised
  // "(Publisher, Year)" group somewhere in a sentence):
  //  - the period must be followed by whitespace;
  //  - the token before the period must be longer than one letter (so initials
  //    like "J." in "J. R. R. Tolkien" are skipped);
  //  - the author segment must sit BEFORE the first "(" (publisher/year group);
  //  - the author segment must look like a name: at most 5 words, and contain
  //    none of the lowercase prose "function words".
  function findAuthorTitleSplit(text) {
    const firstParen = text.indexOf('(');
    const re = /\.(\s+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      // Must be before the publisher/year parenthesis (if any).
      if (firstParen !== -1 && idx > firstParen) break;

      const before = text.slice(0, idx);
      const lastToken = before.split(/\s/).pop();
      if (!lastToken || lastToken.replace(/[^A-Za-zÀ-ÿ]/g, '').length <= 1) continue;

      // Author must contain a space or comma (a real multi-part name).
      if (!/[,\s]/.test(before)) continue;

      if (looksLikeName(before)) return idx;
    }
    return -1;
  }

  // Heuristic: does this segment look like an author name rather than prose?
  function looksLikeName(segment) {
    const words = segment.replace(/[.,]/g, '').split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 5) return false;
    for (const w of words) {
      if (PROSE_WORDS.has(w.toLowerCase())) return false;
    }
    return true;
  }

  /*
   * generateBibliography(footnotes) -> {
   *   entries: [ { author, works: [ {title, publisher, year} ] } ],
   *   text: string   // formatted plain-text bibliography
   * }
   *
   * - Keeps only parsed references.
   * - De-duplicates identical (author|title) pairs.
   * - Groups works under a single author.
   * - Sorts authors, then titles within an author.
   * - Repeated author lines are collapsed to an em-dash ("—").
   */
  function generateBibliography(footnotes) {
    const parsed = footnotes
      .map(parseFootnote)
      .filter((r) => r.parsed);

    // Dedupe by author + title (case-insensitive).
    const seen = new Set();
    const byAuthor = new Map();
    for (const r of parsed) {
      const key = (r.author + '|' + r.title).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!byAuthor.has(r.author)) byAuthor.set(r.author, []);
      byAuthor.get(r.author).push({ title: r.title, publisher: r.publisher, year: r.year });
    }

    const collator = new Intl.Collator('en', { sensitivity: 'base' });

    const entries = [...byAuthor.entries()]
      .sort((a, b) => collator.compare(a[0], b[0]))
      .map(([author, works]) => ({
        author,
        works: works.sort((a, b) => collator.compare(a.title, b.title)),
      }));

    return { entries, text: formatBibliography(entries) };
  }

  // Render one work as "Title, Publisher, Year" (omitting empty parts).
  function formatWork(w) {
    return [w.title, w.publisher, w.year].filter(Boolean).join(', ');
  }

  // Produce the plain-text bibliography. The first work sits on the author line;
  // subsequent works by the same author start with an em-dash instead of the
  // repeated name. Authors are separated by a blank line.
  function formatBibliography(entries) {
    const blocks = entries.map((entry) =>
      entry.works
        .map((w, i) => (i === 0 ? entry.author : '—') + '. ' + formatWork(w))
        .join('\n')
    );
    return blocks.join('\n\n');
  }

  return {
    parseFootnote,
    generateBibliography,
    formatBibliography,
    // exported for testing:
    _internal: { findYear, findAuthorTitleSplit, squish, stripTrailingLocator },
  };
});

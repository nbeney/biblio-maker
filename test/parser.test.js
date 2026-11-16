/*
 * Unit tests for the footnote parser and bibliography generator.
 * These pin down the intended behaviour for specific, hand-picked cases.
 */
import { describe, it, expect } from 'vitest';
import pkg from '../parser.js';
const { parseFootnote, generateBibliography, formatBibliography } = pkg;

describe('parseFootnote — book references', () => {
  it('parses a simple "Author. Title (Publisher, Year)" book', () => {
    const r = parseFootnote('Teskey, Gordon. Delirious Milton: The Fate of the Poet in Modernity (Cambridge: Mass Harvard University Press, 2006), p. 5.');
    expect(r.parsed).toBe(true);
    expect(r.kind).toBe('book');
    expect(r.author).toBe('Teskey, Gordon');
    expect(r.title).toBe('Delirious Milton: The Fate of the Poet in Modernity');
    expect(r.year).toBe('2006');
    expect(r.publisher).toBe('Cambridge: Mass Harvard University Press');
  });

  it('drops a trailing ", ed. <Editor>" from the title', () => {
    const r = parseFootnote('Milton, John. Paradise Lost, ed. John Leonard (Penguin Books, 2003), Book IX, line 41, p. 75.');
    expect(r.parsed).toBe(true);
    expect(r.author).toBe('Milton, John');
    expect(r.title).toBe('Paradise Lost');
    expect(r.publisher).toBe('Penguin Books');
    expect(r.year).toBe('2003');
  });

  it('handles a "City: Publisher" group', () => {
    const r = parseFootnote('Martindale, Charles. ‘Writing Epic: Paradise Lost’, in The Oxford Handbook of Milton, ed. Nicholas McDowell and Nigel Smith (Oxford: Oxford University Press, 2011), p. 448.');
    expect(r.parsed).toBe(true);
    expect(r.author).toBe('Martindale, Charles');
    expect(r.publisher).toBe('Oxford: Oxford University Press');
    expect(r.year).toBe('2011');
  });
});

describe('parseFootnote — articles', () => {
  it('flags a quoted-title journal article as kind "article"', () => {
    const r = parseFootnote('Wilson, Talbot. ‘The Narrator of Paradise Lost: Divine Inspiration and Human Knowledge’, in The Sewanee Review (vol. 79, no.3, 1971) p. 351.');
    expect(r.parsed).toBe(true);
    expect(r.kind).toBe('article');
    expect(r.author).toBe('Wilson, Talbot');
    expect(r.year).toBe('1971');
  });
});

describe('parseFootnote — non-references', () => {
  it('treats "Ibid, …" as a cross-reference', () => {
    const r = parseFootnote('Ibid, Book I, line 16, p. 3.');
    expect(r.parsed).toBe(false);
    expect(r.kind).toBe('crossref');
  });

  it('treats a bare "Paradise Lost, …" short title as a cross-reference', () => {
    const r = parseFootnote('Paradise Lost, Book I, lines 1-26, p.3 & Book IX, line 14, p. 186.');
    expect(r.parsed).toBe(false);
    expect(r.kind).toBe('crossref');
  });

  it('treats "OED, …" as a reference-work shorthand', () => {
    const r = parseFootnote("OED, ‘ambition’, def. I.1.");
    expect(r.parsed).toBe(false);
    expect(r.kind).toBe('reference-work');
  });

  it('treats free prose as unparsed', () => {
    const r = parseFootnote('Barbara Lewalski helpfully identifies this comparison between Milton and Virgil in their respective Book VII proems in Paradise Lost and the Rhetoric of Literary Forms (Princeton University Press, 1985) pp. 33-34.');
    expect(r.parsed).toBe(false);
    expect(r.kind).toBe('prose');
  });

  it('handles empty / whitespace input', () => {
    expect(parseFootnote('').parsed).toBe(false);
    expect(parseFootnote('   ').parsed).toBe(false);
    expect(parseFootnote(null).parsed).toBe(false);
  });
});

describe('generateBibliography', () => {
  const footnotes = [
    'Teskey, Gordon. Delirious Milton: The Fate of the Poet in Modernity (Cambridge: Mass Harvard University Press, 2006), p. 5.',
    'Milton, John. Paradise Lost, ed. John Leonard (Penguin Books, 2003), p. 75.',
    'Milton, John. Areopagitica, in Complete Poems and Major Prose, ed. Merritt Y. Hughes (Hackett Publishing Company, 2003) p. 720.',
    'Ibid, Book I, line 16, p. 3.',
    'Teskey, Gordon. Delirious Milton: The Fate of the Poet in Modernity (Cambridge: Mass Harvard University Press, 2006), p. 5.', // duplicate
  ];

  it('keeps only parsed references and de-duplicates', () => {
    const { entries } = generateBibliography(footnotes);
    const milton = entries.find((e) => e.author === 'Milton, John');
    expect(milton.works).toHaveLength(2);
    const teskey = entries.find((e) => e.author === 'Teskey, Gordon');
    expect(teskey.works).toHaveLength(1); // duplicate collapsed
  });

  it('sorts authors then titles', () => {
    const { entries } = generateBibliography(footnotes);
    expect(entries.map((e) => e.author)).toEqual(['Milton, John', 'Teskey, Gordon']);
    const milton = entries.find((e) => e.author === 'Milton, John');
    // "Areopagitica" sorts before "Paradise Lost"
    expect(milton.works.map((w) => w.title)).toEqual(['Areopagitica', 'Paradise Lost']);
  });

  it('collapses repeated authors to an em-dash in the formatted text', () => {
    const { text } = generateBibliography(footnotes);
    const lines = text.split('\n');
    const miltonLines = lines.filter((l) => l.startsWith('Milton, John') || l.startsWith('—'));
    expect(miltonLines[0].startsWith('Milton, John')).toBe(true);
    expect(miltonLines[1].startsWith('—')).toBe(true);
  });
});

describe('formatBibliography', () => {
  it('formats a single author with two works, second line em-dashed', () => {
    const entries = [{
      author: 'Milton, John',
      works: [
        { title: 'Areopagitica', publisher: 'Hackett Publishing Company', year: '2003' },
        { title: 'Paradise Lost', publisher: 'Penguin Books', year: '2003' },
      ],
    }];
    expect(formatBibliography(entries)).toBe(
      'Milton, John. Areopagitica, Hackett Publishing Company, 2003\n' +
      '—. Paradise Lost, Penguin Books, 2003'
    );
  });
});

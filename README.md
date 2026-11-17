# BiblioMaker

Turn the footnotes of a `.docx` file into a bibliography. Everything runs in your browser; nothing is uploaded.

## Use

1. Open `index.html` in a browser (or serve the folder with any static server).
2. Drag and drop a `.docx` file onto the drop area, or click it to browse.
3. **Footnotes** tab: review each footnote. Click a footnote to edit it; the bibliography updates as you type. Arrow keys and Enter move between rows.
4. **Bibliography** tab: authors are sorted, duplicate works are merged, and repeated authors are shown as an em-dash.

### Footnote toolbar

- **All / Parsed / Unparsed**: show everything, only footnotes recognised as references, or only the rest. Each button shows how many footnotes it covers.
- **Filter box**: all plain words must appear, and words prefixed with `-` must not. Example: `milton -ibid`.
- **Copy**: copy the visible footnotes as plain text.
- **Export**: download the visible footnotes as `footnotes.txt`.
- **Clear**: delete all footnotes, including the auto-saved copy. Asks for confirmation first.
- The counter on the right shows how many footnotes are visible and how many the filters hide.

### Bibliography toolbar

- **Export**: download `bibliography.txt`.
- **Copy**: copies both `text/html` (italic titles, spacing between authors) and `text/plain`, so pasting into Word or Google Docs keeps the formatting.

### Auto-save

Footnotes (including your manual edits) are saved to the browser's IndexedDB shortly after each change and restored on the next visit. Loading a new file replaces the saved session. **Clear** on the Footnotes tab deletes it, and so does clearing the site data.

## Development

The parsing logic lives in `parser.js` and is tested with Vitest.

```
npm install
npm test
```

## License

© Nicolas Beney. [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

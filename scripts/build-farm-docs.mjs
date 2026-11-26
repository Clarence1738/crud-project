// Builds professional PDF editions of docs/farm-management-system/*.md.
// All text is black. Usage: npm.cmd run docs:pdf
// Requires Microsoft Edge or Google Chrome (set BROWSER to override the path).
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDict, PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'docs', 'farm-management-system');
const outDir = path.join(sourceDir, 'pdf');
const documents = [
  { file: 'URS.md', out: 'FMS-URS User Requirements Specification.pdf' },
  { file: 'FS.md', out: 'FMS-FS Functional Specification.pdf' },
  { file: 'DESIGN.md', out: 'FMS-DES System Design.pdf' },
  { file: 'DECISIONS.md', out: 'FMS-DEC Decision Log.pdf' },
];
const combinedName = 'Farm Management System Documentation Set.pdf';

const browser = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((candidate) => candidate && existsSync(candidate));
if (!browser)
  throw new Error('Microsoft Edge or Google Chrome is required. Set BROWSER to its path.');

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (text) =>
  escape(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/&lt;br&gt;/g, '<br>');

/** Renders a `flow` block: each line "A > B > C" becomes a row of boxed steps joined by arrows. */
const flow = (body) =>
  `<div class="flow">${body
    .filter((line) => line.trim())
    .map((line) => {
      const caption = /^(.+?):\s+(.*)$/.exec(line);
      const steps = (caption ? caption[2] : line).split('>').map((step) => step.trim());
      return `<div class="flow-row">${caption ? `<div class="flow-caption">${inline(caption[1])}</div>` : ''}${steps
        .map((step) => `<span class="flow-step">${inline(step)}</span>`)
        .join('<span class="flow-arrow">&#8594;</span>')}</div>`;
    })
    .join('')}</div>`;
const cells = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

/** Minimal Markdown renderer for headings, paragraphs, lists, tables, and code blocks. */
function render(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  const headings = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const id = `s${headings.length}`;
      if (level === 2) headings.push({ id, text: heading[2], index: html.length });
      html.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^(~~~|```)/.test(line)) {
      const fence = line.slice(0, 3);
      const language = line.slice(3).trim();
      const body = [];
      for (i++; i < lines.length && !lines[i].startsWith(fence); i++) body.push(lines[i]);
      i++;
      html.push(language === 'flow' ? flow(body) : `<pre>${escape(body.join('\n'))}</pre>`);
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = [];
      for (; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(lines[i]);
      const head = cells(rows[0]);
      const align = cells(rows[1]).map((spec) => (/^:-+:$/.test(spec) ? 'center' : 'left'));
      const control = head[0] === 'Document control';
      const kind = control
        ? 'control'
        : head[0] === 'Approval role'
          ? 'signoff'
          : head[0] === 'Item'
            ? 'usecase'
            : '';
      const body = rows.slice(2).map(
        (row) =>
          `<tr>${cells(row)
            .map((cell, c) => {
              const id = /^[A-Z]{1,4}-[A-Z0-9]{1,5}$/.test(cell) ? ' class="id"' : '';
              return `<td${id} style="text-align:${align[c]}">${inline(cell)}</td>`;
            })
            .join('')}</tr>`,
      );
      const thead = control
        ? ''
        : `<thead><tr>${head.map((cell, c) => `<th style="text-align:${align[c]}">${inline(cell)}</th>`).join('')}</tr></thead>`;
      html.push(
        `<table class="${kind} cols-${head.length}">${thead}<tbody>${body.join('')}</tbody></table>`,
      );
      continue;
    }
    const list = /^(\s*)(-|\d+\.)\s+/.exec(line);
    if (list) {
      const ordered = list[2] !== '-';
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const item = /^(\s*)(-|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (item) items.push(item[3]);
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      html.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
      continue;
    }
    // The first line is always consumed so an unrecognised line can never stall the loop.
    const paragraph = [lines[i++].trim()];
    while (i < lines.length && lines[i].trim() && !/^(#|\||~~~|```|\s*(-|\d+\.)\s)/.test(lines[i]))
      paragraph.push(lines[i++].trim());
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return { html, headings };
}

const css = `
@page { size: A4; margin: 22mm 20mm 24mm 20mm; }
* { color: #000 !important; background: transparent !important; }
html { -webkit-print-color-adjust: exact; }
body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; margin: 0; }
h1, h2, h3 { font-family: Cambria, Georgia, "Times New Roman", serif; font-weight: 700; break-after: avoid; }
h2 { font-size: 15pt; margin: 22pt 0 8pt; padding-bottom: 3pt; border-bottom: 0.8pt solid #000; }
h3 { font-size: 12pt; margin: 14pt 0 6pt; }
p { margin: 0 0 7pt; }
ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
li { margin-bottom: 3pt; }
code, pre { font-family: Consolas, "Courier New", monospace; font-size: 9pt; }
pre { border: 0.6pt solid #000; padding: 6pt; white-space: pre-wrap; }
table { width: 100%; border-collapse: collapse; margin: 4pt 0 12pt; font-size: 9.5pt; page-break-inside: auto; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
th, td { border: 0.6pt solid #000; padding: 4pt 6pt; vertical-align: top; text-align: left; }
th { font-weight: 700; border-bottom: 1.4pt solid #000; }
table.control td:first-child { width: 32%; font-weight: 700; }
table.cols-2 td:first-child { width: 28%; }
table.usecase td:first-child { width: 20%; font-weight: 700; }
table.signoff td { height: 34pt; }
td.id { white-space: nowrap; }
table.signoff td:first-child { width: 24%; font-weight: 700; }
.flow { margin: 6pt 0 12pt; break-inside: avoid; }
.flow-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4pt; margin-bottom: 7pt; }
.flow-caption { width: 100%; font-weight: 700; font-size: 9.5pt; margin-bottom: 1pt; }
.flow-step { border: 0.8pt solid #000; padding: 3pt 7pt; font-size: 9pt; }
.flow-arrow { font-size: 11pt; }
h2 { break-before: auto; }
h3 { break-inside: avoid; }
h4 { font-family: Cambria, Georgia, "Times New Roman", serif; font-size: 11pt; font-weight: 700; margin: 14pt 0 5pt; break-after: avoid; }
.cover { height: 247mm; display: flex; flex-direction: column; page-break-after: always; }
.cover .rule { border-top: 2.4pt solid #000; margin: 0 0 18pt; }
.cover .product { font-family: Cambria, Georgia, serif; font-size: 14pt; letter-spacing: 1.5pt; text-transform: uppercase; margin: 46mm 0 6pt; }
.cover .title { font-family: Cambria, Georgia, serif; font-size: 27pt; font-weight: 700; line-height: 1.15; margin: 0 0 18pt; }
.cover .meta { margin-top: auto; }
.cover h3 { margin-top: 12pt; }
.cover .note { font-size: 9pt; margin-top: 10pt; }
.contents { page-break-after: always; }
.contents ol { list-style: none; padding: 0; margin: 0; }
.contents li { margin: 0; font-size: 11pt; }
.contents a { display: flex; justify-content: space-between; gap: 12pt; padding: 5pt 0; text-decoration: none; }
a { text-decoration: none; }
`;

/** Prints an HTML string to PDF with the headless browser and returns the PDF path. */
async function print(htmlText, name, workDir) {
  const htmlPath = path.join(workDir, `${name}.html`);
  const pdfPath = path.join(workDir, `${name}.pdf`);
  await fs.writeFile(htmlPath, htmlText, 'utf8');
  execFileSync(
    browser,
    [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-pdf-header-footer',
      `--user-data-dir=${path.join(workDir, 'profile')}`,
      `--print-to-pdf=${pdfPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'ignore', timeout: 120000 },
  );
  if (!existsSync(pdfPath)) throw new Error(`The browser did not produce ${pdfPath}`);
  return pdfPath;
}

async function build(doc, workDir) {
  const markdown = await fs.readFile(path.join(sourceDir, doc.file), 'utf8');
  const { html, headings } = render(markdown);
  // Cover holds everything up to the first numbered section: product, title, control table, revision history.
  const firstSection = html.findIndex(
    (block, index) => index > 1 && /^<h2/.test(block) && /<h2[^>]*>\d+\./.test(block),
  );
  const split = firstSection === -1 ? 2 : firstSection;
  const strip = (block) => block.replace(/<[^>]+>/g, '');
  const product = strip(html[0]);
  const title = strip(html[1]);
  const coverMeta = html.slice(2, split).join('\n');
  const control = {};
  // First occurrence only: the document control table precedes the revision history.
  for (const m of markdown.matchAll(/^\| (Document ID|Version|Date) \| (.+?) \|$/gm))
    control[m[1]] ??= m[2];
  const contents = headings.filter((h) => /^\d+\./.test(h.text));
  const page = (
    numbers,
    body,
  ) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${css}</style></head><body>
<section class="cover"><div class="product">${escape(product)}</div><div class="title">${escape(title)}</div><div class="rule"></div>
<div class="meta">${coverMeta}</div></section>
<section class="contents"><h2>Contents</h2><ol>${contents
    .map(
      (h, n) =>
        `<li><a href="#${h.id}"><span>${inline(h.text)}</span><span>${numbers[n] ?? ''}</span></a></li>`,
    )
    .join('')}</ol></section>
${body}
</body></html>`;
  const base = doc.file.replace(/\.md$/, '');

  // Measuring pass: print the document up to each section heading (plus space for its first lines);
  // the resulting page count is the page on which that section starts.
  const numbers = [];
  for (const [n, h] of contents.entries()) {
    const partial = html.slice(split, h.index + 1).join('\n') + '<div style="height:48pt"></div>';
    const measured = await print(
      page(
        contents.map(() => '00'),
        partial,
      ),
      `${base}-m${n}`,
      workDir,
    );
    numbers.push(String((await PDFDocument.load(await fs.readFile(measured))).getPageCount()));
  }
  const rawPdf = await print(page(numbers, html.slice(split).join('\n')), base, workDir);

  const label = `${control['Document ID']} v${control['Version']}  |  ${title}`;
  const raw = await fs.readFile(rawPdf);

  // Stand-alone edition: own cover, own contents, own page numbers.
  const pdf = await PDFDocument.load(raw);
  const pages = pdf.getPages();
  await stampFooters(
    pdf,
    pages.map((_, i) => (i === 0 ? null : { label, page: i + 1 })),
    pages.length,
  );
  linkContents(
    pdf,
    1,
    numbers.map((n) => pages[Number(n) - 1]),
  );
  pdf.setTitle(`${product}: ${title}`);
  pdf.setSubject(`${control['Document ID']} version ${control['Version']}, ${control['Date']}`);
  setCommonMetadata(pdf);
  await fs.writeFile(path.join(outDir, doc.out), await pdf.save());
  return { raw, pages: pages.length, numbers, contents, title, label };
}

function setCommonMetadata(pdf) {
  pdf.setAuthor('Farm Management System Project');
  pdf.setCreator('scripts/build-farm-docs.mjs');
  pdf.setCreationDate(new Date());
}

/** Draws a black footer rule, label, and "Page X of Y" on each page that has a footer entry. */
async function stampFooters(pdf, footers, total) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  pdf.getPages().forEach((p, index) => {
    const footer = footers[index];
    if (!footer) return;
    const { width } = p.getSize();
    const right = `Page ${footer.page} of ${total}`;
    p.drawLine({
      start: { x: 56.7, y: 46 },
      end: { x: width - 56.7, y: 46 },
      thickness: 0.5,
      color: black,
    });
    p.drawText(footer.label, { x: 56.7, y: 33, size: 8.5, font, color: black });
    p.drawText(right, {
      x: width - 56.7 - font.widthOfTextAtSize(right, 8.5),
      y: 33,
      size: 8.5,
      font,
      color: black,
    });
  });
}

/**
 * Points the links on contents pages, in reading order, at the given target pages with explicit
 * destinations. The browser writes named destinations, which do not survive merging documents.
 */
function linkContents(pdf, contentsIndexes, targets) {
  const pages = pdf.getPages();
  const annots = [contentsIndexes].flat().flatMap((index) => {
    const list = pages[index].node.Annots();
    return list ? Array.from({ length: list.size() }, (_, i) => list.get(i)) : [];
  });
  annots.forEach((ref, i) => {
    if (!targets[i]) return;
    const annot = pdf.context.lookup(ref, PDFDict);
    annot.delete(PDFName.of('A'));
    annot.set(PDFName.of('Dest'), pdf.context.obj([targets[i].ref, PDFName.of('Fit')]));
  });
}

/** Cover and one master contents covering every document and section in the set. */
function masterPage(builds, numbersFor) {
  let n = 0;
  const groups = builds
    .map((b, d) => {
      const docLink = `<li class="doc"><a href="#t${n}"><span>${escape(b.title)}</span><span>${numbersFor(n++)}</span></a></li>`;
      const sections = b.contents
        .map(
          (h) =>
            `<li class="sec"><a href="#t${n}"><span>${inline(h.text)}</span><span>${numbersFor(n++)}</span></a></li>`,
        )
        .join('');
      return `<ol class="group">${docLink}${sections}</ol>`;
    })
    .join('');
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>Documentation Set</title><style>${css}
.contents .group { margin-bottom: 10pt; break-inside: avoid; }
.contents .doc a { font-weight: 700; padding-top: 8pt; }
.contents .sec a { padding-left: 16pt; padding-top: 3pt; padding-bottom: 3pt; font-size: 10.5pt; }
.contents { page-break-after: auto; }
</style></head><body>
<section class="cover"><div class="product">Farm Management System</div><div class="title">Documentation Set</div><div class="rule"></div>
<div class="meta"><table class="control cols-2"><tbody>
<tr><td>Contents</td><td>User Requirements Specification, Functional Specification, System Design, Decision Log</td></tr>
<tr><td>Version</td><td>1.0</td></tr><tr><td>Date</td><td>25 November 2026</td></tr><tr><td>Status</td><td>Issued for review</td></tr>
</tbody></table></div></section>
<section class="contents"><h2>Contents</h2>${groups}</section>
${Array.from({ length: n }, (_, i) => `<span id="t${i}"></span>`).join('')}
</body></html>`;
}

const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fms-docs-'));
try {
  await fs.mkdir(outDir, { recursive: true });
  const builds = [];
  for (const doc of documents) {
    const result = await build(doc, workDir);
    builds.push(result);
    console.log(`${doc.out}: ${result.pages} pages`);
  }

  // The set drops each document's own contents page (page 2) and starts with one master contents.
  const frontCount = (
    await PDFDocument.load(
      await fs.readFile(
        await print(
          masterPage(builds, () => '000'),
          'master-measure',
          workDir,
        ),
      ),
    )
  ).getPageCount();
  const targets = [];
  let next = frontCount + 1;
  for (const b of builds) {
    targets.push(next);
    for (const n of b.numbers) targets.push(next + Number(n) - 2);
    next += b.pages - 1;
  }
  const front = await PDFDocument.load(
    await fs.readFile(
      await print(
        masterPage(builds, (i) => String(targets[i])),
        'master',
        workDir,
      ),
    ),
  );

  const combined = await PDFDocument.create();
  const footers = [];
  for (const copied of await combined.copyPages(front, front.getPageIndices()))
    combined.addPage(copied);
  front
    .getPages()
    .forEach((_, i) =>
      footers.push(
        i === 0 ? null : { label: 'Farm Management System  |  Documentation Set', page: i + 1 },
      ),
    );
  for (const b of builds) {
    const source = await PDFDocument.load(b.raw);
    const keep = source.getPageIndices().filter((i) => i !== 1);
    // Remove the document's own contents links before copying so no target pages are duplicated.
    source.getPages()[1].node.delete(PDFName.of('Annots'));
    for (const copied of await combined.copyPages(source, keep)) {
      combined.addPage(copied);
      footers.push({ label: b.label, page: combined.getPageCount() });
    }
  }
  const total = combined.getPageCount();
  await stampFooters(combined, footers, total);
  const all = combined.getPages();
  linkContents(
    combined,
    front.getPageIndices().slice(1),
    targets.map((p) => all[p - 1]),
  );
  combined.setTitle('Farm Management System Documentation Set');
  combined.setSubject(
    'URS, Functional Specification, System Design, and Decision Log, version 1.0',
  );
  setCommonMetadata(combined);
  await fs.writeFile(path.join(outDir, combinedName), await combined.save());
  console.log(`${combinedName}: ${total} pages`);
} finally {
  await fs.rm(workDir, { recursive: true, force: true });
}

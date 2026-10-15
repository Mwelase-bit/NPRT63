// src/utils/fileText.js - pull plain text out of study files in the browser.
// Supports .txt .md .csv .json .html .rtf (read as text), .docx, .pptx (unzipped
// and read from their XML) and .pdf (via the bundled pdf.js, loaded on demand).
// Exposes window.FileText.
(function () {
    const MAX_FILE_BYTES = 15 * 1024 * 1024;
    const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'log', 'rtf', 'html', 'htm', 'xml'];
    const ACCEPT = '.txt,.md,.markdown,.csv,.tsv,.json,.log,.rtf,.html,.htm,.docx,.pptx,.pdf';

    const extOf = (name) => (String(name).split('.').pop() || '').toLowerCase();

    const decodeEntities = (s) => s
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
        .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&amp;/g, '&');

    const tidy = (s) => s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    // ── Minimal ZIP reader (enough for .docx / .pptx) ───────────────────
    async function inflateRaw(bytes) {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open Word or PowerPoint files. Try a PDF or text file.');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function readZip(buf) {
        const u8 = new Uint8Array(buf);
        const dv = new DataView(buf);
        let eocd = -1;
        for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
            if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('This file is not a valid Office document.');
        const count = dv.getUint16(eocd + 10, true);
        let p = dv.getUint32(eocd + 16, true);
        const entries = new Map();
        for (let i = 0; i < count; i++) {
            if (dv.getUint32(p, true) !== 0x02014b50) break;
            const method = dv.getUint16(p + 10, true);
            const csize = dv.getUint32(p + 20, true);
            const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
            const lho = dv.getUint32(p + 42, true);
            const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
            entries.set(name, { method, csize, lho });
            p += 46 + nlen + elen + clen;
        }
        return {
            names: [...entries.keys()],
            async text(name) {
                const e = entries.get(name);
                if (!e) return null;
                const nlen = dv.getUint16(e.lho + 26, true), elen = dv.getUint16(e.lho + 28, true);
                const start = e.lho + 30 + nlen + elen;
                const data = u8.subarray(start, start + e.csize);
                let out;
                if (e.method === 0) out = data;
                else if (e.method === 8) out = await inflateRaw(data);
                else throw new Error('Unsupported compression in this file.');
                return new TextDecoder('utf-8').decode(out);
            }
        };
    }

    async function docxText(file) {
        const zip = await readZip(await file.arrayBuffer());
        const xml = await zip.text('word/document.xml');
        if (!xml) throw new Error('No document text found in this Word file.');
        return tidy(decodeEntities(xml
            .replace(/<w:tab\/>/g, ' ').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, '')));
    }

    async function pptxText(file) {
        const zip = await readZip(await file.arrayBuffer());
        const slides = zip.names
            .map(n => ({ n, m: n.match(/^ppt\/slides\/slide(\d+)\.xml$/) }))
            .filter(x => x.m)
            .sort((a, b) => +a.m[1] - +b.m[1]);
        if (!slides.length) throw new Error('No slides found in this PowerPoint file.');
        const parts = [];
        for (const s of slides) {
            const xml = await zip.text(s.n);
            const body = tidy(decodeEntities(xml.replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')));
            if (body) parts.push(`Slide ${s.m[1]}\n${body}`);
        }
        return parts.join('\n\n');
    }

    // ── PDF via pdf.js (loaded the first time a PDF is chosen) ──────────
    let pdfLoading = null;
    function loadPdfJs() {
        if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
        if (!pdfLoading) {
            pdfLoading = new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'vendor/pdf.min.js';
                s.onload = () => {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
                    resolve(window.pdfjsLib);
                };
                s.onerror = () => { pdfLoading = null; reject(new Error('Could not load the PDF reader.')); };
                document.head.appendChild(s);
            });
        }
        return pdfLoading;
    }

    async function pdfText(file) {
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pages = [];
        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            let line = '';
            content.items.forEach(it => { line += it.str + (it.hasEOL ? '\n' : ' '); });
            pages.push(line);
        }
        const text = tidy(pages.join('\n\n'));
        if (!text) throw new Error('No selectable text found. This looks like a scanned PDF.');
        return text;
    }

    function htmlText(src) {
        return tidy(decodeEntities(src
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
            .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)[^>]*>/gi, '\n')
            .replace(/<[^>]+>/g, '')));
    }

    function rtfText(src) {
        return tidy(src
            .replace(/\\par[d]?/g, '\n')
            .replace(/\\'[0-9a-f]{2}/gi, '')
            .replace(/\\[a-z]+-?\d* ?/gi, '')
            .replace(/[{}]/g, ''));
    }

    // Returns the plain text of a File, or throws an Error with a student-friendly message
    async function extract(file) {
        if (!file) throw new Error('No file selected.');
        if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 15 MB.');
        const ext = extOf(file.name);
        let text;
        if (ext === 'docx') text = await docxText(file);
        else if (ext === 'pptx') text = await pptxText(file);
        else if (ext === 'pdf') text = await pdfText(file);
        else if (TEXT_EXT.includes(ext)) {
            const raw = await file.text();
            text = (ext === 'html' || ext === 'htm' || ext === 'xml') ? htmlText(raw) : ext === 'rtf' ? rtfText(raw) : tidy(raw);
        } else {
            throw new Error(`.${ext || 'unknown'} files are not supported. Use PDF, Word, PowerPoint or a text file.`);
        }
        if (!text) throw new Error('No readable text found in this file.');
        return text;
    }

    window.FileText = { extract, ACCEPT, extOf, MAX_FILE_BYTES };
})();

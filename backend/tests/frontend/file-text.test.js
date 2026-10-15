// Validation: FileText (src/utils/fileText.js) - reading study files for Study AI.
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'utils', 'fileText.js'), 'utf8');

let FT;
before(() => {
    const win = {};
    const ctx = vm.createContext({
        window: win, Blob, Response, DecompressionStream, TextDecoder, File, String, Map, Uint8Array, DataView,
        console, Math, Error, Promise
    });
    vm.runInContext(SRC, ctx);
    FT = win.FileText;
});

// ── Build a real ZIP (stored or deflated entries) in memory ─────────────────
function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
        c = (crc ^ buf[n]) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function makeZip(files, { deflate = true } = {}) {
    const locals = [], centrals = [];
    let offset = 0;
    for (const [name, content] of Object.entries(files)) {
        const nameBuf = Buffer.from(name), raw = Buffer.from(content);
        const data = deflate ? zlib.deflateRawSync(raw) : raw;
        const method = deflate ? 8 : 0;
        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(method, 8);
        lh.writeUInt32LE(crc32(raw), 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        locals.push(lh, nameBuf, data);
        const ch = Buffer.alloc(46);
        ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(method, 10);
        ch.writeUInt32LE(crc32(raw), 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24);
        ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
        centrals.push(ch, nameBuf);
        offset += 30 + nameBuf.length + data.length;
    }
    const cd = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, cd, end]);
}
const fileOf = (buf, name) => new File([buf], name);

describe('FileText.extract - plain text formats', () => {
    test('.txt and .md come back tidied', async () => {
        const t = await FT.extract(new File(['Cells\r\n\r\n\r\n\r\nare   the unit of life  \n'], 'bio.txt'));
        assert.equal(t, 'Cells\n\nare the unit of life');
        assert.equal(await FT.extract(new File(['# Title\n\nbody'], 'n.md')), '# Title\n\nbody');
    });

    test('.html loses scripts, styles and tags but keeps entities readable', async () => {
        const t = await FT.extract(new File(['<style>p{}</style><h1>Law &amp; Order</h1><script>x()</script><p>Tort law.</p>'], 'a.html'));
        assert.match(t, /Law & Order/);
        assert.match(t, /Tort law\./);
        assert.ok(!/script|style|<|x\(\)/.test(t));
    });

    test('.rtf control words are stripped', async () => {
        const t = await FT.extract(new File(['{\\rtf1\\ansi Hello\\par World}'], 'a.rtf'));
        assert.match(t, /Hello/);
        assert.match(t, /World/);
        assert.ok(!t.includes('\\'));
    });
});

describe('FileText.extract - Word and PowerPoint', () => {
    const docXml = '<w:document><w:body><w:p><w:r><w:t>Photosynthesis</w:t></w:r></w:p>' +
        '<w:p><w:r><w:t xml:space="preserve">Light &amp; water</w:t></w:r><w:r><w:tab/><w:t>make sugar.</w:t></w:r></w:p></w:body></w:document>';

    for (const deflate of [true, false]) {
        test(`.docx paragraphs are read (${deflate ? 'compressed' : 'stored'} zip)`, async () => {
            const buf = makeZip({ '[Content_Types].xml': '<x/>', 'word/document.xml': docXml }, { deflate });
            const t = await FT.extract(fileOf(buf, 'notes.docx'));
            assert.equal(t, 'Photosynthesis\nLight & water make sugar.');
        });
    }

    test('.pptx slides are read in numeric order, not file order', async () => {
        const slide = (s) => `<p:sld><a:p><a:r><a:t>${s}</a:t></a:r></a:p></p:sld>`;
        const buf = makeZip({
            'ppt/slides/slide10.xml': slide('Tenth'),
            'ppt/slides/slide2.xml': slide('Second'),
            'ppt/slides/slide1.xml': slide('First'),
            'ppt/presentation.xml': '<x/>'
        });
        const t = await FT.extract(fileOf(buf, 'deck.pptx'));
        assert.equal(t, 'Slide 1\nFirst\n\nSlide 2\nSecond\n\nSlide 10\nTenth');
    });

    test('a .docx that is not really a zip gives a friendly error', async () => {
        await assert.rejects(FT.extract(new File(['not a zip at all'], 'fake.docx')), /not a valid Office document/);
    });

    test('a .docx with no document.xml gives a friendly error', async () => {
        const buf = makeZip({ 'other.xml': '<x/>' });
        await assert.rejects(FT.extract(fileOf(buf, 'empty.docx')), /No document text/);
    });

    test('a .pptx with no slides gives a friendly error', async () => {
        const buf = makeZip({ 'ppt/presentation.xml': '<x/>' });
        await assert.rejects(FT.extract(fileOf(buf, 'empty.pptx')), /No slides/);
    });
});

describe('FileText.extract - rejects what it cannot read', () => {
    test('unsupported types say what to use instead', async () => {
        await assert.rejects(FT.extract(new File(['x'], 'photo.jpg')), /Use PDF, Word, PowerPoint or a text file/);
        await assert.rejects(FT.extract(new File(['x'], 'noextension')), /not supported/);
    });

    test('empty files are rejected', async () => {
        await assert.rejects(FT.extract(new File(['   \n  '], 'blank.txt')), /No readable text/);
    });

    test('files over 15 MB are rejected before reading', async () => {
        const big = { name: 'huge.txt', size: FT.MAX_FILE_BYTES + 1 };
        await assert.rejects(FT.extract(big), /larger than 15 MB/);
    });

    test('the file picker accepts exactly the supported types', () => {
        for (const e of ['pdf', 'docx', 'pptx', 'txt', 'md']) assert.ok(FT.ACCEPT.includes('.' + e), e);
    });
});

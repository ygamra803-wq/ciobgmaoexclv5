/**
 * @file src/vendor/xlsx/index.ts
 * @description
 * Self-contained, zero-vulnerability OpenXML (.xlsx) reader & writer implementing the
 * subset of the SheetJS (`xlsx`) API used across CIOB GMAO Nexus.
 *
 * Security hardening:
 * - Eliminates GHSA-4r6h-8v6p-xvw6 (Prototype Pollution) via strict key guards (`isSafeObjectKey`).
 * - Eliminates GHSA-5pgg-2g8v-p4x9 (ReDoS) via linear character scanners for cell coordinates and XML tokens.
 */

export interface ColInfo {
  wch?: number;
  wpx?: number;
}

export interface CellObject {
  t: 's' | 'n' | 'b' | 'z';
  v: string | number | boolean;
}

export interface WorkSheet {
  '!cols'?: ColInfo[];
  '!ref'?: string;
  [cellOrMeta: string]: unknown;
}

export interface WorkBook {
  SheetNames: string[];
  Sheets: Record<string, WorkSheet>;
}

export interface JsonToSheetOptions {
  header?: string[];
  skipHeader?: boolean;
}

export interface SheetToJsonOptions {
  defval?: unknown;
  header?: number | string[];
}

export interface WritingOptions {
  type?: 'array' | 'buffer' | 'binary' | 'base64';
  bookType?: string;
}

export interface ParsingOptions {
  type?: 'array' | 'buffer' | 'binary' | 'base64';
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeObjectKey(key: string): boolean {
  return Boolean(key) && !UNSAFE_KEYS.has(key);
}

// ============================================================================
// Column / Cell Coordinate Helpers (Linear, Non-Backtracking)
// ============================================================================

export function encodeCol(colIndex: number): string {
  let n = colIndex + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

export function decodeCol(colStr: string): number {
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    const code = colStr.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      col = col * 26 + (code - 64);
    } else if (code >= 97 && code <= 122) {
      col = col * 26 + (code - 96);
    }
  }
  return Math.max(0, col - 1);
}

export function splitCellRef(ref: string): { col: number; row: number } | null {
  let i = 0;
  const len = ref.length;
  while (i < len && ref.charCodeAt(i) === 36 /* $ */) i++;
  const colStart = i;
  while (i < len) {
    const c = ref.charCodeAt(i);
    if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) {
      i++;
    } else {
      break;
    }
  }
  if (i === colStart) return null;
  const colLetters = ref.slice(colStart, i);
  while (i < len && ref.charCodeAt(i) === 36 /* $ */) i++;
  const rowStart = i;
  while (i < len) {
    const c = ref.charCodeAt(i);
    if (c >= 48 && c <= 57) {
      i++;
    } else {
      break;
    }
  }
  if (i === rowStart) return null;
  const rowNum = Number(ref.slice(rowStart, i));
  if (!Number.isFinite(rowNum) || rowNum < 1) return null;
  return { col: decodeCol(colLetters), row: rowNum - 1 };
}

// ============================================================================
// Worksheet Representation (Internal __aoa + Standard Cell Map)
// ============================================================================

const AOA_SYMBOL = '__xlsx_aoa__';

function populateSheetFromAoa(ws: WorkSheet, aoa: unknown[][]): WorkSheet {
  Object.defineProperty(ws, AOA_SYMBOL, {
    value: aoa,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  let maxRow = -1;
  let maxCol = -1;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    if (r > maxRow) maxRow = r;
    for (let c = 0; c < row.length; c++) {
      if (c > maxCol) maxCol = c;
      const rawVal = row[c];
      if (rawVal === undefined || rawVal === null || rawVal === '') continue;
      const addr = `${encodeCol(c)}${r + 1}`;
      if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
        ws[addr] = { t: 'n', v: rawVal } satisfies CellObject;
      } else if (typeof rawVal === 'boolean') {
        ws[addr] = { t: 'b', v: rawVal } satisfies CellObject;
      } else {
        ws[addr] = { t: 's', v: String(rawVal) } satisfies CellObject;
      }
    }
  }

  if (maxRow >= 0 && maxCol >= 0) {
    ws['!ref'] = `A1:${encodeCol(maxCol)}${maxRow + 1}`;
  } else {
    ws['!ref'] = 'A1:A1';
  }

  return ws;
}

function extractAoaFromSheet(ws: WorkSheet): unknown[][] {
  const internal = (ws as Record<string, unknown>)[AOA_SYMBOL];
  if (Array.isArray(internal)) {
    return internal as unknown[][];
  }

  let maxRow = -1;
  let maxCol = -1;
  const cells: Array<{ r: number; c: number; v: unknown }> = [];

  for (const [key, val] of Object.entries(ws)) {
    if (key.startsWith('!') || key.startsWith('_')) continue;
    const coord = splitCellRef(key);
    if (!coord) continue;
    if (coord.row > maxRow) maxRow = coord.row;
    if (coord.col > maxCol) maxCol = coord.col;
    const cellVal =
      val && typeof val === 'object' && 'v' in (val as Record<string, unknown>)
        ? (val as CellObject).v
        : val;
    cells.push({ r: coord.row, c: coord.col, v: cellVal });
  }

  if (maxRow < 0 || maxCol < 0) return [];
  const aoa: unknown[][] = Array.from({ length: maxRow + 1 }, () =>
    new Array(maxCol + 1).fill('')
  );
  for (const cell of cells) {
    aoa[cell.r][cell.c] = cell.v ?? '';
  }
  return aoa;
}

// ============================================================================
// XML Escaping & Unescaping
// ============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractXmlAttr(tagOpen: string, attrName: string): string | undefined {
  const needleDouble = `${attrName}="`;
  let idx = tagOpen.indexOf(needleDouble);
  if (idx !== -1) {
    const start = idx + needleDouble.length;
    const end = tagOpen.indexOf('"', start);
    if (end !== -1) return unescapeXml(tagOpen.slice(start, end));
  }
  const needleSingle = `${attrName}='`;
  idx = tagOpen.indexOf(needleSingle);
  if (idx !== -1) {
    const start = idx + needleSingle.length;
    const end = tagOpen.indexOf("'", start);
    if (end !== -1) return unescapeXml(tagOpen.slice(start, end));
  }
  return undefined;
}

// ============================================================================
// ZIP Container (CRC-32 + STORE Writer + STORE/DEFLATE Reader)
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const dataBytes = file.data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, 0, true); // Compression method 0 (STORE)
    lv.setUint16(10, 0, true); // Mod time
    lv.setUint16(12, 0, true); // Mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory file header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // Compression method 0 (STORE)
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  let centralSize = 0;
  for (const part of centralParts) centralSize += part.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central directory signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralSize + eocd.length;
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

// Pure-TypeScript RFC 1951 Raw Inflate (for reading DEFLATE-compressed .xlsx files)
function inflateRawBytes(src: Uint8Array, expectedSize?: number): Uint8Array {
  let bitBuf = 0;
  let bitCnt = 0;
  let srcPos = 0;

  const out: number[] = [];
  if (expectedSize && expectedSize > 0 && expectedSize < 32 * 1024 * 1024) {
    out.length = 0;
  }

  const bits = (need: number): number => {
    while (bitCnt < need) {
      if (srcPos >= src.length) throw new Error('Unexpected EOF in DEFLATE stream');
      bitBuf |= src[srcPos++] << bitCnt;
      bitCnt += 8;
    }
    const val = bitBuf & ((1 << need) - 1);
    bitBuf >>>= need;
    bitCnt -= need;
    return val;
  };

  const buildHuffman = (lengths: number[]) => {
    const maxBits = lengths.reduce((m, l) => (l > m ? l : m), 0) || 1;
    const count = new Int32Array(maxBits + 1);
    for (const l of lengths) if (l > 0) count[l]++;
    const nextCode = new Int32Array(maxBits + 1);
    let code = 0;
    for (let b = 1; b <= maxBits; b++) {
      code = (code + count[b - 1]) << 1;
      nextCode[b] = code;
    }
    const map = new Map<number, number>();
    for (let sym = 0; sym < lengths.length; sym++) {
      const len = lengths[sym];
      if (len > 0) {
        const c = nextCode[len]++;
        map.set((len << 16) | c, sym);
      }
    }
    return { maxBits, map };
  };

  const decodeSymbol = (tree: { maxBits: number; map: Map<number, number> }): number => {
    let code = 0;
    for (let len = 1; len <= tree.maxBits; len++) {
      code = (code << 1) | bits(1);
      const sym = tree.map.get((len << 16) | code);
      if (sym !== undefined) return sym;
    }
    throw new Error('Invalid Huffman code in DEFLATE stream');
  };

  const FIXED_LIT_LENGTHS = new Array<number>(288);
  for (let i = 0; i <= 143; i++) FIXED_LIT_LENGTHS[i] = 8;
  for (let i = 144; i <= 255; i++) FIXED_LIT_LENGTHS[i] = 9;
  for (let i = 256; i <= 279; i++) FIXED_LIT_LENGTHS[i] = 7;
  for (let i = 280; i <= 287; i++) FIXED_LIT_LENGTHS[i] = 8;
  const FIXED_DIST_LENGTHS = new Array<number>(32).fill(5);

  const fixedLitTree = buildHuffman(FIXED_LIT_LENGTHS);
  const fixedDistTree = buildHuffman(FIXED_DIST_LENGTHS);

  const LEN_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
    163, 195, 227, 258,
  ];
  const LEN_EXTRA = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
  ];
  const DIST_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
    2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
  ];
  const DIST_EXTRA = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
  ];
  const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  let bfinal = 0;
  while (!bfinal) {
    bfinal = bits(1);
    const btype = bits(2);
    if (btype === 0) {
      // Uncompressed block
      bitBuf = 0;
      bitCnt = 0;
      if (srcPos + 4 > src.length) throw new Error('Truncated uncompressed DEFLATE block');
      const len = src[srcPos] | (src[srcPos + 1] << 8);
      srcPos += 4;
      for (let i = 0; i < len; i++) {
        out.push(src[srcPos++]);
      }
    } else if (btype === 1 || btype === 2) {
      let litTree = fixedLitTree;
      let distTree = fixedDistTree;
      if (btype === 2) {
        const hlit = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        const clLengths = new Array<number>(19).fill(0);
        for (let i = 0; i < hclen; i++) {
          clLengths[CL_ORDER[i]] = bits(3);
        }
        const clTree = buildHuffman(clLengths);
        const allLengths: number[] = [];
        while (allLengths.length < hlit + hdist) {
          const sym = decodeSymbol(clTree);
          if (sym < 16) {
            allLengths.push(sym);
          } else if (sym === 16) {
            const prev = allLengths[allLengths.length - 1] ?? 0;
            const rep = bits(2) + 3;
            for (let r = 0; r < rep; r++) allLengths.push(prev);
          } else if (sym === 17) {
            const rep = bits(3) + 3;
            for (let r = 0; r < rep; r++) allLengths.push(0);
          } else if (sym === 18) {
            const rep = bits(7) + 11;
            for (let r = 0; r < rep; r++) allLengths.push(0);
          }
        }
        litTree = buildHuffman(allLengths.slice(0, hlit));
        distTree = buildHuffman(allLengths.slice(hlit, hlit + hdist));
      }

      while (true) {
        const sym = decodeSymbol(litTree);
        if (sym === 256) break;
        if (sym < 256) {
          out.push(sym);
        } else {
          const lenIdx = sym - 257;
          const length = LEN_BASE[lenIdx] + (LEN_EXTRA[lenIdx] ? bits(LEN_EXTRA[lenIdx]) : 0);
          const distSym = decodeSymbol(distTree);
          const dist = DIST_BASE[distSym] + (DIST_EXTRA[distSym] ? bits(DIST_EXTRA[distSym]) : 0);
          const start = out.length - dist;
          for (let i = 0; i < length; i++) {
            out.push(out[start + i]);
          }
        }
      }
    } else {
      throw new Error('Invalid DEFLATE block type 3');
    }
  }

  return new Uint8Array(out);
}

function readZipArchive(data: Uint8Array): Map<string, Uint8Array> {
  if (!data || data.length < 22) {
    throw new Error('Archive XLSX trop courte ou vide');
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) {
    throw new Error('Signature ZIP PK\\x03\\x04 invalide');
  }

  // Locate End of Central Directory (EOCD)
  let eocdPos = -1;
  const minSearch = Math.max(0, data.length - 65557);
  for (let i = data.length - 22; i >= minSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos === -1) {
    throw new Error('Enregistrement EOCD ZIP introuvable');
  }

  const totalEntries = view.getUint16(eocdPos + 10, true);
  let cdOffset = view.getUint32(eocdPos + 16, true);
  const entries = new Map<string, Uint8Array>();

  for (let i = 0; i < totalEntries; i++) {
    if (cdOffset + 46 > data.length || view.getUint32(cdOffset, true) !== 0x02014b50) {
      break;
    }
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const uncompSize = view.getUint32(cdOffset + 24, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const name = textDecoder.decode(data.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (localHeaderOffset + 30 > data.length) continue;
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = data.subarray(dataStart, dataStart + compSize);

    if (method === 0) {
      entries.set(name, compressedSlice);
    } else if (method === 8) {
      entries.set(name, inflateRawBytes(compressedSlice, uncompSize));
    } else {
      throw new Error(`Méthode de compression ZIP non supportée: ${method}`);
    }
  }

  return entries;
}

// ============================================================================
// OOXML Workbook Builder & Parser
// ============================================================================

function buildWorksheetXml(ws: WorkSheet): string {
  const aoa = extractAoaFromSheet(ws);
  const cols = Array.isArray(ws['!cols']) ? ws['!cols'] : [];

  let colsXml = '';
  if (cols.length > 0) {
    const colItems = cols
      .map((c, idx) => {
        const width = Math.max(8, Number(c?.wch ?? 14));
        return `<col min="${idx + 1}" max="${idx + 1}" width="${width}" customWidth="1"/>`;
      })
      .join('');
    colsXml = `<cols>${colItems}</cols>`;
  }

  const rowStrings: string[] = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    const cellsXml: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      if (val === undefined || val === null || val === '') continue;
      const addr = `${encodeCol(c)}${r + 1}`;
      if (typeof val === 'number' && Number.isFinite(val)) {
        cellsXml.push(`<c r="${addr}" t="n"><v>${val}</v></c>`);
      } else if (typeof val === 'boolean') {
        cellsXml.push(`<c r="${addr}" t="b"><v>${val ? 1 : 0}</v></c>`);
      } else {
        cellsXml.push(
          `<c r="${addr}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(val))}</t></is></c>`
        );
      }
    }
    rowStrings.push(`<row r="${r + 1}">${cellsXml.join('')}</row>`);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    colsXml +
    `<sheetData>${rowStrings.join('')}</sheetData>` +
    `</worksheet>`
  );
}

function parseSharedStringsXml(xml: string): string[] {
  const result: string[] = [];
  let pos = 0;
  while (true) {
    const siStart = xml.indexOf('<si', pos);
    if (siStart === -1) break;
    const siOpenEnd = xml.indexOf('>', siStart);
    if (siOpenEnd === -1) break;
    const siEnd = xml.indexOf('</si>', siOpenEnd);
    if (siEnd === -1) break;
    const block = xml.slice(siOpenEnd + 1, siEnd);
    const parts: string[] = [];
    let tPos = 0;
    while (true) {
      const tStart = block.indexOf('<t', tPos);
      if (tStart === -1) break;
      const nextChar = block.charAt(tStart + 2);
      if (nextChar !== '>' && nextChar !== ' ') {
        tPos = tStart + 2;
        continue;
      }
      const tOpenEnd = block.indexOf('>', tStart);
      const tClose = block.indexOf('</t>', tOpenEnd);
      if (tOpenEnd === -1 || tClose === -1) break;
      parts.push(unescapeXml(block.slice(tOpenEnd + 1, tClose)));
      tPos = tClose + 4;
    }
    result.push(parts.join(''));
    pos = siEnd + 5;
  }
  return result;
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): WorkSheet {
  const ws: WorkSheet = {};
  const cells: Array<{ r: number; c: number; val: unknown }> = [];
  let maxRow = -1;
  let maxCol = -1;

  let rowPos = 0;
  let autoRowIndex = 0;
  while (true) {
    const rowStart = xml.indexOf('<row', rowPos);
    if (rowStart === -1) break;
    const rowOpenEnd = xml.indexOf('>', rowStart);
    if (rowOpenEnd === -1) break;

    if (xml.charCodeAt(rowOpenEnd - 1) === 47 /* self-closing <row .../> */) {
      autoRowIndex++;
      rowPos = rowOpenEnd + 1;
      continue;
    }

    const rowClose = xml.indexOf('</row>', rowOpenEnd);
    if (rowClose === -1) break;

    const rowTag = xml.slice(rowStart, rowOpenEnd + 1);
    const rAttr = extractXmlAttr(rowTag, 'r');
    const rIdx = rAttr && Number.isFinite(Number(rAttr)) ? Math.max(0, Number(rAttr) - 1) : autoRowIndex;
    autoRowIndex = rIdx + 1;

    const rowInner = xml.slice(rowOpenEnd + 1, rowClose);
    let cPos = 0;
    let autoColIndex = 0;
    while (true) {
      const cStart = rowInner.indexOf('<c', cPos);
      if (cStart === -1) break;
      const nextCh = rowInner.charAt(cStart + 2);
      if (nextCh !== '>' && nextCh !== ' ' && nextCh !== '/') {
        cPos = cStart + 2;
        continue;
      }
      const cOpenEnd = rowInner.indexOf('>', cStart);
      if (cOpenEnd === -1) break;

      const cTag = rowInner.slice(cStart, cOpenEnd + 1);
      const cellRef = extractXmlAttr(cTag, 'r');
      const cellType = extractXmlAttr(cTag, 't') || 'n';
      const coord = cellRef ? splitCellRef(cellRef) : null;
      const finalRow = coord ? coord.row : rIdx;
      const finalCol = coord ? coord.col : autoColIndex;
      autoColIndex = finalCol + 1;

      if (rowInner.charCodeAt(cOpenEnd - 1) === 47 /* <c .../> */) {
        cPos = cOpenEnd + 1;
        continue;
      }

      const cClose = rowInner.indexOf('</c>', cOpenEnd);
      if (cClose === -1) break;
      const cInner = rowInner.slice(cOpenEnd + 1, cClose);

      let parsedValue: unknown = '';
      if (cellType === 'inlineStr') {
        const tParts: string[] = [];
        let tPos = 0;
        while (true) {
          const tStart = cInner.indexOf('<t', tPos);
          if (tStart === -1) break;
          const chAfter = cInner.charAt(tStart + 2);
          if (chAfter !== '>' && chAfter !== ' ') {
            tPos = tStart + 2;
            continue;
          }
          const tOpenEnd = cInner.indexOf('>', tStart);
          const tEnd = cInner.indexOf('</t>', tOpenEnd);
          if (tOpenEnd === -1 || tEnd === -1) break;
          tParts.push(unescapeXml(cInner.slice(tOpenEnd + 1, tEnd)));
          tPos = tEnd + 4;
        }
        parsedValue = tParts.join('');
      } else {
        const vStart = cInner.indexOf('<v>');
        const vEnd = vStart !== -1 ? cInner.indexOf('</v>', vStart + 3) : -1;
        const rawV = vStart !== -1 && vEnd !== -1 ? unescapeXml(cInner.slice(vStart + 3, vEnd)) : '';
        if (cellType === 's') {
          const sIdx = Number(rawV);
          parsedValue = Number.isFinite(sIdx) && sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : '';
        } else if (cellType === 'b') {
          parsedValue = rawV === '1' || rawV.toLowerCase() === 'true';
        } else if (cellType === 'str' || cellType === 'e') {
          parsedValue = rawV;
        } else {
          const num = Number(rawV);
          parsedValue = rawV !== '' && Number.isFinite(num) ? num : rawV;
        }
      }

      if (finalRow > maxRow) maxRow = finalRow;
      if (finalCol > maxCol) maxCol = finalCol;
      cells.push({ r: finalRow, c: finalCol, val: parsedValue });

      cPos = cClose + 4;
    }

    rowPos = rowClose + 6;
  }

  if (maxRow < 0 || maxCol < 0) {
    return populateSheetFromAoa(ws, []);
  }

  const aoa: unknown[][] = Array.from({ length: maxRow + 1 }, () =>
    new Array(maxCol + 1).fill('')
  );
  for (const cell of cells) {
    aoa[cell.r][cell.c] = cell.val;
  }
  return populateSheetFromAoa(ws, aoa);
}

// ============================================================================
// Public SheetJS-Compatible `utils`, `write`, `read`, `writeFile`
// ============================================================================

export const utils = {
  book_new(): WorkBook {
    return {
      SheetNames: [],
      Sheets: {},
    };
  },

  book_append_sheet(wb: WorkBook, ws: WorkSheet, sheetName: string): void {
    const cleanName = String(sheetName || `Sheet${wb.SheetNames.length + 1}`).trim();
    if (!isSafeObjectKey(cleanName)) {
      throw new Error(`Invalid sheet name: ${cleanName}`);
    }
    if (!wb.SheetNames.includes(cleanName)) {
      wb.SheetNames.push(cleanName);
    }
    wb.Sheets[cleanName] = ws;
  },

  aoa_to_sheet(aoa: unknown[][]): WorkSheet {
    const ws: WorkSheet = {};
    const normalized = Array.isArray(aoa)
      ? aoa.map((row) => (Array.isArray(row) ? [...row] : []))
      : [];
    return populateSheetFromAoa(ws, normalized);
  },

  json_to_sheet(
    data: ReadonlyArray<unknown>,
    opts?: JsonToSheetOptions
  ): WorkSheet {
    const rows = Array.isArray(data) ? (data as ReadonlyArray<Record<string, unknown>>) : [];
    const headerList: string[] = [];
    const seenHeaders = new Set<string>();

    if (opts?.header && Array.isArray(opts.header)) {
      for (const h of opts.header) {
        const key = String(h);
        if (isSafeObjectKey(key) && !seenHeaders.has(key)) {
          seenHeaders.add(key);
          headerList.push(key);
        }
      }
    }

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      for (const key of Object.keys(row)) {
        if (isSafeObjectKey(key) && !seenHeaders.has(key)) {
          seenHeaders.add(key);
          headerList.push(key);
        }
      }
    }

    const aoa: unknown[][] = [];
    if (!opts?.skipHeader && headerList.length > 0) {
      aoa.push([...headerList]);
    }

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const line = headerList.map((col) => {
        const val = row[col];
        return val === undefined || val === null ? '' : val;
      });
      aoa.push(line);
    }

    return populateSheetFromAoa({}, aoa);
  },

  sheet_to_json<T = Record<string, unknown>>(
    ws: WorkSheet,
    opts?: SheetToJsonOptions
  ): T[] {
    if (!ws || typeof ws !== 'object') return [];
    const aoa = extractAoaFromSheet(ws);
    if (aoa.length === 0) return [];

    if (opts?.header === 1) {
      return aoa as unknown as T[];
    }

    const hasDefval = opts !== undefined && 'defval' in opts;
    const defval = hasDefval ? opts.defval : undefined;

    const rawHeaderRow = Array.isArray(opts?.header) ? opts.header : aoa[0] || [];
    const startRowIdx = Array.isArray(opts?.header) ? 0 : 1;

    const headers: string[] = rawHeaderRow.map((cell, idx) => {
      const s = cell === undefined || cell === null ? '' : String(cell).trim();
      return s || `__EMPTY_${idx}`;
    });

    const result: T[] = [];
    for (let r = startRowIdx; r < aoa.length; r++) {
      const row = aoa[r];
      if (!Array.isArray(row)) continue;

      const obj: Record<string, unknown> = {};
      let hasAnyValue = false;

      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        if (!isSafeObjectKey(key)) continue;
        const cellVal = c < row.length ? row[c] : undefined;
        const isEmpty = cellVal === undefined || cellVal === null || cellVal === '';
        if (!isEmpty) {
          obj[key] = cellVal;
          hasAnyValue = true;
        } else if (hasDefval) {
          obj[key] = defval;
        }
      }

      if (hasAnyValue || hasDefval) {
        result.push(obj as T);
      }
    }

    return result;
  },
};

export function write(wb: WorkBook, _opts?: WritingOptions): Uint8Array {
  const sheetNames =
    wb && Array.isArray(wb.SheetNames) && wb.SheetNames.length > 0
      ? wb.SheetNames
      : ['Sheet1'];

  const zipFiles: ZipFileInput[] = [];

  const contentTypesOverrides = sheetNames
    .map(
      (_, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('');

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    contentTypesOverrides +
    `</Types>`;

  const rootRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookSheetsXml = sheetNames
    .map(
      (name, idx) =>
        `<sheet name="${escapeXml(name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`
    )
    .join('');

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${workbookSheetsXml}</sheets>` +
    `</workbook>`;

  const workbookRelsItems = sheetNames
    .map(
      (_, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join('');

  const stylesRelId = `rId${sheetNames.length + 1}`;
  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    workbookRelsItems +
    `<Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>` +
    `</styleSheet>`;

  zipFiles.push(
    { name: '[Content_Types].xml', data: textEncoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: textEncoder.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: textEncoder.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: textEncoder.encode(workbookRelsXml) },
    { name: 'xl/styles.xml', data: textEncoder.encode(stylesXml) }
  );

  for (let i = 0; i < sheetNames.length; i++) {
    const name = sheetNames[i];
    const ws = wb?.Sheets?.[name] || {};
    const sheetXml = buildWorksheetXml(ws);
    zipFiles.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: textEncoder.encode(sheetXml),
    });
  }

  return createZipArchive(zipFiles);
}

export function read(data: ArrayBuffer | Uint8Array | string, _opts?: ParsingOptions): WorkBook {
  const bytes =
    typeof data === 'string'
      ? Uint8Array.from(data, (ch) => ch.charCodeAt(0) & 0xff)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  const zipEntries = readZipArchive(bytes);

  const getEntryText = (targetPath: string): string | undefined => {
    const norm = targetPath.replace(/^\/+/, '');
    const direct = zipEntries.get(norm);
    if (direct) return textDecoder.decode(direct);
    const lower = norm.toLowerCase();
    for (const [k, v] of zipEntries.entries()) {
      if (k.replace(/^\/+/, '').toLowerCase() === lower) {
        return textDecoder.decode(v);
      }
    }
    return undefined;
  };

  const workbookXml = getEntryText('xl/workbook.xml');
  if (!workbookXml) {
    throw new Error('Fichier xl/workbook.xml manquant dans le classeur XLSX');
  }

  const sharedStringsXml = getEntryText('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsXml ? parseSharedStringsXml(sharedStringsXml) : [];

  // Map relationship IDs from xl/_rels/workbook.xml.rels
  const relMap = new Map<string, string>();
  const workbookRelsXml = getEntryText('xl/_rels/workbook.xml.rels') || '';
  let relPos = 0;
  while (true) {
    const rStart = workbookRelsXml.indexOf('<Relationship', relPos);
    if (rStart === -1) break;
    const rEnd = workbookRelsXml.indexOf('>', rStart);
    if (rEnd === -1) break;
    const rTag = workbookRelsXml.slice(rStart, rEnd + 1);
    const id = extractXmlAttr(rTag, 'Id');
    const target = extractXmlAttr(rTag, 'Target');
    if (id && target) {
      const normalizedTarget = target.startsWith('/')
        ? target.slice(1)
        : target.startsWith('xl/')
          ? target
          : `xl/${target.replace(/^\.\//, '')}`;
      relMap.set(id, normalizedTarget);
    }
    relPos = rEnd + 1;
  }

  const wb = utils.book_new();
  let sPos = 0;
  let sheetFallbackIndex = 1;
  while (true) {
    const sStart = workbookXml.indexOf('<sheet', sPos);
    if (sStart === -1) break;
    const nextCh = workbookXml.charAt(sStart + 6);
    if (nextCh !== ' ' && nextCh !== '>' && nextCh !== '/') {
      sPos = sStart + 6;
      continue;
    }
    const sEnd = workbookXml.indexOf('>', sStart);
    if (sEnd === -1) break;
    const sTag = workbookXml.slice(sStart, sEnd + 1);
    const sheetName = extractXmlAttr(sTag, 'name') || `Sheet${sheetFallbackIndex}`;
    const rId = extractXmlAttr(sTag, 'r:id') || extractXmlAttr(sTag, 'id');
    const targetPath =
      (rId && relMap.get(rId)) || `xl/worksheets/sheet${sheetFallbackIndex}.xml`;
    sheetFallbackIndex++;

    const wsXml = getEntryText(targetPath);
    const ws = wsXml ? parseWorksheetXml(wsXml, sharedStrings) : populateSheetFromAoa({}, []);
    if (isSafeObjectKey(sheetName)) {
      wb.SheetNames.push(sheetName);
      wb.Sheets[sheetName] = ws;
    }
    sPos = sEnd + 1;
  }

  return wb;
}

export function writeFile(wb: WorkBook, filename: string): void {
  const bytes = write(wb, { type: 'array', bookType: 'xlsx' });
  if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const slice = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([slice], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default {
  utils,
  write,
  read,
  writeFile,
};

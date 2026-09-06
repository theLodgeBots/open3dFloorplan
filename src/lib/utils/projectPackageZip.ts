/** OpenPlan3D package ZIP profile: stored UTF-8 files, one disk, no descriptors or ZIP64.
 * Based on https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT.
 * Bounded before allocation/extraction; paths and both directories must agree.
 */
export const PACKAGE_LIMIT = 64 * 1024 * 1024;
export const PACKAGE_ENTRIES = 512;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const packageError = (message: string): never => { throw new Error(`Invalid project package: ${message}`); };
export function safePackagePath(name: string): boolean {
  return name.length <= 200 && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(name);
}
function checkPathTree(names: Iterable<string>) {
  const paths = new Set([...names].map(name => name.toLowerCase()));
  for (const name of paths) {
    const parts = name.split('/'); parts.pop();
    while (parts.length) {
      if (paths.has(parts.join('/'))) packageError('A file path is also used as a directory.');
      parts.pop();
    }
  }
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function readPackageZip(bytes: Uint8Array): Record<string, Uint8Array> {
  if (bytes.length < 22 || bytes.length > PACKAGE_LIMIT) packageError('The file must be a ZIP package under 64 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p: number) => view.getUint16(p, true), u32 = (p: number) => view.getUint32(p, true);
  const end = bytes.length - 22;
  if (u32(end) !== 0x06054b50 || u16(end + 4) || u16(end + 6) || u16(end + 20)) packageError('Unsupported ZIP layout. Export a new project package from OpenPlan3D.');
  const count = u16(end + 10), offset = u32(end + 16), size = u32(end + 12);
  if (!count || count > PACKAGE_ENTRIES || u16(end + 8) !== count || offset + size !== end) packageError('Invalid ZIP directory or too many files.');
  const entries: Record<string, Uint8Array> = Object.create(null), names = new Set<string>();
  let pos = offset, localEnd = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || u32(pos) !== 0x02014b50) packageError('The ZIP directory is damaged.');
    const flags = u16(pos + 8), method = u16(pos + 10), length = u32(pos + 24), nameLength = u16(pos + 28);
    const extra = u16(pos + 30), comment = u16(pos + 32), local = u32(pos + 42), crc = u32(pos + 16);
    if ((flags & ~0x800) || method !== 0 || u32(pos + 20) !== length || extra || comment || u16(pos + 34) ||
        ![0, 0x8000].includes(u32(pos + 38) >>> 16 & 0xf000) || (u32(pos + 38) & 16) || pos + 46 + nameLength > end) packageError('Only regular, uncompressed package files are supported.');
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    if (!safePackagePath(name) || names.has(name.toLowerCase())) packageError('Duplicate or unsafe file path.');
    names.add(name.toLowerCase());
    if (local !== localEnd || local + 30 > offset || u32(local) !== 0x04034b50 || u16(local + 6) !== flags ||
        u16(local + 8) !== method || u32(local + 14) !== crc || u32(local + 18) !== length || u32(local + 22) !== length ||
        u16(local + 26) !== nameLength || u16(local + 28) !== 0) packageError('The ZIP file headers disagree.');
    const start = local + 30 + nameLength;
    localEnd = start + length;
    if (localEnd > offset || decoder.decode(bytes.subarray(local + 30, start)) !== name) packageError('The ZIP file boundaries disagree.');
    const content = bytes.subarray(start, localEnd);
    if (crc32(content) !== crc) packageError(`The file ${name} is damaged.`);
    entries[name] = content;
    pos += 46 + nameLength;
  }
  if (pos !== end || localEnd !== offset) packageError('Unexpected ZIP data.');
  checkPathTree(names);
  return entries;
}
export function writePackageZip(entries: Record<string, Uint8Array>): Uint8Array<ArrayBuffer> {
  const files = Object.entries(entries), names = new Set<string>();
  if (!files.length || files.length > PACKAGE_ENTRIES) packageError('Too many package files.');
  let total = 22;
  for (const [name, bytes] of files) {
    if (!safePackagePath(name) || names.has(name.toLowerCase())) packageError('Duplicate or unsafe file path.');
    names.add(name.toLowerCase()); total += 76 + name.length * 2 + bytes.length;
  }
  if (total > PACKAGE_LIMIT) packageError('The project and attachments exceed the 64 MiB package limit.');
  checkPathTree(names);
  const bytes = new Uint8Array(total), view = new DataView(bytes.buffer);
  const u16 = (p: number, n: number) => view.setUint16(p, n, true), u32 = (p: number, n: number) => view.setUint32(p, n, true);
  const central: { name: Uint8Array; offset: number; size: number; crc: number }[] = [];
  let pos = 0;
  for (const [path, data] of files) {
    const name = encoder.encode(path), crc = crc32(data);
    central.push({ name, offset: pos, size: data.length, crc });
    u32(pos, 0x04034b50); u16(pos + 4, 20); u16(pos + 6, 0x800); u32(pos + 14, crc);
    u32(pos + 18, data.length); u32(pos + 22, data.length); u16(pos + 26, name.length);
    bytes.set(name, pos + 30); bytes.set(data, pos + 30 + name.length); pos += 30 + name.length + data.length;
  }
  const directory = pos;
  for (const file of central) {
    u32(pos, 0x02014b50); u16(pos + 4, 20); u16(pos + 6, 20); u16(pos + 8, 0x800);
    u32(pos + 16, file.crc); u32(pos + 20, file.size); u32(pos + 24, file.size); u16(pos + 28, file.name.length); u32(pos + 42, file.offset);
    bytes.set(file.name, pos + 46); pos += 46 + file.name.length;
  }
  u32(pos, 0x06054b50); u16(pos + 8, files.length); u16(pos + 10, files.length); u32(pos + 12, pos - directory); u32(pos + 16, directory);
  return bytes;
}
export function packageJSON(bytes: Uint8Array | undefined): any {
  if (!bytes || bytes.length > 32 * 1024 * 1024) packageError('Missing or oversized JSON document.');
  const raw = decoder.decode(bytes!);
  let value;
  try { value = JSON.parse(raw); } catch { packageError('A JSON document is unreadable.'); }
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{' || raw[i] === '[') {
      stack.push(raw[i] === '{' ? new Set() : null);
      if (stack.length > 100) packageError('JSON nesting is too deep.');
    } else if (raw[i] === '}' || raw[i] === ']') stack.pop();
    else if (raw[i] === '"') {
      const start = i++;
      for (; i < raw.length; i++) { if (raw[i] === '\\') i++; else if (raw[i] === '"') break; }
      let next = i + 1; while (/\s/.test(raw[next] ?? '') && next < raw.length) next++;
      const keys = stack.at(-1);
      if (raw[next] === ':' && keys) {
        const key = JSON.parse(raw.slice(start, i + 1));
        if (keys.has(key)) packageError('A JSON document contains duplicate keys.');
        keys.add(key);
      }
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) packageError('Expected a JSON object.');
  return value;
}
export const jsonBytes = (value: unknown) => encoder.encode(JSON.stringify(value));

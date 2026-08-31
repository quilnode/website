import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import test from "node:test";
import { stripPNGMetadata } from "../scripts/png-privacy.mjs";
import { sanitizeDirectory } from "../scripts/strip-image-metadata.mjs";

const signature = Buffer.from("89504e470d0a1a0a", "hex");
function chunk(type, data = Buffer.alloc(0)) {
  const body = Buffer.concat([Buffer.from(type), Buffer.from(data)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}
const header = chunk("IHDR", Buffer.from("00000001000000010806000000", "hex"));
const pixels = chunk("IDAT", deflateSync(Buffer.from([0, 22, 166, 255, 255])));
const end = chunk("IEND");
const minimal = Buffer.concat([signature, header, pixels, end]);

test("strips all ancillary metadata, including unknown private chunks, without changing image bytes", () => {
  const metadata = [
    "eXIf",
    "tEXt",
    "iTXt",
    "zTXt",
    "tIME",
    "iCCP",
    "sRGB",
    "pHYs",
    "vpAg",
  ];
  const source = Buffer.concat([
    signature,
    header,
    ...metadata.map((type) => chunk(type, "metadata fixture")),
    pixels,
    end,
  ]);
  assert.deepEqual(stripPNGMetadata(source), minimal);
});

test("strips payloads after the final PNG chunk", () => {
  assert.deepEqual(
    stripPNGMetadata(Buffer.concat([minimal, Buffer.from("trailing fixture")])),
    minimal,
  );
});

test("sanitization is idempotent and retains palette transparency", () => {
  const paletteHeader = chunk(
    "IHDR",
    Buffer.from("00000001000000010803000000", "hex"),
  );
  const source = Buffer.concat([
    signature,
    paletteHeader,
    chunk("PLTE", Buffer.from([22, 166, 255])),
    chunk("tRNS", Buffer.from([128])),
    chunk("IDAT", deflateSync(Buffer.from([0, 0]))),
    end,
  ]);
  assert.deepEqual(stripPNGMetadata(source), source);
  assert.deepEqual(stripPNGMetadata(stripPNGMetadata(source)), source);
});

test("rejects bad signatures, truncation, missing endings, and invalid headers", () => {
  for (const source of [
    Buffer.from("not a PNG"),
    minimal.subarray(0, 16),
    minimal.subarray(0, minimal.length - 12),
    Buffer.concat([signature, pixels, end]),
    Buffer.concat([signature, header, header, pixels, end]),
    Buffer.concat([signature, header, end]),
  ])
    assert.throws(() => stripPNGMetadata(source), /PNG/);
});

test("rejects corrupt chunk checksums", () => {
  const corrupt = Buffer.from(minimal);
  corrupt[29] ^= 1;
  assert.throws(() => stripPNGMetadata(corrupt), /checksum/);
});

test("rejects unknown critical chunks instead of damaging an image", () => {
  const source = Buffer.concat([signature, header, chunk("ABCD"), pixels, end]);
  assert.throws(() => stripPNGMetadata(source), /critical/);
});

test("does not silently remove animation frames", () => {
  for (const type of ["acTL", "fcTL", "fdAT"]) {
    const source = Buffer.concat([signature, header, chunk(type), pixels, end]);
    assert.throws(() => stripPNGMetadata(source), /static PNG/);
  }
});

test("rejects high-bit chunk names instead of treating them as ASCII", () => {
  const invalidHeader = Buffer.from(header);
  invalidHeader[4] |= 0x80;
  invalidHeader.writeUInt32BE(
    crc32(invalidHeader.subarray(4, -4)),
    invalidHeader.length - 4,
  );
  assert.throws(
    () =>
      stripPNGMetadata(Buffer.concat([signature, invalidHeader, pixels, end])),
    /chunk type/,
  );
});

async function scratchDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "quilnode-png-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("sanitizes nested filenames literally and leaves clean images untouched", async (t) => {
  const directory = await scratchDirectory(t);
  const nested = path.join(directory, "folder#1?%");
  await mkdir(nested);
  const file = path.join(nested, "preview #1?%.PNG");
  const source = Buffer.concat([
    signature,
    header,
    chunk("tEXt", "metadata fixture"),
    pixels,
    end,
  ]);
  await writeFile(file, source);
  const root = pathToFileURL(directory + path.sep);
  await sanitizeDirectory(root);
  assert.deepEqual(await readFile(file), minimal);
  await utimes(file, 1, 1);
  const before = await stat(file);
  await sanitizeDirectory(root);
  const after = await stat(file);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.deepEqual(await readdir(nested), [path.basename(file)]);
});

test("a malformed input is not replaced or left with temporary files", async (t) => {
  const directory = await scratchDirectory(t);
  const file = path.join(directory, "invalid.png");
  const original = Buffer.from("invalid PNG fixture");
  await writeFile(file, original);
  await assert.rejects(
    sanitizeDirectory(pathToFileURL(directory + path.sep)),
    /PNG signature/,
  );
  assert.deepEqual(await readFile(file), original);
  assert.deepEqual(await readdir(directory), ["invalid.png"]);
});

test("asset sanitization never follows symlinks", async (t) => {
  const directory = await scratchDirectory(t);
  const outside = path.join(directory, "outside.png");
  const publicRoot = path.join(directory, "public");
  await mkdir(publicRoot);
  const original = Buffer.concat([
    signature,
    header,
    chunk("tEXt", "outside fixture"),
    pixels,
    end,
  ]);
  await writeFile(outside, original);
  await symlink(outside, path.join(publicRoot, "linked.png"));
  await assert.rejects(
    sanitizeDirectory(pathToFileURL(publicRoot + path.sep)),
    /symlinks/,
  );
  assert.deepEqual(await readFile(outside), original);
});

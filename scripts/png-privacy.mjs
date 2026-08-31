import { crc32 } from "node:zlib";

const signature = Buffer.from("89504e470d0a1a0a", "hex");
const imageChunks = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);

/** Keep static image bytes and transparency, stripping all other chunks and trailing data. */
export function stripPNGMetadata(source) {
  if (!source.subarray(0, 8).equals(signature))
    throw new Error("Invalid PNG signature");
  const retained = [signature];
  let hasImageData = false;
  for (let offset = 8; offset < source.length;) {
    if (offset + 12 > source.length) throw new Error("Truncated PNG chunk");
    const length = source.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > source.length) throw new Error("Invalid PNG chunk length");
    const type = source.toString("latin1", offset + 4, offset + 8);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type))
      throw new Error("Invalid PNG chunk type");
    if (
      source.readUInt32BE(end - 4) !==
      crc32(source.subarray(offset + 4, end - 4))
    ) {
      throw new Error("Invalid PNG checksum");
    }
    if (
      (offset === 8 && type !== "IHDR") ||
      (type === "IHDR" && (offset !== 8 || length !== 13))
    ) {
      throw new Error("Invalid PNG header");
    }
    if (["acTL", "fcTL", "fdAT"].includes(type)) {
      throw new Error(
        "Export a static PNG before publishing; animation is not stripped silently",
      );
    }
    if (imageChunks.has(type)) retained.push(source.subarray(offset, end));
    else if (type[0] === type[0].toUpperCase())
      throw new Error("Unsupported critical PNG chunk");
    if (type === "IDAT") hasImageData = true;
    if (type === "IEND") {
      if (!hasImageData || length !== 0) throw new Error("Invalid PNG ending");
      return Buffer.concat(retained);
    }
    offset = end;
  }
  throw new Error("Missing PNG ending");
}

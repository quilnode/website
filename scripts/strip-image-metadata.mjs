import { randomUUID } from "node:crypto";
import { open, readFile, readdir, rename, unlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { stripPNGMetadata } from "./png-privacy.mjs";

export async function sanitizeDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error("Public assets must not be symlinks");
    const file = new URL(
      encodeURIComponent(entry.name) + (entry.isDirectory() ? "/" : ""),
      directory,
    );
    if (entry.isDirectory()) await sanitizeDirectory(file);
    else if (/\.png$/i.test(entry.name)) {
      const source = await readFile(file);
      const clean = stripPNGMetadata(source);
      if (source.equals(clean)) continue;
      const temporary = new URL(`.png-clean-${randomUUID()}`, directory);
      const handle = await open(temporary, "wx", 0o644);
      try {
        // Replace atomically so an interrupted write cannot corrupt the source image.
        await handle.writeFile(clean);
        await handle.close();
        await rename(temporary, file);
      } finally {
        await handle.close();
        await unlink(temporary).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await sanitizeDirectory(new URL("../public/", import.meta.url));
}

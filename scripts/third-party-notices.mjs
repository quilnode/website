import { readFile } from "node:fs/promises";

// These packages contribute code or fonts to the browser bundle, not just the build.
export const shippedPackages = [
  "@vercel/analytics",
  "react",
  "react-dom",
  "scheduler",
  "react-icons",
  "@fontsource-variable/inter",
];

export function thirdPartyNotices() {
  return {
    name: "quilnode-third-party-notices",
    apply: "build",
    async generateBundle() {
      const sections = [
        "QuilNode website — third-party notices",
        "Only Feather glyphs from the React Icons collection are bundled.",
      ];
      for (const name of shippedPackages) {
        const base = new URL(`../node_modules/${name}/`, import.meta.url);
        const { version } = JSON.parse(
          await readFile(new URL("package.json", base), "utf8"),
        );
        const license = await readFile(new URL("LICENSE", base), "utf8");
        sections.push(`${name} ${version}\n\n${license.trim()}`);
      }
      const feather = await readFile(
        new URL("../assets/licenses/feather.txt", import.meta.url),
        "utf8",
      );
      sections.push(
        `Feather icons\nhttps://github.com/feathericons/feather\n\n${feather.trim()}`,
      );
      this.emitFile({
        type: "asset",
        fileName: "third-party-notices.txt",
        source: `${sections.join("\n\n────────────────────\n\n")}\n`,
      });
    },
  };
}

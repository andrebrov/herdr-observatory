import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
/** Resolve installed assets locally; no CDN, copied vendor source, or runtime server. */
export async function dashboardHTML(): Promise<string> {
  const [html, vendor] = await Promise.all([
    readFile(new URL("../ui/index.html", import.meta.url), "utf8"),
    readFile(
      fileURLToPath(import.meta.resolve("morphdom/dist/morphdom-umd.js")),
      "utf8",
    ),
  ]);
  return html.replace(
    "<!-- LOCAL_VENDOR -->",
    () => `<script>${vendor.replaceAll("</script", "<\\/script")}</script>`,
  );
}

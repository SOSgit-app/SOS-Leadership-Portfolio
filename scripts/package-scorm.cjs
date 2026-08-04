/**
 * Builds dist/sos-leadership-portfolio-scorm.zip from the current source tree.
 * Only files listed here are included (never node_modules).
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist");
const OUT_ZIP = path.join(OUT_DIR, "sos-leadership-portfolio-scorm.zip");

const FILES = [
  "imsmanifest.xml",
  "index.html",
  "assets/styles.css",
  "shared/lz-string.min.js",
  "shared/scorm.js",
  "shared/jszip.min.js",
  "shared/app.js",
];

async function main() {
  const zip = new JSZip();
  const builtAt = new Date().toISOString();

  for (const rel of FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      console.error("Missing required file:", rel);
      process.exit(1);
    }
    let body = fs.readFileSync(abs);
    if (rel === "index.html") {
      const html = body.toString("utf8");
      const stamp = `<!-- scorm-package:${builtAt} -->`;
      const next = html.includes("scorm-package:")
        ? html.replace(/<!-- scorm-package:[^>]+ -->/, stamp)
        : html.replace("</html>", `\n${stamp}\n</html>`);
      body = Buffer.from(next, "utf8");
    }
    zip.file(rel, body);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const buf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(OUT_ZIP, buf);
  console.log("Created", OUT_ZIP, `(${buf.length} bytes)`);
  console.log("Upload this zip to your LMS. View page source in the player and search for scorm-package to confirm the build time.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

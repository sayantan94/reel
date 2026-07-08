#!/usr/bin/env node
/**
 * reel — take any video and create a scroll-scrub background.
 *
 *   npx reel-it prepare <input.mp4 | https://…> [options]
 *
 * Ingests a video (local path or URL), re-encodes it all-intra (every frame
 * seekable → glassy scrubbing), extracts a poster, and writes a self-contained
 * preview.html you can open to see the background immediately. Prints the
 * copy-paste snippet for React and plain HTML.
 *
 * Input can be a local file, a direct video URL, or a YouTube/streaming-site
 * page URL (fetched via yt-dlp — grab a short segment with --start/--seconds).
 *
 * Options:
 *   --out <dir>       output directory              (default ./reel-out)
 *   --name <base>     asset basename                (default the input's name)
 *   --quality <name>  small | balanced | sharp      (default balanced)
 *   --height <px>     override preset scale height
 *   --crf <n>         override preset quality; lower = sharper/bigger
 *   --start <sec>     segment start                 (default 0 for page URLs)
 *   --seconds <n>     segment length                (default 20 for page URLs)
 *   --no-preview      skip writing preview.html
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const QUALITY = {
  small: { height: 720, crf: 26, preset: "medium" },
  balanced: { height: 1080, crf: 22, preset: "slow" },
  sharp: { height: 1440, crf: 18, preset: "slow" },
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-preview") args.preview = false;
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

function run(cmd, cmdArgs) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, cmdArgs, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", rej);
    p.on("close", (code) => (code === 0 ? res() : rej(new Error(err.split("\n").slice(-6).join("\n")))));
  });
}

function hasBin(cmd, flag = "-version") {
  return new Promise((res) => {
    const p = spawn(cmd, [flag], { stdio: "ignore" });
    p.on("error", () => res(false));
    p.on("close", (c) => res(c === 0));
  });
}
const hasFfmpeg = () => hasBin("ffmpeg");

async function download(url, dest) {
  const res = await fetch(url, {
    headers: {
      "accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

/** A page URL we can't fetch as a file directly — needs yt-dlp. */
function isPageUrl(u) {
  return /youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitter\.com|x\.com|instagram\.com/i.test(u);
}

/** Convert a normal Pexels video page to its direct download endpoint. */
function pexelsDownloadUrl(u) {
  const match = u.match(/pexels\.com\/video\/[^/?#]*-(\d+)\/?/i);
  return match ? `https://www.pexels.com/download/video/${match[1]}/` : null;
}

/** Download a bounded segment of a streaming-site video via yt-dlp. */
async function fetchViaYtDlp(url, dest, start, seconds) {
  if (!(await hasBin("yt-dlp", "--version"))) {
    throw new Error("this looks like a streaming-site URL; install yt-dlp to fetch it (`brew install yt-dlp`).");
  }
  const end = Number(start) + Number(seconds);
  // Video-only (we strip audio anyway); no --force-keyframes-at-cuts because
  // that makes ffmpeg re-open the CDN URL (often 403s) — we re-encode after.
  await run("yt-dlp", [
    "-f", "bv*[height<=1440][ext=mp4]/bv*/b[ext=mp4]/b",
    "--download-sections", `*${start}-${end}`,
    "-o", dest,
    url,
  ]);
}

const PREVIEW = (mp4, poster) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>reel preview</title>
<style>
  *{margin:0;box-sizing:border-box}
  body{background:#07080d;color:#f6f4ee;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
  .track{position:relative;height:360vh}
  .stage{position:sticky;top:0;height:100vh;overflow:hidden}
  video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:none;transform:translateZ(0);backface-visibility:hidden}
  .overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,8,13,.68),rgba(7,8,13,.22) 48%,rgba(7,8,13,.06))}
  .content{position:relative;z-index:1;margin-top:-100vh}
  .copy{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 7vw;pointer-events:none}
  h1{max-width:9ch;font-size:clamp(48px,10vw,132px);line-height:.94;font-weight:850;letter-spacing:0}
  p.l{max-width:36ch;font-size:clamp(16px,1.8vw,21px);line-height:1.48;margin-top:1rem;color:rgba(246,244,238,.82)}
  .cue{position:fixed;right:22px;bottom:20px;font:700 11px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;opacity:.72}
</style></head>
<body>
  <div class="track" data-reel-track>
    <div class="stage reel-stage">
      <video data-reel-video data-reel-preload="eager" src="${mp4}" poster="${poster}" muted playsinline></video>
      <div class="overlay"></div>
    </div>
    <div class="content reel-content">
      <div class="copy">
        <div data-reel-reveal="0.06,0.34" data-reel-rise="40"><h1>Your headline<br>reveals here.</h1></div>
        <div data-reel-reveal="0.42,0.72"><p class="l">The whole background is this video — scrubbed by scrolling. Swap the copy, colors, and reveal ranges to taste.</p></div>
      </div>
    </div>
  </div>
  <div class="cue">scroll &darr;</div>
  <script type="module">
    import { auto } from "./reel.core.js";
    auto();
  </script>
</body></html>`;

const SNIPPET = (mp4, poster) => `
Done. Use it:

React —
  import { Reel, Reveal } from "reel-it";
  import "reel-it/styles.css";

  <Reel src="/${mp4}" poster="/${poster}" length="360vh" preload="eager">
    <div style={{position:"sticky",top:0,height:"100vh",display:"grid",placeItems:"center"}}>
      <Reveal from={0.06} to={0.34}><h1>Your headline</h1></Reveal>
    </div>
  </Reel>

Plain HTML — see the generated preview.html.
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] === "prepare" ? args._.slice(1) : args._;
  const input = cmd[0];
  if (!input) {
    console.log("usage: reel prepare <input.mp4 | https://…> [--out dir] [--quality balanced|sharp|small] [--height 1080] [--crf 22] [--name base] [--no-preview]");
    process.exit(input === undefined ? 1 : 0);
  }
  if (!(await hasFfmpeg())) {
    console.error("reel: ffmpeg not found on PATH. Install it (e.g. `brew install ffmpeg`) and retry.");
    process.exit(1);
  }

  const outDir = resolve(args.out ?? "reel-out");
  const quality = args.quality ?? "balanced";
  const preset = QUALITY[quality];
  if (!preset) {
    console.error(`reel: unknown quality "${quality}". Use small, balanced, or sharp.`);
    process.exit(1);
  }
  const height = Number(args.height ?? preset.height);
  const crf = Number(args.crf ?? preset.crf);
  const preview = args.preview !== false;
  const resolvedInput = pexelsDownloadUrl(input) ?? input;
  const isUrl = /^https?:\/\//.test(resolvedInput);
  const pageUrl = isUrl && isPageUrl(resolvedInput);
  const base = (args.name ?? (basename(input, extname(input)) || "film")).replace(/[^a-z0-9_-]+/gi, "-");

  await mkdir(outDir, { recursive: true });

  let source = resolvedInput;
  let tmp;
  if (pageUrl) {
    const start = args.start ?? 0;
    const seconds = args.seconds ?? 20;
    tmp = join(tmpdir(), `reel-src-${base}.mp4`);
    process.stderr.write(`• fetching ${seconds}s segment (from ${start}s) via yt-dlp… `);
    await fetchViaYtDlp(resolvedInput, tmp, start, seconds);
    source = tmp;
    process.stderr.write("done\n");
  } else if (isUrl) {
    tmp = join(tmpdir(), `reel-src-${base}.mp4`);
    process.stderr.write("• downloading… ");
    await download(input, tmp);
    source = tmp;
    process.stderr.write("done\n");
  } else if (!existsSync(source)) {
    console.error(`reel: input not found: ${source}`);
    process.exit(1);
  }

  const mp4 = `${base}.mp4`;
  const poster = `${base}-poster.jpg`;
  const trimArgs = [];
  if (!pageUrl && args.start != null) trimArgs.push("-ss", String(args.start));
  if (!pageUrl && args.seconds != null) trimArgs.push("-t", String(args.seconds));

  process.stderr.write(`• encoding ${quality} all-intra (${height}px, crf ${crf})… `);
  await run("ffmpeg", [
    "-y", ...trimArgs, "-i", source, "-an",
    "-vf", `scale=-2:${height}:flags=lanczos`,
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-preset", preset.preset,
    "-g", "1", "-x264-params", "keyint=1:scenecut=0",
    "-crf", String(crf), "-movflags", "+faststart",
    join(outDir, mp4),
  ]);
  process.stderr.write("done\n");

  process.stderr.write("• extracting poster… ");
  await run("ffmpeg", ["-y", "-i", join(outDir, mp4), "-frames:v", "1", "-q:v", "2", join(outDir, poster)]);
  process.stderr.write("done\n");

  if (preview) {
    await writeFile(join(outDir, "preview.html"), PREVIEW(mp4, poster));
    // Ship the engine next to the preview so it runs offline / pre-publish.
    const coreSrc = join(HERE, "..", "dist", "core.js");
    if (existsSync(coreSrc)) await copyFile(coreSrc, join(outDir, "reel.core.js"));
  }
  if (tmp) await rm(tmp, { force: true });

  console.log(`\n✓ background ready in ${outDir}/`);
  console.log(`  ${mp4}`);
  console.log(`  ${poster}`);
  if (preview) console.log(`  preview.html   ← open this to see the background (serve it: npx serve ${outDir})`);
  console.log(SNIPPET(mp4, poster));
}

main().catch((e) => {
  console.error("reel:", e.message);
  process.exit(1);
});

# reel

**Turn any page into a film you scrub by scrolling.** A fixed, full-bleed video is pinned behind your content and its timeline is driven by scroll position — scroll down and the film plays forward, scroll up and it rewinds. Add scroll-pinned reveals so headlines and copy bloom in as the film unspools.

Inspired by the "dye-in-water" scrollytelling look, generalized into a drop-in you can put on any site.

- **Framework-agnostic core** (vanilla TS) + a **React** API.
- **~2 KB** of logic. No dependencies.
- rAF loop with lerp smoothing so scrubbing is silky, not steppy.
- Optional **blob preload** for glassy, stutter-free seeks.
- Respects `prefers-reduced-motion`.

## Install

```bash
npm install reel
```

## Take any video → a background (CLI)

Give `reel` any clip (local file or URL) and it produces a scrub-ready
background: re-encodes it all-intra (every frame seekable, so scrubbing is
glassy), extracts a poster, writes a `preview.html` you can open to see it, and
prints the copy-paste snippet.

```bash
npx reel prepare ./my-clip.mp4
npx reel prepare https://example.com/ink.mp4 --height 1080 --crf 24 --out public/hero
```

Options: `--out <dir>` (default `./reel-out`), `--name <base>`, `--height <px>`
(default 1080), `--crf <n>` (default 26), `--no-preview`. Requires `ffmpeg` on
your PATH.

Output:

```
✓ background ready in reel-out/
  my-clip.mp4        ← all-intra, faststart, audio stripped
  my-clip-poster.jpg
  preview.html       ← open to see the background live
```

Then drop the `.mp4` into your site and use the React or HTML API below.

## React

```tsx
import { Reel, Reveal } from "reel";
import "reel/styles.css";

export default function Hero() {
  return (
    <Reel src="/ink.mp4" poster="/ink-poster.jpg" length="360vh" preload="eager"
          overlay="linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.55))">
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "grid", placeItems: "center" }}>
        <Reveal from={0.06} to={0.34}><h1>Sayantan Bhowmik</h1></Reveal>
        <Reveal from={0.4} to={0.7}><p>AI agent infrastructure</p></Reveal>
      </div>
    </Reel>
  );
}
```

`useScrollProgress()` returns live progress `0..1` anywhere inside a `<Reel>`.

## Any site (no framework)

```html
<link rel="stylesheet" href="reel/dist/styles.css" />

<div data-reel-track style="height: 360vh">
  <div class="reel-stage">
    <video data-reel-video data-reel-preload="eager"
           src="ink.mp4" poster="ink-poster.jpg" muted playsinline></video>
    <div class="reel-overlay" style="background: rgba(0,0,0,.4)"></div>
  </div>
  <div class="reel-content">
    <div data-reel-reveal="0.06,0.34"><h1>Scroll is the timeline</h1></div>
  </div>
</div>

<script type="module">
  import { auto } from "reel/core";
  auto();
</script>
```

## Preparing the film (important)

Smooth scrubbing needs a video encoded with **dense keyframes** — ideally all-intra (every frame a keyframe). Progressive playback files (sparse keyframes) stutter when you seek between them. Re-encode any clip with ffmpeg:

```bash
ffmpeg -i source.mp4 -an -vf "scale=1280:-2" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -g 1 -x264-params keyint=1:scenecut=0 -crf 28 \
  -movflags +faststart film.mp4
```

- `-g 1 -x264-params keyint=1` → every frame seekable.
- `-movflags +faststart` → metadata at the front for fast start.
- `-an` → drop audio (a scrubbed film is silent).
- Keep it hero-sized (a few MB). Serve it from a host that supports HTTP **Range** requests (most CDNs do; Python's `http.server` does **not**).

## API

| Export | What it is |
| --- | --- |
| `Reel` | React component: pins the film, defines the scroll length, hosts content. |
| `Reveal` | React component: fades + rises children across a `[from, to]` progress window. |
| `useScrollProgress()` | React hook: live progress `0..1`. |
| `createReel(opts)` | Core: wire a `track` + `video`, returns a handle (`progress`, `onProgress`, `refresh`, `destroy`). |
| `createReveals(specs)` | Core: build an updater for `[from,to]` element reveals. |
| `preloadFilm(video, src)` | Core: fetch the film into a blob for instant seeking. |
| `auto(root?)` | Core: wire everything declaratively from `data-reel-*` attributes. |

## Demo asset

`examples/assets/ink-720.mp4` is ["Colored ink in water"](https://www.pexels.com/) from Pexels (free to use, no attribution required — credited anyway). Swap in your own clip with `reel prepare`.

## License

MIT © Sayantan Bhowmik

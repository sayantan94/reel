<p align="center">
  <img src="assets/logo.svg" width="112" alt="reel" />
</p>

<h1 align="center">reel-it</h1>

<p align="center">Turn any page into a film you scrub by scrolling.</p>

<p align="center">
  <img src="examples/demo.gif" width="520" alt="reel scrubbing a film background by scroll" />
</p>

reel-it pins a full-bleed video behind your page and maps scroll progress to the video's timeline. Scroll down and the film moves forward. Scroll up and it rewinds. Content can fade in at exact points on that same timeline.

## The Mental Model

Every reel has five pieces:

1. **Clip** - an MP4 encoded for seeking. For crisp scrubbing, every frame should be a keyframe.
2. **Track** - a tall wrapper, such as `height: 360vh`. This is the scroll distance.
3. **Stage** - a sticky, full-screen layer that holds the video while the track scrolls.
4. **Content** - headings, copy, or UI that sits over the stage.
5. **Reveals** - optional progress windows, such as `0.10 -> 0.35`, that fade content in as the film reaches that point.

The core formula is:

```txt
progress = clamp(-track.top / (track.height - viewport.height), 0, 1)
video.currentTime = progress * video.duration
```

Everything else is a wrapper around that idea.

## Quickstart

```bash
npm install reel-it

npx reel-it prepare ./raw/color-water.mp4 \
  --seconds 10 --quality balanced --name color-water

npx reel-it prepare "https://www.pexels.com/video/colorful-tropical-fish-swimming-in-aquarium-36004282/" \
  --seconds 10 --quality balanced --name tropical-fish

npx reel-it prepare "https://www.pexels.com/video/high-speed-photography-of-colorful-ink-diffusion-in-water-9669111/" \
  --seconds 10 --quality balanced --name color-ink

npx reel-it prepare "https://www.pexels.com/video/washing-a-paint-brush-on-a-glass-of-water-3795829/" \
  --seconds 10 --quality balanced --name paint-brush
```

```tsx
import { Reel, Reveal } from "reel-it";
import "reel-it/styles.css";

export default function Hero() {
  return (
    <Reel
      src="/color-water.mp4"
      poster="/color-water-poster.jpg"
      length="360vh"
      preload="eager"
      overlay="rgba(0,0,0,.28)"
    >
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "grid", placeItems: "center" }}>
        <Reveal from={0.08} to={0.32}>
          <h1>Scroll is the timeline</h1>
        </Reveal>
      </div>
    </Reel>
  );
}
```

Serve the page from a real HTTP server. Video scrubbing depends on normal browser video loading and HTTP range requests; opening the HTML file directly is not a reliable test.

## Prepare A Crisp Clip

Most videos are encoded with sparse keyframes, which makes random seeks lag or smear. `reel-it prepare` re-encodes the clip as all-intra H.264 so each frame is directly seekable.

```bash
npx reel-it prepare ./ocean.mov
npx reel-it prepare ./ocean.mov --quality sharp
npx reel-it prepare ./ocean.mov --height 1440 --crf 18 --out public/ocean
npx reel-it prepare "https://www.youtube.com/watch?v=ID" --start 60 --seconds 12 --quality balanced
npx reel-it prepare "https://www.pexels.com/video/colorful-tropical-fish-swimming-in-aquarium-36004282/" --seconds 10 --quality balanced --name tropical-fish
npx reel-it prepare "https://www.pexels.com/video/high-speed-photography-of-colorful-ink-diffusion-in-water-9669111/" --seconds 10 --quality balanced --name color-ink
npx reel-it prepare "https://www.pexels.com/video/washing-a-paint-brush-on-a-glass-of-water-3795829/" --seconds 10 --quality balanced --name paint-brush
```

If Pexels blocks command-line download for a page URL, download the video in the browser and run `reel-it prepare` on the local file:

```bash
npx reel-it prepare ./tropical-fish.mp4 --seconds 10 --quality balanced --name tropical-fish
npx reel-it prepare ./color-ink.mp4 --seconds 10 --quality balanced --name color-ink
npx reel-it prepare ./paint-brush.mp4 --seconds 10 --quality balanced --name paint-brush
```

Quality presets:

| Preset | Height | CRF | Use it for |
| --- | ---: | ---: | --- |
| `small` | 720 | 26 | quick tests and small backgrounds |
| `balanced` | 1080 | 22 | the default, good hero quality |
| `sharp` | 1440 | 18 | crisp demos and portfolio pages |

Lower CRF means sharper output and larger files. All-intra video is always larger than normal delivery video, so keep clips short and use `preload="eager"` only for hero-sized assets that can fit comfortably in memory.

Output:

```txt
reel-out/
  ocean.mp4
  ocean-poster.jpg
  preview.html
  reel.core.js
```

The generated `preview.html` is intentionally plain so you can judge the encoded clip without heavy filters hiding compression.

## Plain HTML

```html
<link rel="stylesheet" href="node_modules/reel-it/dist/styles.css" />

<div data-reel-track style="height: 360vh">
  <div class="reel-stage">
    <video
      data-reel-video
      data-reel-preload="eager"
      src="ocean.mp4"
      poster="ocean-poster.jpg"
      muted
      playsinline
    ></video>
    <div class="reel-overlay" style="background: rgba(0,0,0,.28)"></div>
  </div>

  <div class="reel-content">
    <div data-reel-reveal="0.08,0.32">
      <h1>Scroll is the timeline</h1>
    </div>
    <div data-reel-reveal="0.44,0.66,0.78,0.9">
      <p>This line fades in, then fades out.</p>
    </div>
  </div>
</div>

<script type="module">
  import { auto } from "reel-it/core";
  auto();
</script>
```

## React API

`<Reel>` creates the track, stage, video, and content layers.

| Prop | Default | Notes |
| --- | --- | --- |
| `src` | required | MP4 URL |
| `poster` | none | image shown before the first frame |
| `length` | `"300vh"` | scroll distance for the whole film |
| `duration` | video duration | scrub only the first N seconds |
| `smoothing` | `0.3` | lerp amount per animation frame |
| `seek` | `"precise"` | use `"fast"` only for very heavy clips |
| `preload` | `"native"` | `"eager"` fetches the whole clip as a blob |
| `overlay` | none | CSS background for a dim/tint layer |

`<Reveal from={0.1} to={0.35}>` fades and rises its children over a progress window.

`useScrollProgress()` returns the current reel progress, `0` to `1`, anywhere inside a `<Reel>`.

## Core API

```ts
import { createReel, createReveals, preloadFilm } from "reel-it/core";
```

Use the core when you want to wire the DOM yourself or build your own framework wrapper.

```ts
const reel = createReel({
  track: document.querySelector("[data-reel-track]")!,
  video: document.querySelector("[data-reel-video]")!,
  smoothing: 0.3,
  seek: "precise",
});

reel.onProgress((progress) => {
  console.log(progress);
});
```

## Local Development

```bash
git clone https://github.com/sayantan94/reel.git
cd reel
npm install
npm run build
python3 -m http.server 4173 --directory examples
```

Then open `http://localhost:4173`.

The package is published as `reel-it`. The CLI can be called as `reel-it` from `npx`, and the installed binary also exposes `reel` for shorter local scripts.

## Deploy The Website

The repo includes `vercel.json`, so Vercel can build the package and serve the static website from `examples/`.

```bash
npm run build
npx vercel
```

Vercel settings:

```txt
Build Command: npm run build
Output Directory: examples
```

Keep prepared MP4 files under `examples/assets/` for the marketing site, or under `public/` in an app that consumes `reel-it`.

## npm Release

```bash
npm run pack:check
npm version patch
npm publish --access public
```

`reel-it@1.0.0` is published on npm. Future releases should bump the version before publishing. The package contains the runtime, React adapter, CSS, and `reel` / `reel-it` CLI binaries.

## Manual Encoding

If you want to prepare a file yourself, keep the dense keyframes and sharp scaler:

```bash
ffmpeg -i source.mp4 -an -vf "scale=-2:1080:flags=lanczos" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow \
  -g 1 -x264-params keyint=1:scenecut=0 -crf 22 \
  -movflags +faststart film.mp4
```

For sharper output, use `scale=-2:1440:flags=lanczos` and `-crf 18`.

## Examples

The `examples/` folder is a static website built with reel-it itself:

- `index.html` - docs and landing page with a scroll-scrubbed background
- `pexels.html` - full-screen prepared color-water example
- `hero.html` - large headline over film
- `color.html` - centered copy over ink
- `cosmos.html` - dark scrim with reveal copy
- `minimal.html` - background only

## License

MIT

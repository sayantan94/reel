<p align="center">
  <img src="assets/logo.svg" width="112" alt="reel" />
</p>

<h1 align="center">reel</h1>

<p align="center">Turn any page into a film you scrub by scrolling.</p>

<p align="center">
  <img src="assets/demo.gif" width="520" alt="reel scrubbing an ink in water film back and forth" />
</p>

A full bleed video sits pinned behind your content and its timeline follows the scroll. Scroll down and the film plays forward, scroll up and it rewinds. Pin headlines and copy so they bloom in as the film unspools.

## Live examples

Three demos live in `examples/`, each self contained: **Hero** (a headline that blooms in over the film), **Story** (several lines that fade in and out on their own cue), and **Minimal** (just the scrub background).

Run them locally:

```bash
npx serve examples
# open the printed url
```

Or deploy the `examples/` folder to any static host. On Vercel, set the project root directory to `examples` and it serves as a live demo, no build step.

* Framework free core plus a React layer.
* Around 2 KB of logic, zero dependencies.
* Smooth scrubbing via a request animation frame loop with lerp easing.
* One command to turn any clip into a scrub ready background.

## How it works

reel does three things:

1. It pins your video full screen behind the page.
2. It maps the scroll position onto the video playback time, so the film becomes a timeline you scrub. Scroll down and it moves forward, scroll up and it goes back.
3. It reveals content you pin to a progress window, so a headline can fade in exactly when the film reaches a certain moment.

The scroll length you give it (for example `360vh`) is the whole film. A page that scrolls three and a half screens plays the entire clip from start to finish.

## How to use it

1. **Prepare a clip.** Run `npx reel prepare your_video.mp4`. You get a web ready `your_video.mp4` (re encoded so every frame is seekable), a poster image, and a `preview.html` to check it.
2. **Drop the files into your site**, for example into `public/`.
3. **Add reel and point it at the clip.** Use the `Reel` component in React, or the `data-reel` markup on any site. Set `length` to how long you want the scroll to be.
4. **Pin your content.** Wrap headlines in `Reveal` (React) or `data-reel-reveal="start,end"` (HTML) with a start and end between 0 and 1, and they fade in as the film reaches that point.

The three usage examples below show each path.

## Use it locally

reel is not on npm yet, so use it straight from the clone.

```bash
git clone https://github.com/sayantan94/reel.git
cd reel
npm install
npm run build
```

**Try the demo.** It needs a server that supports HTTP range requests (a plain file open will not scrub), so serve the folder:

```bash
npx serve .
# then open the printed url at /examples/demo
```

**Turn any video into a background** with the CLI, run straight from the clone:

```bash
node bin/reel.mjs prepare ./my_clip.mp4
node bin/reel.mjs prepare "https://www.youtube.com/watch?v=ID" --start 60 --seconds 20
node bin/reel.mjs prepare ./ocean.mp4 --height 1080 --crf 24 --out public/hero
```

**Use it inside another local project.** Install it by path, or link it:

```bash
# from your project, point at the clone
npm install /path/to/reel

# or link it, so edits in reel show up live
cd /path/to/reel && npm link
cd /path/to/your-project && npm link reel
```

Then import it as shown below. Once it is published, all of this becomes `npm install reel` and `npx reel prepare`.

## Take any video and create a background

Give `reel` any clip (a local file, a direct URL, or a YouTube link) and it builds a scrub ready background: it re encodes the clip so every frame is a keyframe (that is what makes scrubbing smooth), pulls a poster, and writes a `preview.html` you can open to see it. From the clone, call it with `node bin/reel.mjs prepare` (or plain `reel prepare` once linked or published).

Flags: `--out <dir>`, `--name <base>`, `--height <px>`, `--crf <n>`, `--start <sec>`, `--seconds <n>`, `--no_preview`. Needs `ffmpeg` on your PATH (and `yt-dlp` for streaming links).

Output:

```
ok background ready in reel-out/
  my_clip.mp4        every frame seekable, web optimised, silent
  my_clip-poster.jpg
  preview.html       open to watch the background
```

## Use it in React

```tsx
import { Reel, Reveal } from "reel";
import "reel/styles.css";

export default function Hero() {
  return (
    <Reel src="/ocean.mp4" poster="/ocean-poster.jpg" length="360vh" preload="eager">
      <div style={{ position: "sticky", top: 0, height: "100vh", display: "grid", placeItems: "center" }}>
        <Reveal from={0.06} to={0.34}><h1>Sayantan Bhowmik</h1></Reveal>
        <Reveal from={0.42} to={0.72}><p>AI agent infrastructure</p></Reveal>
      </div>
    </Reel>
  );
}
```

`useScrollProgress()` returns the live progress from 0 to 1 anywhere inside a `Reel`.

## Use it on any site, no framework

```html
<link rel="stylesheet" href="reel/dist/styles.css" />

<div data-reel-track style="height: 360vh">
  <div class="reel-stage">
    <video data-reel-video data-reel-preload="eager"
           src="ocean.mp4" poster="ocean-poster.jpg" muted playsinline></video>
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

## Preparing a clip by hand

If you would rather encode it yourself, the important part is dense keyframes so seeks land instantly:

```bash
ffmpeg -i source.mp4 -an -vf "scale=1280:-2" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -g 1 -x264-params keyint=1:scenecut=0 -crf 28 \
  -movflags +faststart film.mp4
```

Keep it hero sized, a few MB, and serve it from a host that supports HTTP range requests (most do).

## Demo asset

`examples/assets/ink-720.mp4` is a free clip from Pexels. Swap in your own with `reel prepare`.

## License

MIT

/**
 * reel/core — the framework-agnostic engine.
 *
 * A "reel" pins a full-bleed <video> behind the page and scrubs its timeline
 * from scroll position: scroll through the `track` element and the video's
 * currentTime sweeps 0 → duration. No playback; every frame is chosen by you,
 * by scrolling. Works on any site with or without a UI framework.
 */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/**
 * Fetch the whole film into memory and hand it to the <video> as a blob URL.
 * Progressive <video> loading can stutter while seeking to un-buffered frames;
 * a fully in-memory clip is instantly seekable, which is what makes
 * scroll-scrubbing glassy. Best for hero-sized films (a few MB to ~30MB).
 * Resolves once metadata is ready. Falls back to the plain URL on failure.
 */
const blobUrls = new WeakMap();
export async function preloadFilm(video, src) {
    try {
        const res = await fetch(src);
        if (!res.ok)
            throw new Error("HTTP " + res.status);
        const url = URL.createObjectURL(await res.blob());
        // Revoke any *previous* blob for this element — never the one we're about
        // to assign. (Assigning src fires "emptied"; revoking there would kill the
        // blob before the video can load it.) Final cleanup happens in destroy().
        const prev = blobUrls.get(video);
        if (prev)
            URL.revokeObjectURL(prev);
        blobUrls.set(video, url);
        video.src = url;
    }
    catch {
        video.src = src; // graceful fallback: let the browser stream it
    }
    video.load();
    if (video.readyState >= 1)
        return;
    await new Promise((resolve) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        video.addEventListener("error", () => resolve(), { once: true });
    });
}
/** Release a blob created by preloadFilm for this video, if any. */
export function releaseFilm(video) {
    const url = blobUrls.get(video);
    if (url) {
        URL.revokeObjectURL(url);
        blobUrls.delete(video);
    }
}
/** Scroll progress of a track element through a pinned viewport, 0..1. */
function trackProgress(track) {
    const rect = track.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0)
        return 0;
    return clamp01(-rect.top / scrollable);
}
export function createReel(options) {
    const { track, video, smoothing = 0.3, seek = "precise" } = options;
    const subs = new Set();
    if (options.onProgress)
        subs.add(options.onProgress);
    let duration = options.duration ?? (isFinite(video.duration) ? video.duration : 0);
    let targetProgress = trackProgress(track);
    let easedProgress = targetProgress;
    let lastSeek = -1;
    let raf = 0;
    let alive = true;
    // Manual control: never let the element play itself.
    video.pause();
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const onMeta = () => {
        if (!options.duration && isFinite(video.duration))
            duration = video.duration;
    };
    video.addEventListener("loadedmetadata", onMeta);
    const emit = (p) => subs.forEach((fn) => fn(p));
    const onScroll = () => {
        targetProgress = trackProgress(track);
    };
    const loop = () => {
        if (!alive)
            return;
        easedProgress += (targetProgress - easedProgress) * smoothing;
        // Snap when close enough so we settle exactly on 0 and 1.
        if (Math.abs(targetProgress - easedProgress) < 0.0005)
            easedProgress = targetProgress;
        if (duration > 0) {
            const t = easedProgress * duration;
            // Only seek on a meaningful delta — avoids hammering the decoder.
            if (Math.abs(t - lastSeek) > 0.01) {
                lastSeek = t;
                if (seek === "fast" && typeof video.fastSeek === "function")
                    video.fastSeek(t);
                else
                    video.currentTime = t;
            }
        }
        emit(easedProgress);
        raf = requestAnimationFrame(loop);
    };
    const onResize = () => onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    raf = requestAnimationFrame(loop);
    return {
        get progress() {
            return easedProgress;
        },
        onProgress(fn) {
            subs.add(fn);
            return () => subs.delete(fn);
        },
        refresh() {
            onScroll();
        },
        destroy() {
            alive = false;
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onResize);
            video.removeEventListener("loadedmetadata", onMeta);
            releaseFilm(video);
            subs.clear();
        },
    };
}
/**
 * Drive opacity/transform on elements as progress crosses their window.
 * With outFrom/outTo the element also fades back out, so lines can swap.
 * Call the returned updater with progress (e.g. from reel.onProgress).
 */
export function createReveals(specs) {
    return (progress) => {
        for (const s of specs) {
            const inSpan = Math.max(0.0001, s.to - s.from);
            const inLocal = clamp01((progress - s.from) / inSpan);
            let out = 1;
            if (s.outFrom != null && s.outTo != null) {
                const outSpan = Math.max(0.0001, s.outTo - s.outFrom);
                out = 1 - clamp01((progress - s.outFrom) / outSpan);
            }
            const rise = s.rise ?? 24;
            s.el.style.opacity = String(inLocal * out);
            s.el.style.transform = `translateY(${(1 - inLocal) * rise}px)`;
        }
    };
}
/**
 * Declarative, zero-framework wiring. Scans the DOM for:
 *   [data-reel-track]            the scroll track (wraps everything)
 *   [data-reel-video]            the <video> to scrub
 *   [data-reel-reveal="a,b"]     elements revealed over progress a..b
 * and returns the live ReelHandle. This is the "drop onto any site" path.
 */
export function auto(root = document) {
    const track = root.querySelector("[data-reel-track]");
    const video = root.querySelector("[data-reel-video]");
    if (!track || !video)
        return null;
    const reveals = [];
    root.querySelectorAll("[data-reel-reveal]").forEach((el) => {
        // "in,in" fades in and holds; "in,in,out,out" also fades back out.
        const n = (el.dataset.reelReveal ?? "0,1").split(",").map(Number);
        const rise = el.dataset.reelRise ? Number(el.dataset.reelRise) : undefined;
        reveals.push({ el, from: n[0] || 0, to: n[1] ?? 1, outFrom: n[2], outTo: n[3], rise });
    });
    // Opt-in blob preload for reliable, stutter-free scrubbing: data-reel-preload="eager"
    if (video.dataset.reelPreload === "eager" && video.currentSrc) {
        void preloadFilm(video, video.currentSrc);
    }
    const update = createReveals(reveals);
    const reel = createReel({ track, video });
    reel.onProgress(update);
    return reel;
}
//# sourceMappingURL=core.js.map
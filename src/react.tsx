/**
 * reel/react — thin React sugar over the core engine.
 *
 *   <Reel src="/ink.mp4" length="300vh" duration={36}>
 *     <Reveal from={0.05} to={0.35}><h1>Sayantan Bhowmik</h1></Reveal>
 *     <Reveal from={0.4} to={0.7}><p>AI agent infrastructure</p></Reveal>
 *     ... your scrollable content ...
 *   </Reel>
 *
 * The video pins full-bleed behind children; scrolling the Reel's height
 * scrubs the film. useScrollProgress() reads live progress anywhere inside.
 */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createReel, preloadFilm, type ReelHandle } from "./core.js";

const ProgressContext = createContext<() => number>(() => 0);
/** Subscribe-on-mount store so consumers re-render on progress change. */
const SubContext = createContext<{
  subscribe: (fn: (p: number) => void) => () => void;
} | null>(null);

export interface ReelProps {
  /** Video source URL (encode with dense keyframes for smooth scrubbing). */
  src: string;
  /** Optional poster shown before the first frame decodes. */
  poster?: string;
  /** Scroll length of the film, any CSS length. Default "300vh". */
  length?: string;
  /** Scrub only this many video-seconds (defaults to full duration). */
  duration?: number;
  /** Lerp smoothing 0..1. Default 0.3. */
  smoothing?: number;
  /** "precise" maps scroll to exact frames; "fast" can help heavy clips. */
  seek?: "precise" | "fast";
  /** Dim/tint the video with an overlay color (e.g. "rgba(0,0,0,.25)"). */
  overlay?: string;
  /**
   * "eager" fetches the whole film into memory (blob) before scrubbing for
   * glassy, stutter-free seeks — best for hero-sized clips. "native" (default)
   * lets the browser stream it progressively.
   */
  preload?: "native" | "eager";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Reel({
  src,
  poster,
  length = "300vh",
  duration,
  smoothing,
  seek,
  overlay,
  preload = "native",
  className,
  style,
  children,
}: ReelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<ReelHandle | null>(null);
  const progressRef = useRef(0);
  const subs = useRef(new Set<(p: number) => void>());

  useEffect(() => {
    if (!trackRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (preload === "eager") void preloadFilm(video, src);
    const reel = createReel({
      track: trackRef.current,
      video,
      duration,
      smoothing,
      seek,
      onProgress: (p) => {
        progressRef.current = p;
        subs.current.forEach((fn) => fn(p));
      },
    });
    handleRef.current = reel;
    return () => reel.destroy();
  }, [duration, smoothing, seek, preload, src]);

  const store = {
    subscribe: (fn: (p: number) => void) => {
      subs.current.add(fn);
      return () => subs.current.delete(fn);
    },
  };

  return (
    <SubContext.Provider value={store}>
      <ProgressContext.Provider value={() => progressRef.current}>
        <div ref={trackRef} className={"reel-track " + (className ?? "")} style={{ height: length, ...style }}>
          <div className="reel-stage">
            <video
              ref={videoRef}
              className="reel-video"
              src={preload === "eager" ? undefined : src}
              poster={poster}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
            />
            {overlay && <div className="reel-overlay" style={{ background: overlay }} />}
          </div>
          <div className="reel-content">{children}</div>
        </div>
      </ProgressContext.Provider>
    </SubContext.Provider>
  );
}

/** Live scroll progress 0..1 for anything inside a <Reel>. */
export function useScrollProgress(): number {
  const store = useContext(SubContext);
  const getInitial = useContext(ProgressContext);
  const [p, setP] = useState(getInitial);
  useEffect(() => {
    if (!store) return;
    return store.subscribe(setP);
  }, [store]);
  return p;
}

export interface RevealProps {
  /** Progress at which this starts fading in. */
  from: number;
  /** Progress at which it's fully in (and holds after). */
  to: number;
  /** translateY px at `from`, easing to 0 at `to`. Default 24. */
  rise?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** Fades + rises its children as scroll progress crosses [from, to]. */
export function Reveal({ from, to, rise = 24, className, style, children }: RevealProps) {
  const p = useScrollProgress();
  const span = Math.max(0.0001, to - from);
  const local = Math.min(1, Math.max(0, (p - from) / span));
  return (
    <div
      className={className}
      style={{
        opacity: local,
        transform: `translateY(${(1 - local) * rise}px)`,
        willChange: "opacity, transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

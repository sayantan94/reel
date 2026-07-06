/**
 * reel — turn any page into a film you scrub by scrolling.
 *
 * Framework-agnostic core:
 *   import { createReel, auto } from "reel/core";
 * React API:
 *   import { Reel, Reveal, useScrollProgress } from "reel";
 * Styles (once, anywhere):
 *   import "reel/styles.css";
 */
export { createReel, createReveals, auto, preloadFilm, releaseFilm } from "./core.js";
export type { ReelOptions, ReelHandle, RevealSpec } from "./core.js";
export { Reel, Reveal, useScrollProgress } from "./react.js";
export type { ReelProps, RevealProps } from "./react.js";

"use client";

import { useEffect, useRef, useState } from "react";

const MAX_DEPTH = 113;
const CYCLE_MS = 16000;

const MARKS = [0, 20, 40, 60, 80, 100, 120] as const;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Premium hero depth tape + descending CWT diver (desktop HUD). */
export function HeroDepthHud() {
  const [depth, setDepth] = useState(18);
  const [progress, setProgress] = useState(0.12);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion.current) {
      setDepth(MAX_DEPTH);
      setProgress(0.72);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) % (CYCLE_MS * 2);
      // Descend then ascend (one full out-and-back).
      const half = CYCLE_MS;
      const goingDown = elapsed < half;
      const local = goingDown ? elapsed / half : (elapsed - half) / half;
      const p = goingDown ? easeInOutCubic(local) : easeInOutCubic(1 - local);
      setProgress(p);
      setDepth(Math.round(12 + p * (MAX_DEPTH - 12)));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const travelerTop = `calc(8% + ${progress * 68}%)`;

  return (
    <div className="hero-hud" aria-hidden="true">
      <div className="hero-hud__glow" />
      <div className="hero-hud__haze" />

      <div className="hero-hud__tape">
        <div className="hero-hud__cable" />
        <div className="hero-hud__cable-core" />
        <ul className="hero-hud__marks">
          {MARKS.map((m) => (
            <li
              key={m}
              className="hero-hud__mark"
              style={{ top: `${(m / 120) * 100}%` }}
            >
              <span className="hero-hud__tick hero-hud__tick--major" />
              <span className="hero-hud__label">{m}</span>
            </li>
          ))}
          {Array.from({ length: 24 }, (_, i) => {
            const m = (i + 1) * 5;
            if (m % 20 === 0 || m > 120) return null;
            return (
              <li
                key={`m-${m}`}
                className="hero-hud__mark hero-hud__mark--minor"
                style={{ top: `${(m / 120) * 100}%` }}
              >
                <span className="hero-hud__tick" />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hero-hud__traveler" style={{ top: travelerTop }}>
        <span className="hero-hud__wake" />
        <span className="hero-hud__bubble hero-hud__bubble--a" />
        <span className="hero-hud__bubble hero-hud__bubble--b" />
        <span className="hero-hud__bubble hero-hud__bubble--c" />
        <HeroDiverSilhouette className="hero-hud__diver" />
        <div className="hero-hud__readout">
          <div className="hero-hud__readout-depth">
            <b className="num">{depth}</b>
            <span>m</span>
          </div>
          <div className="hero-hud__readout-meta">
            <span className="hero-hud__pill">CWT</span>
            <span>Roatan · Diveye</span>
          </div>
          <span className="hero-hud__needle" />
        </div>
      </div>

      <div className="hero-hud__caption">
        <span>Depth</span>
        <span>0 — 120 m</span>
      </div>
    </div>
  );
}

function HeroDiverSilhouette({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 56 140"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hd-body" x1="18%" y1="0%" x2="82%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
          <stop offset="42%" stopColor="#d7eef4" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#7fb4c2" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id="hd-fin" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#eaf7fb" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#3cc8dc" stopOpacity="0.42" />
        </linearGradient>
        <filter id="hd-soft" x="-20%" y="-10%" width="140%" height="120%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
      </defs>
      {/* Head-first CWT — streamlined competition silhouette */}
      <g filter="url(#hd-soft)">
        <ellipse cx="28" cy="16" rx="8.2" ry="10" fill="url(#hd-body)" />
        <path
          d="M19.5 24c1.5 12 3.1 26 4.1 40h8.8c1-14 2.6-28 4.1-40-2.8-1.8-12.4-1.8-17 0Z"
          fill="url(#hd-body)"
        />
        <path
          d="M15 32c-7.5 4.5-12.5 8-14 10.5 5 3.5 11.5 5 17.5 3.8M41 32c7.5 4.5 12.5 8 14 10.5-5 3.5-11.5 5-17.5 3.8"
          fill="none"
          stroke="url(#hd-body)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path
          d="M23.2 64c.7 14 1.2 26 1.7 36h6.2c.5-10 1-22 1.7-36H23.2Z"
          fill="url(#hd-body)"
        />
        <path
          d="M18 102c-10 12-15 26-5 33 12-7 17-19 14.5-33H18Zm20 0c10 12 15 26 5 33-12-7-17-19-14.5-33H38Z"
          fill="url(#hd-fin)"
        />
        <path
          d="M25.5 100h5c1.2 10 2.4 20-2.5 27-4.9-7-3.7-17-2.5-27Z"
          fill="#e7f6fa"
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

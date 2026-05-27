"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ModuleKey } from "../../_lib/module-visibility";

export type OrbitModule = {
  moduleKey: ModuleKey;
  iconSrc: string;
  name: string;
  jpName: string;
  description: string;
  tone: "soft" | "mid" | "strong";
  href: string;
};

type Props = {
  modules: readonly OrbitModule[];
  onOrbHover?: (moduleKey: string) => void;
  onOrbClick?: (moduleKey: string) => void;
};

const BASE_VELOCITY = 0.00001047;
const MAX_VELOCITY = 0.0008;
const VELOCITY_DECAY = 0.985;
const VELOCITY_BOOST = 0.0002;
const CLICK_DELAY_MS = 700;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function OrbitStage({
  modules,
  onOrbHover,
  onOrbClick,
}: Props) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const rotationRef = useRef(0);
  const velocityRef = useRef(BASE_VELOCITY);
  const pausedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [activeKey, setActiveKey] = useState<ModuleKey | null>(null);
  const [sparkleKey, setSparkleKey] = useState<ModuleKey | null>(null);

  const activeModule = useMemo(
    () => modules.find((module) => module.moduleKey === activeKey) ?? null,
    [activeKey, modules],
  );

  const updatePositions = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || modules.length === 0) return;

    const rect = stage.getBoundingClientRect();
    const vmin = Math.min(rect.width, rect.height);
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.max(vmin * 0.32, Math.min(vmin * 0.4, (vmin - 52) / 2));
    const maxByArc = 2 * radius * Math.sin(Math.PI / modules.length) * 0.86;
    const bubbleSize = Math.max(46, Math.min(150, vmin * 0.16, maxByArc));
    const bubbleHalfSize = bubbleSize / 2;

    bubbleRefs.current.forEach((bubble, index) => {
      if (!bubble) return;
      const baseAngle = (index * (Math.PI * 2)) / modules.length - Math.PI / 2;
      const angle = baseAngle + rotationRef.current;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      bubble.style.setProperty("--orbit-bubble-size", `${bubbleSize}px`);
      bubble.style.transform = `translate3d(${x - bubbleHalfSize}px, ${y - bubbleHalfSize}px, 0)`;
    });
  }, [modules.length]);

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      reducedMotionRef.current = media.matches;
      updatePositions();
    };
    media.addEventListener("change", onMotionChange);

    const onResize = () => updatePositions();
    window.addEventListener("resize", onResize);

    const tick = (now: number) => {
      const last = lastTimeRef.current ?? now;
      const dt = now - last;
      lastTimeRef.current = now;

      if (!pausedRef.current && !reducedMotionRef.current) {
        rotationRef.current += velocityRef.current * dt;
      }

      if (velocityRef.current > BASE_VELOCITY) {
        velocityRef.current =
          BASE_VELOCITY + (velocityRef.current - BASE_VELOCITY) * VELOCITY_DECAY;
        if (velocityRef.current - BASE_VELOCITY < 0.000001) {
          velocityRef.current = BASE_VELOCITY;
        }
      } else if (velocityRef.current < BASE_VELOCITY) {
        velocityRef.current =
          BASE_VELOCITY - (BASE_VELOCITY - velocityRef.current) * VELOCITY_DECAY;
        if (BASE_VELOCITY - velocityRef.current < 0.000001) {
          velocityRef.current = BASE_VELOCITY;
        }
      }

      updatePositions();
      frameRef.current = window.requestAnimationFrame(tick);
    };

    updatePositions();
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      media.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", onResize);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [updatePositions]);

  useEffect(() => {
    updatePositions();
  }, [modules, updatePositions]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const boost = (event.deltaY > 0 ? 1 : -1) * VELOCITY_BOOST;
    velocityRef.current = Math.max(
      -MAX_VELOCITY,
      Math.min(MAX_VELOCITY, velocityRef.current + boost),
    );
  }, []);

  const handleEnter = useCallback(
    (module: OrbitModule) => {
      pausedRef.current = true;
      setActiveKey(module.moduleKey);
      onOrbHover?.(module.moduleKey);
    },
    [onOrbHover],
  );

  const handleLeave = useCallback(() => {
    pausedRef.current = false;
  }, []);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, module: OrbitModule) => {
      event.preventDefault();
      onOrbClick?.(module.moduleKey);
      setSparkleKey(module.moduleKey);
      window.setTimeout(() => setSparkleKey(null), 1500);
      window.setTimeout(() => router.push(module.href), CLICK_DELAY_MS);
    },
    [onOrbClick, router],
  );

  const handlePanelClick = useCallback(() => {
    if (!activeModule) return;
    onOrbClick?.(activeModule.moduleKey);
    router.push(activeModule.href);
  }, [activeModule, onOrbClick, router]);

  return (
    <section
      ref={stageRef}
      className="home-orbit-stage"
      data-visible-count={modules.length}
      onWheel={handleWheel}
      aria-label="Garden modules orbit"
    >
      <div className="home-orbit-ring" aria-hidden="true" />
      {modules.map((module, index) => (
        <a
          key={module.moduleKey}
          ref={(node) => {
            bubbleRefs.current[index] = node;
          }}
          href={module.href}
          className={`home-orbit-bubble tone-${module.tone}${
            sparkleKey === module.moduleKey ? " click-sparkle" : ""
          }`}
          data-module-key={module.moduleKey}
          onClick={(event) => handleClick(event, module)}
          onMouseEnter={() => handleEnter(module)}
          onMouseLeave={handleLeave}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="home-orbit-bubble-img" src={module.iconSrc} alt={module.name} />
          <span className="home-orbit-highlight" aria-hidden="true" />
          <span className="home-orbit-label">
            <span className="home-orbit-name">{module.name}</span>
            <span className="home-orbit-jp">{module.jpName}</span>
          </span>
        </a>
      ))}

      <div
        className="home-orbit-info-panel"
        data-active={activeModule ? "true" : "false"}
        aria-live="polite"
      >
        {activeModule && (
          <>
            <div className="home-orbit-info-name">
              <span className="home-orbit-info-en">{activeModule.name}</span>
              <span className="home-orbit-info-divider" aria-hidden="true" />
              <span className="home-orbit-info-jp">{activeModule.jpName}</span>
            </div>
            <p className="home-orbit-info-desc">{activeModule.description}</p>
            <button className="home-orbit-info-button" type="button" onClick={handlePanelClick}>
              詳しく見る
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}

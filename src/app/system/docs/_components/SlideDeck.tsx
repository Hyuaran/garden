"use client";

import { useEffect, useRef } from "react";
import type { PlayableSlideDeck } from "../_data/slides";
import styles from "../slides/slides.module.css";

export default function SlideDeck({ deck }: { deck: PlayableSlideDeck }) {
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    function scrollByKey(event: KeyboardEvent) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const slides = slideRefs.current.filter((slide): slide is HTMLElement => Boolean(slide));
      if (!slides.length) return;
      const currentIndex = slides.reduce((best, slide, index) => {
        const distance = Math.abs(slide.getBoundingClientRect().top);
        const bestDistance = Math.abs(slides[best].getBoundingClientRect().top);
        return distance < bestDistance ? index : best;
      }, 0);
      const nextIndex = event.key === "ArrowRight"
        ? Math.min(currentIndex + 1, slides.length - 1)
        : Math.max(currentIndex - 1, 0);
      if (nextIndex === currentIndex) return;
      event.preventDefault();
      // このシェルの内側の入れ物では behavior:"smooth" が効かず、キー送りが無反応になるため使わない。
      slides[nextIndex].scrollIntoView({ behavior: "auto", block: "start" });
    }
    window.addEventListener("keydown", scrollByKey);
    return () => window.removeEventListener("keydown", scrollByKey);
  }, []);

  if (!deck.slides.length) return <p className={styles.notice} role="status">画像を読み込めませんでした。ページを再読み込みしてお試しください。</p>;

  return <div className={styles.slideStack}>
    {deck.slides.map((slide, index) => <figure className={styles.slideFigure} key={slide.index}
      ref={element => { slideRefs.current[index] = element; }}>
      <figcaption>{slide.index} / {deck.slideCount}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.slideImage} src={slide.src} alt={`${deck.title} ${slide.index}枚目`} referrerPolicy="no-referrer" />
    </figure>)}
  </div>;
}

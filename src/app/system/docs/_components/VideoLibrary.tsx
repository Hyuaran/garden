"use client";

import { useRef, useState } from "react";
import { groupVideos, type PlayableDocVideo } from "../_data/videos";
import styles from "../videos/videos.module.css";

export default function VideoLibrary({ videos }: { videos: PlayableDocVideo[] }) {
  const players = useRef(new Map<string, HTMLVideoElement>());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [playing, setPlaying] = useState<string | null>(null);

  function pauseOthers(current: HTMLVideoElement) {
    for (const player of players.current.values()) {
      if (player !== current && !player.paused) player.pause();
    }
  }

  async function togglePlayback(id: string) {
    const player = players.current.get(id);
    if (!player) return;
    if (!player.paused) { player.pause(); return; }
    try {
      await player.play();
      setFailed(previous => { const next = new Set(previous); next.delete(id); return next; });
    } catch {
      setFailed(previous => new Set(previous).add(id));
    }
  }

  return <div className={styles.library}>{groupVideos(videos).map((group, index) => <section key={group.category} aria-labelledby={`video-category-${index}`}>
    <h2 id={`video-category-${index}`}>{group.category}</h2>
    <div className={styles.grid}>{group.videos.map(video => <article className={styles.card} key={video.id} aria-labelledby={`video-title-${video.id}`}>
      {video.videoUrl ? <video className={styles.player} controls playsInline preload="metadata" poster={video.posterUrl} src={video.videoUrl}
        aria-label={`${video.title}の動画`}
        ref={player => { if (player) players.current.set(video.id, player); else players.current.delete(video.id); }}
        onPlay={event => { pauseOthers(event.currentTarget); setPlaying(video.id); }}
        onPause={() => setPlaying(previous => previous === video.id ? null : previous)}
        onError={() => setFailed(previous => new Set(previous).add(video.id))}>
        このブラウザでは動画を再生できません。
      </video> : null}
      <div className={styles.details}>
        <h3 id={`video-title-${video.id}`}>{video.title}</h3>
        {video.videoUrl && <button className={styles.playButton} type="button" onClick={() => togglePlayback(video.id)} aria-label={`${video.title}を${playing === video.id ? "一時停止" : "再生"}`}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{playing === video.id ? <path d="M8 5v14M16 5v14" /> : <path d="m8 5 11 7-11 7z" />}</svg>
          {playing === video.id ? "一時停止" : "再生する"}
        </button>}
        <p className={styles.duration}>所要時間：{video.duration}</p>
        <p>{video.description}</p>
        {(!video.videoUrl || failed.has(video.id)) && <p className={styles.notice} role="status">動画を読み込めませんでした。ページを再読み込みしてお試しください。</p>}
      </div>
    </article>)}</div>
  </section>)}</div>;
}

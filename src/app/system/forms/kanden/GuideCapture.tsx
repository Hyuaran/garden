"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import SalesIcon from "./SalesIcon";
import { ActionButton, FormDialog, ResultMessage } from "../_components/form-kit";
import styles from "./sales-form.module.css";

export default function GuideCapture({ label, close, fallback, choose, captured }: {
  label: string; close: () => void; fallback: () => void; choose: () => void; captured: (file: File) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [frameRatio, setFrameRatio] = useState(0);
  const [error, setError] = useState("");
  const active = useRef(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    active.current = true;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled || !video.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        video.current.srcObject = stream;
      } catch {
        if (!cancelled) setError("カメラを開けませんでした。端末のカメラかファイルを選んでください。");
      }
    }
    void start();
    return () => {
      cancelled = true;
      active.current = false;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  function updateFrameRatio() {
    const frame = video.current;
    if (frame?.videoWidth && frame.videoHeight) setFrameRatio(frame.videoWidth / frame.videoHeight);
  }

  const paperRatio = 1 / Math.SQRT2;
  const cropWidth = 0.82 * Math.min(1, paperRatio / (frameRatio || paperRatio));
  const cropHeight = 0.82 * Math.min(1, (frameRatio || paperRatio) / paperRatio);

  function capture() {
    const frame = video.current;
    if (!frame?.videoWidth || !frame.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(frame.videoWidth * cropWidth);
    canvas.height = Math.round(frame.videoHeight * cropHeight);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(frame, (frame.videoWidth - canvas.width) / 2, (frame.videoHeight - canvas.height) / 2,
      canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!active.current) return;
      if (blob) captured(new File([blob], "撮影.jpg", { type: "image/jpeg" }));
      else setError("撮影できませんでした。もう一度お試しください。");
    }, "image/jpeg", 0.92);
  }

  return <FormDialog title={`${label}の撮影`} onClose={close} size="sm" actions={<>
    <ActionButton disabled={!frameRatio} onClick={capture}><SalesIcon name="camera" /> 撮影</ActionButton>
    <ActionButton onClick={fallback}>端末のカメラ</ActionButton>
    <ActionButton onClick={choose}><SalesIcon name="image" /> ファイル選択</ActionButton>
  </>}>
    <p>書類全体を枠に合わせ、文字が読めるように撮影してください。</p>
    <ResultMessage>{error}</ResultMessage>
    {!error && <div className={styles.guide} {...CLARITY_MASK} style={{
      width: frameRatio ? `min(100%, ${55 * frameRatio}dvh)` : undefined,
      "--guide-width": `${cropWidth * 100}%`, "--guide-height": `${cropHeight * 100}%`,
    } as CSSProperties}>
      <video ref={video} autoPlay muted playsInline onLoadedMetadata={updateFrameRatio} onResize={updateFrameRatio} />
      {frameRatio > 0 && <span aria-hidden="true" />}
    </div>}
  </FormDialog>;
}

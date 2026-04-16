"use client";

/**
 * Garden-Tree Breeze トリプルタイマーバー
 *
 * プロトタイプの BreezeDualTimer を TypeScript 化。
 * 架電中 / 通話中 / 入力中 の3フェーズを横並びで表示する。
 * アクティブフェーズのみカウントアップし、非アクティブはグレーアウト。
 *
 * Sprout 架電画面（Breeze モード）で使用。
 */

import { useEffect, useState } from "react";

import { C } from "../_constants/colors";

type BreezeDualTimerProps = {
  /** 現在のフェーズ: "calling" | "talking" | "inputting" */
  callPhase: string;
  /** 架電タイマーリセット用キー */
  callTimerKey: number;
  /** 通話タイマーリセット用キー */
  talkTimerKey: number;
  /** 入力タイマーリセット用キー */
  inputTimerKey: number;
  /** 架電中の閾値(秒) */
  threshold?: number;
  /** 入力中の閾値(秒) */
  inputThreshold?: number;
};

function fmt(s: number): string {
  return (
    String(Math.floor(s / 60)).padStart(2, "0") +
    ":" +
    String(s % 60).padStart(2, "0")
  );
}

function TimerBar({
  label,
  active,
  sec,
  over,
  activeColor,
  activeBg,
  activeBorder,
}: {
  label: string;
  active: boolean;
  sec: number;
  over: boolean;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        borderRadius: 12,
        flex: 1,
        background: active
          ? over
            ? "rgba(196,74,74,0.08)"
            : activeBg
          : "rgba(0,0,0,0.02)",
        border: `1px solid ${
          active
            ? over
              ? "rgba(196,74,74,0.15)"
              : activeBorder
            : "rgba(0,0,0,0.04)"
        }`,
        transition: "all 0.3s ease",
      }}
    >
      {active && (
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: over ? C.red : activeColor,
            animation: "pulse 1.5s infinite",
          }}
        />
      )}
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: active ? (over ? C.red : activeColor) : "#bbb",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          color: active ? C.textMuted : "#ccc",
        }}
      >
        —
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: active ? (over ? C.red : activeColor) : "#ccc",
        }}
      >
        {active ? fmt(sec) : "00:00"}
      </span>
    </div>
  );
}

export function BreezeDualTimer({
  callPhase,
  callTimerKey,
  talkTimerKey,
  inputTimerKey,
  threshold = 20,
  inputThreshold = 60,
}: BreezeDualTimerProps) {
  const [callSec, setCallSec] = useState(0);
  const [talkSec, setTalkSec] = useState(0);
  const [inputSec, setInputSec] = useState(0);

  useEffect(() => {
    setCallSec(0);
    const iv = setInterval(() => setCallSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [callTimerKey]);

  useEffect(() => {
    if (callPhase === "talking" || callPhase === "inputting") {
      setTalkSec(0);
      const iv = setInterval(() => setTalkSec((s) => s + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [talkTimerKey, callPhase]);

  useEffect(() => {
    if (callPhase === "inputting") {
      setInputSec(0);
      const iv = setInterval(() => setInputSec((s) => s + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [inputTimerKey, callPhase]);

  const isCalling = callPhase === "calling";
  const isTalking = callPhase === "talking";
  const isInput = callPhase === "inputting";
  const callOver = callSec >= threshold;
  const inputOver = inputSec >= inputThreshold;

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <TimerBar
        label="架電中"
        active={isCalling}
        sec={callSec}
        over={callOver}
        activeColor={C.midGreen}
        activeBg="rgba(45,106,79,0.06)"
        activeBorder="rgba(45,106,79,0.1)"
      />
      <TimerBar
        label="通話中"
        active={isTalking}
        sec={talkSec}
        over={false}
        activeColor="#2d6a8a"
        activeBg="rgba(45,106,138,0.08)"
        activeBorder="rgba(45,106,138,0.15)"
      />
      <TimerBar
        label="入力中"
        active={isInput}
        sec={inputSec}
        over={inputOver}
        activeColor="#8a5ac6"
        activeBg="rgba(138,90,198,0.08)"
        activeBorder="rgba(138,90,198,0.15)"
      />
    </div>
  );
}

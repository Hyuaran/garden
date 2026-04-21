"use client";

/**
 * Garden-Tree クアッドタイマー（4フェーズ）
 *
 * プロトタイプの QuadTimer を TypeScript 化。
 * InCallScreen（通話画面）で使用する4フェーズ対応タイマーバー。
 *
 * フェーズ: waiting → calling → talking → inputting
 *
 * - 各フェーズごとに独立したカウントアップ
 * - アクティブフェーズのみ色付き表示、非アクティブはグレーアウト
 * - 閾値超過で赤表示（waiting / calling / inputting）
 */

import { useEffect, useState } from "react";

import { C } from "../_constants/colors";

type QuadTimerProps = {
  phase: string;
  waitKey: number;
  callKey: number;
  talkKey: number;
  inputKey: number;
  waitThreshold?: number;
  callThreshold?: number;
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

export function QuadTimer({
  phase,
  waitKey,
  callKey,
  talkKey,
  inputKey,
  waitThreshold = 60,
  callThreshold = 20,
  inputThreshold = 60,
}: QuadTimerProps) {
  const [waitSec, setWaitSec] = useState(0);
  const [callSec, setCallSec] = useState(0);
  const [talkSec, setTalkSec] = useState(0);
  const [inputSec, setInputSec] = useState(0);

  useEffect(() => {
    setWaitSec(0);
    const iv = setInterval(() => setWaitSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [waitKey]);

  useEffect(() => {
    if (
      phase === "calling" ||
      phase === "talking" ||
      phase === "inputting"
    ) {
      setCallSec(0);
      const iv = setInterval(() => setCallSec((s) => s + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [callKey, phase]);

  useEffect(() => {
    if (phase === "talking" || phase === "inputting") {
      setTalkSec(0);
      const iv = setInterval(() => setTalkSec((s) => s + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [talkKey, phase]);

  useEffect(() => {
    if (phase === "inputting") {
      setInputSec(0);
      const iv = setInterval(() => setInputSec((s) => s + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [inputKey, phase]);

  const isWait = phase === "waiting";
  const isCall = phase === "calling";
  const isTalk = phase === "talking";
  const isInput = phase === "inputting";

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <TimerBar
        label="架電中"
        active={isCall}
        sec={callSec}
        over={callSec >= callThreshold}
        activeColor={C.midGreen}
        activeBg="rgba(45,106,79,0.06)"
        activeBorder="rgba(45,106,79,0.1)"
      />
      <TimerBar
        label="通話中"
        active={isTalk}
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
        over={inputSec >= inputThreshold}
        activeColor="#8a5ac6"
        activeBg="rgba(138,90,198,0.08)"
        activeBorder="rgba(138,90,198,0.15)"
      />
      <TimerBar
        label="待機中"
        active={isWait}
        sec={waitSec}
        over={waitSec >= waitThreshold}
        activeColor={C.gold}
        activeBg="rgba(201,168,76,0.08)"
        activeBorder="rgba(201,168,76,0.15)"
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, type ComponentProps, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

export type CallGuardLinkProps = ComponentProps<typeof Link> & {
  /** 通話中フラグ。true なら遷移を確認モーダルでガード */
  guardActive?: boolean;
  /** モーダル表示時の文言 */
  guardMessage?: string;
};

export function CallGuardLink({ guardActive, guardMessage, onClick, children, ...rest }: CallGuardLinkProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (guardActive) {
      e.preventDefault();
      const href = typeof rest.href === 'string' ? rest.href : (rest.href as { pathname: string }).pathname;
      setPendingHref(href);
      setShowConfirm(true);
      return;
    }
    onClick?.(e);
  };

  const handleConfirm = () => {
    if (pendingHref) {
      router.push(pendingHref);
    }
    setShowConfirm(false);
    setPendingHref(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingHref(null);
  };

  return (
    <>
      <Link {...rest} onClick={handleClick}>
        {children}
      </Link>
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
            fontFamily: "'Noto Sans JP', sans-serif",
          }}
        >
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, maxWidth: 400, width: '90vw' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 16, color: '#a00' }}>通話中の画面遷移確認</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#222' }}>
              {guardMessage ?? '通話中の途中で画面を離れようとしています。結果が保存されない可能性があります。続行しますか？'}
            </p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={handleCancel} style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                キャンセル
              </button>
              <button type="button" onClick={handleConfirm} style={{ padding: '8px 16px', border: 'none', background: '#a00', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>
                続行する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

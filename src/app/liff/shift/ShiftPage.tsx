'use client';
import Script from 'next/script';
import { useRef, useState } from 'react';
import { FormPage, FixedValue, formStyles } from '@/app/system/forms/_components/form-kit';
type Liff = { init: (options: { liffId: string }) => Promise<void>; isInClient: () => boolean; isLoggedIn: () => boolean; getIDToken: () => string | null };
export default function ShiftPage() {
  const id = process.env.NEXT_PUBLIC_LIFF_SHIFT_ID;
  const started = useRef(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState(id ? '確認中です' : '準備中です');
  async function initialize() {
    if (started.current || !id) return;
    started.current = true;
    try {
      const liff = (window as unknown as { liff: Liff }).liff;
      await liff.init({ liffId: id });
      if (!liff.isInClient() || !liff.isLoggedIn()) { setMessage('LINE の中で開いてください'); return; }
      const response = await fetch('/api/liff/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: liff.getIDToken() }), cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) { setMessage(response.status === 401 || response.status === 403 ? 'この画面は従業員の方だけが使えます' : '確認できませんでした。時間をおいてもう一度お試しください。'); return; }
      setName(result.name);
      setMessage('準備中です。提出したシフトをここで確認できるようになります。');
    } catch { setMessage('確認できませんでした。時間をおいてもう一度お試しください。'); }
  }
  if (!id) return <main className={formStyles.pageShell}><FixedValue>準備中です</FixedValue></main>;
  return <div style={{maxWidth:560,margin:'0 auto',padding:16}}><FormPage title={name ? name + 'さんのシフト' : 'シフト'} submitterName="" employeeNumber="" embedded>
    <FixedValue>{message}</FixedValue>
    <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="afterInteractive" onReady={()=>{void initialize();}} onError={()=>setMessage('確認できませんでした。時間をおいてもう一度お試しください。')}/>
  </FormPage></div>;
}

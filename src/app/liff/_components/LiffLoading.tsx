// LINE の中のページで、本人を確かめている間に出す待ち表示（社長スタイルのくるくる）。
// 開いた直後の短い待ちなので、画面全体を暗くせず本文の場所に出す。
export const LIFF_LOADING_MESSAGE = '確認中です';

export default function LiffLoading() {
  return <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '48px 0' }}>
    <style>{'@keyframes garden-liff-spin{to{transform:rotate(360deg)}}'}</style>
    <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: '50%', border: '5px solid rgba(14,165,160,.18)', borderTopColor: '#0ea5a0', animation: 'garden-liff-spin .85s linear infinite' }} />
    <span style={{ fontSize: 15, color: 'var(--ink, #10233F)' }}>読み込んでいます</span>
  </div>;
}

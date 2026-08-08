import Link from "next/link";
import { PartnerHeaderActions } from "./_components/PartnerHeaderActions";

export default function PartnerPortalPage() {
  return (
    <main style={{ minHeight: "100dvh", padding: "clamp(24px,6vw,72px)", background: "var(--bg-paper-soft)", color: "var(--text-main)" }}>
      <header style={{ maxWidth: 760, margin: "0 auto 36px" }}>
        <nav style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Garden toss portal</span>
          <PartnerHeaderActions />
        </nav>
        <h1 style={{ marginTop: 18, fontSize: "clamp(30px,6vw,48px)", fontWeight: 500 }}>外注ポータル</h1>
        <p style={{ color: "var(--text-sub)" }}>利用するフォームを選択してください。</p>
      </header>
      <section style={{ maxWidth: 760, margin: "auto" }}>
        <Link href="/p/toss" style={{ display: "block", padding: 28, border: "1px solid var(--border-card)", borderRadius: 20, background: "var(--bg-card-solid)", color: "inherit", textDecoration: "none", boxShadow: "var(--shadow-soft)" }}>
          <small>01</small><h2 style={{ marginTop: 24 }}>関電メンバー トスポータル</h2><p style={{ color: "var(--text-sub)" }}>案件の登録と進捗確認</p>
        </Link>
      </section>
    </main>
  );
}

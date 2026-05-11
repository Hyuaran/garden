# ============================================================
# Bud Phase D + 5/11 拡張 全 13 migration 検証 Runner（PowerShell）
# ============================================================
# 対応 dispatch: main- No. 295
# 用途: a-main-023 / 東海林さんが main DB に対して検証 SQL を実行
# 前提: .env.local に NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 設定済
# 実行例: pwsh docs/scripts/verify-bud-phase-d-all.ps1
# ============================================================

param(
    [string]$EnvFile = ".env.local",
    [string]$SqlFile = "docs/scripts/verify-bud-phase-d-all.sql"
)

# .env.local 読込（簡易、コメント行除外）
if (-not (Test-Path $EnvFile)) {
    Write-Error "$EnvFile not found. main DB 接続情報が必要。"
    exit 1
}

$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_]+)=(.+?)$' -and $_ -notmatch '^\s*#') {
        $envVars[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
}

$SupabaseUrl = $envVars['NEXT_PUBLIC_SUPABASE_URL']
$ServiceKey = $envVars['SUPABASE_SERVICE_ROLE_KEY']

if (-not $SupabaseUrl -or -not $ServiceKey) {
    Write-Error "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in $EnvFile"
    exit 1
}

# SQL 読込
$Sql = Get-Content $SqlFile -Raw

# Supabase RPC エンドポイント経由で実行（SELECT のみ、書込なし）
# 注意: Supabase REST は単一 SQL 文しかサポートしないため、
#       psql コマンド経由か、Supabase Dashboard SQL Editor で直接 Run 推奨。

Write-Host "=== Bud Phase D 検証手順 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "PowerShell から本 SQL を Supabase に直接送信するのは複雑なため、" -ForegroundColor Yellow
Write-Host "以下のいずれかの方法で SQL を Run してください:" -ForegroundColor Yellow
Write-Host ""
Write-Host "方法 A: Supabase Dashboard SQL Editor" -ForegroundColor Green
Write-Host "  1. https://supabase.com/dashboard/project/<project-ref>/sql"
Write-Host "  2. 以下のファイル内容をコピペ:"
Write-Host "     $SqlFile"
Write-Host "  3. Run"
Write-Host ""
Write-Host "方法 B: psql (DB 直接接続)" -ForegroundColor Green
Write-Host "  psql `"$SupabaseUrl`" -f $SqlFile"
Write-Host ""
Write-Host "方法 C: Supabase CLI" -ForegroundColor Green
Write-Host "  supabase db execute --file $SqlFile"
Write-Host ""
Write-Host "=== 期待結果 ===" -ForegroundColor Cyan
Write-Host "§0 前提拡張 + Root テーブル: 全 OK"
Write-Host "§1 全 41 テーブル: 全 OK"
Write-Host "§2 helpers 関数: 5 件 OK (bud_has_payroll_role / bud_is_admin_or_super_admin / bud_is_super_admin / bud_encrypt_my_number / bud_decrypt_my_number)"
Write-Host "§3 RLS 有効化: 全 OK"
Write-Host "§4 テーブル数集計: D-01=3, D-09=3, D-05=4, D-02=6, D-03=2, D-07=3, D-11=2, D-04=2, D-10=3, D-12=3, D-06=3, Bank=3, Shiwakechou=3"
Write-Host "§5 重要制約: 2 件 OK (uq_eba_active_account_per_employee / chk_yes_no_self_approval)"
Write-Host ""
Write-Host "NG row があれば該当 migration を a-main-023 / 東海林さんと相談" -ForegroundColor Red

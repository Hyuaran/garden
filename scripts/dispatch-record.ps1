# dispatch-record.ps1 - dispatch 起草と同時に counter / status を自動更新
#
# 使用例:
#   .\scripts\dispatch-record.ps1 -No 177 -Target "claude.ai chat「Garden UI 021」" -File "dispatch-main-no177-...md" -Status "投下予定"
#   .\scripts\dispatch-record.ps1 -No 177 -Target "a-bud-002" -File "dispatch-main-no177-...md" -Status "投下済" -Urgency "🟡"
#
# 機能:
#   1. dispatch-counter.txt を +1
#   2. dispatch-status.md の冒頭表に新規エントリを挿入
#   3. 状態フラグを設定（投下予定 / 投下済 / 完了 / 未投下）
#
# memory `feedback_dispatch_header_format` v5 / `dispatch-template.md` 連携

param(
    [Parameter(Mandatory=$true)]
    [int]$No,

    [Parameter(Mandatory=$true)]
    [string]$Target,

    [Parameter(Mandatory=$true)]
    [string]$File,

    [string]$Status = "起草済（未投下）",

    [string]$Urgency = "🟡",

    [string]$Note = ""
)

$ErrorActionPreference = "Stop"

# スクリプトの位置から repo ルートを自動解決（セッション越え対応、a-main-017 / 018 / 019 ... で共通使用可）
$repoRoot = Split-Path -Parent $PSScriptRoot
$counterFile = Join-Path $repoRoot "docs\dispatch-counter.txt"
$statusFile = Join-Path $repoRoot "docs\dispatch-status.md"

if (-not (Test-Path $counterFile)) {
    Write-Error "dispatch-counter.txt が見つかりません: $counterFile"
    exit 1
}

# === Step 1: counter +1 ===
$nextNo = $No + 1
Set-Content -Path $counterFile -Value $nextNo -Encoding UTF8 -NoNewline
Write-Host "✅ dispatch-counter.txt: $No → $nextNo"

# === Step 2: dispatch-status.md に新規エントリ挿入 ===
$now = Get-Date -Format "yyyy-MM-dd HH:mm"
$flagMap = @{
    "投下予定"   = "🔄 進行中"
    "起草済"     = "❌ 未投下"
    "起草済（未投下）" = "❌ 未投下"
    "投下済"     = "✅ 投下済"
    "完了"       = "✅ 完了"
    "未投下"     = "❌ 未投下"
    "上書き"     = "〜 上書き / 破棄"
    "破棄"       = "〜 上書き / 破棄"
    "要確認"     = "⚠️ 要確認"
}

$flag = $flagMap[$Status]
if (-not $flag) { $flag = "❌ 未投下" }

$noteSuffix = if ($Note) { "（$Note）" } else { "" }
$newEntry = "| - | main- No. $No | $now | $Target | $Status$noteSuffix | $flag |"

# 既存ファイル読み込み
if (-not (Test-Path $statusFile)) {
    Write-Error "dispatch-status.md が見つかりません: $statusFile"
    exit 1
}

$content = Get-Content -Path $statusFile -Raw -Encoding UTF8

# 「## 直近 dispatch 状態」表の冒頭（# | 番号 | 起草日時... のヘッダー直後）に挿入
$pattern = '(\| # \| 番号 \| 起草日時 \| 投下先 \| 状態 \| 完了報告 \|\r?\n\|[-\s|]+\|\r?\n)'
$replacement = "`$1$newEntry`r`n"

if ($content -match $pattern) {
    $newContent = $content -replace $pattern, $replacement
    Set-Content -Path $statusFile -Value $newContent -Encoding UTF8
    Write-Host "✅ dispatch-status.md: main- No. $No エントリ追加"
} else {
    Write-Warning "dispatch-status.md の表ヘッダーが見つからず、自動追加スキップ。手動で追記してください。"
    Write-Host "追加するエントリ: $newEntry"
}

# === Step 3: counter 値表示更新 ===
$content2 = Get-Content -Path $statusFile -Raw -Encoding UTF8
$content2 = $content2 -replace 'dispatch counter: \*\*\d+\*\*', "dispatch counter: **$nextNo**"
Set-Content -Path $statusFile -Value $content2 -Encoding UTF8
Write-Host "✅ dispatch-status.md 内 counter 表示更新: $nextNo"

Write-Host ""
Write-Host "=== 完了 ==="
Write-Host "dispatch No: $No"
Write-Host "宛先: $Target"
Write-Host "状態: $Status ($flag)"
Write-Host "次の counter: $nextNo"

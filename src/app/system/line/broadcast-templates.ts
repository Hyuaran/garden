// 一斉送信の定型文（押すと絞り込み・題名・送る文が入る。送る前に画面で直せる）
export type BroadcastTemplate = { key: string; label: string; title: string; body: string; tags: { kind: string; name: string }[] };

function jstToday(now: Date) {
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1 };
}

export function broadcastTemplates(now = new Date()): BroadcastTemplate[] {
  const { year, month } = jstToday(now);
  const reiwa = year - 2018;
  return [
    {
      key: "employment-contract",
      label: "雇用契約書のお知らせ",
      // 毎月の雇用契約書の更新：在籍中のテレマ（ブロードバンド事業）のアルバイト
      tags: [{ kind: "employment", name: "アルバイト" }, { kind: "business", name: "ブロードバンド事業" }, { kind: "status", name: "在籍中" }],
      title: `${year}年${month}月分 雇用契約書`,
      body: `お疲れ様です！\n\n${year}年${month}月分【雇用契約書】のクラウドサインをお送りしてますので、認証作業をお願いします。\nすでに認証済みの方もいらっしゃいますが、再送が必要な方はご連絡ください！`,
    },
    {
      key: "year-end-adjustment",
      label: "年末調整のお知らせ",
      // 所属は関係なく、在籍中の正社員とアルバイト。案内メールの日付と期限の日付は毎年送る前に直す
      tags: [{ kind: "employment", name: "正社員" }, { kind: "employment", name: "アルバイト" }, { kind: "status", name: "在籍中" }],
      title: `${year}年度 年末調整申告開始のお知らせ`,
      body: [
        "【年末調整申告開始のお知らせ】",
        `～ ${year}年度 ～`,
        "",
        "お疲れ様です！",
        "年末調整の申告が開始いたしました。",
        "すでにマネーフォワードでご登録のメールアドレスにご案内が送信されております。",
        "※10/21(水)～10/23(金)頃",
        "",
        "質問に「はい」もしくは「いいえ」で答えていただき、",
        "保険料控除などの情報は入力を行って下さい。",
        "",
        `〇令和${reiwa}年途中入社の従業員様の源泉徴収票について`,
        "〇控除証明や源泉徴収票について",
        "添付いただき、原本の提出が必要です。",
        "チームリーダーを通じて東海林まで必ずご提出ください。",
        "",
        "〇保険料控除について",
        "年内途中で解約された保険がある場合は、個別に東海林までご相談ください。",
        "",
        "●申告入力・原本提出期限",
        `令和${reiwa}年11月20日(金)17時`,
        "各種控除証明書が間に合わない場合は東海林までご相談ください。",
      ].join("\n"),
    },
  ];
}

/** 定型文のタグ（種類＋名前）を、今あるタグの id に直す。見つからないタグがあれば名前を返す */
export function templateTagIds(template: BroadcastTemplate, tags: { id: string; kind: string; name: string }[]) {
  const ids: string[] = [];
  const missing: string[] = [];
  for (const want of template.tags) {
    const tag = tags.find(t => t.kind === want.kind && t.name === want.name);
    if (tag) ids.push(tag.id); else missing.push(want.name);
  }
  return { ids, missing };
}

/**
 * Tree Phase D-02: 結果ボタンラベル → DB enum マッピング
 *
 * _constants/callButtons.ts のラベル（日本語表示）から
 * tree_call_records.result_code（DB CHECK 制約値）へ変換。
 *
 * D-01 §0-2 確定: result_code は CHECK 制約 hard-code（12 種）
 */

export type ResultCode =
  | 'toss' | 'order' | 'tantou_fuzai' | 'coin'
  | 'sight_A' | 'sight_B' | 'sight_C'
  | 'unreach'
  | 'ng_refuse' | 'ng_claim' | 'ng_contracted' | 'ng_other';

export type ResultGroup = 'positive' | 'pending' | 'negative' | 'neutral';

const LABEL_TO_RESULT_CODE: Record<string, ResultCode> = {
  'トス': 'toss',
  '受注': 'order',
  '担不': 'tantou_fuzai',
  'コイン': 'coin',
  '見込 A': 'sight_A',
  '見込 B': 'sight_B',
  '見込 C': 'sight_C',
  '不通': 'unreach',
  'NG お断り': 'ng_refuse',
  'NG クレーム': 'ng_claim',
  'NG 契約済': 'ng_contracted',
  'NG その他': 'ng_other',
};

const RESULT_CODE_TO_GROUP: Record<ResultCode, ResultGroup> = {
  toss: 'positive', order: 'positive', coin: 'positive',
  sight_A: 'pending', sight_B: 'pending', sight_C: 'pending',
  ng_refuse: 'negative', ng_claim: 'negative', ng_contracted: 'negative', ng_other: 'negative',
  unreach: 'neutral', tantou_fuzai: 'neutral',
};

export function labelToResultCode(label: string): ResultCode | null {
  return LABEL_TO_RESULT_CODE[label] ?? null;
}

export function resultCodeToGroup(code: ResultCode): ResultGroup {
  return RESULT_CODE_TO_GROUP[code];
}

/** トス時はメモ必須（業務ルール） */
export function isMemoRequired(code: ResultCode): boolean {
  return code === 'toss';
}

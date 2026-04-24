/**
 * Garden Root — upsert/insert 前の payload クレンジング
 *
 * 目的（Phase A-3-f）:
 *   Root Phase A-1 の 7 マスタ実装で、`emptyX()` ファクトリが `created_at: ""` /
 *   `updated_at: ""` を含む空の行オブジェクトを返していたため、新規作成時に
 *   Postgres が `invalid input syntax for type timestamp with time zone: ""` を
 *   返すバグが Phase A-2 KoT sync で発覚（PR #15 / commit 6f07eef で KoT 側のみ修正）。
 *
 *   本モジュールは 7 マスタ共通で使えるサニタイザを提供する。
 *
 * 設計方針:
 *   - `created_at` / `updated_at` は **常に payload から除外**する
 *     - INSERT 時: Postgres の DEFAULT now() が効く
 *     - UPDATE 時: `trg_*_updated_at` トリガが updated_at を自動更新
 *     - 空文字列が含まれていても弾かれない（除外されるため）
 *   - フィールド値が空文字 `""` の timestamptz / date 列も安全に扱いたい場合、
 *     `nullableDateKeys` オプションで指定すると `undefined` に変換する
 *     （PostgREST が undefined を省略するため、DB の DEFAULT / NULL 許容に任せる）
 *   - 既にマスタ個別の `onChange` で `value || null` している nullable 列は別に
 *     null が入っているので、このサニタイザは「想定外の空文字流入」に対する
 *     二重防御（defensive）に位置づけられる。
 */

/** payload から必ず除外するキー（DB 側で自動管理） */
const AUTO_MANAGED_KEYS = ["created_at", "updated_at"] as const;

export type SanitizeOptions = {
  /** 追加で除外したいキー（例: trigger 生成される nextId 等） */
  excludeKeys?: readonly string[];
  /** 空文字 `""` を undefined に変換したい date/timestamptz/nullable 列 */
  nullableDateKeys?: readonly string[];
};

/**
 * payload を upsert/insert 用にクレンジングする。
 *
 * TypeScript の index signature 制約を避けるため、入力は `object` で受けて
 * 実行時に `Object.entries` で走査する。呼出側は返り値を `Partial<T>` で
 * 扱えるよう、型パラメータ T を明示するか、後段で as キャストしてよい。
 *
 * @returns `Partial<T>` 相当のプレーンオブジェクト（キーは除外後の残存分のみ）
 */
export function sanitizeUpsertPayload<T extends object>(
  payload: T,
  options: SanitizeOptions = {},
): Partial<T> {
  const excluded = new Set<string>([...AUTO_MANAGED_KEYS, ...(options.excludeKeys ?? [])]);
  const nullableDate = new Set<string>(options.nullableDateKeys ?? []);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (excluded.has(key)) continue;
    if (nullableDate.has(key) && value === "") continue; // undefined で送らせる
    result[key] = value;
  }
  return result as Partial<T>;
}

/**
 * マスタごとの nullable date/timestamptz 列一覧。
 * 新規マスタ追加時はここを更新することで、ページ側の handleSave は
 * `sanitizeUpsertPayload(editTarget, { nullableDateKeys: NULLABLE_DATE_KEYS.xxx })`
 * を呼ぶだけで漏れなく対応できる。
 */
export const NULLABLE_DATE_KEYS = {
  companies: [] as const,
  bank_accounts: [] as const,
  vendors: [] as const,
  employees: ["termination_date"] as const,
  salary_systems: [] as const,
  insurance: ["effective_to"] as const,
  attendance: ["imported_at"] as const,
} as const;

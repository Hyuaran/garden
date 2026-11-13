"use client";

import { useRef, useState } from "react";
import SystemBreadcrumb from "@/app/system/_components/SystemBreadcrumb/SystemBreadcrumb";
import UpdatedStamp from "@/app/system/_components/UpdatedStamp/UpdatedStamp";
import DataTable, {
  type DataColumn,
} from "@/app/system/_components/DataTable/DataTable";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import Modal from "@/app/system/_components/Modal/Modal";
import { SystemViewHeading, SystemViewButton } from "@/app/system/_components/ViewPermissionButton/SystemViewContext";
import {
  ActionButton,
  ActionRow,
  FieldGrid,
  FieldLabel,
  FixedValue,
  FormRow,
  NumberField,
  RadioGroup,
  ResultMessage,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
  formStyles,
} from "@/app/system/forms/_components/form-kit";
import {
  CATEGORIES,
  CHANNELS,
  REPORT_GROUPS,
  overlapping,
  roundPoints,
  splitPeriod,
  validateRow,
  type PointRow,
} from "@/lib/product-points";
import { refreshPoints, savePoint } from "./actions";
import styles from "./product-points.module.css";

const options = (values: Record<string, string>) =>
  Object.entries(values).map(([value, label]) => ({ value, label }));
const columns: DataColumn<PointRow>[] = [
  { id: "product", label: "商材", type: "text", value: (row) => row.product },
  {
    id: "category",
    label: "区分",
    type: "text",
    value: (row) => CATEGORIES[row.category],
  },
  {
    id: "channel",
    label: "獲得方法",
    type: "text",
    value: (row) => CHANNELS[row.channel],
  },
  {
    id: "total",
    label: "合計付与ポイント",
    type: "number",
    value: (row) => row.total_points,
  },
  {
    id: "toss",
    label: "トス付与ポイント",
    type: "number",
    value: (row) => row.toss_points,
  },
  {
    id: "closer",
    label: "クローザー付与ポイント",
    type: "number",
    value: (row) => row.closer_points,
  },
  {
    id: "start",
    label: "開始日",
    type: "date",
    value: (row) => row.start_date,
  },
  {
    id: "end",
    label: "終了日",
    type: "date",
    value: (row) => row.end_date ?? "",
  },
];

function blankRow(today: string): PointRow {
  return {
    id: "",
    product: "",
    channel: "hakuchi",
    category: "kaisen",
    report_group: "collab",
    start_date: today,
    end_date: null,
    total_points: 0.2,
    toss_points: 0.2,
    closer_points: 0,
    unit_price: null,
    has_option: null,
    kintone_names: [],
    sort_order: 100,
    note: null,
    updated_at: "",
    updated_by: null,
  };
}

export default function ProductPointsClient({
  initialRows,
  canWrite,
  today,
  initialError = "",
}: {
  initialRows: PointRow[];
  canWrite: boolean;
  today: string;
  initialError?: string;
}) {
  const [checkedAt, setCheckedAt] = useState<string>();
  const [refreshBusy, setRefreshBusy] = useState(false);
  const refreshing = useRef(false);
  const [rows, setRows] = useState(initialRows);
  const [channels, setChannels] = useState(Object.keys(CHANNELS));
  const [categories, setCategories] = useState(Object.keys(CATEGORIES));
  const [showEnded, setShowEnded] = useState(false);
  const [draft, setDraft] = useState<PointRow | null>(null);
  const [source, setSource] = useState<PointRow | null>(null);
  const [split, setSplit] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState(initialError);
  const change = <K extends keyof PointRow>(key: K, value: PointRow[K]) =>
    setDraft((current) => current && { ...current, [key]: value });
  // 既定の並び＝管理表の付与ポイントシートの順（sort_order）→ 白地・LP・アライアンス → 新しい期間が上
  const channelOrder = Object.keys(CHANNELS);
  const visible = rows
    .filter(
      (row) =>
        channels.includes(row.channel) &&
        categories.includes(row.category) &&
        (showEnded ||
          (row.start_date <= today && (!row.end_date || row.end_date >= today))),
    )
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        channelOrder.indexOf(a.channel) - channelOrder.indexOf(b.channel) ||
        b.start_date.localeCompare(a.start_date),
    );
  const updatedAt = rows.reduce(
    (latest, row) => (row.updated_at > latest ? row.updated_at : latest),
    "",
  );

  async function refresh() {
    if (refreshing.current || saving.current) return;
    refreshing.current = true;
    setRefreshBusy(true);
    setError("");
    try {
      const result = await refreshPoints();
      if (!result.rows) throw new Error(result.error);
      setRows(result.rows);
      setCheckedAt(result.checkedAt);
    } catch {
      setError("付与ポイント表を読み直せませんでした。もう一度お試しください。");
    } finally {
      refreshing.current = false;
      setRefreshBusy(false);
    }
  }

  function open(row?: PointRow) {
    if (saving.current) return;
    setSource(row ?? null);
    setDraft(row ? { ...row } : blankRow(today));
    setSplit(false);
  }

  async function save() {
    if (!draft || !canWrite || saving.current || refreshing.current) return;
    const next = {
      ...draft,
      id: split || !source ? crypto.randomUUID() : source.id,
      product: draft.product.trim(),
      closer_points: roundPoints(draft.total_points - draft.toss_points),
    };
    const validation = validateRow(next);
    if (validation) {
      setError(validation);
      return;
    }
    const before = rows;
    let optimistic: PointRow[];
    try {
      if (split && source) optimistic = splitPeriod(rows, source, next);
      else {
        const conflict = overlapping(rows, next);
        if (conflict)
          throw new Error(
            `同じ商材・獲得方法で期間が重なっています（${conflict.start_date}〜${conflict.end_date ?? ""}）`,
          );
        optimistic = rows.filter((row) => row.id !== next.id).concat(next);
      }
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    setRows(optimistic);
    setDraft(null);
    const rollback = (message: string) => {
      setRows(before);
      setError(message);
      setDraft(draft);
    };
    try {
      const result = await savePoint(
        next,
        source?.id ?? null,
        source?.updated_at ?? null,
        split,
      );
      if (result.error || !result.rows) {
        rollback(result.error ?? "保存できませんでした。");
        return;
      }
      const saved = result.rows;
      setRows(
        optimistic
          .filter(
            (row) =>
              row.id !== next.id && !saved.some((item) => item.id === row.id),
          )
          .concat(saved),
      );
    } catch {
      rollback("保存できませんでした。通信を確認して、もう一度お試しください。");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const field = (label: string, input: React.ReactNode) => (
    <FieldLabel label={label}>{input}</FieldLabel>
  );
  return (
    <main className={`${formStyles.pageShell} ${styles.pageShell}`}>
      <header>
        <SystemBreadcrumb root={{ label: "Soil", href: "/soil" }} items={[{ label: "付与ポイント表" }]} />
        <SystemViewHeading>
          <h1>付与ポイント表</h1>
          <SystemViewButton />
        </SystemViewHeading>
        <UpdatedStamp label="" date={checkedAt ?? updatedAt} showSeconds onRefresh={() => void refresh()} busy={refreshBusy} disabled={busy} refreshLabel="付与ポイント表を読み直す" />
      </header>
      <div className={styles.filters}>
        <BoxSelect
          label="獲得方法"
          value={channels}
          options={options(CHANNELS)}
          onChange={setChannels}
        />
        <BoxSelect
          label="区分"
          value={categories}
          options={options(CATEGORIES)}
          onChange={setCategories}
        />
        <label>
          <input
            type="checkbox"
            checked={showEnded}
            onChange={(event) => setShowEnded(event.target.checked)}
          />{" "}
          終了期間も表示
        </label>
      </div>
      <ResultMessage>{error}</ResultMessage>
      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(row) => row.id}
        searchText={(row) => [row.product, ...row.kintone_names].join(" ")}
        searchPlaceholder="商材・Kintone での表記"
        defaultSort={{ id: "sheet_order", direction: "asc" }}
        onRowClick={(row) => open(row)}
        rowClickable={() => !busy}
        emptyText="該当する付与ポイントはありません。"
      />
      {canWrite && (
        <ActionRow>
          <ActionButton disabled={busy} onClick={() => open()}>
            追加する
          </ActionButton>
        </ActionRow>
      )}
      {draft && (
        <Modal
          title={source ? "付与ポイントを確認・変更" : "付与ポイントを追加"}
          size="lg"
          onClose={() => setDraft(null)}
        >
          <ResultMessage>{error}</ResultMessage>
          <fieldset disabled={!canWrite || busy} className={styles.fields}>
            <FormRow label="商材と獲得方法">
              <FieldGrid>
                {field(
                  "商材",
                  <TextField
                    aria-label="商材"
                    value={draft.product}
                    disabled={split}
                    onChange={(event) => change("product", event.target.value)}
                  />,
                )}
                {field(
                  "獲得方法",
                  split ? (
                    <FixedValue>{CHANNELS[draft.channel]}</FixedValue>
                  ) : (
                    <RadioGroup
                      name="channel"
                      label="獲得方法"
                      options={Object.values(CHANNELS)}
                      value={CHANNELS[draft.channel]}
                      onChange={(value) =>
                        change(
                          "channel",
                          options(CHANNELS).find(
                            (item) => item.label === value,
                          )!.value as PointRow["channel"],
                        )
                      }
                    />
                  ),
                )}
                {field(
                  "区分",
                  <RadioGroup
                    name="category"
                    label="区分"
                    options={Object.values(CATEGORIES)}
                    value={CATEGORIES[draft.category]}
                    onChange={(value) =>
                      change(
                        "category",
                        options(CATEGORIES).find(
                          (item) => item.label === value,
                        )!.value as PointRow["category"],
                      )
                    }
                  />,
                )}
                {field(
                  "配信の内訳",
                  <SelectField
                    aria-label="配信の内訳"
                    value={draft.report_group}
                    onChange={(event) =>
                      change(
                        "report_group",
                        event.target.value as PointRow["report_group"],
                      )
                    }
                  >
                    {options(REPORT_GROUPS).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>,
                )}
              </FieldGrid>
            </FormRow>
            <FormRow label="付与ポイント">
              <FieldGrid>
                {field(
                  "合計付与ポイント",
                  <NumberField
                    aria-label="合計付与ポイント"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.total_points}
                    onChange={(event) =>
                      change("total_points", event.target.valueAsNumber)
                    }
                  />,
                )}
                {field(
                  "トス付与ポイント",
                  <NumberField
                    aria-label="トス付与ポイント"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.toss_points}
                    onChange={(event) =>
                      change("toss_points", event.target.valueAsNumber)
                    }
                  />,
                )}
                {field(
                  "クローザー付与ポイント",
                  <FixedValue>
                    {Number.isFinite(draft.total_points - draft.toss_points)
                      ? roundPoints(draft.total_points - draft.toss_points)
                      : ""}
                  </FixedValue>,
                )}
              </FieldGrid>
            </FormRow>
            <FormRow
              label={split ? "新しいポイントを使い始める日" : "使う期間"}
            >
              <FieldGrid>
                {field(
                  "開始日",
                  <TextField
                    aria-label="開始日"
                    type="date"
                    value={draft.start_date}
                    onChange={(event) =>
                      change("start_date", event.target.value)
                    }
                  />,
                )}
                {field(
                  "終了日",
                  split ? (
                    <FixedValue>{source?.end_date ?? "期限なし"}</FixedValue>
                  ) : (
                    <TextField
                      aria-label="終了日"
                      type="date"
                      value={draft.end_date ?? ""}
                      onChange={(event) =>
                        change("end_date", event.target.value || null)
                      }
                    />
                  ),
                )}
              </FieldGrid>
            </FormRow>
            <FormRow label="金額と表記">
              <FieldGrid>
                {field(
                  "金額",
                  <NumberField
                    aria-label="金額"
                    type="number"
                    min="0"
                    step="1"
                    unit="円"
                    value={draft.unit_price ?? ""}
                    onChange={(event) =>
                      change(
                        "unit_price",
                        event.target.value === ""
                          ? null
                          : event.target.valueAsNumber,
                      )
                    }
                  />,
                )}
                {field(
                  "オプション有無",
                  <RadioGroup
                    name="option"
                    label="オプション有無"
                    options={["あり", "なし", "指定なし"]}
                    value={draft.has_option || "指定なし"}
                    onChange={(value) =>
                      change("has_option", value === "指定なし" ? null : value)
                    }
                  />,
                )}
                {field(
                  "Kintone での表記（1行に1つ）",
                  <TextArea
                    aria-label="Kintone での表記"
                    rows={3}
                    value={draft.kintone_names.join("\n")}
                    onChange={(event) =>
                      change("kintone_names", event.target.value.split("\n"))
                    }
                  />,
                )}
                {field(
                  "備考",
                  <TextArea
                    aria-label="備考"
                    rows={3}
                    value={draft.note ?? ""}
                    onChange={(event) =>
                      change("note", event.target.value || null)
                    }
                  />,
                )}
              </FieldGrid>
            </FormRow>
          </fieldset>
          {canWrite && (
            <ActionRow>
              {source && !split && (
                <ActionButton
                  onClick={() => {
                    setSplit(true);
                    change("start_date", today);
                  }}
                >
                  この日から新しいポイントにする
                </ActionButton>
              )}
              {split && (
                <ActionButton
                  onClick={() => {
                    setSplit(false);
                    setDraft(source);
                  }}
                >
                  期間の変更を取り消す
                </ActionButton>
              )}
              <SubmitButton busy={busy} onClick={() => void save()}>
                保存
              </SubmitButton>
            </ActionRow>
          )}
        </Modal>
      )}
    </main>
  );
}

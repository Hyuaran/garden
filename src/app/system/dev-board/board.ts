import { GARDEN_SHELL_MODULES } from "@/app/_components/layout/GardenShell/garden-shell-config";
export const modules = [{ id: "system", name: "System" }, ...GARDEN_SHELL_MODULES, { id: "common", name: "共通" }];
export const statuses = { open: "未回答", answered: "回答済み", in_progress: "Claude が対応中", done: "完了" };
export type Question = { id: string; module: string; title: string; body: string; answer_type: "choice" | "text"; options: {key: string; label: string; recommended?: boolean}[]; status: keyof typeof statuses; answer_choice: string | null; answer_text_raw: string | null; answer_text: string | null; answered_at: string | null; created_at: string; done_at: string | null; sort: number; system_dev_question_logs: {id: string; at: string; actor: string; action: string; detail: unknown}[] };
export function rawAnswer(q: Question, choice: string, text: string) {
 const option = q.options.find(o => o.key === choice);
 if (q.answer_type === "choice" && choice === "other" && !text.trim()) throw new Error("補足に書いてください");
 if (q.answer_type === "choice" && choice && choice !== "other" && !option) throw new Error("答えを選んでください。");
 const raw = [q.answer_type === "choice" ? option?.label : "", text.trim()].filter(Boolean).join("\n");
 if (!raw || raw.length > 10000) throw new Error("回答を1〜10000文字で入力してください。");
 return raw;
}
export function orderedQuestions(rows: Question[]) { const order = {open: 0, in_progress: 1, answered: 2, done: 3}; return [...rows].sort((a,b) => order[a.status]-order[b.status] || a.sort-b.sort || a.created_at.localeCompare(b.created_at)); }

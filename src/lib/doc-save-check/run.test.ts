import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: vi.fn(() => { throw Error("実DB禁止"); }) }));
vi.mock("@/app/api/bud/expense-drive/_lib/drive", () => ({ getDriveAccessToken: vi.fn(() => { throw Error("実Drive禁止"); }), findOrCreateSubfolder: vi.fn(), uploadToFolder: vi.fn() }));
import { runDocSaveCheck, type DocRepository, type RunDeps } from "./run";
import { mail, attachment } from "./test-fixtures";
function setup(ok: boolean | null = true) {
  const history = new Set<string>();
  const repo: DocRepository = {
    lastApplied: vi.fn(async () => ok === null ? null : { ran_at: "2026-10-27T01:00:00Z", applied: true, ok }),
    insert: vi.fn(async () => {}), wasSaved: vi.fn(async md5 => history.has(md5)),
    record: vi.fn(async item => { history.add(item.md5); }),
  };
  const deps: RunDeps = { now: new Date("2026-10-28T01:10:00Z"), repo, notifier: { send: vi.fn(async () => {}) }, fetchMails: vi.fn(async () => ({ items: [mail], failedMailboxes: [] })), content: async () => attachment.contentBytes, attachments: async () => [attachment], index: vi.fn(async () => new Set<string>()), save: vi.fn(async () => ({ id: "file", url: "https://drive.test/file", fileName: "saved.pdf" })) };
  return { deps, repo };
}
const apply = { apply: true, trigger: "cron" as const };
describe("runDocSaveCheck", () => {
  beforeEach(() => { vi.stubEnv("DOC_SAVE_CHECK_AUTOSAVE", "off"); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("切りでは知らせるだけ", async () => {
    const { deps, repo } = setup();
    const result = await runDocSaveCheck(apply, deps);
    expect(result.ok).toBe(true); expect(result.counts?.missing).toBe(1);
    expect(deps.save).not.toHaveBeenCalled(); expect(repo.record).not.toHaveBeenCalled();
    expect(deps.notifier!.send).toHaveBeenCalledTimes(1); expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(result.message).toContain("契約書.pdf");
  });
  it("on なら保存・記録し、Driveから消されても二度保存しない", async () => {
    vi.stubEnv("DOC_SAVE_CHECK_AUTOSAVE", "on");
    const { deps, repo } = setup();
    const first = await runDocSaveCheck(apply, deps);
    expect(first.counts?.autosaved).toBe(1); expect(first.message).toContain("保存しました https://drive.test/file");
    const second = await runDocSaveCheck(apply, deps);
    expect(second.counts?.previouslySaved).toBe(1);
    expect(second.counts?.missing).toBe(0);
    expect(second.message).toBeUndefined();
    expect(deps.notifier!.send).toHaveBeenCalledTimes(1);
    expect(deps.save).toHaveBeenCalledTimes(1); expect(repo.record).toHaveBeenCalledTimes(1);
  });
  it("dry はスイッチonでも送らない・保存しない・一切記録しない", async () => {
    vi.stubEnv("DOC_SAVE_CHECK_AUTOSAVE", "on");
    const { deps, repo } = setup();
    const result = await runDocSaveCheck({ ...apply, apply: false }, deps);
    expect(result.ok).toBe(true); expect(result.message).toContain("未保存 1 件");
    for (const fn of [deps.notifier!.send, deps.save, repo.insert, repo.record]) expect(fn).not.toHaveBeenCalled();
  });
  it("失敗通知は一回、回復は一回", async () => {
    const first = setup();
    first.deps.fetchMails = async () => { throw Error("boom"); };
    await runDocSaveCheck(apply, first.deps);
    expect(first.deps.notifier!.send).toHaveBeenCalledTimes(1);
    const second = setup(false); second.deps.fetchMails = first.deps.fetchMails;
    await runDocSaveCheck(apply, second.deps);
    expect(second.deps.notifier!.send).not.toHaveBeenCalled();
    second.deps.fetchMails = async () => ({ items: [], failedMailboxes: [] });
    await runDocSaveCheck(apply, second.deps);
    expect(second.deps.notifier!.send).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("回復しました"));
  });
  it("一箱でも読めなければ未保存と決め付けずエラー", async () => {
    const { deps } = setup();
    deps.fetchMails = async () => ({ items: [mail], failedMailboxes: [{ mailbox: "bad", error: "403" }] });
    const result = await runDocSaveCheck(apply, deps);
    expect(result.ok).toBe(false); expect(result.error).toContain("読めなかった"); expect(deps.save).not.toHaveBeenCalled();
  });
  it("dryの失敗も通知・記録せず、保存失敗に保存履歴を作らない", async () => {
    const { deps, repo } = setup();
    deps.attachments = async () => { throw Error("添付を読めません"); };
    expect((await runDocSaveCheck({ ...apply, apply: false }, deps)).ok).toBe(false);
    expect(deps.notifier!.send).not.toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
    vi.stubEnv("DOC_SAVE_CHECK_AUTOSAVE", "on");
    deps.attachments = async () => [attachment];
    deps.save = async () => { throw Error("保存失敗"); };
    expect((await runDocSaveCheck(apply, deps)).ok).toBe(false);
    expect(repo.record).not.toHaveBeenCalled();
  });
  it("異常なしは月曜だけ・休日はforceだけ", async () => {
    const { deps } = setup(); deps.fetchMails = async () => ({ items: [], failedMailboxes: [] });
    await runDocSaveCheck(apply, deps); expect(deps.notifier!.send).not.toHaveBeenCalled();
    deps.now = new Date("2026-10-26T01:10:00Z");
    await runDocSaveCheck(apply, deps); expect(deps.notifier!.send).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("異常なし"));
    deps.now = new Date("2026-10-31T01:10:00Z");
    expect((await runDocSaveCheck(apply, deps)).skipped).toBe("休みの日");
    expect((await runDocSaveCheck({ ...apply, force: true }, deps)).skipped).toBeUndefined();
  });
});


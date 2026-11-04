// Offline only: in-memory PostgreSQL. No environment files or network clients.
// npm install --prefix .codex-515-test-db --no-package-lock --ignore-scripts @electric-sql/pglite@0.5.15
// node scripts/attendance/test-migration.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const packageRoot = resolve(
  process.argv[2] ||
    ".codex-515-test-db/node_modules/@electric-sql/pglite/dist",
);
const { PGlite } = await import(
  pathToFileURL(resolve(packageRoot, "index.js"))
);
const { pg_trgm } = await import(
  pathToFileURL(resolve(packageRoot, "contrib/pg_trgm.js"))
);
const db = new PGlite({ extensions: { pg_trgm } });
let checks = 0;
const test = (value, expected) => {
  assert.deepEqual(value, expected);
  checks++;
};
const query = async (sql, params = []) => (await db.query(sql, params)).rows;

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create extension pg_trgm;
    create table root_employees(employee_id text primary key, user_id uuid, name text);
    insert into root_employees(employee_id,name) values ('E1','本人'),('M1','責任者');
    create table system_kanri_month_setting(year_month text primary key,holidays date[],updated_by uuid,updated_at timestamptz);
    create table system_view_scopes(page_key text,tab_key text,label text,default_roles text[],primary key(page_key,tab_key));
    create function public.search_norm(text,boolean) returns text language sql immutable as 'select lower(coalesce($1,''''))';
    create function public.garden_search_join(variadic text[]) returns text language sql immutable as 'select array_to_string($1,'' '')';
  `);
  for (const name of [
    "20260813000004_system_attendance_punches.sql",
    "20260909000002_system_attendance_kot_export_rounding.sql",
    "20261103000511_shift_submit_confirm.sql",
    "20261103000512_shift_kot_status.sql",
    "20261104000516_attendance_corrections_kot_send.sql",
  ]) {
    await db.exec(await readFile(resolve("supabase/migrations", name), "utf8"));
  }
  test(
    (
      await query("select kot_send_start_date from system_attendance_settings")
    )[0].kot_send_start_date,
    null,
  );
  const punches = [
    {
      punch_type: "clock_in",
      punched_at: "2026-11-03T14:00:00+09:00",
      client_punch_id: "11111111-1111-5111-8111-111111111111",
    },
  ];
  const imported = () =>
    db.query("select import_kot_attendance_day($1,$2,$3,$4)", [
      "E1",
      "2026-11-03",
      JSON.stringify(punches),
      JSON.stringify({ start_time: "18:30", kot_status: "sent" }),
    ]);
  await imported();
  await imported();
  test(
    (await query("select count(*)::int n from system_attendance_punches"))[0].n,
    1,
  );
  test(
    (
      await query(
        "select start_time::text,kot_status from system_shift_confirmed",
      )
    )[0],
    { start_time: "18:30:00", kot_status: "sent" },
  );
  await db.exec(`insert into system_attendance_punches(employee_id,punch_type,punched_at,client_punch_id,source) values
    ('E1','clock_out','2026-11-03T21:00:00+09:00','22222222-2222-4222-8222-222222222222','web'),
    ('E1','break_start','2026-11-03T16:00:00+09:00','33333333-3333-4333-8333-333333333333','correction');`);
  punches.length = 0;
  await imported();
  test(
    (
      await query(
        "select source from system_attendance_punches order by source",
      )
    ).map((row) => row.source),
    ["correction", "web"],
  );
  await db.exec(
    "update system_attendance_settings set kot_send_start_date='2026-11-03'",
  );
  await assert.rejects(imported(), /開始日以降/);
  checks++;
  test(
    (await query("select count(*)::int n from system_attendance_punches"))[0].n,
    2,
  );
  await db.exec(
    "update system_attendance_settings set kot_send_start_date=null",
  );
  const today = (
    await query("select (now() at time zone 'Asia/Tokyo')::date::text d")
  )[0].d;
  async function correction(action, target = null, time = "14:00") {
    return (
      await query(
        `insert into system_attendance_corrections(employee_id,work_date,action,punch_type,target_punch_id,requested_time,reason)
      values('E1',$1,$2,'clock_in',$3,$4,'打刻の修正') returning id`,
        [
          today,
          action,
          target,
          action === "delete" ? null : `${today}T${time}:00+09:00`,
        ],
      )
    )[0].id;
  }
  const added = await correction("add");
  await assert.rejects(
    db.query(
      "select decide_attendance_correction($1,'E1','approved','',false)",
      [added],
    ),
    /自分の申請/,
  );
  checks++;
  await db.query(
    "select decide_attendance_correction($1,'M1','approved','',false)",
    [added],
  );
  const raw = (
    await query(
      "select id,punched_at from system_attendance_punches where correction_id=$1",
      [added],
    )
  )[0];
  test(Boolean(raw), true);
  const changed = await correction("change", raw.id, "15:00");
  await db.query(
    "select decide_attendance_correction($1,'M1','approved','',false)",
    [changed],
  );
  test(
    (
      await query(
        "select punched_at,voided_at is not null voided from system_attendance_punches where id=$1",
        [raw.id],
      )
    )[0],
    { punched_at: raw.punched_at, voided: true },
  );
  const replacement = (
    await query(
      "select id from system_attendance_punches where correction_id=$1",
      [changed],
    )
  )[0].id;
  const deleted = await correction("delete", replacement);
  await db.query(
    "select decide_attendance_correction($1,'M1','approved','',false)",
    [deleted],
  );
  test(
    (
      await query(
        "select count(*)::int n from system_attendance_punches where correction_id=$1 and voided_at is null",
        [changed],
      )
    )[0].n,
    0,
  );
  await db.query(
    "insert into system_attendance_kot_send(employee_id,work_date,status) values('E1',$1,'sent')",
    [today],
  );
  const sentCorrection = await correction("add");
  await db.query(
    "select decide_attendance_correction($1,'E1','approved','',true)",
    [sentCorrection],
  );
  test(
    (
      await query(
        "select kot_fix_needed from system_attendance_corrections where id=$1",
        [sentCorrection],
      )
    )[0].kot_fix_needed,
    true,
  );
  const rejected = await correction("add");
  await assert.rejects(
    db.query(
      "select decide_attendance_correction($1,'M1','rejected','',false)",
      [rejected],
    ),
    /却下の理由/,
  );
  checks++;
  const failedChange = await correction("change", 99999999);
  await assert.rejects(
    db.query(
      "select decide_attendance_correction($1,'M1','approved','',false)",
      [failedChange],
    ),
  );
  checks++;
  test(
    (
      await query(
        "select status from system_attendance_corrections where id=$1",
        [failedChange],
      )
    )[0].status,
    "pending",
  );
  await assert.rejects(
    db.query(
      "insert into system_shift_submission(employee_id,year_month,note) values('E1','2026-12',$1)",
      ["x".repeat(501)],
    ),
  );
  checks++;
  const rls = await query(
    "select relrowsecurity from pg_class where relname in ('system_attendance_settings','system_attendance_corrections','system_attendance_kot_send')",
  );
  test(
    rls.every((row) => row.relrowsecurity),
    true,
  );
  const activeCorrectionPunch = (
    await query("select id from system_attendance_punches where correction_id=$1", [sentCorrection])
  )[0].id;
  const invalidChange = await correction("change", activeCorrectionPunch);
  await db.query("update system_attendance_corrections set requested_time=requested_time+interval '1 day' where id=$1", [invalidChange]);
  await assert.rejects(db.query("select decide_attendance_correction($1,'M1','approved','',false)", [invalidChange]), /日付/);
  checks++;
  test((await query("select voided_at from system_attendance_punches where id=$1", [activeCorrectionPunch]))[0].voided_at, null);

  await db.exec("insert into root_employees(employee_id,name) values('E2','送信対象')");
  await db.query("update system_attendance_settings set kot_send_start_date=$1", [today]);
  const sendIds = await query(`insert into system_attendance_punches(employee_id,punch_type,punched_at,client_punch_id)
    values('E2','clock_in',$1,gen_random_uuid()::text),('E2','clock_out',$2,gen_random_uuid()::text) returning id`, [
    `${today}T14:00:00+09:00`, `${today}T21:00:00+09:00`,
  ]);
  const attempt = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await db.query("select claim_attendance_send('E2',$1,$2,$3)", [today, sendIds.map(row => row.id), attempt]);
  await assert.rejects(db.query("select claim_attendance_send('E2',$1,$2,gen_random_uuid())", [today, sendIds.map(row => row.id)]), /処理中/);
  checks++;
  await db.query("select finish_attendance_send('E2',$1,$2,'failed','登録失敗','[]','M1')", [today, attempt]);
  test((await query("select distinct kot_sync_status from system_attendance_punches where employee_id='E2'"))[0].kot_sync_status, "unsent");
  await db.query("select claim_attendance_send('E2',$1,$2,$3)", [today, sendIds.map(row => row.id), attempt]);
  await db.query("select finish_attendance_send('E2',$1,$2,'sent',null,'[]','M1')", [today, attempt]);
  test((await query("select distinct kot_sync_status from system_attendance_punches where employee_id='E2'"))[0].kot_sync_status, "synced");
  await db.query("select mark_attendance_manual('E1','2026-01-01','M1')");
  test((await query("select status from system_attendance_kot_send where employee_id='E1' and work_date='2026-01-01'"))[0].status, "manual");
  console.log(
    `Offline PostgreSQL: ${checks} checks passed; migration applied only to memory.`,
  );
} finally {
  await db.close();
}

// ローカルの一時PostgreSQLのみ。本番の接続情報・環境変数を読み込まない。
// node scripts/verify-product-points-520.mjs ./tmp/verify-520/node_modules/@electric-sql/pglite
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const modulePath = path.resolve(process.argv[2]);
const { PGlite } = await import(
  pathToFileURL(path.join(modulePath, "dist/index.js")).href
);
const { btree_gist } = await import(
  pathToFileURL(path.join(modulePath, "dist/contrib/btree_gist.js")).href
);

async function main() {
  const db = new PGlite({ extensions: { btree_gist } });
  let checks = 0;
  const check = (actual, expected) => {
    assert.deepEqual(actual, expected);
    checks++;
  };
  const fails = async (sql, params, code) => {
    await assert.rejects(db.query(sql, params), (error) => error.code === code);
    checks++;
  };
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('00000000-0000-0000-0000-000000000001');
      create function public.has_role_at_least(text) returns boolean language sql stable
        as $$ select coalesce(current_setting('test.manager', true), '') = 'yes' $$;
    `);
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261112000520_soil_product_points.sql",
        "utf8",
      ),
    );
    check(
      (await db.query("select count(*)::int as count from soil_product_points"))
        .rows[0].count,
      81,
    );
    const source = (
      await db.query(
        "select * from soil_product_points where product = 'AU光' and channel = 'hakuchi'",
      )
    ).rows[0];
    const call = (row, split = false, expected = source.updated_at) =>
      db.query(
        "select * from soil_product_points_save($1::jsonb, $2::uuid, $3::uuid, $4::timestamptz, $5)",
        [
          JSON.stringify(row),
          "00000000-0000-0000-0000-000000000001",
          source.id,
          expected,
          split,
        ],
      );
    // 重複する新規行は並行処理でも最後の防壁となる排他制約が断る。
    await fails(
      "insert into soil_product_points(product,channel,category,report_group,start_date,total_points) values ('AU光','hakuchi','kaisen','au','2026-12-01',2)",
      [],
      "23P01",
    );
    await fails(
      "insert into soil_product_points(product,channel,category,report_group,start_date,total_points,toss_points) values ('試験','lp','credit','credit','2026-11-01',0.1,0.2)",
      [],
      "23514",
    );
    await fails(
      "insert into soil_product_points(product,channel,category,report_group,start_date,end_date,total_points) values ('試験','lp','kaisen','au','2026-11-02','2026-11-01',1)",
      [],
      "23514",
    );
    check(
      (
        await db.query(
          "select product from soil_product_point_at('au光 Sonet','hakuchi','2026-11-01')",
        )
      ).rows[0].product,
      "AU光",
    );
    check(
      (
        await db.query(
          "select product from soil_product_point_at('SoftbankAir　割賦','lp','2026-11-12')",
        )
      ).rows[0].product,
      "SoftbankAir 割賦",
    );
    check(
      (
        await db.query(
          "select * from soil_product_point_at('au光プラス','hakuchi','2026-11-12')",
        )
      ).rows.length,
      0,
    );

    // 2行目のCHECK失敗でも先に行われた終了日変更が残らない。
    await assert.rejects(
      call(
        {
          ...source,
          start_date: "2026-11-15",
          total_points: 0.1,
          toss_points: 0.2,
        },
        true,
      ),
    );
    checks++;
    check(
      (
        await db.query(
          "select end_date from soil_product_points where id = $1",
          [source.id],
        )
      ).rows[0].end_date,
      null,
    );
    check(
      (await db.query("select count(*)::int as count from soil_product_points"))
        .rows[0].count,
      81,
    );
    await assert.rejects(call({ ...source, start_date: "2026-11-01" }, true));
    checks++;
    check(
      (
        await db.query(
          "select end_date from soil_product_points where id = $1",
          [source.id],
        )
      ).rows[0].end_date,
      null,
    );
    const saved = await call(
      {
        ...source,
        start_date: "2026-11-15",
        total_points: 2,
        toss_points: 0.2,
      },
      true,
    );
    check(saved.rows.length, 2);
    check(
      (await db.query("select count(*)::int as count from soil_product_points"))
        .rows[0].count,
      82,
    );
    check(
      (
        await db.query(
          "select total_points::float as points from soil_product_point_at('AU光','hakuchi','2026-11-14')",
        )
      ).rows[0].points,
      1.6,
    );
    check(
      (
        await db.query(
          "select closer_points::float as points from soil_product_point_at('AU光','hakuchi','2026-11-15')",
        )
      ).rows[0].points,
      1.8,
    );
    await assert.rejects(
      call({ ...source, total_points: 3 }, false),
      (error) => error.code === "40001",
    );
    checks++;
    await db.exec("set role authenticated");
    check(
      (await db.query("select count(*)::int as count from soil_product_points"))
        .rows[0].count,
      0,
    );
    await db.exec("set test.manager = 'yes'");
    check(
      (await db.query("select count(*)::int as count from soil_product_points"))
        .rows[0].count,
      82,
    );
    await fails("delete from soil_product_points", [], "42501");
    await assert.rejects(call(source), (error) => error.code === "42501");
    checks++;
    await db.exec("reset role");
    console.log(
      `Local PostgreSQL: ${checks} checks passed (migration, overlap, split rollback, concurrency, RLS).`,
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Kintone カスタマイズ：振込依頼の二重払い防止チェック
 *
 * 配信URL（Kintone の「JavaScript / CSSでカスタマイズ」に URL指定で登録する）
 *   https://garden-os.net/kintone/garden-transfer-duplicate-check.js
 *
 * 適用先アプリ
 *   51「振込依頼」（PC 用）
 *
 * 目的（2026-10-15 東海林さん決定・依頼＝010_Daily/2026-10-15/020_Claude/004）
 *   ヒューマンシーン 319,000 円の二重払い（同じ 6 月分の請求書で 7/31・9/1 に 2 回振込）の再発防止。
 *   保存するとき、同じ請求書（Drive のファイル ID）が付いた振込依頼・振込実行が他にあれば確認を出す。
 *   ① 同じ請求書＋同じ支払先（お支払い先 または 口座番号が一致）＝「振込済みです。それでも登録しますか？」
 *   ② 同じ請求書＋支払先が違う＝「添付間違いではありませんか？」
 *   どちらも［キャンセル］で保存をやめる。［OK］なら保存する（分割払い・振込失敗後の再振込など正当な 2 回目があるため完全には止めない）。
 *   ③（「実績期間」欄ができたら）同じ支払先＋同じ実績期間 も ① と同じ確認にする → PERIOD_FIELD を入れる
 *
 * 自分自身は数えない：振込依頼は自分のレコード番号、振込実行は同じ振込ID（51→98 の写し）を除く。
 * 調べられなかったとき（通信の失敗など）は保存を止めない。
 *
 * ★画面以外（API・Claude の手順書）での登録には効かない → レシピ「Kintone振込レコード作成」のドライランにも同じ確認を入れてある。
 */
(function () {
  "use strict";

  var REQUEST_APP = 51;
  var EXECUTE_APP = 98;
  var LINK_FIELD = "リンク"; // 請求書・支払明細
  var PAYEE_FIELD = "文字列__1行__0"; // お支払い先
  var ACCOUNT_FIELD = "文字列__1行__6"; // 口座番号
  var TRANSFER_ID_FIELD = "文字列__1行_"; // 振込ID
  var DUE_FIELD = "日付_0"; // 支払期日
  var AMOUNT_FIELD = "数値"; // 金額
  var PERIOD_FIELD = ""; // 「実績期間」欄のフィールドコード（できたら入れる）
  var DUMMY_PERIOD = "1000-01-01"; // 実績が分からない既存レコードに入れたダミー（同じ実績期間として数えない）

  function fileIdOf(url) {
    if (!url) return null;
    var match = /\/d\/([A-Za-z0-9_-]{10,})/.exec(url) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(url);
    return match ? match[1] : null;
  }

  function norm(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/\s+/g, "");
  }

  function val(record, code) {
    return record && record[code] ? record[code].value : "";
  }

  function samePayee(a, b) {
    var payeeA = norm(val(a, PAYEE_FIELD));
    var accountA = norm(val(a, ACCOUNT_FIELD));
    return (payeeA !== "" && payeeA === norm(val(b, PAYEE_FIELD))) || (accountA !== "" && accountA === norm(val(b, ACCOUNT_FIELD)));
  }

  /**
   * 突き合わせの本体（画面と、手元の検証の両方で使う）
   * current＝保存しようとしているレコード／selfId＝その振込依頼のレコード番号（新規は空）
   * requests・executes＝同じファイル ID を含む振込依頼・振込実行
   */
  function findDuplicates(current, selfId, requests, executes) {
    var id = fileIdOf(val(current, LINK_FIELD));
    var result = { same: [], other: [], period: [] };
    var transferId = norm(val(current, TRANSFER_ID_FIELD));
    var rows = []
      .concat(
        requests
          .filter(function (r) { return String(val(r, "$id")) !== String(selfId || ""); })
          .map(function (r) { return { app: "振込依頼", record: r }; })
      )
      .concat(
        executes
          .filter(function (r) { return !(transferId !== "" && norm(val(r, TRANSFER_ID_FIELD)) === transferId); })
          .map(function (r) { return { app: "振込実行", record: r }; })
      );
    rows.forEach(function (row) {
      var sameFile = id && fileIdOf(val(row.record, LINK_FIELD)) === id;
      var payee = samePayee(current, row.record);
      if (sameFile && payee) result.same.push(row);
      else if (sameFile) result.other.push(row);
      else if (PERIOD_FIELD && payee && val(current, PERIOD_FIELD) && val(current, PERIOD_FIELD) !== DUMMY_PERIOD && val(current, PERIOD_FIELD) === val(row.record, PERIOD_FIELD)) result.period.push(row);
    });
    return result;
  }

  function describe(row) {
    var amount = Number(val(row.record, AMOUNT_FIELD) || 0).toLocaleString("ja-JP");
    return "・" + row.app + " #" + val(row.record, "$id") + "（" + (val(row.record, PAYEE_FIELD) || "支払先なし") + "／" + (val(row.record, DUE_FIELD) || "期日なし") + " 支払／" + amount + " 円）";
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { fileIdOf: fileIdOf, findDuplicates: findDuplicates, describe: describe };
    return;
  }

  function q(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function fetchRecords(app, condition) {
    return kintone
      .api(kintone.api.url("/k/v1/records", true), "GET", { app: app, query: condition + " order by $id desc limit 100" })
      .then(function (resp) { return resp.records || []; });
  }

  function onSubmit(event) {
    var record = event.record;
    var id = fileIdOf(val(record, LINK_FIELD));
    var payee = val(record, PAYEE_FIELD);
    var period = PERIOD_FIELD && val(record, PERIOD_FIELD) !== DUMMY_PERIOD ? val(record, PERIOD_FIELD) : "";
    if (!id && !(period && payee)) return event;
    var selfId = event.recordId || val(record, "$id");

    var conditions = [];
    if (id) conditions.push(LINK_FIELD + ' like "' + q(id) + '"');
    if (period && payee) conditions.push("(" + PAYEE_FIELD + ' = "' + q(payee) + '" and ' + PERIOD_FIELD + ' = "' + q(period) + '")');
    var condition = conditions.join(" or ");

    return Promise.all([fetchRecords(REQUEST_APP, condition), fetchRecords(EXECUTE_APP, condition)])
      .then(function (lists) {
        var found = findDuplicates(record, selfId, lists[0], lists[1]);
        var same = found.same.concat(found.period);
        if (same.length) {
          var head = found.same.length ? "この請求書は、すでに次の振込で使われています。" : "同じ支払先・同じ実績期間の振込がすでにあります。";
          if (!window.confirm(head + "\n\n" + same.map(describe).join("\n") + "\n\n二重払いではありませんか？それでも保存しますか？")) {
            event.error = "保存をやめました（二重払いの確認）。内容を確かめてから保存してください。";
          }
          return event;
        }
        if (found.other.length) {
          if (!window.confirm("別の支払先の振込に、同じ請求書が付いています。\n\n" + found.other.map(describe).join("\n") + "\n\n添付間違いではありませんか？それでも保存しますか？")) {
            event.error = "保存をやめました（請求書の添付の確認）。";
          }
        }
        return event;
      })
      .catch(function (error) {
        // 調べられなかったときは保存を止めない
        if (window.console) window.console.warn("二重払いチェックを実行できませんでした", error);
        return event;
      });
  }

  kintone.events.on(["app.record.create.submit", "app.record.edit.submit", "app.record.index.edit.submit"], onSubmit);
})();

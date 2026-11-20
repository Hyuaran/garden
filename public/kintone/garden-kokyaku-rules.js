/**
 * Kintone 顧客一覧（アプリ 10）の条件分岐を作成・編集画面の項目変更時に実行する。
 * 配信 URL（PC 用・スマートフォン用）
 *   https://garden-os.net/kintone/garden-kokyaku-rules.js
 * 実績日・実績可否は garden-jisseki-rules.js が担当する。付与件数は別途移行する。
 */
(function () {
  'use strict';

  var detailField = '商材詳細ステータス';
  var processOptions = [
    ['一括削除する', ''],
    ['上位店連携依頼へ変更', '上位店連携依頼'],
    ['キャンセル依頼へ変更', 'キャンセル依頼'],
    ['書類郵送依頼へ変更', '書類郵送依頼']
  ];
  var processFields = ['処理希望日', '処理希望時間から', '処理希望時間まで', '処理詳細', '処理共有事項'];
  var statusRules = [
    ['解約', ['解約']],
    ['完了', ['完了']],
    ['支払待ち', ['支払待ち']],
    ['入金待ち', ['工事後FC待ち', '入金待ち']],
    ['後確待ち', ['後確コール待ち', '後確待ち']],
    ['エントリー待ち', ['エントリー待ち']],
    ['開通待ち', ['決済登録待ち', '開通予定日待ち', '工事前FC待ち', '開通待ち']],
    ['キャンセル', ['リトライ', 'キャンセル']],
    ['受注待ち', ['アポ待ち']]
  ];
  var knownDetails = statusRules.reduce(function (details, rule) {
    return details.concat(rule[1]);
  }, ['高齢者フロー', '不明']);
  // 指示書の表記と、書き出し設定にある全角スペース入りの選択肢を除外する。
  var excludedConstruction = ['新設', '新規・新設', '流用', '新設　新規', '新設　流用'];
  var userFields = [
    ['ET日', 'ET者名'],
    ['決済登録日', '決済登録者名'],
    ['後確OK日', '後確者名'],
    ['開通前FC日', '開通前FC者名']
  ];
  var countDates = [
    ['後確OK日', '2023-01-01'],
    ['開通予定日', '2022-01-01'],
    ['キャンセル日', '2023-01-01'],
    ['開通日', '2022-01-01']
  ];

  function includesOption(value, options) {
    var selected = Array.isArray(value) ? value : [value];
    return selected.some(function (option) { return options.indexOf(option) !== -1; });
  }

  function partnerCode(value) {
    var number = Number(value);
    if ((typeof value === 'string' || typeof value === 'number') && Number.isFinite(number) && number >= 1) {
      return String(value);
    }
  }

  function sameValue(current, next) {
    if (Array.isArray(next)) {
      // ユーザー選択は表示名ではなくコードで比較する。
      return Array.isArray(current) && current.length === 1 && current[0]?.code === next[0].code;
    }
    return (current ?? '') === next;
  }

  function evaluateRules(values, today, loginUser, changedField) {
    var updates = {};

    function changed() {
      return !changedField || Array.prototype.indexOf.call(arguments, changedField) !== -1;
    }

    // 1・2・5・6。同時にチェックされた場合は設定順で後のルールが優先される。
    if (changed('チェックボックス')) {
      processOptions.forEach(function (option) {
        if (includesOption(values.チェックボックス, [option[0]])) {
          updates.処理区分 = option[1];
          processFields.forEach(function (code) { updates[code] = ''; });
        }
      });
    }

    // 3・4・7。後続のステータス判定は更新後の詳細ステータスを参照する。
    if (changed('ドロップダウン_9', detailField) &&
        includesOption(values.ドロップダウン_9, ['トスアップ', '成約ベース']) &&
        !includesOption(values[detailField], knownDetails)) {
      updates[detailField] = 'アポ待ち';
    }
    if (changed('数値_0')) {
      var code = partnerCode(values.数値_0);
      if (code !== undefined) { updates.パートナーコード = code; }
    }
    if (changed('開通日', 'ドロップダウン_39') && values.開通日 && values.開通日 <= today &&
        !includesOption(values.ドロップダウン_39, excludedConstruction)) {
      updates[detailField] = '入金待ち';
      updates.商材ステータス = '入金待ち';
    }

    // 14〜17。
    userFields.forEach(function (rule) {
      var dateField = rule[0];
      if (changed(dateField) && values[dateField] && values[dateField] === today) {
        if (loginUser && loginUser.code) {
          updates[rule[1]] = [loginUser.name
            ? { code: loginUser.code, name: loginUser.name }
            : { code: loginUser.code }];
        }
        if (dateField === 'ET日') { updates.ET日カウント＿宮永テスト = '〇'; }
      }
    });

    // 18〜26。
    if (changed(detailField) || updates[detailField]) {
      var detail = updates[detailField] || values[detailField];
      statusRules.forEach(function (rule) {
        if (includesOption(detail, rule[1])) { updates.商材ステータス = rule[0]; }
      });
    }

    // 27〜30。日付項目の値は YYYY-MM-DD。
    countDates.forEach(function (rule) {
      var dateField = rule[0];
      if (changed(dateField) && values[dateField] && values[dateField] >= rule[1]) {
        updates[dateField + 'カウント_宮永テスト'] = '〇';
      }
    });

    Object.keys(updates).forEach(function (field) {
      if (sameValue(values[field], updates[field])) { delete updates[field]; }
    });
    return updates;
  }

  function applyKokyakuRules(values, today, loginUser) {
    return evaluateRules(values, today, loginUser);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyKokyakuRules: applyKokyakuRules };
  }
  if (typeof kintone === 'undefined') { return; }

  var japanDate = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  var screens = ['app.record.create', 'app.record.edit', 'mobile.app.record.create', 'mobile.app.record.edit'];
  var inputs = ['チェックボックス', 'ドロップダウン_9', detailField, '数値_0', 'ドロップダウン_39'];
  userFields.concat(countDates).forEach(function (rule) {
    if (inputs.indexOf(rule[0]) === -1) { inputs.push(rule[0]); }
  });

  inputs.forEach(function (input) {
    var events = screens.map(function (screen) { return screen + '.change.' + input; });
    kintone.events.on(events, function (event) {
      var record = event.record;
      var values = {};
      Object.keys(record).forEach(function (field) { values[field] = record[field].value; });
      var today = japanDate.format(new Date()).replace(/\//g, '-');
      var updates = evaluateRules(values, today, kintone.getLoginUser(), input);
      Object.keys(updates).forEach(function (field) {
        if (record[field]) { record[field].value = updates[field]; }
      });
      // 同じコードでも、数値項目の変更時はルックアップを取得する。
      if (input === '数値_0' && record.パートナーコード && partnerCode(values.数値_0) !== undefined) {
        record.パートナーコード.lookup = true;
      }
      return event;
    });
  });
})();

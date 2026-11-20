/**
 * Kintone 顧客一覧（アプリ 10）の実績日と実績可否を自動更新する。
 * 配信 URL（PC 用・スマートフォン用）
 *   https://garden-os.net/kintone/garden-jisseki-rules.js
 */
(function () {
  'use strict';

  function applyJissekiRules(values) {
    var date = values.実績日 || values.受注日 || '';
    var eligibility = values.実績可否 || '可';
    var retry = values.リトライ日;
    var launch = values.立ち上げ日;

    if (retry && (!launch || launch < retry)) {
      eligibility = '否';
    }
    if (launch && (!retry || launch >= retry)) {
      date = launch;
      eligibility = '可';
    } else if (!launch && values.受注日) {
      // 立ち上げていない受注は、実績日を受注日にそろえる（当日受注）。
      date = values.受注日;
    }
    if (!values.後確OK日 && values.キャンセル日) {
      eligibility = '否';
    }
    if (values.商材詳細ステータス === '管理会社まち') {
      eligibility = '否';
      date = '';
    }
    return { 実績日: date, 実績可否: eligibility };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyJissekiRules: applyJissekiRules };
  }
  if (typeof kintone === 'undefined') { return; }

  var inputs = ['受注日', '立ち上げ日', 'リトライ日', 'キャンセル日', '後確OK日', '商材詳細ステータス'];
  var outputs = ['実績日', '実績可否'];
  var fields = inputs.concat(outputs);
  var screens = ['app.record.create', 'app.record.edit', 'app.record.index.edit',
                 'mobile.app.record.create', 'mobile.app.record.edit'];
  var events = [];
  screens.forEach(function (screen) {
    events.push(screen + '.submit');
    inputs.forEach(function (code) {
      events.push(screen + '.change.' + code);
    });
  });

  kintone.events.on(events, function (event) {
    var record = event.record;
    // 一覧などで判定に必要な項目が見えない場合は、値を推測しない。
    if (!fields.every(function (code) { return !!record[code]; })) { return event; }

    var values = {};
    fields.forEach(function (code) {
      values[code] = record[code].value;
    });
    var result = applyJissekiRules(values);
    outputs.forEach(function (code) {
      if ((record[code].value || '') !== result[code]) {
        record[code].value = result[code];
      }
    });
    return event;
  });
})();

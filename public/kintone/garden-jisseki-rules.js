/**
 * Kintone 顧客一覧（アプリ 10）の実績日と実績可否を自動更新する。
 * 配信 URL（PC 用・スマートフォン用）
 *   https://garden-os.net/kintone/garden-jisseki-rules.js
 */
(function () {
  'use strict';

  // 立ち上げ日・管理会社回収日は「取り直した日」。遅い方を実績日にする。
  function applyJissekiRules(values) {
    var date = values.実績日 || values.受注日 || '';
    var eligibility = values.実績可否 || '可';
    var retry = values.リトライ日;
    var launch = values.立ち上げ日;
    var collected = values.管理会社回収日;
    var waiting = Array.isArray(values.管理会社まち) ? values.管理会社まち.slice() : [];
    var reacquired = [launch, collected].filter(Boolean).sort().pop() || '';

    if (retry && (!reacquired || reacquired < retry)) {
      eligibility = '否';
    }
    if (reacquired && (!retry || reacquired >= retry)) {
      date = reacquired;
      eligibility = '可';
    } else if (!reacquired && values.受注日) {
      // 立ち上げも回収もしていない受注は、実績日を受注日にそろえる（当日受注）。
      date = values.受注日;
    }
    // 管理会社回収日を入れたら、管理会社まちのチェックを外す。
    if (collected) {
      waiting = [];
    }
    if (!values.後確OK日 && values.キャンセル日) {
      eligibility = '否';
    }
    if (waiting.length) {
      eligibility = '否';
      date = '';
    }
    return { 実績日: date, 実績可否: eligibility, 管理会社まち: waiting };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyJissekiRules: applyJissekiRules };
  }
  if (typeof kintone === 'undefined') { return; }

  var inputs = ['受注日', '立ち上げ日', '管理会社まち', '管理会社回収日', 'リトライ日', 'キャンセル日', '後確OK日'];
  var outputs = ['実績日', '実績可否', '管理会社まち'];
  var fields = inputs.concat(['実績日', '実績可否']);
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
      var now = record[code].value;
      var same = Array.isArray(now) ? now.join('|') === result[code].join('|') : (now || '') === result[code];
      if (!same) {
        record[code].value = result[code];
      }
    });
    return event;
  });
})();

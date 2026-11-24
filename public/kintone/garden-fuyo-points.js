/**
 * 顧客一覧（アプリ 10）の付与件数を Garden の付与ポイント表から設定する。
 * PC・スマートフォン共通: https://garden-os.net/kintone/garden-fuyo-points.js
 */
(function () {
  'use strict';

  var output = '付与件数';
  var tossOutput = 'トス付与件数_Garden';
  var changes = ['商材名区分2', '事業名', 'B_リスト名', '実績日', '受注日'];

  function buildQuery(record) {
    function value(code) {
      return String(record[code]?.value ?? '').trim();
    }
    var product = value('商材名区分2');
    var master = value('m_product');
    var date = value('実績日') || value('受注日');
    if (!record[output] || !(product || master) || !date) { return null; }
    return new URLSearchParams({
      product: product, master: master, business: value('事業名'),
      list: value('B_リスト名'), date: date
    }).toString();
  }

  function applyResult(record, result, name) {
    if (Number.isFinite(result.points)) {
      record[output].value = String(result.points);
      // トス分が無い商材・獲得方法も空欄にせず 0 を入れる（AP付与件数＝付与件数−トス付与件数）。
      if (record[tossOutput]) {
        record[tossOutput].value = String(Number.isFinite(result.toss) ? result.toss : 0);
      }
    }
    return result.points === null
      ? '付与ポイント表に無い商材です（' + name + '）。Garden の付与ポイント表に追加してください。'
      : '';
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildQuery: buildQuery, applyResult: applyResult };
  }
  if (typeof kintone === 'undefined') { return; }

  var controller;
  var generation = 0;
  var warning;
  var endpoint = 'https://garden-os.net/api/kintone/product-points?';
  var screens = ['app.record.create', 'app.record.edit',
                 'mobile.app.record.create', 'mobile.app.record.edit'];

  function showWarning(mobile, message) {
    if (warning) { warning.remove(); warning = undefined; }
    if (!message) { return; }
    var header = mobile ? kintone.mobile.app.getHeaderSpaceElement?.()
      : kintone.app.record.getHeaderMenuSpaceElement?.();
    if (!header && !document.body) { return; }
    warning = document.createElement('div');
    warning.setAttribute('role', 'status');
    warning.textContent = message;
    if (header) { header.appendChild(warning); }
    else { document.body.prepend(warning); }
  }

  function startLookup() {
    if (controller) { controller.abort(); }
    controller = new AbortController();
    return { generation: ++generation, controller: controller };
  }

  async function lookup(query, signalController) {
    var timer;
    try {
      var request = fetch(endpoint + query, { signal: signalController.signal })
        .then(function (response) { return response.ok ? response.json() : null; });
      var deadline = new Promise(function (resolve) {
        timer = setTimeout(function () {
          signalController.abort();
          resolve(null);
        }, 5000);
      });
      return await Promise.race([request, deadline]);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  function requestedName(query) {
    var params = new URLSearchParams(query);
    return params.get('product') || params.get('master');
  }

  kintone.events.on(['app.record.detail.show', 'mobile.app.record.detail.show'], function (event) {
    var api = event.type.startsWith('mobile.') ? kintone.mobile.app.record : kintone.app.record;
    api.setFieldShown?.(tossOutput, false);
    return event;
  });

  screens.forEach(function (screen) {
    var mobile = screen.startsWith('mobile.');
    var api = mobile ? kintone.mobile.app.record : kintone.app.record;

    kintone.events.on(screen + '.show', function (event) {
      // Garden が書く内部の欄。画面にはトス付与件数（計算）を出す。
      api.setFieldShown?.(tossOutput, false);
      if (controller) { controller.abort(); }
      generation++;
      showWarning(mobile, '');
      return event;
    });

    // 項目変更イベントは同期で返し、終了後にレコード API で反映する。
    kintone.events.on(changes.map(function (code) { return screen + '.change.' + code; }), function (event) {
      var task = startLookup();
      showWarning(mobile, '');
      setTimeout(async function () {
        try {
          if (task.generation !== generation) { return; }
          var query = buildQuery(api.get().record);
          if (!query) { return; }
          var result = await lookup(query, task.controller);
          if (!result || task.generation !== generation) { return; }
          var current = api.get();
          if (!current || buildQuery(current.record) !== query) { return; }
          var previous = current.record[output].value;
          var previousToss = current.record[tossOutput]?.value;
          showWarning(mobile, applyResult(current.record, result, requestedName(query)));
          if (previous !== current.record[output].value ||
              previousToss !== current.record[tossOutput]?.value) { api.set(current); }
        } catch {
          // 編集画面を離れた場合など、現在の値を維持する。
        }
      }, 0);
      return event;
    });

    kintone.events.on(screen + '.submit', async function (event) {
      var task = startLookup();
      showWarning(mobile, '');
      var query = buildQuery(event.record);
      if (!query) { return event; }
      var result = await lookup(query, task.controller);
      if (result && task.generation === generation) {
        showWarning(mobile, applyResult(event.record, result, requestedName(query)));
      }
      return event;
    });
  });
})();

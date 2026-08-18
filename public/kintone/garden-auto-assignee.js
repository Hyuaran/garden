/**
 * Kintone つなぎカスタマイズ：日付を入れたら担当者に自分が入る
 *
 * 配信URL（Kintone の「JavaScript / CSSでカスタマイズ」に URL指定で登録する）
 *   https://garden-os.net/kintone/garden-auto-assignee.js
 *
 * 適用先アプリ
 *   233「全案件一覧」／ 234「取次連携用」（PC用・スマートフォン用の両方）
 *
 * 目的
 *   ET日・後確OK日・開通前FC日・開通後FC日 を入力したとき、対応する担当者欄に
 *   ログイン中の本人を自動で入れる。日付と担当者の二度打ちをなくす。
 *
 * ★これは Garden（Leaf）側で進捗更新の画面ができるまでの「つなぎ」。
 *   Garden 側ができたら Kintone のカスタマイズ設定を外す。
 *
 * ★このファイルは URL が公開されており、誰でも中身を読める。
 *   認証情報・トークン・外に出せないロジックは絶対に書かないこと。
 *
 * 動作ルール（2026-08-18 東海林さん承認）
 *   - 日付が「空 → 値あり」に変わったとき、担当者が空なら本人を入れる
 *   - 担当者に既に誰か入っていれば触らない（他人の記録を上書きしない）
 *   - 日付を消しても担当者は消さない（誰が入れたかの記録を残す）
 *   - 新規作成・編集・一覧のインライン編集／スマホの新規作成・編集で動く
 */
(function () {
  'use strict';

  var PAIRS = [
    { date: 'ET日', user: 'ET者名' },
    { date: '後確OK日', user: '後確者名' },
    { date: '開通前FC日', user: '開通前FC者名' },
    { date: '開通後FC日', user: '開通後FC者名' }
  ];

  // PC：新規作成・編集・一覧のインライン編集／スマホ：新規作成・編集
  var SCREENS = ['app.record.create', 'app.record.edit', 'app.record.index.edit',
                 'mobile.app.record.create', 'mobile.app.record.edit'];

  var MARK = '.change.';

  var events = [];
  PAIRS.forEach(function (p) {
    SCREENS.forEach(function (s) {
      events.push(s + MARK + p.date);
    });
  });

  kintone.events.on(events, function (event) {
    var record = event.record;

    // どの日付が変わったかは event.type から取る。
    // ★ event.changes.field は { type, value } だけで code を持たない（実測 2026-08-18）。
    //    ここを code で判定すると常に undefined になり、何も起きない。
    var type = event.type || '';
    var changedCode = type.slice(type.lastIndexOf(MARK) + MARK.length);

    var pair = null;
    for (var i = 0; i < PAIRS.length; i++) {
      if (PAIRS[i].date === changedCode) { pair = PAIRS[i]; break; }
    }
    if (!pair) { return event; }

    var dateField = record[pair.date];
    var userField = record[pair.user];

    // その画面に項目が無い場合は何もしない
    if (!dateField || !userField) { return event; }

    // 日付を消した場合は担当者を消さない
    if (!dateField.value) { return event; }

    // 既に誰か入っている場合は上書きしない
    if (userField.value && userField.value.length > 0) { return event; }

    var me = kintone.getLoginUser();
    userField.value = [{ code: me.code, name: me.name }];

    return event;
  });
})();

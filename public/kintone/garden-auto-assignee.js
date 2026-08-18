/**
 * Kintone つなぎカスタマイズ：日付を入れたら担当者欄に自分の名前が入る
 *
 * 配信URL（Kintone の「JavaScript / CSSでカスタマイズ」に URL指定で登録する）
 *   https://garden-os.net/kintone/garden-auto-assignee.js
 *
 * 適用先アプリ
 *   233「全案件一覧」／ 234「取次連携用」（PC用・スマートフォン用の両方）
 *
 * 目的
 *   ET日・後確OK日・開通前FC日・開通後FC日 を入力したとき、対応する担当者欄に
 *   ログイン中の本人の名前を自動で入れる。日付と担当者の二度打ちをなくす。
 *
 * ★担当者欄は「ユーザー選択」ではなく「文字列（1行）」。
 *   退職してアカウントを削除しても、誰がやったかの記録が残るようにするため
 *   （2026-08-18 東海林さん判断）。表記ゆれは Garden（Leaf）移行時に解決する。
 *
 * ★これは Garden（Leaf）側で進捗更新の画面ができるまでの「つなぎ」。
 *   Garden 側ができたら Kintone のカスタマイズ設定を外す。
 *
 * ★このファイルは URL が公開されており、誰でも中身を読める。
 *   認証情報・トークン・外に出せないロジックは絶対に書かないこと。
 *
 * 動作ルール（2026-08-18 東海林さん承認）
 *   - 日付が「空 → 値あり」に変わったとき、担当者が空なら本人の名前を入れる
 *   - 担当者に既に誰か入っていれば触らない（他人の記録を上書きしない）
 *   - 日付を消しても担当者は消さない（誰が入れたかの記録を残す）
 *   - 新規作成・編集・一覧のインライン編集／スマホの新規作成・編集で動く
 *
 * ★共有アカウント（CSサポート）の扱い
 *   共有アカウントは「誰が作業したか」が分からないため、自動入力しない。
 *   日付が入っているのに担当者が空、または担当者が共有アカウント名のままだと
 *   保存できないようにして、実際に作業した人の氏名の手入力を促す。
 *   判定は表示名ではなく **ログイン名** で行う（表示名は変わりうるため）。
 */
(function () {
  'use strict';

  var PAIRS = [
    { date: 'ET日', user: 'ET者名' },
    { date: '後確OK日', user: '後確者名' },
    { date: '開通前FC日', user: '開通前FC者名' },
    { date: '開通後FC日', user: '開通後FC者名' }
  ];

  // 共有アカウント（誰が作業したか特定できないため自動入力しない）
  var SHARED_CODES = ['ap1@hyuaran.com'];   // CSサポート
  var SHARED_NAMES = ['CSサポート'];         // 手入力でこの名前を残させないため

  function isSharedAccount(user) {
    return SHARED_CODES.indexOf(user.code) >= 0;
  }

  function isSharedName(value) {
    var s = String(value || '').replace(/[\s　]/g, '');
    for (var i = 0; i < SHARED_NAMES.length; i++) {
      if (s === SHARED_NAMES[i].replace(/[\s　]/g, '')) { return true; }
    }
    return false;
  }

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
    if (userField.value) { return event; }

    var me = kintone.getLoginUser();

    // 共有アカウントは誰が作業したか分からないので入れない（保存時に手入力を促す）
    if (isSharedAccount(me)) { return event; }

    // 担当者欄は「文字列（1行）」。ユーザー選択ではなく名前をそのまま書き込む。
    // 退職してアカウントを削除しても、誰がやったかの記録が残るようにするため。
    userField.value = me.name;

    return event;
  });

  // ------------------------------------------------------------------
  // 保存時のチェック：日付が入っているのに担当者が埋まっていない／
  // 共有アカウント名のままなら保存させず、手入力を促す
  // ------------------------------------------------------------------
  var SUBMITS = ['app.record.create.submit', 'app.record.edit.submit',
                 'app.record.index.edit.submit',
                 'mobile.app.record.create.submit', 'mobile.app.record.edit.submit'];

  kintone.events.on(SUBMITS, function (event) {
    var record = event.record;
    var messages = [];

    PAIRS.forEach(function (p) {
      var dateField = record[p.date];
      var userField = record[p.user];

      // その画面に無い項目は対象外（一覧のインライン編集など）
      if (!dateField || !userField) { return; }
      if (!dateField.value) { return; }

      if (!userField.value) {
        userField.error = p.date + ' を入れた方の氏名を入力してください。';
        messages.push(p.user);
      } else if (isSharedName(userField.value)) {
        userField.error = '共有アカウントのままです。実際に作業した方の氏名を入力してください。';
        messages.push(p.user);
      }
    });

    if (messages.length > 0) {
      var text = messages.join('／') + ' を入力してください。\n'
               + '共有アカウント（CSサポート）のままでは保存できません。\n'
               + '実際に作業した方の氏名を入力してください。';

      // Kintone が画面上部の赤いバーと、該当欄の下の赤いボックスの2か所に出してくれる。
      // 一時期ここでダイアログも出していたが、三重表示になり OK を押す手間が増えるだけだったため外した
      // （2026-08-18。「表示されない」という当初の判断は誤りで、実際には最初から出ていた）。
      event.error = text.replace(/\n/g, ' ');

      // 直すべき欄まで移動してカーソルを置く（どこを直せばよいか一目で分かるように）
      try {
        var el = kintone.app.record.getFieldElement(messages[0]);
        if (el) {
          el.scrollIntoView({ block: 'center' });
          var box = el.querySelector('input');
          if (box) { box.focus(); }
        }
      } catch (e) {
        // 一覧のインライン編集・スマホでは要素を取れないことがある。移動できなくても保存は止まる。
      }
    }

    return event;
  });
})();

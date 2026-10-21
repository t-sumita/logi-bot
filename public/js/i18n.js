// UI 文言辞書と言語切替。言語の正は <html lang>（ヘッダーのトグルが書き換える）

const LANG_KEY = 'logiLang';
const DEFAULT_LANG = 'ja';

/** 文言辞書。追加時は必ず ja / en を同時に書く */
const DICT = {
  ja: {
    // ── ヒーロー ──
    'hero.title.l1': '図解思考で',
    'hero.title.l2': 'プレゼン構想を組み立てる',
    'hero.sub': '5ステップの一問一答で、バラバラなアイデアを「合体ロボ（全体シナリオ図）」へと整理します。',
    // ── ステップガイド ──
    'guide.title': '合体ロボの5パーツ — どんな順番で組み立てる？',
    'step1.title': '🫀 ① 胴体（コア）',
    'step1.desc':  '現実・理想・提案を1〜2文でまとめる',
    'step2.title': '💪🛡️ ② 左腕・右腕',
    'step2.desc':  '現実の問題と理想の成果をドリルダウン',
    'step3.title': '🦿 ③ 両足（2本柱）',
    'step3.desc':  '何を？ / どうやって？を具体化する',
    'step4.title': '🔍 ④ 合体前の点検',
    'step4.desc':  '矛盾・ブレを洗い出して整合性を確認',
    'step5.title': '🧠🗂️ ⑤ 頭・台座',
    'step5.desc':  'イントロとクロージングで全体を完成',
    // ── スタートセクション ──
    'start.tab.quick':      '✏️ テーマ名だけ入れて一問一答で始める',
    'start.tab.bulk':       '📋 メモをまとめて貼り付けて仮組みする',
    'start.label.title':    'プレゼンのテーマ・プロジェクト名',
    'start.ph.title':       '例：新製品ローンチ計画、営業プロセス改善提案',
    'start.hint.quick':     'テーマ名だけでOK。一問一答で5ステップを進めながら、AIがロジカルな思考図解を組み立てます。',
    'start.btn.quick':      '▶ 一問一答で始める',
    'start.label.bulkTitle':'プレゼンのテーマ・プロジェクト名',
    'start.ph.bulkTitle':   '例：社内情報共有ツール刷新計画',
    'start.label.bulkMemo': '企画メモ・議事録・箇条書きをここにドサッと貼り付け',
    'start.btn.sample':     '📄 サンプルを読み込む',
    'start.btn.bulk':       '🚀 まとめて仮組みする',
    // ── 再開セクション ──
    'resume.title':   '🔄 前回の続きから再開する',
    'resume.clearAll':'すべてのセッションを削除',
    // ── セッション ステップインジケーター ──
    'step.step1_core':           '① 胴体',
    'step.step1_core.main':      '① 胴体（コア）',
    'step.step1_core.sub':       '現実→理想→提案',
    'step.step2_drilldown':      '② 左腕・右腕',
    'step.step2_drilldown.main': '② 左腕・右腕',
    'step.step2_drilldown.sub':  '現実・理想の深掘り',
    'step.step3_what_how':       '③ 両足',
    'step.step3_what_how.main':  '③ 両足（2本柱）',
    'step.step3_what_how.sub':   '何を？/ どうやって？',
    'step.step4_verify':         '④ 点検',
    'step.step4_verify.main':    '④ 合体前の点検',
    'step.step4_verify.sub':     '矛盾・ブレ検証',
    'step.step5_combine':        '⑤ 頭・台座',
    'step.step5_combine.main':   '⑤ 頭・台座',
    'step.step5_combine.sub':    'イントロ・クロージング',
    'step.complete':             '完成',
    'step.complete.main':        '完成',
    'step.complete.sub':         '合体ロボ🤖',
    // ── サブステップ（Step 1 胴体コア）──
    'substep.reality':           '①現実',
    'substep.ideal':             '②理想',
    'substep.proposal':          '③提案',
    // ── ナビゲーション ──
    'nav.back':    '← 前へ',
    'nav.next':    '次のステップへ →',
    'nav.loading': '読み込み中…',
    // ── ヘッダーボタン ──
    'menu.button.title':     'メニュー',
    'menu.mode.desc':        '現在の動作モード。手動作図（AIを使わず手動で図を組み立て）／合言葉／APIキーを切り替えます',
    'menu.gear.label':       '設定',
    'menu.gear.desc':        'APIキーや各種設定を変更します',
    'menu.copy.label':       'コピー',
    'menu.copy.desc':        '現在の図解テキスト/データをクリップボードにコピーします',
    'menu.md.label':         '.md',
    'menu.md.desc':          '図解内容をMarkdownファイルとしてダウンロードします',
    'menu.status.label':     'STATUS',
    'menu.status.desc':      '現在の作業状態・履歴をファイルとして保存します',
    'menu.print.label':      '印刷・PDF',
    'menu.print.desc':       '図解を印刷、またはPDFとして保存します（印刷用最適化）',
    'menu.code.label':       'Mermaidコード',
    'menu.code.desc':        '外部ツール等で使えるMermaid形式のコードを表示・コピーします',
    'header.gear.title':    '動作モード（手動作図 / 合言葉 / APIキー）の切り替えとプロンプトのコピー',
    'header.info.title':     'このサイトについて',
    'header.lang.label':     'EN',
    'header.lang.aria':      '言語を切り替え (Switch language)',
    // ── モードバッジ ──
    'mode.mock.label':        '🎭 手動作図モード',
    'mode.mock.title':        '現在：AI通信を行わない無料の手動作図モードです（クリックで合言葉・APIキーを設定）',
    'mode.owner.label':       '🔑 AI有効 (Owner)',
    'mode.owner.title':       '現在：オーナーパスコードで本物のAI（Gemini）に接続中です（クリックで設定変更）',
    'mode.byok.anthropic':    '⚡ AI有効 (Claude)',
    'mode.byok.gemini':       '⚡ AI有効 (Gemini)',
    'mode.byok.openai':       '⚡ AI有効 (OpenAI)',
    'mode.byok.title':        '現在：ご自身のAPIキーでAIに接続中です（クリックで設定変更）',
    // ── ダイアグラムペイン ──
    'diagram.tab.current':  '現在のステップ',
    'diagram.tab.final':    '合体ロボ全体図',
    'diagram.placeholder':  'ステップを進めると図が生成されます',
    'diagram.zoom.title':   '図の拡大表示',
    'diagram.zoom.btn':     '⛶',
    'diagram.code.btn':     '{ }',
    // ── ガード通知 ──
    'guard.title':     '次へ進む前に確認が必要な項目があります',
    'guard.forceNext': 'それでも進む',
    // ── チャット入力 ──
    'chat.ph': 'メッセージを入力… (Enter で送信、Shift+Enter で改行)',
    // ── Info モーダル ──
    'info.modal.title': 'logi-bot について',
    'info.close':       '閉じる',
  },
  en: {
    'hero.title.l1': 'Build Presentation Ideas',
    'hero.title.l2': 'with Visual Thinking',
    'hero.sub': 'In 5 guided steps, organize scattered ideas into a "Combo-Robot" scenario diagram.',
    'guide.title': '5 Steps of the Combo-Robot — Build in Order',
    'step1.title': '🫀 ① Body (Core)',
    'step1.desc':  'Summarize reality, ideal, and proposal in 1–2 sentences',
    'step2.title': '💪🛡️ ② Arms',
    'step2.desc':  'Drill down on problems (reality) and success criteria (ideal)',
    'step3.title': '🦿 ③ Legs (2 Pillars)',
    'step3.desc':  'Clarify What to do and How to do it',
    'step4.title': '🔍 ④ Pre-Assemble Check',
    'step4.desc':  'Identify and resolve contradictions & inconsistencies',
    'step5.title': '🧠🗂️ ⑤ Head & Base',
    'step5.desc':  'Add intro (hook) and closing (CTA) to complete the story',
    'start.tab.quick':      '✏️ Start with a topic, step by step',
    'start.tab.bulk':       '📋 Paste notes and draft all at once',
    'start.label.title':    'Presentation topic / project name',
    'start.ph.title':       'e.g. New Product Launch Plan, Sales Process Improvement',
    'start.hint.quick':     'A topic name is enough. The AI builds a logical thinking diagram through a 5-step Q&A.',
    'start.btn.quick':      '▶ Start Q&A',
    'start.label.bulkTitle':'Presentation topic / project name',
    'start.ph.bulkTitle':   'e.g. Internal Knowledge Sharing Tool Revamp',
    'start.label.bulkMemo': 'Paste your notes, minutes, or bullet points here',
    'start.btn.sample':     '📄 Load Sample',
    'start.btn.bulk':       '🚀 Draft All at Once',
    'resume.title':    '🔄 Resume from last time',
    'resume.clearAll': 'Delete all sessions',
    'step.step1_core':           '① Body',
    'step.step1_core.main':      '① Body (Core)',
    'step.step1_core.sub':       'Reality→Ideal→Proposal',
    'step.step2_drilldown':      '② Arms',
    'step.step2_drilldown.main': '② Arms',
    'step.step2_drilldown.sub':  'Drill-Down',
    'step.step3_what_how':       '③ Legs',
    'step.step3_what_how.main':  '③ Legs (2 Pillars)',
    'step.step3_what_how.sub':   'What? / How?',
    'step.step4_verify':         '④ Check',
    'step.step4_verify.main':    '④ Pre-Assemble Check',
    'step.step4_verify.sub':     'Logic Check',
    'step.step5_combine':        '⑤ Head & Base',
    'step.step5_combine.main':   '⑤ Head & Base',
    'step.step5_combine.sub':    'Intro & Closing',
    'step.complete':             'Done',
    'step.complete.main':        'Done',
    'step.complete.sub':         'Combo-Robot🤖',
    // ── Substep (Step 1 Body Core) ──
    'substep.reality':           '① Reality',
    'substep.ideal':             '② Ideal',
    'substep.proposal':          '③ Proposal',
    'nav.back':    '← Back',
    'nav.next':    'Next Step →',
    'nav.loading': 'Loading…',
    'menu.button.title':     'Menu',
    'menu.mode.desc':        'Current mode. Switch between Manual (build the diagram by hand, no AI) / Passcode / API key',
    'menu.gear.label':       'Settings',
    'menu.gear.desc':        'Change your API key and other settings',
    'menu.copy.label':       'Copy',
    'menu.copy.desc':        'Copy the current diagram text/data to the clipboard',
    'menu.md.label':         '.md',
    'menu.md.desc':          'Download the diagram content as a Markdown file',
    'menu.status.label':     'STATUS',
    'menu.status.desc':      'Save the current work state and history as a file',
    'menu.print.label':      'Print / PDF',
    'menu.print.desc':       'Print the diagram or save it as PDF (print-optimized)',
    'menu.code.label':       'Mermaid code',
    'menu.code.desc':        'Show and copy Mermaid code usable in external tools',
    'header.gear.title':    'Switch mode (Manual / Passcode / API key) and copy prompt',
    'header.info.title':     'About this site',
    'header.lang.label':     'JP',
    'header.lang.aria':      'Switch language (言語を切り替え)',
    'mode.mock.label':        '🎭 Manual Mode',
    'mode.mock.title':        'Current: Free manual drawing mode — no AI calls (click to set passcode or API key)',
    'mode.owner.label':       '🔑 AI On (Owner)',
    'mode.owner.title':       'Current: Connected to real AI (Gemini) via owner passcode (click to change)',
    'mode.byok.anthropic':    '⚡ AI On (Claude)',
    'mode.byok.gemini':       '⚡ AI On (Gemini)',
    'mode.byok.openai':       '⚡ AI On (OpenAI)',
    'mode.byok.title':        'Current: Connected to AI with your own API key (click to change)',
    'diagram.tab.current':  'Current Step',
    'diagram.tab.final':    'Full Combo-Robot',
    'diagram.placeholder':  'Diagram appears when you advance a step',
    'diagram.zoom.title':   'Diagram Zoom',
    'diagram.zoom.btn':     '⛶',
    'diagram.code.btn':     '{ }',
    'guard.title':     'Some items need review before proceeding',
    'guard.forceNext': 'Proceed anyway',
    'chat.ph':    'Type a message… (Enter to send, Shift+Enter for newline)',
    'info.modal.title': 'About logi-bot',
    'info.close':       'Close',
  },
};

/**
 * 現在の言語を返す。<html lang> が "en*" なら英語、それ以外は日本語
 * @returns {'ja'|'en'}
 */
export function getLang() {
  const l = (document.documentElement.lang || DEFAULT_LANG).toLowerCase();
  return l.startsWith('en') ? 'en' : 'ja';
}

/**
 * 辞書キーを現在言語の文言に変換する
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const text = DICT[getLang()][key];
  if (text == null) {
    console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return text;
}

/**
 * localStorage から言語を復元して <html lang> に反映する
 */
export function initLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved) document.documentElement.lang = saved;
}

/**
 * 言語を切り替えて localStorage に保存し、<html lang> を更新する
 */
export function toggleLang() {
  const next = getLang() === 'ja' ? 'en' : 'ja';
  localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next;
}

/**
 * [data-t] / [data-t-attr] / [data-lang] 属性を持つ要素に文言を反映する
 * - data-t="key"                    → textContent を置換
 * - data-t-attr="attr:key[,...]"    → 属性値を置換
 * - data-lang="ja"|"en"             → 現在言語と一致しないものを hidden にする
 * @param {ParentNode} [root]
 */
export function applyStatic(root = document) {
  const lang = getLang();
  for (const el of root.querySelectorAll('[data-t]')) {
    el.textContent = t(el.getAttribute('data-t'));
  }
  for (const el of root.querySelectorAll('[data-t-attr]')) {
    for (const pair of el.getAttribute('data-t-attr').split(',')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  for (const el of root.querySelectorAll('[data-lang]')) {
    el.hidden = el.getAttribute('data-lang') !== lang;
  }
}

/**
 * <html lang> の変更を MutationObserver で監視してコールバックを呼ぶ
 * @param {() => void} callback
 */
export function onLangChange(callback) {
  let last = getLang();
  new MutationObserver(() => {
    const cur = getLang();
    if (cur === last) return;
    last = cur;
    callback();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}

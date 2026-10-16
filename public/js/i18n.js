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
    'step1.title': '胸・腹（コア）',
    'step1.desc':  '現実・理想・提案の骨格を1〜2文でまとめる',
    'step2.title': '両腕（ドリルダウン）',
    'step2.desc':  '根拠・数値・原因を深掘りして腕を鍛える',
    'step3.title': '両脚（What/How）',
    'step3.desc':  '何をどうやって実現するか、脚を固める',
    'step4.title': '点検（矛盾検証）',
    'step4.desc':  '論理のブレや矛盾を洗い出して解消する',
    'step5.title': '頭・台座（合体）',
    'step5.desc':  'イントロ＋クロージングで合体ロボ完成！',
    // ── スタートセクション ──
    'start.tab.quick':      '✏️ テーマ名だけ入れて一問一答で始める',
    'start.tab.bulk':       '📋 メモをまとめて貼り付けて仮組みする',
    'start.label.title':    'プレゼンのテーマ・プロジェクト名',
    'start.ph.title':       '例：新製品ローンチ計画、営業プロセス改善提案',
    'start.hint.quick':     'テーマ名だけでOK。一問一答で5ステップを進めながら、AIがMermaid図を組み立てます。',
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
    'step.onboarding': '準備',
    'step.step1':      '胸・腹',
    'step.step2':      '両腕',
    'step.step3':      '両脚',
    'step.step4':      '点検',
    'step.step5':      '頭・台座',
    'step.complete':   '完成',
    // ── ナビゲーション ──
    'nav.back':    '← 前へ',
    'nav.next':    '次のステップへ →',
    'nav.loading': '読み込み中…',
    // ── ヘッダーボタン ──
    'header.copy':           '📋 コピー',
    'header.copy.title':     '現在の内容をMarkdownとしてコピー',
    'header.download':       '⬇ .md',
    'header.download.title': 'Markdownファイルをダウンロード',
    'header.gear.title':     '動作モード（お試し / 合言葉 / APIキー）の切り替えとプロンプトのコピー',
    'header.info.title':     'このサイトについて',
    'header.lang.label':     'EN',
    'header.lang.aria':      '言語を切り替え (Switch language)',
    // ── モードバッジ ──
    'mode.mock.label':        '🎭 お試し (MOCK)',
    'mode.mock.title':        '現在：AI通信を行わない無料のお試し作図モードです（クリックで合言葉・APIキーを設定）',
    'mode.owner.label':       '🔑 AI有効 (Owner)',
    'mode.owner.title':       '現在：オーナーパスコードで本物のAI（Claude）に接続中です（クリックで設定変更）',
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
    'guide.title': '5 Parts of the Combo-Robot — Build in Order',
    'step1.title': 'Chest & Belly (Core)',
    'step1.desc':  'Summarize reality, ideal & proposal in 1–2 sentences',
    'step2.title': 'Arms (Drill-Down)',
    'step2.desc':  'Dig into evidence, numbers, and root causes',
    'step3.title': 'Legs (What / How)',
    'step3.desc':  'Clarify what to do and how to execute',
    'step4.title': 'Inspection (Verify)',
    'step4.desc':  'Find and resolve logic gaps',
    'step5.title': 'Head & Base (Combine)',
    'step5.desc':  'Add intro + closing to complete the Combo-Robot!',
    'start.tab.quick':      '✏️ Start with a topic, step by step',
    'start.tab.bulk':       '📋 Paste notes and draft all at once',
    'start.label.title':    'Presentation topic / project name',
    'start.ph.title':       'e.g. New Product Launch Plan, Sales Process Improvement',
    'start.hint.quick':     'A topic name is enough. The AI builds Mermaid diagrams through a 5-step Q&A.',
    'start.btn.quick':      '▶ Start Q&A',
    'start.label.bulkTitle':'Presentation topic / project name',
    'start.ph.bulkTitle':   'e.g. Internal Knowledge Sharing Tool Revamp',
    'start.label.bulkMemo': 'Paste your notes, minutes, or bullet points here',
    'start.btn.sample':     '📄 Load Sample',
    'start.btn.bulk':       '🚀 Draft All at Once',
    'resume.title':    '🔄 Resume from last time',
    'resume.clearAll': 'Delete all sessions',
    'step.onboarding': 'Intro',
    'step.step1':      'Core',
    'step.step2':      'Arms',
    'step.step3':      'Legs',
    'step.step4':      'Check',
    'step.step5':      'Combine',
    'step.complete':   'Done',
    'nav.back':    '← Back',
    'nav.next':    'Next Step →',
    'nav.loading': 'Loading…',
    'header.copy':           '📋 Copy',
    'header.copy.title':     'Copy current content as Markdown',
    'header.download':       '⬇ .md',
    'header.download.title': 'Download Markdown file',
    'header.gear.title':     'Switch mode (Demo / Passcode / API key) and copy prompt',
    'header.info.title':     'About this site',
    'header.lang.label':     'JP',
    'header.lang.aria':      'Switch language (言語を切り替え)',
    'mode.mock.label':        '🎭 Demo (MOCK)',
    'mode.mock.title':        'Current: Free demo mode — no AI calls (click to set passcode or API key)',
    'mode.owner.label':       '🔑 AI On (Owner)',
    'mode.owner.title':       'Current: Connected to real AI (Claude) via owner passcode (click to change)',
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

// AI・モード設定モーダル — localStorage に永続化

import { t, applyStatic, onLangChange } from "./i18n.js";

const SETTINGS_KEY = "logiSettings";

const CHAT_AI_PROMPT = `あなたは「logi-bot」、図解思考AIファシリテーターです。
永田豊志の「ドリルダウン＋合体ロボ作戦」に基づき、ユーザーのアイデアをプレゼン構想に整理します。

【5ステップ・合体ロボフレームワーク】

Step 1【胸・腹：コア】
「現実の問題」「理想の状態」「提案（解決策）」を各1〜2文で整理する。

Step 2【両腕：ドリルダウン】
・現実の問題点・制約を2〜3つ具体化（数値化・原因追求）
・理想達成時の成果を2〜3つ明確化
・最大のギャップを一言でまとめる

Step 3【両脚：What/How】
・何を変える・作る・やめる？（What）
・どうやって実行する？体制・予算・期限（How）
→ What と How を同じ数だけ対にして整理する

Step 4【点検】
Step 1〜3の矛盾・論理のブレを洗い出す。
矛盾があれば解決策を考える。「全体として一貫したストーリーか？」

Step 5【頭・台座：フレーム】
・イントロ：「誰に向けて」「どんな一文で興味を引くか」（フック）
・クロージング：「聴いた後に何をしてほしいか」（CTA）
・プレゼンのタイトル

【進め方のルール】
- 1ターンにつき1〜2問まで（質問を詰め込まない）
- ユーザーの回答を要約して確認を取ってから次へ
- 各ステップ完了時にMermaid図（flowchart TB）で可視化する
- 深掘りが必要なときは：数値化・具体化・5Why・導入前後比較・ROI試算の質問を使う

【Mermaid図テンプレート（Step 1）】
\`\`\`mermaid
flowchart TB
  R["🔴 現実\\n{現実}"] -->|ギャップ| I["🟢 理想\\n{理想}"]
  P["💡 提案\\n{提案}"] -->|橋渡し| I
  R -.->|課題の源| P
\`\`\`

まず「どんなプレゼンを作りますか？テーマを教えてください」と聞いてください。`;

// ── デフォルト設定 ────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  mode: "mock",
  ownerPasscode: "",
  byokProvider: "anthropic",
  byokModel: "",
  byokApiKey: "",
};

// ── 設定の読み書き ────────────────────────────────────────────────
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── モードバッジのラベル・色・ツールチップ ───────────────────────
export function getModeBadge(settings = getSettings()) {
  switch (settings.mode) {
    case "owner":
      return { label: t("mode.owner.label"), cls: "badge-owner", title: t("mode.owner.title") };
    case "byok": {
      const provKey = `mode.byok.${settings.byokProvider}`;
      return { label: t(provKey), cls: "badge-byok", title: t("mode.byok.title") };
    }
    default:
      return { label: t("mode.mock.label"), cls: "badge-demo", title: t("mode.mock.title") };
  }
}

// ── モーダル HTML ─────────────────────────────────────────────────
const MODAL_HTML = `
<div class="settings-overlay" id="settingsOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
  <div class="settings-modal">
    <div class="settings-header">
      <h2 class="settings-title" id="settingsTitle">⚙️ AI・モード設定</h2>
      <button class="btn btn-ghost btn-sm btn-icon" id="settingsClose" aria-label="閉じる">✕</button>
    </div>

    <div class="settings-body">
      <!-- Mode A: MOCK -->
      <label class="mode-option" for="modeMock">
        <input type="radio" name="logiMode" id="modeMock" value="mock">
        <div class="mode-option-body">
          <div class="mode-option-title">🎭 手動作図モード（デフォルト・無料）</div>
          <div class="mode-option-desc">APIキー不要。サンプルシナリオ体験 + 手動入力で図を組み立てられます。</div>
        </div>
      </label>

      <!-- Mode B: Owner -->
      <label class="mode-option" for="modeOwner">
        <input type="radio" name="logiMode" id="modeOwner" value="owner">
        <div class="mode-option-body">
          <div class="mode-option-title">🔑 オーナーモード（合言葉認証）</div>
          <div class="mode-option-desc">サーバーの ANTHROPIC_API_KEY を使ってAIを呼び出します。</div>
          <div class="mode-option-form" id="ownerForm">
            <input class="form-input form-input-sm" type="password" id="ownerPasscode"
              placeholder="オーナーパスコードを入力" autocomplete="current-password">
          </div>
        </div>
      </label>

      <!-- Mode C: BYOK -->
      <label class="mode-option" for="modeByok">
        <input type="radio" name="logiMode" id="modeByok" value="byok">
        <div class="mode-option-body">
          <div class="mode-option-title">🧪 自分のAPIキーを使う（BYOK）</div>
          <div class="mode-option-desc">Anthropic / Gemini / OpenAI のAPIキーで動作します。キーはブラウザのみに保存されます。</div>
          <div class="mode-option-form" id="byokForm">
            <div class="byok-row">
              <label class="byok-label" for="byokProvider">プロバイダ</label>
              <select class="form-input form-input-sm" id="byokProvider">
                <option value="anthropic">Anthropic Claude</option>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div class="byok-row">
              <label class="byok-label" for="byokModel">モデル（省略可）</label>
              <input class="form-input form-input-sm" type="text" id="byokModel"
                placeholder="例: claude-sonnet-4-6 / gemini-2.5-flash / gpt-4o-mini">
            </div>
            <div class="byok-row">
              <label class="byok-label" for="byokApiKey">API キー</label>
              <input class="form-input form-input-sm" type="password" id="byokApiKey"
                placeholder="sk-ant-... / AIza... / sk-..." autocomplete="off">
            </div>
          </div>
        </div>
      </label>

      <!-- Skill Prompt Copy -->
      <div class="settings-divider"></div>
      <div class="skill-copy-section">
        <div class="skill-copy-title">📋 ChatAI用プロンプト（APIキー不要で使う）</div>
        <div class="skill-copy-desc">このプロンプトを ChatGPT / Claude / Gemini のチャット画面に貼り付けると、APIキーなしで図解思考ができます。</div>
        <button class="btn btn-ghost btn-sm" id="copySkillBtn">📋 プロンプトをクリップボードにコピー</button>
      </div>
    </div>

    <div class="settings-footer">
      <button class="btn btn-ghost" id="settingsCancel">キャンセル</button>
      <button class="btn btn-primary" id="settingsApply">適用</button>
    </div>
  </div>
</div>`;

// ── モーダル初期化 ────────────────────────────────────────────────

/**
 * 設定モーダルを初期化し、ヘッダーにバッジを描画する。
 * settings-gear ボタンの id="settingsGearBtn" が HTML に必要。
 */
export function initSettings() {
  // モーダル DOM を挿入
  const wrapper = document.createElement("div");
  wrapper.innerHTML = MODAL_HTML;
  document.body.appendChild(wrapper.firstElementChild);

  const overlay = document.getElementById("settingsOverlay");

  // 現在の設定をフォームに反映
  function loadToForm() {
    const s = getSettings();
    document.getElementById("modeMock").checked   = s.mode === "mock";
    document.getElementById("modeOwner").checked  = s.mode === "owner";
    document.getElementById("modeByok").checked   = s.mode === "byok";
    document.getElementById("ownerPasscode").value = s.ownerPasscode;
    document.getElementById("byokProvider").value  = s.byokProvider;
    document.getElementById("byokModel").value     = s.byokModel;
    document.getElementById("byokApiKey").value    = s.byokApiKey;
    updateFormVisibility(s.mode);
  }

  function updateFormVisibility(mode) {
    document.getElementById("ownerForm").style.display = mode === "owner" ? "block" : "none";
    document.getElementById("byokForm").style.display  = mode === "byok"  ? "block" : "none";
  }

  // ラジオボタンで表示切り替え
  document.querySelectorAll("input[name=logiMode]").forEach((radio) => {
    radio.addEventListener("change", (e) => updateFormVisibility(e.target.value));
  });

  // 適用
  document.getElementById("settingsApply").addEventListener("click", () => {
    const mode = document.querySelector("input[name=logiMode]:checked")?.value ?? "mock";
    const newSettings = {
      mode,
      ownerPasscode: document.getElementById("ownerPasscode").value,
      byokProvider:  document.getElementById("byokProvider").value,
      byokModel:     document.getElementById("byokModel").value,
      byokApiKey:    document.getElementById("byokApiKey").value,
    };
    saveSettings(newSettings);
    overlay.hidden = true;
    renderBadge();
    showToast(`モードを「${getModeBadge(newSettings).label}」に設定しました`);
  });

  // キャンセル
  document.getElementById("settingsCancel").addEventListener("click", () => { overlay.hidden = true; });
  document.getElementById("settingsClose").addEventListener("click",  () => { overlay.hidden = true; });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) overlay.hidden = true; });

  // スキルプロンプトコピー
  document.getElementById("copySkillBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(CHAT_AI_PROMPT);
      showToast("📋 プロンプトをクリップボードにコピーしました");
    } catch {
      showToast("❌ コピーに失敗しました", true);
    }
  });

  // ギアボタンからモーダルを開く
  const gearBtn = document.getElementById("settingsGearBtn");
  if (gearBtn) {
    gearBtn.addEventListener("click", () => {
      loadToForm();
      overlay.hidden = false;
    });
  }

  renderBadge();
}

/** ヘッダーのモードバッジを現在の設定と言語に合わせて更新する */
export function renderBadge() {
  const badge = document.getElementById("modeBadge");
  if (!badge) return;
  const { label, cls, title } = getModeBadge();
  badge.textContent = label;
  badge.className = `mode-badge ${cls}`;
  badge.title = title;
}

function showToast(msg, isError = false) {
  const existing = document.querySelector(".logi-toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "logi-toast";
  el.textContent = msg;
  el.style.cssText = [
    "position:fixed","bottom:80px","left:50%","transform:translateX(-50%)",
    `background:${isError ? "#DC2626" : "#1E293B"}`, "color:#fff",
    "padding:10px 20px","border-radius:8px","font-size:.85rem",
    "z-index:9999","box-shadow:0 4px 16px rgba(0,0,0,.25)",
    "transition:opacity .3s ease","pointer-events:none",
  ].join(";");
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 350); }, 2500);
}

/** モードヘッダーを settings モーダルから取得する用（api.js から利用） */
export function getModeHeaders() {
  const s = getSettings();
  if (s.mode === "owner") return { "X-Logi-Mode": "owner", "X-Owner-Passcode": s.ownerPasscode };
  if (s.mode === "byok")  return { "X-Logi-Mode": "byok",  "X-Provider": s.byokProvider, "X-Model": s.byokModel, "X-Api-Key": s.byokApiKey };
  return { "X-Logi-Mode": "mock" };
}

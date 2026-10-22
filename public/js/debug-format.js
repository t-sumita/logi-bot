// デバッグパネル用：ツール引数(extracted)をエッセンス化して表示用 HTML に整形する

/** エッセンス表示で1行あたりに出す値の最大文字数 */
export const DEBUG_ESSENCE_MAX_CHARS = 70;
/** エッセンス表示で並べる最大行数（これを超えた分は「ほか N 件」に畳む） */
export const DEBUG_ESSENCE_MAX_ROWS = 40;

/**
 * HTML 特殊文字をエスケープする。
 * @param {unknown} str 対象の値
 * @returns {string} エスケープ済み文字列
 */
function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 値を持つ末端フィールドの数を再帰的に数える。
 * 空文字・null・undefined は「更新なし」として数えない。
 * @param {unknown} val 対象の値
 * @returns {number} 末端フィールド数
 */
export function countLeaves(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (Array.isArray(val)) return val.reduce((sum, v) => sum + countLeaves(v), 0);
  if (typeof val === "object") return Object.values(val).reduce((sum, v) => sum + countLeaves(v), 0);
  return 1;
}

/**
 * extracted を「パス: 値」の1行表記に平坦化する（エッセンス表示用）。
 * 配列は 1 始まりの添字を付けて図のノード番号と対応させる。
 * @param {unknown} val 対象の値
 * @param {string} [prefix] 親までのパス
 * @param {Array<{path: string, value: string}>} [out] 収集先
 * @returns {Array<{path: string, value: string}>} 平坦化した行の配列
 */
export function flattenExtracted(val, prefix = "", out = []) {
  if (val === null || val === undefined || val === "") return out;
  if (Array.isArray(val)) {
    val.forEach((v, i) => flattenExtracted(v, `${prefix}[${i + 1}]`, out));
    return out;
  }
  if (typeof val === "object") {
    for (const [key, v] of Object.entries(val)) {
      flattenExtracted(v, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out.push({ path: prefix || "(root)", value: String(val) });
  return out;
}

/**
 * 更新されたトップレベルキーを「キー(件数)」のチップ HTML にする。
 * @param {unknown} extracted ツール引数
 * @returns {string} チップ列の HTML
 */
export function buildExtractedChips(extracted) {
  if (!extracted || typeof extracted !== "object") {
    return '<span class="debug-chip-none">—</span>';
  }
  const chips = Object.entries(extracted)
    .map(([key, val]) => ({ key, count: countLeaves(val) }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `<span class="debug-chip">${escHtml(entry.key)}(${entry.count})</span>`);
  if (chips.length === 0) return '<span class="debug-chip-none">—</span>';
  return `<span class="debug-chips">${chips.join("")}</span>`;
}

/**
 * ツール引数のエッセンス（パス: 値）を箇条書き HTML にする。
 * @param {unknown} extracted ツール引数
 * @returns {string} エッセンスの HTML
 */
export function buildExtractedEssence(extracted) {
  const rows = flattenExtracted(extracted);
  if (rows.length === 0) return '<p class="debug-empty">更新されたフィールドはありません。</p>';

  const shown = rows.slice(0, DEBUG_ESSENCE_MAX_ROWS);
  const items = shown.map((row) => {
    const truncated = row.value.length > DEBUG_ESSENCE_MAX_CHARS
      ? `${row.value.slice(0, DEBUG_ESSENCE_MAX_CHARS)}…`
      : row.value;
    return `<li><span class="debug-ess-path">${escHtml(row.path)}</span>` +
           `<span class="debug-ess-val">${escHtml(truncated)}</span></li>`;
  });
  const rest = rows.length - shown.length;
  if (rest > 0) items.push(`<li><span class="debug-ess-val">…ほか ${rest} 件</span></li>`);
  return `<ul class="debug-essence">${items.join("")}</ul>`;
}

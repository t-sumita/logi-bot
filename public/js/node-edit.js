// 図のノード番号 → SessionParts 上の値の読み書き（追加・修正・削除）を行う純粋ロジック

/** 単一値ノード: 番号 → [親オブジェクトへのパス, キー] */
const SCALAR_PATHS = {
  "0": ["frame", "intro", "hook"],
  "1": ["core", "reality"],
  "2": ["core", "ideal"],
  "3": ["core", "proposal"],
  "8": ["frame", "closing", "cta"],
};

/** 配列グループ: グループ番号 → 配列へのパス */
const GROUP_PATHS = {
  "4": ["drilldown", "reality_factors"],
  "5": ["drilldown", "ideal_goals"],
  "6": ["what_how", "what_items"],
  "7": ["what_how", "how_items"],
};

/** 親ノード（詳細を追加できる単一値ノード）→ 配下のグループ番号 */
const PARENT_TO_GROUP = { "1": "4", "2": "5" };

/** 日本語ラベル（ダイアログ見出し用） */
const GROUP_LABELS = { "4": "現実の詳細", "5": "理想の詳細", "6": "左足 / What", "7": "右足 / How" };

/**
 * ノード番号を解析し、編集ダイアログの種別を返す。
 * @param {string} nodeId - "0"〜"8" または "4-1" 等
 * @returns {{kind: "detail"|"parent"|"group"|"leaf"|"unknown", group?: string, index?: number}}
 *   detail=配列の末端ノード（削除可）/ parent=現実・理想（更新＋詳細追加）/
 *   group=足の見出し・空の腕足プレースホルダー（詳細追加のみ）/ leaf=頭・提案・台座（更新のみ）
 */
export function classifyNode(nodeId) {
  const id = String(nodeId);
  const m = id.match(/^([4-7])-(\d+)$/);
  if (m) return { kind: "detail", group: m[1], index: Number(m[2]) - 1 };
  if (PARENT_TO_GROUP[id]) return { kind: "parent", group: PARENT_TO_GROUP[id] };
  if (GROUP_PATHS[id]) return { kind: "group", group: id };
  if (SCALAR_PATHS[id]) return { kind: "leaf" };
  return { kind: "unknown" };
}

/** パスを辿って親オブジェクトを返す（途中が無ければ作る） */
function walk(parts, path) {
  let cur = parts;
  for (const key of path) {
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  return cur;
}

/** 配列グループを取得（無ければ空配列を作る） */
function groupArray(parts, group) {
  const path = GROUP_PATHS[group];
  const holder = walk(parts, path.slice(0, -1));
  const key = path[path.length - 1];
  if (!Array.isArray(holder[key])) holder[key] = [];
  return holder[key];
}

/**
 * ノードの現在テキストを返す。存在しなければ空文字。
 * @param {object} parts - SessionParts
 * @param {string} nodeId
 * @returns {string}
 */
export function getNodeText(parts, nodeId) {
  const info = classifyNode(nodeId);
  if (info.kind === "detail") return String(groupArray(parts, info.group)[info.index] ?? "");
  const path = SCALAR_PATHS[String(nodeId)];
  if (!path) return "";
  return String(walk(parts, path.slice(0, -1))[path[path.length - 1]] ?? "");
}

/**
 * ノードのテキストを上書きする（parts を直接変更する）。
 * @param {object} parts
 * @param {string} nodeId
 * @param {string} text
 * @returns {boolean} 更新できたか
 */
export function setNodeText(parts, nodeId, text) {
  const info = classifyNode(nodeId);
  const value = String(text ?? "").trim();
  if (info.kind === "detail") {
    const arr = groupArray(parts, info.group);
    if (info.index < 0 || info.index >= arr.length) return false;
    arr[info.index] = value;
    return true;
  }
  const path = SCALAR_PATHS[String(nodeId)];
  if (!path) return false;
  walk(parts, path.slice(0, -1))[path[path.length - 1]] = value;
  return true;
}

/**
 * グループの末尾に空の詳細ノードを追加する。
 * @param {object} parts
 * @param {string} nodeId - 親ノード（"1"/"2"）またはグループ番号（"4"〜"7"）
 * @returns {string|null} 追加したノード番号（例 "4-3"）。追加できなければ null
 */
export function addDetail(parts, nodeId) {
  const info = classifyNode(nodeId);
  if (info.kind !== "parent" && info.kind !== "group") return null;
  const arr = groupArray(parts, info.group);
  arr.push("");
  return `${info.group}-${arr.length}`;
}

/**
 * 詳細ノードを削除する（後続ノードの番号は繰り上がる）。
 * @param {object} parts
 * @param {string} nodeId - "4-1" 等
 * @returns {boolean} 削除できたか
 */
export function removeDetail(parts, nodeId) {
  const info = classifyNode(nodeId);
  if (info.kind !== "detail") return false;
  const arr = groupArray(parts, info.group);
  if (info.index < 0 || info.index >= arr.length) return false;
  arr.splice(info.index, 1);
  return true;
}

/** ダイアログ見出し用のグループ名 */
export function groupLabel(group) {
  return GROUP_LABELS[group] ?? `グループ${group}`;
}

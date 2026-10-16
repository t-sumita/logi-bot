# 仕様: ステートマシン設計

> 根拠: PLAN.md §4 / `.claude/skills/logi-session/SKILL.md`
> 実装: `functions/_lib/session.ts` / `public/js/session.js`

## 概要

logi-bot のセッションは **7つの状態** と **5種のイベント** で構成される有限ステートマシン。
状態はクライアント側の `localStorage`（`logiSession_<id>`）で管理する。

## 状態定義

| 状態名 | 表示名 | 説明 |
|---|---|---|
| `idle` | 待機中 | セッション未開始 |
| `onboarding` | オンボーディング | 5ステップガイド表示 + バルクインプット受付 |
| `step1_core` | Step 1: コア（胸・腹） | 現実・理想・提案を抽出中 |
| `step2_drilldown` | Step 2: ドリルダウン（両腕） | 現実・理想を深掘り中 |
| `step3_what_how` | Step 3: What/How（両脚） | 実現手段を具体化中 |
| `step4_verify` | Step 4: 検証（点検） | 矛盾・ブレを確認・解消中 |
| `step5_combine` | Step 5: 合体（頭・台座） | イントロ・クロージング構築中 |
| `complete` | 完成 | 合体ロボ図生成済み |

## イベント定義

| イベント | 発火条件 | 説明 |
|---|---|---|
| `START` | 利用者がセッション開始 | `idle` → `onboarding` |
| `BULK_EXTRACT` | `onboarding` で長文が入力された（閾値: 100文字超） | バルク抽出処理 → 最初の不足ステップへ遷移 |
| `NEXT` | 現在ステップの必須フィールドが揃い「次へ」を選択 | 順方向遷移 |
| `BACK` | 利用者が「前のステップに戻る」を選択 | 逆方向遷移（`idle` / `onboarding` には戻れない） |
| `RESET` | 利用者が「最初からやり直す」を選択 | 任意状態 → `idle`（セッション初期化） |

## 遷移テーブル

```
idle             + START         → onboarding
idle             + RESET         → idle

onboarding       + NEXT          → step1_core    [短い入力または題名のみ]
onboarding       + BULK_EXTRACT  → step{n}       [一括抽出後、最初の不足ステップへ]
onboarding       + RESET         → idle

step1_core       + NEXT          → step2_drilldown  [guard: core 3要素が揃っていること]
step1_core       + BACK          → onboarding
step1_core       + RESET         → idle

step2_drilldown  + NEXT          → step3_what_how   [guard: reality_factors≥1 && ideal_goals≥1]
step2_drilldown  + BACK          → step1_core
step2_drilldown  + RESET         → idle

step3_what_how   + NEXT          → step4_verify      [guard: what_items≥1 && how_items≥1 && 同数]
step3_what_how   + BACK          → step2_drilldown
step3_what_how   + RESET         → idle

step4_verify     + NEXT          → step5_combine     [guard: is_consistent == true]
step4_verify     + BACK          → step3_what_how
step4_verify     + RESET         → idle

step5_combine    + NEXT          → complete          [guard: intro.hook && closing.cta]
step5_combine    + BACK          → step4_verify
step5_combine    + RESET         → idle

complete         + RESET         → idle
```

## オンボーディングとファストトラック処理

### `onboarding` 状態の役割

1. **ガイド表示**: 5ステップの概要を身体パーツ比喩で提示
   - Step 1（胸・腹）: 現実・理想・提案のコア
   - Step 2（両腕）: 現実と理想のドリルダウン（事実・数値・原因）
   - Step 3（両脚）: What・How・体制・予算
   - Step 4（点検）: 矛盾・ブレのチェック
   - Step 5（頭・台座）: イントロとクロージングの合体
2. **バルクインプット案内**: 「既存のメモや長文があれば貼り付けてください」と促す
3. **入力待ち**: 短い入力 → `NEXT`（`step1_core` へ）/ 長文 → `BULK_EXTRACT`

### ファストトラック処理（`BULK_EXTRACT`）

```
BULK_EXTRACT 発火
  → /api/chat (step=onboarding, mode=bulk_extract) 呼び出し
  → Claude API が長文から SessionParts の各フィールドを一括抽出
  → 抽出結果を session.parts にマージ
  → "ここまで仮組みしました！" メッセージと各ステップの仮Mermaid図を表示
  → 最初の不足ステップを判定（first_incomplete_step を計算）
  → session.step = first_incomplete_step に設定
```

### 不足ステップの判定ロジック（`first_incomplete_step`）

```typescript
function firstIncompleteStep(parts: SessionParts): StepName {
  if (!parts.core.reality || !parts.core.ideal || !parts.core.proposal)
    return "step1_core";
  if (parts.drilldown.reality_factors.length < 1 || parts.drilldown.ideal_goals.length < 1)
    return "step2_drilldown";
  if (parts.what_how.what_items.length < 1 || parts.what_how.how_items.length < 1)
    return "step3_what_how";
  if (!parts.verification.is_consistent)
    return "step4_verify";
  if (!parts.frame.intro.hook || !parts.frame.closing.cta)
    return "step5_combine";
  return "complete";
}
```

## ガード条件詳細

### `step1_core` → `step2_drilldown`
- `parts.core.reality` が非空文字列
- `parts.core.ideal` が非空文字列
- `parts.core.proposal` が非空文字列

### `step2_drilldown` → `step3_what_how`
- `parts.drilldown.reality_factors.length >= 1`
- `parts.drilldown.ideal_goals.length >= 1`

### `step3_what_how` → `step4_verify`
- `parts.what_how.what_items.length >= 1`
- `parts.what_how.how_items.length >= 1`
- `what_items.length == how_items.length`

### `step4_verify` → `step5_combine`
- `parts.verification.is_consistent == true`
- `contradictions` がある場合、すべてに `resolution` が紐付いていること

### `step5_combine` → `complete`
- `parts.frame.intro.hook` が非空
- `parts.frame.closing.cta` が非空

## 図生成タイミング

- `NEXT` イベント処理後、現ステップの Mermaid 図を **サーバーサイド** で生成・`diagrams.step{n}` に保存
- `BULK_EXTRACT` 後は抽出済みの各ステップ分の仮図を一括生成
- `complete` 遷移時に合体ロボ図（`diagrams.final`）を生成

## エラー状態

- ガード条件未充足で `NEXT` → 遷移せず不足フィールドを UI に表示
- API エラー → `status: "error"` に設定し、エラー内容を UI に表示
- `RESET` は常に成功する（エラー状態からの回復手段）

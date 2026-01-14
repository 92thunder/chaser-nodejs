# 地図記憶型期待値最大化アルゴリズム

## 概要

このドキュメントでは、チェイサーゲームにおいて地図情報を記憶し、期待値計算に基づいて最適な行動を選択する4分木探索アルゴリズムについて説明します。

深度10の先読み探索、計画継続システム、袋小路検出、往復パス枝刈りなどの機能を統合し、効率的かつ戦略的なゲームプレイを実現します。

## アルゴリズムの特徴

- **地図情報の蓄積**: ゲーム中に得た情報を絶対座標系で記録
- **シンプルな点数システム**: 各マスに明確な点数を割り当て
- **4分木探索**: 各ターンで4方向（上下左右）の先読みを実行
- **深度10探索**: 10手先まで見据えた戦略的な行動選択
- **経路上の合計**: 移動経路上のすべてのマスの点数を合計して評価
- **計画継続**: 一度決めた行動計画を敵に遭遇しない限り最後まで実行
- **袋小路検出**: アイテム取得後に閉じ込められないかを事前シミュレーション
- **経路最適化**: 同じ位置を往復するような無駄な経路を枝刈り

## システム設計

### 1. データ構造

#### 座標系
```typescript
type Position = { x: number, y: number };
```

#### 地図セル情報
```typescript
type MapCell = {
  type: Cell;           // セルの種類（EMPTY, BLOCK, ITEM, または未探索）
  lastSeen: number;     // 最後に観測したターン数
};
```

#### ゲーム状態
```typescript
type PlayerState = {
  position: Position;
  currentTurn: number;
  gameMap: GameMap;           // Map<string, MapCell> ("x,y" -> MapCell)
  plannedActions: Direction[]; // 前ターンで計画した移動方向のシーケンス
};
```

**重要**: プレイヤーには「向き」の概念がありません。`walk(direction)`は単純に指定された方向に移動するだけです。`getReady()`で取得する3x3の情報は常に絶対座標基準（北が常に上）です。

### 2. 座標管理システム

#### 絶対座標での位置追跡
- `getReady()`で取得する3x3の情報は既に絶対座標（北が常に上、回転なし）
- 移動コマンド`walk(direction)`の実行で現在位置を更新
- 座標変換は不要、単純な加算で位置を追跡可能

#### 情報更新ロジック
```typescript
function updateMapFromReady(state: PlayerState, readyResult: ReadyResult): void {
  const directions = [
    { dx: -1, dy: -1, cell: readyResult.upLeft },
    { dx: 0, dy: -1, cell: readyResult.up },
    { dx: 1, dy: -1, cell: readyResult.upRight },
    // ... 他の方向
  ];
  
  directions.forEach(({ dx, dy, cell }) => {
    const pos = { 
      x: state.position.x + dx, 
      y: state.position.y + dy 
    };
    updateMapCell(state.gameMap, pos, cell, state.currentTurn, 1.0);
  });
}
```

## 期待値計算システム

### シンプルな点数システム

各マスには以下の点数が割り当てられます：

| マスの種類 | 点数 | 説明 |
|-----------|------|------|
| **アイテムマス（ITEM）** | 2点 | アイテムがあるマス。最優先で獲得 |
| **未探索マス** | 1点 | まだ訪れていない・情報がないマス。探索を促進 |
| **空マス（EMPTY）** | 0点 | 何もないマス。移動可能だが価値なし |
| **ブロックマス（BLOCK）** | -∞ | 移動不可。このルートは枝刈り |
| **袋小路アイテム** | -8点 | アイテム(2点) - 袋小路ペナルティ(10点) = 実質-8点 |

#### 重要な発見: アイテム取得の副作用

**ゲームの仕様**: アイテムを取得すると、**取得する前にいたマスがブロックになります**。

この仕様により、行動の選択を誤ると自分を閉じ込めてしまう可能性があります。そのため、スコア計算時にアイテム取得をシミュレーションし、取得後に脱出可能かをチェックする必要があります。

### 経路上の合計で評価（袋小路検出付き）

4分木の各経路について、**経路上のすべてのマスの点数を合計**して期待値とします。

```typescript
function calculatePathScore(path: Position[], gameMap: GameMap): number {
  let totalScore = 0;
  const simulatedMap = new Map(gameMap); // シミュレーション用コピー

  for (const pos of path) {
    const cell = getMapCell(simulatedMap, pos);

    if (cell === undefined) {
      // 未探索マス
      totalScore += 1;
    } else if (cell.type === ITEM) {
      totalScore += 2;

      // アイテム取得をシミュレーション: このマスがブロックになる
      updateMapCell(simulatedMap, pos, BLOCK, 0);

      // 取得後に脱出可能かチェック
      const escapeRoutes = ALL_DIRECTIONS.filter(dir => {
        const escapePos = getNextPosition(pos, dir);
        return isSafeToMove(escapePos, simulatedMap);
      });

      if (escapeRoutes.length === 0) {
        // 袋小路！アイテムの価値を相殺する重いペナルティ
        totalScore -= 10;
      }
    } else if (cell.type === EMPTY) {
      totalScore += 0;
    } else if (cell.type === BLOCK || cell.type === ENEMY) {
      // 移動不可 - このパスは無効
      return -Infinity;
    }
  }

  return totalScore;
}
```

### 評価例

#### 例1: 未探索エリアへの探索
```
経路: 現在位置 → 空(0) → 未探索(1) → 未探索(1)
合計: 0 + 1 + 1 = 2点
```

#### 例2: アイテム獲得
```
経路: 現在位置 → 空(0) → 空(0) → アイテム(2)
合計: 0 + 0 + 2 = 2点
```

#### 例3: 未探索経由でアイテム
```
経路: 現在位置 → 未探索(1) → 未探索(1) → アイテム(2)
合計: 1 + 1 + 2 = 4点
```

この例では、例3が最も高得点となり選択されます。

## 4分木探索アルゴリズム

### 探索戦略
各ノードで以下の4つの方向を評価（プレイヤーには向きがないため全方向を等しく考慮）：
1. **上（up）**: 北方向への移動
2. **下（down）**: 南方向への移動
3. **左（left）**: 西方向への移動
4. **右（right）**: 東方向への移動

### 探索深度
- **基本深度**: 10手先まで探索（最大4^10 = 約100万パターン、枝刈り後は大幅に削減）
- 実際の評価経路数は数百〜数千程度（枝刈りにより削減）
- より深い探索により、より戦略的な行動選択が可能

### 枝刈りルール
以下の条件で探索を打ち切り：
- **ブロック（BLOCK）または敵（ENEMY）への移動**: 移動不可
- **既訪問位置への移動**: 同じ経路内で既に訪れた位置に戻るパスを排除
  - 例: `up → down → up` のような往復パターンを防止
  - これにより無駄な探索を大幅に削減し、効率的な経路のみを評価

## 実装の流れ

### メインループ（計画継続機能付き）
```typescript
async function gameLoop() {
  const state = initializePlayerState();

  while (true) {
    // 1. 現在状況の取得と地図更新
    const readyResult = await client.getReady();
    updateMapFromReady(state, readyResult);

    // 2. 敵が隣接（8方向）していたら逃げる（緊急対応）
    if (hasAdjacentEnemy(readyResult)) {
      const escapeDirection = findEscapeDirection(readyResult);
      await client.walk(escapeDirection);
      updatePlayerPosition(state, escapeDirection);
      state.plannedActions = []; // 計画を破棄
      state.currentTurn++;
      continue;
    }

    // 3. 計画継続: 前ターンの計画が残っていれば優先実行
    let actionToTake: Direction | null = null;

    if (state.plannedActions.length > 0) {
      const plannedAction = state.plannedActions[0];
      state.plannedActions = state.plannedActions.slice(1);

      // 計画が安全かチェック
      if (isDirectionSafe(readyResult, plannedAction)) {
        actionToTake = plannedAction;
      } else {
        // 計画が危険になった、破棄して再探索
        state.plannedActions = [];
        actionToTake = null;
      }
    }

    // 4. 計画がなければ4分木探索で新しい計画を立案
    if (actionToTake === null) {
      actionToTake = findBestAction(state); // 内部でplannedActionsを更新
    }

    // 5. 行動実行と状態更新
    if (actionToTake !== null) {
      await client.walk(actionToTake);
      updatePlayerPosition(state, actionToTake);
    }

    state.currentTurn++;
  }
}
```

### 最適行動探索（統計情報付き）
```typescript
function findBestAction(state: PlayerState): Direction | null {
  const searchDepth = 10; // 10手先まで探索
  const rootNode = createTreeNode(state.position, null, searchDepth);

  // 4分木の構築
  buildTree(rootNode, searchDepth, state.gameMap);

  // リーフノードからスコアを収集
  const results: Array<{ actions: Direction[], score: number }> = [];
  collectLeafScores(rootNode, state.gameMap, results);

  if (results.length === 0) {
    return null; // 有効な経路なし
  }

  // 統計情報の出力
  const maxScore = Math.max(...results.map(r => r.score));
  const minScore = Math.min(...results.map(r => r.score));
  console.log(`📊 探索統計:`);
  console.log(`   評価した経路数: ${results.length}パターン`);
  console.log(`   スコア範囲: ${minScore} 〜 ${maxScore}`);

  // 最高得点の候補を抽出
  const topCandidates = results.filter(r => r.score === maxScore);

  if (topCandidates.length > 1) {
    console.log(`   最高スコアの候補: ${topCandidates.length}個`);
  }

  // タイブレーク: 前回の計画経路を優先（計画の一貫性）
  let best = topCandidates[0];
  if (topCandidates.length > 1 && state.plannedActions.length > 0) {
    const plannedNext = state.plannedActions[0];
    const matchingPlan = topCandidates.find(c => c.actions[0] === plannedNext);
    if (matchingPlan) {
      best = matchingPlan;
      console.log(`✅ 前回の計画と一致、継続性を維持`);
    }
  }

  // 新しい計画を保存（最初の行動は今回実行、残りを保存）
  state.plannedActions = best.actions.slice(1);

  console.log(`🎯 選択: ${best.actions[0]} (計画: [${best.actions.slice(0, 3).join(", ")}...])`);

  return best.actions[0];
}
```

## 4分木の構築例と計画継続

### 深度10の探索ツリー（枝刈り後）

```
ルートノード (現在位置)
├─ up (1手目)
│  ├─ up (2手目) ※down は枝刈り（往復防止）
│  │  ├─ up (3手目) ※down は枝刈り
│  │  │  └─ ... 深度10まで継続
│  │  ├─ left (3手目)
│  │  │  └─ ... 深度10まで継続
│  │  └─ right (3手目)
│  │     └─ ... 深度10まで継続
│  ├─ left (2手目)
│  │  └─ ... 深度10まで継続
│  └─ right (2手目)
│     └─ ... 深度10まで継続
├─ down (1手目)
│  └─ ... (同様に展開)
├─ left (1手目)
│  └─ ... (同様に展開)
└─ right (1手目)
   └─ ... (同様に展開)

理論上の最大: 4^10 = 1,048,576パターン
実際の評価: 枝刈り後、数百〜数千パターン（マップの形状により変動）
```

### 計画継続システム

このアルゴリズムの重要な特徴は、**一度立てた計画を最後まで実行する**ことです。

#### 動作フロー

1. **計画立案**: 4分木探索で10手先までの最適経路を選択
2. **最初の行動実行**: 計画の1手目を実行
3. **残りを保存**: 計画の2〜10手目を`state.plannedActions`に保存
4. **次ターン**: 敵がいなければ、再探索せずに計画の2手目を実行
5. **継続**: 計画が尽きるか、敵に遭遇するまで計画を継続

#### 計画破棄の条件

以下の場合のみ計画を破棄して再探索：
- **敵遭遇**: 8方向（上下左右+斜め）に敵を検出
- **計画が危険**: 次の計画行動がブロックや敵になっている

#### メリット

1. **一貫性**: フラフラせず、目標に向かって直進
2. **効率性**: 毎ターン深度10の探索をしなくて済む（計画実行中は探索スキップ）
3. **計画性**: 10手先を見据えた戦略を実際に遂行
4. **反応性**: 危険を検知したら即座に計画変更

#### 動作例

```
ターン1: 4分木探索（深度10） → 最適経路["right", "right", "up", "up", "right", ...]
       → "right"に移動、残り["right", "up", "up", "right", ...]を保存
       📊 評価した経路数: 1247パターン

ターン2: 敵なし、計画実行
       → "right"に移動、残り["up", "up", "right", ...]を保存
       ⏭️  探索スキップ（計画実行中）

ターン3: 敵なし、計画実行
       → "up"に移動、残り["up", "right", ...]を保存
       ⏭️  探索スキップ（計画実行中）

ターン4: 敵を検出！
       → 計画破棄、逃げる
       ⚠️  緊急回避モード

ターン5: 敵なし、計画なし
       → 4分木探索（深度10）→ 新しい計画を立案
       📊 評価した経路数: 892パターン
```

この仕組みにより、深度10の探索コストを大幅に削減しながら、戦略的な行動を実現します。

## 期待される効果

1. **効率的な探索**: 未探索エリアを優先的に探索
2. **計画的なアイテム収集**: 無駄のない経路でアイテムを獲得、袋小路を回避
3. **先読み能力**: 10手先を見据えた戦略的な移動
4. **適応性**: 地図情報の蓄積により徐々に賢くなる
5. **一貫した行動**: 計画継続により、フラフラせず目標に向かう
6. **安全性**: 敵を8方向で検出し、即座に回避
7. **無駄のない探索**: 往復パスを枝刈りし、効率的な経路のみを評価

## 実装から得られた重要な学び

### 1. ゲームAPIの正確な理解

**誤解していたこと**:
- プレイヤーに「向き」の状態があると考えていた
- `getReady()`が相対座標を返すと考えていた

**実際の仕様**:
- プレイヤーには向きがなく、`walk(direction)`は単に指定方向に移動
- `getReady()`は常に絶対座標基準（北が常に上）
- この理解により、`PlayerState`から`direction`フィールドを削除

### 2. アイテム取得の副作用

**重大な発見**: アイテムを取得すると、取得前にいたマスがブロックになる

**対策**:
- スコア計算時にアイテム取得をシミュレーション
- 取得後に脱出可能かチェック
- 袋小路の場合は-10点のペナルティでアイテムの価値を相殺

### 3. 計画継続の重要性

**問題**: 毎ターン再探索すると、同じ挙動を繰り返す（up → down → up のような往復）

**解決策**:
- 一度立てた計画を敵に遭遇しない限り最後まで実行
- 計画実行中は探索をスキップし、効率化
- 危険を検知したら即座に計画破棄して再探索

### 4. 往復パスの枝刈り

**問題**: `up → down → up` のような無駄な往復パスが評価されていた

**解決策**:
- 木探索時に、既に訪れた位置への移動を枝刈り
- `node.path`に訪問履歴を保持し、重複チェック
- これにより評価パターン数を大幅に削減

### 5. 敵検出の強化

**当初**: 4方向（上下左右）のみチェック

**改良**: 8方向（上下左右+斜め4方向）をチェック
- `readyResult.upLeft`, `upRight`, `downLeft`, `downRight`も確認
- より早期に敵を検知し、安全性向上

### 6. 探索深度の拡張

**当初**: 深度3（理論上27パターン）

**最終**: 深度10（理論上100万パターン、枝刈り後は数百〜数千）
- 往復枝刈りにより、深度を大幅に拡張可能
- より長期的な戦略が可能に
- 計画継続により、探索コストは実質的に削減

## 今後の拡張案

- **探索深度の動的調整**: 状況に応じて深度を変更（敵が多い時は浅く、安全な時は深く）
- **look/searchコマンドの活用**: 遠距離情報の収集と活用
- **敵の移動予測**: 敵の過去の動きから移動パターンを学習
- **複数ゴール最適化**: 複数のアイテムを効率的に回収する経路計画
- **協調プレイ**: 複数プレイヤーでの協調戦略（マルチエージェント）

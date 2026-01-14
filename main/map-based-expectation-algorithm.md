# 地図記憶型期待値最大化アルゴリズム

## 概要

このドキュメントでは、チェイサーゲームにおいて地図情報を記憶し、期待値計算に基づいて最適な行動を選択する3分木アルゴリズムについて説明します。

## アルゴリズムの特徴

- **地図情報の蓄積**: ゲーム中に得た情報を座標系で記録
- **シンプルな点数システム**: 各マスに明確な点数を割り当て
- **3分木探索**: 各ターンで3つの主要行動の先読みを実行
- **経路上の合計**: 移動経路上のすべてのマスの点数を合計して評価

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
  direction: Direction;
  currentTurn: number;
  gameMap: GameMap;           // Map<string, MapCell> ("x,y" -> MapCell)
  plannedActions: Direction[]; // 前ターンで計画した移動方向のシーケンス
};
```

### 2. 座標管理システム

#### 相対座標から絶対座標への変換
- `getReady()`で取得する3x3の情報を絶対座標にマッピング
- 移動コマンド`walk()`の実行で現在位置を更新
- 方向情報と組み合わせて正確な位置追跡

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
| **ブロックマス（BLOCK）** | - | 移動不可。このルートは枝刈り |

### 経路上の合計で評価

3分木の各経路について、**経路上のすべてのマスの点数を合計**して期待値とします。

```typescript
function calculatePathScore(path: Position[], gameMap: GameMap): number {
  let totalScore = 0;

  for (const pos of path) {
    const cell = getMapCell(gameMap, pos);

    if (cell === undefined) {
      // 未探索マス
      totalScore += 1;
    } else if (cell.type === ITEM) {
      totalScore += 2;
    } else if (cell.type === EMPTY) {
      totalScore += 0;
    } else if (cell.type === BLOCK) {
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

## 3分木探索アルゴリズム

### 探索戦略
各ノードで以下の3つの主要行動を評価：
1. **直進継続**: 現在の方向を維持して移動
2. **右回転後移動**: 時計回りに方向転換後移動
3. **左回転後移動**: 反時計回りに方向転換後移動

### 探索深度
- **基本深度**: 3手先まで探索（3^3 = 27パターン）
- 計算量とのバランスで調整可能

### 枝刈りルール
以下の条件で探索を打ち切り：
- ブロック（BLOCK）への移動
- 地図外への移動
- 同じマスを行き来するだけの無駄な経路

## 実装の流れ

### メインループ
```typescript
async function gameLoop() {
  const state = initializePlayerState();

  while (true) {
    // 1. 現在状況の取得と地図更新
    const readyResult = await client.getReady();
    updateMapFromReady(state, readyResult);

    // 2. 敵が隣接していたら逃げる（緊急対応）
    if (hasAdjacentEnemy(readyResult)) {
      const escapeDirection = findEscapeDirection(readyResult);
      await client.walk(escapeDirection);
      updatePlayerPosition(state, escapeDirection);
      continue;
    }

    // 3. 3分木探索による最適行動の決定
    const bestAction = findBestAction(state);

    // 4. 行動実行と状態更新
    await client.walk(bestAction);
    updatePlayerPosition(state, bestAction);

    state.currentTurn++;
  }
}
```

### 最適行動探索
```typescript
function findBestAction(state: PlayerState): Direction {
  const searchDepth = 3; // 3手先まで探索
  const rootNode = createTreeNode(state, null, 0);

  // 3分木の構築
  buildTree(rootNode, searchDepth, state.gameMap);

  // 各経路の点数を計算
  const scores = rootNode.children.map(child => ({
    direction: child.action,
    score: calculatePathScore(child.path, state.gameMap),
    actions: child.actions  // この経路の全移動方向
  }));

  // 最高得点を取得
  const maxScore = Math.max(...scores.map(s => s.score));

  // 最高得点の候補をフィルタリング
  const topCandidates = scores.filter(s => s.score === maxScore);

  // 同点の場合、前回計画した経路を優先
  let best = topCandidates[0];
  if (topCandidates.length > 1 && state.plannedActions.length > 0) {
    const plannedNext = state.plannedActions[0];
    const matchingPlan = topCandidates.find(c => c.direction === plannedNext);
    if (matchingPlan) {
      best = matchingPlan;
    }
  }

  // 次回のために計画を保存
  state.plannedActions = best.actions;

  return best.direction;
}
```

## 3分木の構築例

### 深度3の探索ツリー

```
ルートノード (現在位置)
├─ 直進 (1手目)
│  ├─ 直進 (2手目)
│  │  ├─ 直進 (3手目) → スコア計算
│  │  ├─ 右回転 (3手目) → スコア計算
│  │  └─ 左回転 (3手目) → スコア計算
│  ├─ 右回転 (2手目)
│  │  ├─ 直進 (3手目) → スコア計算
│  │  ├─ 右回転 (3手目) → スコア計算
│  │  └─ 左回転 (3手目) → スコア計算
│  └─ 左回転 (2手目)
│     ├─ 直進 (3手目) → スコア計算
│     ├─ 右回転 (3手目) → スコア計算
│     └─ 左回転 (3手目) → スコア計算
├─ 右回転 (1手目)
│  └─ ... (同様に9パターン)
└─ 左回転 (1手目)
   └─ ... (同様に9パターン)

合計: 27パターンの経路を評価
```

### 同点時の経路優先ルール

複数の経路が同じ最高得点の場合、**前ターンで計画した経路を優先**します。

#### メリット
1. **一貫性**: 同じ目標に向かって直進し続ける
2. **効率性**: 毎ターン方向転換するような無駄な動きを避ける
3. **計画性**: 3手先の計画を実際に実行し続ける

#### 動作例
```
ターン1: 3分木探索 → 最適経路["right", "right", "down"]を選択
       → "right"に移動、計画["right", "down"]を保存

ターン2: 3分木探索 → 候補A["right", "down", "left"]: 4点
                   → 候補B["down", "left", "right"]: 4点
       → 候補Aが前回計画の"right"で始まるので優先
       → "right"に移動、計画["down", "left"]を保存

ターン3: 状況が変わり新しい最適経路を選択...
```

この仕組みにより、フラフラせず計画的に移動できます。

## 期待される効果

1. **効率的な探索**: 未探索エリアを優先的に探索
2. **計画的なアイテム収集**: 無駄のない経路でアイテムを獲得
3. **先読み能力**: 3手先を見据えた戦略的な移動
4. **適応性**: 地図情報の蓄積により徐々に賢くなる

## 今後の拡張案

- **探索深度の動的調整**: 状況に応じて深度を変更
- **アイテムの優先度**: アイテムの種類に応じた点数調整
- **経路最適化**: 同じゴールに向かう複数の経路から最短を選択
- **look/searchコマンドの活用**: 遠距離情報の収集と活用

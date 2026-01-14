/**
 * 地図記憶型期待値最大化アルゴリズム
 * Map-Based Expectation Maximization Algorithm
 *
 * このアルゴリズムは以下の特徴を持ちます:
 * - 地図情報を座標系で記憶
 * - 深度3の4分木探索で3手先を予測
 * - アイテム優先、未探索エリアを評価するスコアシステム
 * - 敵が隣接したら即座に脱出
 * - 前回の計画を継続することで一貫した移動
 */

// ============================================================================
// 1. IMPORTS
// ============================================================================
import {
	init,
	EMPTY,
	BLOCK,
	ITEM,
	ENEMY,
	type Cell,
	type Direction,
	type ReadyResult,
	type ChaserClient,
} from "../chaser.ts";

// ============================================================================
// 2. TYPE DEFINITIONS
// ============================================================================

// 絶対座標での位置
type Position = {
	x: number;
	y: number;
};

// 地図セル情報
type MapCell = {
	type: Cell; // EMPTY, BLOCK, ITEM, ENEMY
	lastSeen: number; // 最後に観測したターン数
};

// ゲーム地図: "x,y" -> MapCell
type GameMap = Map<string, MapCell>;

// プレイヤー状態（directionフィールドなし - プレイヤーに向きは存在しない）
type PlayerState = {
	position: Position;
	currentTurn: number;
	gameMap: GameMap;
	plannedActions: Direction[]; // 前ターンで計画した移動方向のシーケンス
};

// 木探索のノード
type TreeNode = {
	position: Position;
	action: Direction | null; // このノードに到達するための行動
	depth: number;
	path: Position[]; // ルートからこのノードまでの全位置
	actions: Direction[]; // ルートからこのノードまでの全行動
	children: TreeNode[];
	score: number; // 計算されたパススコア
};

// ============================================================================
// 3. CONSTANTS
// ============================================================================

// getReady()の3x3グリッド用相対オフセット（絶対座標）
const RELATIVE_OFFSETS = {
	upLeft: { dx: -1, dy: -1 },
	up: { dx: 0, dy: -1 },
	upRight: { dx: 1, dy: -1 },
	left: { dx: -1, dy: 0 },
	center: { dx: 0, dy: 0 },
	right: { dx: 1, dy: 0 },
	downLeft: { dx: -1, dy: 1 },
	down: { dx: 0, dy: 1 },
	downRight: { dx: 1, dy: 1 },
} as const;

// スコア値
const SCORE_ITEM = 2;
const SCORE_UNEXPLORED = 1;
const SCORE_EMPTY = 0;
const SCORE_BLOCK = -Number.POSITIVE_INFINITY;

// 探索設定
const SEARCH_DEPTH = 10; // 10手先まで探索
const ALL_DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

// ============================================================================
// 4. MAP MANAGEMENT
// ============================================================================

// 位置から地図キーを生成
function positionToKey(pos: Position): string {
	return `${pos.x},${pos.y}`;
}

// 地図セルを更新または追加
function updateMapCell(
	gameMap: GameMap,
	pos: Position,
	cell: Cell,
	currentTurn: number,
): void {
	const key = positionToKey(pos);
	gameMap.set(key, { type: cell, lastSeen: currentTurn });
}

// 地図からセルを取得（未探索の場合はundefined）
function getMapCell(gameMap: GameMap, pos: Position): MapCell | undefined {
	const key = positionToKey(pos);
	return gameMap.get(key);
}

// getReady()の結果から地図を更新
function updateMapFromReady(
	state: PlayerState,
	readyResult: ReadyResult,
): void {
	const cells = [
		{ offset: RELATIVE_OFFSETS.upLeft, cell: readyResult.upLeft },
		{ offset: RELATIVE_OFFSETS.up, cell: readyResult.up },
		{ offset: RELATIVE_OFFSETS.upRight, cell: readyResult.upRight },
		{ offset: RELATIVE_OFFSETS.left, cell: readyResult.left },
		{ offset: RELATIVE_OFFSETS.center, cell: readyResult.center },
		{ offset: RELATIVE_OFFSETS.right, cell: readyResult.right },
		{ offset: RELATIVE_OFFSETS.downLeft, cell: readyResult.downLeft },
		{ offset: RELATIVE_OFFSETS.down, cell: readyResult.down },
		{ offset: RELATIVE_OFFSETS.downRight, cell: readyResult.downRight },
	];

	for (const { offset, cell } of cells) {
		const pos = {
			x: state.position.x + offset.dx,
			y: state.position.y + offset.dy,
		};
		updateMapCell(state.gameMap, pos, cell, state.currentTurn);
	}
}

// ============================================================================
// 5. COORDINATE UTILITIES
// ============================================================================

// 指定方向への次の位置を計算
function getNextPosition(currentPos: Position, direction: Direction): Position {
	switch (direction) {
		case "right":
			return { x: currentPos.x + 1, y: currentPos.y };
		case "left":
			return { x: currentPos.x - 1, y: currentPos.y };
		case "up":
			return { x: currentPos.x, y: currentPos.y - 1 };
		case "down":
			return { x: currentPos.x, y: currentPos.y + 1 };
	}
}

// プレイヤー位置を更新（移動が成功したと仮定）
function updatePlayerPosition(
	state: PlayerState,
	walkedDirection: Direction,
): void {
	switch (walkedDirection) {
		case "right":
			state.position.x++;
			break;
		case "left":
			state.position.x--;
			break;
		case "up":
			state.position.y--;
			break;
		case "down":
			state.position.y++;
			break;
	}
}

// ============================================================================
// 6. VALIDATION
// ============================================================================

// 指定位置への移動が安全かチェック（地図情報ベース）
function isSafeToMove(pos: Position, gameMap: GameMap): boolean {
	const cell = getMapCell(gameMap, pos);

	// 未探索セルは安全と仮定
	if (cell === undefined) return true;

	// ブロックと敵は移動不可
	if (cell.type === BLOCK) return false;
	if (cell.type === ENEMY) return false;

	return true;
}

// 指定方向が安全かチェック（readyResultベース）
function isDirectionSafe(
	readyResult: ReadyResult,
	direction: Direction,
): boolean {
	const targetCell = readyResult[direction];
	return targetCell !== BLOCK && targetCell !== ENEMY;
}

// ============================================================================
// 7. SCORING
// ============================================================================

// 経路のスコアを計算
function calculatePathScore(path: Position[], gameMap: GameMap): number {
	let totalScore = 0;
	const simulatedMap = new Map(gameMap); // 地図のコピー

	for (let i = 0; i < path.length; i++) {
		const pos = path[i];
		if (!pos) continue; // 安全チェック

		const cell = getMapCell(simulatedMap, pos);

		if (cell === undefined) {
			// 未探索セル: 探索を促進
			totalScore += SCORE_UNEXPLORED;
		} else if (cell.type === ITEM) {
			// アイテムセル: 最高優先度
			totalScore += SCORE_ITEM;

			// アイテム取得後、そのマスはブロックになる
			updateMapCell(simulatedMap, pos, BLOCK, 0);

			// 袋小路チェック: アイテム取得後に脱出できるか?
			// 4方向すべてが塞がれていたら完全に閉じ込められる
			const escapeRoutes = ALL_DIRECTIONS.filter((dir) => {
				const escapePos = getNextPosition(pos, dir);
				return isSafeToMove(escapePos, simulatedMap);
			});

			if (escapeRoutes.length === 0) {
				// 脱出不可能 = 袋小路
				console.log(
					`⚠️  袋小路検出: (${pos.x},${pos.y})でアイテム取得後、全方向が塞がれている`,
				);
				totalScore -= 10; // 大幅減点（完全にNGではないが避けたい）
			}
		} else if (cell.type === EMPTY) {
			// 空セル: 価値なし
			totalScore += SCORE_EMPTY;
		} else if (cell.type === BLOCK || cell.type === ENEMY) {
			// 無効な経路
			return SCORE_BLOCK;
		}
	}

	return totalScore;
}

// ============================================================================
// 8. TREE SEARCH
// ============================================================================

// 木ノードを作成
function createTreeNode(
	position: Position,
	action: Direction | null,
	depth: number,
	parentPath: Position[] = [],
	parentActions: Direction[] = [],
): TreeNode {
	const path = [...parentPath, position];
	const actions = action !== null ? [...parentActions, action] : parentActions;

	return {
		position,
		action,
		depth,
		path,
		actions,
		children: [],
		score: 0,
	};
}

// 再帰的に探索木を構築
function buildTree(
	node: TreeNode,
	maxDepth: number,
	gameMap: GameMap,
): void {
	// 基底ケース: 最大深度に到達
	if (node.depth === 0) return;

	// 全4方向を試行
	for (const direction of ALL_DIRECTIONS) {
		const nextPos = getNextPosition(node.position, direction);

		// 枝刈り1: 安全でない場合はスキップ
		if (!isSafeToMove(nextPos, gameMap)) {
			continue;
		}

		// 枝刈り2: 同じ位置に戻る場合はスキップ（往復防止）
		const isReturningToVisited = node.path.some(
			(visitedPos) =>
				visitedPos.x === nextPos.x && visitedPos.y === nextPos.y,
		);
		if (isReturningToVisited) {
			continue;
		}

		// 子ノードを作成
		const child = createTreeNode(
			nextPos,
			direction,
			node.depth - 1,
			node.path,
			node.actions,
		);

		node.children.push(child);

		// 再帰呼び出し
		buildTree(child, maxDepth, gameMap);
	}
}

// リーフノードのスコアを収集
function collectLeafScores(
	node: TreeNode,
	gameMap: GameMap,
	results: Array<{ actions: Direction[]; score: number }>,
): void {
	// リーフノード（子がいない または 最大深度）の場合
	if (node.children.length === 0) {
		const score = calculatePathScore(node.path, gameMap);
		if (node.actions.length > 0) {
			// ルートノードはactionを持たないのでスキップ
			results.push({ actions: node.actions, score: score });
		}
		return;
	}

	// 子ノードから再帰的に収集
	for (const child of node.children) {
		collectLeafScores(child, gameMap, results);
	}
}

// 最良の行動を選択（タイブレーク付き）
function findBestAction(state: PlayerState): Direction | null {
	// ルートノードを現在位置に作成
	const rootNode = createTreeNode(state.position, null, SEARCH_DEPTH);

	// 探索木を構築
	buildTree(rootNode, SEARCH_DEPTH, state.gameMap);

	// 全リーフのスコアを収集
	const results: Array<{ actions: Direction[]; score: number }> = [];
	collectLeafScores(rootNode, state.gameMap, results);

	// 有効な経路が見つからなかった場合
	if (results.length === 0) return null;

	// 統計情報を表示
	console.log(`   評価した経路数: ${results.length}パターン`);

	// 最高スコアを取得
	const maxScore = Math.max(...results.map((r) => r.score));
	const minScore = Math.min(...results.map((r) => r.score));
	console.log(`   スコア範囲: ${minScore.toFixed(1)} 〜 ${maxScore.toFixed(1)}`);

	// 最高スコアの候補を全て取得
	const topCandidates = results.filter((r) => r.score === maxScore);

	if (topCandidates.length > 1) {
		console.log(`   最高スコアの候補: ${topCandidates.length}個`);
	}

	// タイブレーク: 前回計画した経路を優先
	let best = topCandidates[0];
	if (topCandidates.length > 1 && state.plannedActions.length > 0) {
		const plannedNext = state.plannedActions[0];
		const matchingPlan = topCandidates.find((c) => c.actions[0] === plannedNext);
		if (matchingPlan) {
			best = matchingPlan;
			console.log(`   ✓ 前回の計画を継続`);
		}
	}

	// 次回のために計画を更新（最初のアクションを削除）
	state.plannedActions = best.actions.slice(1);

	return best.actions[0];
}

// ============================================================================
// 9. ENEMY AVOIDANCE
// ============================================================================

// 隣接セル（斜めを含む）に敵がいるかチェック
function hasAdjacentEnemy(readyResult: ReadyResult): boolean {
	return (
		readyResult.up === ENEMY ||
		readyResult.down === ENEMY ||
		readyResult.left === ENEMY ||
		readyResult.right === ENEMY ||
		readyResult.upLeft === ENEMY ||
		readyResult.upRight === ENEMY ||
		readyResult.downLeft === ENEMY ||
		readyResult.downRight === ENEMY
	);
}

// 敵から逃げる方向を見つける
function findEscapeDirection(
	readyResult: ReadyResult,
): Direction | null {
	// 優先度1: 敵でもブロックでもない方向
	for (const direction of ALL_DIRECTIONS) {
		const cell = readyResult[direction];
		if (cell !== ENEMY && cell !== BLOCK) {
			return direction;
		}
	}

	// 優先度2: ブロックでない方向（敵がいても移動は可能）
	for (const direction of ALL_DIRECTIONS) {
		const cell = readyResult[direction];
		if (cell !== BLOCK) {
			return direction;
		}
	}

	// 完全に閉じ込められた
	return null;
}

// ============================================================================
// 10. GAME LOOP
// ============================================================================

// プレイヤー状態を初期化
function initializePlayerState(): PlayerState {
	return {
		position: { x: 0, y: 0 }, // 最初のgetReady()で設定
		currentTurn: 0,
		gameMap: new Map(),
		plannedActions: [],
	};
}

// 安全に移動を実行
async function safeWalk(
	client: ChaserClient,
	direction: Direction,
	state: PlayerState,
	readyResult: ReadyResult,
): Promise<boolean> {
	// 移動前に安全性を再確認
	if (!isDirectionSafe(readyResult, direction)) {
		return false; // 移動失敗
	}

	// walkコマンドを実行
	await client.walk(direction);

	// 位置を更新（移動が成功したと仮定）
	updatePlayerPosition(state, direction);

	return true; // 移動成功
}

// メインゲームループ
async function gameLoop() {
	const client = await init();
	const state = initializePlayerState();

	while (true) {
		// 1. 現在状況の取得と地図更新
		const readyResult = await client.getReady();
		updateMapFromReady(state, readyResult);

		console.log(
			`\n=== ターン ${state.currentTurn} | 位置: (${state.position.x}, ${state.position.y}) | 地図サイズ: ${state.gameMap.size}セル ===`,
		);

		// 2. 緊急対応: 敵が隣接している場合は即座に脱出
		if (hasAdjacentEnemy(readyResult)) {
			console.log("⚠️  敵が隣接! 緊急脱出モード - 計画を破棄");
			console.log("   周囲の状況:");
			console.log(
				`     ${readyResult.upLeft} ${readyResult.up} ${readyResult.upRight}`,
			);
			console.log(
				`     ${readyResult.left} @ ${readyResult.right}`,
			);
			console.log(
				`     ${readyResult.downLeft} ${readyResult.down} ${readyResult.downRight}`,
			);

			// 計画を破棄
			state.plannedActions = [];

			const escapeDirection = findEscapeDirection(readyResult);

			if (escapeDirection !== null) {
				console.log(`🏃 脱出方向: ${escapeDirection}`);
				const moved = await safeWalk(client, escapeDirection, state, readyResult);
				if (moved) {
					state.currentTurn++;
					continue;
				}
				console.log("❌ 脱出失敗、通常探索にフォールバック");
			} else {
				console.log("❌ 脱出方向なし、通常探索にフォールバック");
			}
		}

		// 3. 行動決定: 計画があればそれを実行、なければ木探索
		let actionToTake: Direction | null = null;

		if (state.plannedActions.length > 0) {
			// 計画が残っている場合: 計画を実行
			const plannedAction = state.plannedActions[0];
			state.plannedActions = state.plannedActions.slice(1);

			// 計画が安全かチェック
			if (plannedAction && isDirectionSafe(readyResult, plannedAction)) {
				actionToTake = plannedAction;
				console.log(
					`📋 計画実行: ${actionToTake} (残り${state.plannedActions.length}手)`,
				);
			} else {
				// 計画が安全でない場合は破棄して再探索
				console.log(
					`⚠️  計画${plannedAction}が危険、計画を破棄して再探索`,
				);
				state.plannedActions = [];
				actionToTake = null;
			}
		}

		// 計画がない、または計画が失敗した場合: 木探索
		if (actionToTake === null) {
			console.log("🔍 木探索を実行...");
			const startTime = Date.now();
			actionToTake = findBestAction(state);
			const elapsedMs = Date.now() - startTime;

			if (actionToTake !== null) {
				console.log(
					`🎯 新しい計画: ${actionToTake} → ${state.plannedActions.slice(0, 2).join(" → ")}... (深度${SEARCH_DEPTH}, ${elapsedMs}ms)`,
				);
			} else {
				console.log(`⚠️  木探索で有効な経路なし (${elapsedMs}ms)`);
			}
		}

		// 4. 行動を実行
		if (actionToTake !== null) {
			const moved = await safeWalk(client, actionToTake, state, readyResult);

			// 計画した移動が失敗した場合、計画を破棄して代替方向を試す
			if (!moved) {
				console.log(
					`❌ ${actionToTake}への移動失敗、計画を破棄して代替方向を探索`,
				);
				state.plannedActions = []; // 計画を破棄

				for (const direction of ALL_DIRECTIONS) {
					if (isDirectionSafe(readyResult, direction)) {
						console.log(`🔄 代替方向: ${direction}`);
						await safeWalk(client, direction, state, readyResult);
						break;
					}
				}
			}
		} else {
			console.log("⚠️  有効な行動なし、安全な方向に移動");
			// 有効な行動が見つからなかった場合、任意の安全な方向に移動
			for (const direction of ALL_DIRECTIONS) {
				if (isDirectionSafe(readyResult, direction)) {
					console.log(`🔄 フォールバック: ${direction}`);
					await safeWalk(client, direction, state, readyResult);
					break;
				}
			}
		}

		state.currentTurn++;
	}
}

// ============================================================================
// 11. ENTRY POINT
// ============================================================================

gameLoop();

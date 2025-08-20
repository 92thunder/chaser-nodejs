/**
 * lookで敵を見つけたら逆方向に逃げる
 */
import {
	type Direction,
	type ReadyResult,
	EMPTY,
	ENEMY,
	BLOCK,
	ITEM,
	init,
} from "../../chaser.ts";

const client = await init();

let direction: Direction = "right";

// 進行方向にブロックがあれば向き先を変える
// 引数としてdirection, readyResult, turnDirectionを受け取る
// 戻り値としてDirectionを返す
function turn(
	direction: Direction,
	readyResult: ReadyResult,
	turnDirection,
): Direction {
	// 進行方向にブロックがあれば向き先を変える
	if (direction === "right" && readyResult["right"] === BLOCK) {
		if (turnDirection === "right") {
			return "down";
		} else {
			return "up";
		}
	}
	if (direction === "down" && readyResult["down"] === BLOCK) {
		if (turnDirection === "right") {
			return "left";
		} else {
			return "right";
		}
	}
	if (direction === "left" && readyResult["left"] === BLOCK) {
		if (turnDirection === "right") {
			return "up";
		} else {
			return "down";
		}
	}
	if (direction === "up" && readyResult["up"] === BLOCK) {
		if (turnDirection === "right") {
			return "right";
		} else {
			return "left";
		}
	}
	return direction;
}

let count = 0;
while (true) {
	count++;
	let readyResult = await client.getReady();
	console.log(readyResult);

	// 敵が上下左右にいたらブロックを置く
	if (readyResult["right"] === ENEMY) {
		await client.put("right");
		continue;
	}
	if (readyResult["down"] === ENEMY) {
		await client.put("down");
		continue;
	}
	if (readyResult["left"] === ENEMY) {
		await client.put("left");
		continue;
	}
	if (readyResult["up"] === ENEMY) {
		await client.put("up");
		continue;
	}

	// アイテムがある方向に方向を変える
	if (readyResult[direction] === ITEM) {
		// 進行方向にアイテムがあれば向き先を変えない
	} else if (readyResult["right"] === ITEM) {
		direction = "right";
	} else if (readyResult["down"] === ITEM) {
		direction = "down";
	} else if (readyResult["left"] === ITEM) {
		direction = "left";
	} else if (readyResult["up"] === ITEM) {
		direction = "up";
	}

	// countが3で割り切れたら
	if (count % 3 === 0) {
		let lookResult = await client.look(direction);

		// lookした範囲に敵がいたら
		console.log(lookResult.raw, lookResult.raw.includes(ENEMY));
		if (lookResult.raw.includes(ENEMY)) {
			// 逆方向に向き先を変える
			if (direction === "right") {
				direction = "left";
			} else if (direction === "left") {
				direction = "right";
			} else if (direction === "up") {
				direction = "down";
			} else if (direction === "down") {
				direction = "up";
			}
			console.log(direction);
		}
		continue;
	}

	// 回転方向をランダムにする
	let turnDirection = "right";
	if (0.5 < Math.random()) {
		turnDirection = "left";
	}

	// 進行方向にブロックがあれば向き先を変える
	// 3回向き先を変えることで安全な方向に移動する
	direction = turn(direction, readyResult, turnDirection);
	direction = turn(direction, readyResult, turnDirection);
	direction = turn(direction, readyResult, turnDirection);

	await client.walk(direction);
}

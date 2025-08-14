/**
 * 3回向き先を変更する
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
// 引数としてReadyResultを受け取る
// 戻り値としてDirectionを返す
function turn(direction: Direction, readyResult: ReadyResult): Direction {
	if (direction === "right" && readyResult["right"] === BLOCK) {
		return "down";
	}
	if (direction === "down" && readyResult["down"] === BLOCK) {
		return "left";
	}
	if (direction === "left" && readyResult["left"] === BLOCK) {
		return "up";
	}
	if (direction === "up" && readyResult["up"] === BLOCK) {
		return "right";
	}
	return direction;
}

while (true) {
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

	// 進行方向にブロックがあれば向き先を変える
	// 3回向き先を変えることで安全な方向に移動する
	direction = turn(direction, readyResult);
	direction = turn(direction, readyResult);
	direction = turn(direction, readyResult);

	await client.walk(direction);
}

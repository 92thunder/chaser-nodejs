/**
 * ループしないように回転方向をランダムにする
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

	// 回転方向をランダムにする
	let turnDirection = "right";
	if (0.5 < Math.random()) {
		turnDirection = "left";
	}

	// 進行方向にブロックがあれば向き先を変える
	if (direction === "right" && readyResult["right"] === BLOCK) {
		if (turnDirection === "right") {
			direction = "down";
		} else {
			direction = "up";
		}
	}
	if (direction === "down" && readyResult["down"] === BLOCK) {
		if (turnDirection === "right") {
			direction = "left";
		} else {
			direction = "right";
		}
	}
	if (direction === "left" && readyResult["left"] === BLOCK) {
		if (turnDirection === "right") {
			direction = "up";
		} else {
			direction = "down";
		}
	}
	if (direction === "up" && readyResult["up"] === BLOCK) {
		if (turnDirection === "right") {
			direction = "right";
		} else {
			direction = "left";
		}
	}
	await client.walk(direction);
}

/**
 * 敵を見つけたらブロックを置く
 */
import {
	BLOCK,
	type Direction,
	EMPTY,
	ENEMY,
	ITEM,
	init,
} from "../../chaser.ts";

const client = await init();

let direction: Direction = "right";

while (true) {
	let readyResult = await client.getReady();
	console.log(readyResult);

	// 敵が上下左右にいたらブロックを置く
	if (readyResult.right === ENEMY) {
		await client.put("right");
		continue;
	}
	if (readyResult.down === ENEMY) {
		await client.put("down");
		continue;
	}
	if (readyResult.left === ENEMY) {
		await client.put("left");
		continue;
	}
	if (readyResult.up === ENEMY) {
		await client.put("up");
		continue;
	}

	// 進行方向にブロックがあれば向き先を変える
	if (direction === "right" && readyResult.right === BLOCK) {
		direction = "down";
	}
	if (direction === "down" && readyResult.down === BLOCK) {
		direction = "left";
	}
	if (direction === "left" && readyResult.left === BLOCK) {
		direction = "up";
	}
	if (direction === "up" && readyResult.up === BLOCK) {
		direction = "right";
	}
	await client.walk(direction);
}

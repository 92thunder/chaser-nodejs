/**
 * 壁にぶつかったら向き先を変更する
 */
import {
	type Direction,
	EMPTY,
	ENEMY,
	BLOCK,
	ITEM,
	init,
} from "../../chaser.ts";

const client = await init();

let direction: Direction = "right";

while (true) {
	const readyResult = await client.getReady();
	console.log(readyResult);

	if (direction === "right" && readyResult["right"] === BLOCK) {
		direction = "down";
	}
	if (direction === "down" && readyResult["down"] === BLOCK) {
		direction = "left";
	}
	if (direction === "left" && readyResult["left"] === BLOCK) {
		direction = "up";
	}
	if (direction === "up" && readyResult["up"] === BLOCK) {
		direction = "right";
	}
	await client.walk(direction);
}

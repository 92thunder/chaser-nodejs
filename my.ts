import { type Direction, EMPTY, ENEMY, BLOCK, ITEM, init } from "./chaser.ts";

const client = await init();

let direction: Direction = "right";

while (true) {
	let readyResult = await client.getReady();
	console.log(readyResult);

	if (direction === "right" && readyResult["right"] === BLOCK) {
		if (readyResult["down"] === BLOCK) {
			direction = "left";
		} else {
			direction = "down";
		}
	}
	if (direction === "down" && readyResult["down"] === BLOCK) {
		if (readyResult["left"] === BLOCK) {
			direction = "up";
		} else {
			direction = "left";
		}
	}
	if (direction === "left" && readyResult["left"] === BLOCK) {
		if (readyResult["up"] === BLOCK) {
			direction = "right";
		} else {
			direction = "up";
		}
	}
	if (direction === "up" && readyResult["up"] === BLOCK) {
		if (readyResult["right"] === BLOCK) {
			direction = "down";
		} else {
			direction = "right";
		}
	}
	await client.walk(direction);
}

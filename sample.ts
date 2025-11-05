import { BLOCK, type Direction, EMPTY, ENEMY, ITEM, init } from "./chaser.ts";

const client = await init();

while (true) {
	let readyResult = await client.getReady();
	console.log(readyResult["upLeft"], readyResult["up"], readyResult["upRight"]);
	console.log(readyResult["left"], readyResult["center"], readyResult["right"]);
	console.log(
		readyResult["downLeft"],
		readyResult["down"],
		readyResult["downRight"],
	);
	console.log("-----");

	let direction: Direction = "right";
	await client.walk(direction);
}

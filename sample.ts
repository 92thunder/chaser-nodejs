import { type Direction, EMPTY, ENEMY, BLOCK, ITEM, init } from "./chaser.ts";

const client = await init();

while (true) {
	const values = await client.getReady();
	console.log(values);

	let direction: Direction = "right";
	await client.walk(direction);
}

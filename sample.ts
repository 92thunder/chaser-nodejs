import { type Direction, EMPTY, ENEMY, BLOCK, ITEM, init } from "./chaser.ts";

const client = await init();

while (true) {
	const values = await client.getReady();
	console.log(values["upLeft"], values["up"], values["upRight"]);
	console.log(values["left"], values["center"], values["right"]);
	console.log(values["downLeft"], values["down"], values["downRight"]);
	console.log("-----");

	let direction: Direction = "right";
	await client.walk(direction);
}

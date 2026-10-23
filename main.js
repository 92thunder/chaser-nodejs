import { init } from "./chaser.ts";

const client = await init();

while (true) {
	const readyResult = await client.getReady();
	console.log(readyResult.upLeft, readyResult.up, readyResult.upRight);
	console.log(readyResult.left, readyResult.center, readyResult.right);
	console.log(readyResult.downLeft, readyResult.down, readyResult.downRight);
	console.log("-----");

	await client.walk("right");
}

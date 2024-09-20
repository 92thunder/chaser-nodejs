import { init } from "./chaser.js";

const client = await init();

while (true) {
	const values = await client.getReady();
	console.log(values);
	await client.look("right");
}

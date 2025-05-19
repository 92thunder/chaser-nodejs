import { init } from "./chaser.ts";

const client = await init();

while (true) {
	const values = await client.getReady();
	console.log(values);
	await client.look("right");
}

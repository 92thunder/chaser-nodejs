/**
 * 同じ所をぐるぐる回らないように、来た回数を覚えて行っていないマスへ進む
 * （ヒント集「ぐるぐる回らないようにしたい」）
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

// 場所（スタートから右に x マス、下に y マス）
let x = 0;
let y = 0;
// 来た回数のメモ（"x,y" という文字をカギにして、マスごとに回数を入れる）
const visited: Record<string, number> = {};
let mode = "ふつう";

let direction: Direction = "right";

while (true) {
	let readyResult = await client.getReady();
	console.log(readyResult);

	// 来た回数[場所] を 1 ふやす
	const here = x + "," + y;
	visited[here] = (visited[here] ?? 0) + 1;
	if (visited[here] >= 3) {
		mode = "探検";
	}

	// 壁をよけて向きを決める（1.ts と同じ）
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

	// 探検モードなら、ブロックじゃなくて来た回数が 0 のマスへ向かう
	if (mode === "探検") {
		if (readyResult.right !== BLOCK && !visited[x + 1 + "," + y]) {
			direction = "right";
			mode = "ふつう";
		} else if (readyResult.down !== BLOCK && !visited[x + "," + (y + 1)]) {
			direction = "down";
			mode = "ふつう";
		} else if (readyResult.left !== BLOCK && !visited[x - 1 + "," + y]) {
			direction = "left";
			mode = "ふつう";
		} else if (readyResult.up !== BLOCK && !visited[x + "," + (y - 1)]) {
			direction = "up";
			mode = "ふつう";
		}
	}

	await client.walk(direction);

	// 場所を進んだ分だけ動かす
	if (direction === "right") x++;
	if (direction === "down") y++;
	if (direction === "left") x--;
	if (direction === "up") y--;
}

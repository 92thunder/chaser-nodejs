/**
 * 何回も来たマスに気づいたら、来た回数がいちばん少ないマスへ進んで脱出する
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
// 来た回数のメモ（"x,y" という文字をカギにする）。スタートのマスだけ入れて始める
const visited = { "0,0": 1 };
let mode = "ふつう";

let direction: Direction = "right";

while (true) {
	let readyResult = await client.getReady();
	console.log(readyResult);

	// 今のマスに3回以上来ていたら脱出モードにする
	const here = x + "," + y;
	if (visited[here] >= 3) {
		mode = "脱出";
	}

	// 進む先がブロックなら、向きを変える
	if (readyResult[direction] === BLOCK) {
		if (direction === "right") {
			direction = "down";
		} else if (direction === "down") {
			direction = "left";
		} else if (direction === "left") {
			direction = "up";
		} else if (direction === "up") {
			direction = "right";
		}
	}

	// 脱出モードでは、ブロックじゃないマスのうち、来た回数がいちばん少ないマスへ進む
	// 同じ回数のときは、右→下→左→上 の順で先に見たマスにする
	if (mode === "脱出") {
		const rightCount = visited[x + 1 + "," + y] ?? 0;
		const downCount = visited[x + "," + (y + 1)] ?? 0;
		const leftCount = visited[x - 1 + "," + y] ?? 0;
		const upCount = visited[x + "," + (y - 1)] ?? 0;

		let least = 999;
		if (readyResult.right !== BLOCK && rightCount < least) {
			direction = "right";
			least = rightCount;
		}
		if (readyResult.down !== BLOCK && downCount < least) {
			direction = "down";
			least = downCount;
		}
		if (readyResult.left !== BLOCK && leftCount < least) {
			direction = "left";
			least = leftCount;
		}
		if (readyResult.up !== BLOCK && upCount < least) {
			direction = "up";
			least = upCount;
		}
	}

	await client.walk(direction);

	// 場所を進んだ分だけ動かして、来た回数を 1 ふやす
	if (direction === "right") x++;
	if (direction === "down") y++;
	if (direction === "left") x--;
	if (direction === "up") y--;
	const next = x + "," + y;
	visited[next] = (visited[next] ?? 0) + 1;
}

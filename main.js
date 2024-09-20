import { init } from "./chaser.js";

const client = await init();

// const map = [
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// 	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
// ];
// const myPosition = {
// 	x: null,
// 	y: null,
// };
const ENEMY = "1";
const BLOCK = "2";
const ITEM = "3";

let baseDirection = "right";
let rightOrLeft = "right";
function turn(direction) {
	if (direction === "right") {
		if (baseDirection === "right") {
			baseDirection = "down";
		} else if (baseDirection === "down") {
			baseDirection = "left";
		} else if (baseDirection === "left") {
			baseDirection = "up";
		} else if (baseDirection === "up") {
			baseDirection = "right";
		}
	}
	if (direction === "left") {
		if (baseDirection === "right") {
			baseDirection = "up";
		} else if (baseDirection === "down") {
			baseDirection = "right";
		} else if (baseDirection === "left") {
			baseDirection = "down";
		} else if (baseDirection === "up") {
			baseDirection = "left";
		}
	}
}
function turnBack() {
	if (baseDirection === "right") {
		baseDirection = "left";
	} else if (baseDirection === "down") {
		baseDirection = "up";
	} else if (baseDirection === "left") {
		baseDirection = "right";
	} else if (baseDirection === "up") {
		baseDirection = "down";
	}
}

function directionToIndex(direction) {
	if (direction === "right") {
		return 5;
	}
	if (direction === "down") {
		return 7;
	}
	if (direction === "left") {
		return 3;
	}
	if (direction === "up") {
		return 1;
	}
}

let backCount = 0;

let foundEnemy = false;
while (true) {
	const values = await client.getReady();
	console.clear();
	console.log(values.slice(0, 3));
	console.log(values.slice(3, 6));
	console.log(values.slice(6, 9));

	if (values.includes(ENEMY)) {
		if (values[directionToIndex("up")] === ENEMY) {
			await client.put("up");
			continue;
		}
		if (values[directionToIndex("right")] === ENEMY) {
			await client.put("right");
			continue;
		}
		if (values[directionToIndex("down")] === ENEMY) {
			await client.put("down");
			continue;
		}
		if (values[directionToIndex("left")] === ENEMY) {
			await client.put("left");
			continue;
		}
		const lookValues = await client.look(baseDirection);
		if (lookValues.includes(ENEMY)) {
			foundEnemy = true;
			turnBack();
		}
		continue;
	}

	if (values.includes(ITEM) && !foundEnemy) {
		if (values[directionToIndex("up")] === ITEM) {
			baseDirection = "up";
		}
		if (values[directionToIndex("right")] === ITEM) {
			baseDirection = "right";
		}
		if (values[directionToIndex("down")] === ITEM) {
			baseDirection = "down";
		}
		if (values[directionToIndex("left")] === ITEM) {
			baseDirection = "left";
		}
	}

	if (values[directionToIndex(baseDirection)] === BLOCK) {
		if (2 <= backCount) {
			rightOrLeft = "left";
		}

		turn(rightOrLeft);
		if (values[directionToIndex(baseDirection)] === BLOCK) {
			turn(rightOrLeft);
			if (values[directionToIndex(baseDirection)] === BLOCK) {
				turn(rightOrLeft);
			}
			backCount++;
		} else {
			backCount = 0;
		}
		await client.walk(baseDirection);
	} else {
		await client.walk(baseDirection);
	}
	foundEnemy = false;
}

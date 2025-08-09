import readline from "node:readline/promises";
import net from "node:net";

type Empty = "0";
export const EMPTY: Empty = "0";
type Enemy = "1";
export const ENEMY = "1";
type Block = "2";
export const BLOCK: Block = "2";
type Item = "3";
export const ITEM: Item = "3";

export type Cell = Empty | Enemy | Block | Item;
export type ReadyResult = {
	upLeft: Cell;
	up: Cell;
	upRight: Cell;
	left: Cell;
	center: Cell;
	right: Cell;
	downLeft: Cell;
	down: Cell;
	downRight: Cell;
	raw: string;
};

export type Direction = "up" | "down" | "right" | "left";

interface ChaserClient {
	getReady(): Promise<ReadyResult>;
	search(direction: Direction): Promise<string>;
	look(direction: Direction): Promise<ReadyResult>;
	walk(direction: Direction): Promise<string>;
	put(direction: Direction): Promise<string>;
}

async function initTcpClient() {
	let host = "127.0.0.1";
	let port = 2009;
	let name = "test player";

	if (process.env.NODE_ENV !== "development") {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		host =
			(await rl.question("サーバーのIPアドレスを入力してください > ")) ||
			"127.0.0.1";
		port = Number(await rl.question("ポート番号を入力してください > ")) || 2009;
		name =
			(await rl.question("ユーザー名を入力してください > ")) || "test player";
		rl.close();
	}

	const client = net.connect(port, host, () => {
		console.info(`Connected to  ${host} !`);
	});

	client.on("error", () => {
		client.destroy();
		process.exit();
	});

	client.on("end", () => {
		client.destroy();
		process.exit();
	});

	client.on("close", () => {
		console.info("Connection is closed.");
		process.exit();
	});

	client.write(`${name}\r\n`, (error) => {
		if (error) {
			console.error(error);
		}
	});

	return client;
}

async function waitMyTurn(client: net.Socket) {
	return new Promise<void>((resolve) => {
		client.once("data", (data) => {
			if (data.toString().includes("@")) {
				resolve();
			} else {
				console.error("connection error: ", data.toString());
			}
		});
	});
}

async function sendCommand(
	client: net.Socket,
	command: string,
): Promise<Cell[9]> {
	if (command === "gr") {
		await waitMyTurn(client);
	}
	return new Promise<string>((resolve) => {
		client.once("data", (data) => {
			if (command !== "gr") {
				client.write("#\r\n");
			}
			if (data.toString()[0] === "0") {
				process.exit();
			}
			resolve(data.toString().slice(1, 10));
		});
		client.write(`${command}\r\n`);
	});
}

export async function init(): Promise<ChaserClient> {
	const client = await initTcpClient();

	const chaserClient = {
		async getReady(): Promise<ReadyResult> {
			const readyResult = await sendCommand(client, "gr");
			return {
				upLeft: readyResult[0] as Cell,
				up: readyResult[1] as Cell,
				upRight: readyResult[2] as Cell,
				left: readyResult[3] as Cell,
				center: readyResult[4] as Cell,
				right: readyResult[5] as Cell,
				downLeft: readyResult[6] as Cell,
				down: readyResult[7] as Cell,
				downRight: readyResult[8] as Cell,
				raw: readyResult,
			};
		},
		search(direction: Direction) {
			switch (direction) {
				case "up":
					return sendCommand(client, "su");
				case "down":
					return sendCommand(client, "sd");
				case "right":
					return sendCommand(client, "sr");
				case "left":
					return sendCommand(client, "sl");
				default:
					throw new Error("引数が間違っています");
			}
		},
		async look(direction: Direction) {
			let lookResult: string;
			switch (direction) {
				case "up":
					lookResult = await sendCommand(client, "lu");
					break;
				case "down":
					lookResult = await sendCommand(client, "ld");
					break;
				case "right":
					lookResult = await sendCommand(client, "lr");
					break;
				case "left":
					lookResult = await sendCommand(client, "ll");
					break;
				default:
					throw new Error("引数が間違っています");
			}
			return {
				upLeft: lookResult[0] as Cell,
				up: lookResult[1] as Cell,
				upRight: lookResult[2] as Cell,
				left: lookResult[3] as Cell,
				center: lookResult[4] as Cell,
				right: lookResult[5] as Cell,
				downLeft: lookResult[6] as Cell,
				down: lookResult[7] as Cell,
				downRight: lookResult[8] as Cell,
				raw: lookResult,
			};
		},
		walk(direction: Direction) {
			switch (direction) {
				case "up":
					return sendCommand(client, "wu");
				case "down":
					return sendCommand(client, "wd");
				case "right":
					return sendCommand(client, "wr");
				case "left":
					return sendCommand(client, "wl");
				default:
					throw new Error("引数が間違っています");
			}
		},
		put(direction: Direction) {
			switch (direction) {
				case "up":
					return sendCommand(client, "pu");
				case "down":
					return sendCommand(client, "pd");
				case "right":
					return sendCommand(client, "pr");
				case "left":
					return sendCommand(client, "pl");
				default:
					throw new Error("引数が間違っています");
			}
		},
	};
	return chaserClient;
}

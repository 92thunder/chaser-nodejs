import readline from "node:readline/promises";
import net from "node:net";

type Empty = "0";
type Enemy = "1";
type Block = "2";
type Item = "3";

type Cell = Empty | Enemy | Block | Item;

type Direction = "up" | "down" | "right" | "left";

interface ChaserClient {
	getReady(): Promise<Cell[9]>;
	search(direction: Direction): Promise<string>;
	look(direction: Direction): Promise<string>;
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

	client.on("end", () => {
		client.destroy();
	});

	client.on("close", () => {
		console.info("Connection is closed.");
	});

	client.write(`${name}\r\n`, (error) => {
		if (error) {
			console.error(error);
		}
	});

	return client;
}

async function waitMyTurn(client) {
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

async function sendCommand(client, command): Promise<Cell[9]> {
	if (command === "gr") {
		await waitMyTurn(client);
	}
	return new Promise<string>((resolve) => {
		client.once("data", (data) => {
			if (command !== "gr") {
				client.write("#\r\n");
			}
			resolve(data.toString().slice(1, 10));
		});
		client.write(`${command}\r\n`);
	});
}

export async function init(): Promise<ChaserClient> {
	const client = await initTcpClient();

	const chaserClient = {
		async getReady(): Promise<Cell[9]> {
			return sendCommand(client, "gr");
		},
		search(direction) {
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
		look(direction) {
			switch (direction) {
				case "up":
					return sendCommand(client, "lu");
				case "down":
					return sendCommand(client, "ld");
				case "right":
					return sendCommand(client, "lr");
				case "left":
					return sendCommand(client, "ll");
				default:
					throw new Error("引数が間違っています");
			}
		},
		walk(direction) {
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
		put(direction) {
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

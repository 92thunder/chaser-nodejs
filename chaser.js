import readline from "node:readline/promises";
import net from "node:net";

async function initTcpClient() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const port =
		Number(await rl.question("ポート番号を入力してください > ")) || 2009;
	const name =
		(await rl.question("ユーザー名を入力してください > ")) || "test player";
	const host =
		(await rl.question("サーバーのIPアドレスを入力してください > ")) ||
		"127.0.0.1";
	rl.close();

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
	return new Promise((resolve) => {
		client.once("data", (data) => {
			if (data.toString().includes("@")) {
				resolve();
			} else {
				console.error("connection error: ", data.toString());
			}
		});
	});
}

async function sendCommand(client, command) {
	if (command === "gr") {
		await waitMyTurn(client);
	}
	return new Promise((resolve) => {
		client.once("data", (data) => {
			if (command !== "gr") {
				client.write("#\r\n");
			}
			resolve(data.toString().slice(1, 10));
		});
		client.write(`${command}\r\n`);
	});
}

export async function init() {
	const client = await initTcpClient();

	const chaserClient = {
		async getReady() {
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

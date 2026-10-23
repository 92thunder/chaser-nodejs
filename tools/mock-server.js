/**
 * CHaser サーバーのモック（動作確認用）
 *
 * 本物の CHaser Server と同じ TCP の手順で通信し、マップファイルを読んで
 * 勝ち・負け・引き分けまで判定する。COOL / HOT それぞれに次のどれかを割り当てられる。
 *
 *   wait          外からの接続を待つ（自分で exe や node を起動してつなぐ）
 *   cmd:<コマンド>  コマンドを起動して自動でつなぐ（IP・ポート・名前の質問に自動で答える）
 *   bot:stay      毎ターン getReady して上を search するだけ
 *   bot:random    ブロックと敵を避けてランダムに歩く
 *   bot:put       上下左右に敵がいたら put する。いなければ stay と同じ
 *
 * 使い方:
 *   node tools/mock-server.js [マップ] [--cool 種類] [--hot 種類] [--turns N]
 *                             [--port 2009] [--timeout 10000] [--view] [--expect cool|hot|draw]
 *
 * 例:
 *   node tools/mock-server.js maps/dev1.map
 *   node tools/mock-server.js tools/maps/win-items.map --cool "cmd:dist/player.exe" --expect cool
 *
 * ルール（モックの仮定。本物のサーバーと細部が違う可能性がある）:
 *   - マップの外はブロック扱い
 *   - ブロックの上に walk したら負け
 *   - 相手のいるマスに walk しても負けにはならない（モックではその場にとどまる。本物で動くかは未確認）
 *   - アイテムを取ると、取る前にいたマスがブロックになる
 *   - 相手のいるマスに put したら勝ち
 *   - getReady の時点で上下左右がすべてブロックなら負け
 *   - 時間切れ・切断・不正なコマンドは負け
 *   - ターンを使い切ったらアイテム数で判定
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { parseArgs } from "node:util";

const EMPTY = 0;
const BLOCK = 2;
const ITEM = 3;
const SIDES = ["COOL", "HOT"];

const DIRECTIONS = {
	u: { dx: 0, dy: -1, name: "Up" },
	d: { dx: 0, dy: 1, name: "Down" },
	l: { dx: -1, dy: 0, name: "Left" },
	r: { dx: 1, dy: 0, name: "Right" },
};
const ACTIONS = { w: "Walk", l: "Look", s: "Search", p: "Put" };

// ============================================================================
// マップ
// ============================================================================

function loadMap(path) {
	const map = { name: path, turns: 100, cells: [], start: {} };
	for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
		const value = line.slice(2);
		switch (line[0]) {
			case "N":
				map.name = value;
				break;
			case "T":
				map.turns = Number(value);
				break;
			case "D":
				map.cells.push(value.split(",").map(Number));
				break;
			case "C":
			case "H": {
				const [x, y] = value.split(",").map(Number);
				map.start[line[0] === "C" ? "COOL" : "HOT"] = { x, y };
				break;
			}
		}
	}
	return map;
}

// ============================================================================
// ゲーム
// ============================================================================

class Game {
	constructor(map, turns) {
		this.cells = map.cells.map((row) => [...row]);
		this.turns = turns;
		this.players = {
			COOL: { pos: { ...map.start.COOL }, items: 0 },
			HOT: { pos: { ...map.start.HOT }, items: 0 },
		};
		this.result = null; // { winner: "COOL" | "HOT" | null, reason }
	}

	opponent(side) {
		return side === "COOL" ? "HOT" : "COOL";
	}

	// side から見たマスの値（"0" 空き, "1" 敵, "2" ブロック, "3" アイテム）
	view(side, x, y) {
		const enemy = this.players[this.opponent(side)].pos;
		if (enemy.x === x && enemy.y === y) return "1";
		return String(this.cells[y]?.[x] ?? BLOCK);
	}

	around(side, cx, cy) {
		let s = "";
		for (let y = cy - 1; y <= cy + 1; y++) {
			for (let x = cx - 1; x <= cx + 1; x++) s += this.view(side, x, y);
		}
		return s;
	}

	finish(winner, reason) {
		if (!this.result) this.result = { winner, reason };
	}

	lose(side, reason) {
		this.finish(this.opponent(side), `${side} ${reason}`);
	}

	judgeByItems(reason) {
		const cool = this.players.COOL.items;
		const hot = this.players.HOT.items;
		const winner = cool > hot ? "COOL" : hot > cool ? "HOT" : null;
		this.finish(winner, `${reason}（アイテム COOL:${cool} HOT:${hot}）`);
	}

	// コマンドを実行して、返す9文字のデータを返す
	command(side, cmd) {
		const me = this.players[side];
		const { x, y } = me.pos;

		if (cmd === "gr") {
			log(`[行動] ${side} が GetReady を行いました`);
			const surrounded = Object.values(DIRECTIONS).every(
				(d) => this.view(side, x + d.dx, y + d.dy) === String(BLOCK),
			);
			if (surrounded) this.lose(side, "が上下左右をブロックに囲まれた");
			return this.around(side, x, y);
		}

		const action = ACTIONS[cmd[0]];
		const dir = DIRECTIONS[cmd[1]];
		if (cmd.length !== 2 || !action || !dir) {
			this.lose(side, `が不正なコマンド "${cmd}" を送った`);
			return "000000000";
		}
		log(`[行動] ${side} が ${action}${dir.name} を行いました`);
		const tx = x + dir.dx;
		const ty = y + dir.dy;

		switch (action) {
			case "Walk": {
				const target = this.view(side, tx, ty);
				if (target === String(BLOCK)) {
					this.lose(side, "がブロックに移動した");
				} else if (target === "1") {
					// 負けにはならない。重なるのを避けて、その場にとどまる
					return this.around(side, x, y);
				} else if (target === String(ITEM)) {
					me.items++;
					this.cells[y][x] = BLOCK;
					this.cells[ty][tx] = EMPTY;
				}
				me.pos = { x: tx, y: ty };
				return this.around(side, tx, ty);
			}
			case "Put": {
				if (this.view(side, tx, ty) === "1") {
					this.lose(this.opponent(side), "がブロックを置かれた");
				} else if (this.cells[ty]?.[tx] !== undefined) {
					this.cells[ty][tx] = BLOCK;
				}
				return this.around(side, x, y);
			}
			case "Look":
				return this.around(side, x + dir.dx * 2, y + dir.dy * 2);
			case "Search": {
				let s = "";
				for (let i = 1; i <= 9; i++)
					s += this.view(side, x + dir.dx * i, y + dir.dy * i);
				return s;
			}
		}
	}

	render() {
		return this.cells
			.map((row, y) =>
				row
					.map((cell, x) => {
						for (const side of SIDES) {
							const p = this.players[side].pos;
							if (p.x === x && p.y === y) return side[0];
						}
						return cell === BLOCK ? "#" : cell === ITEM ? "*" : ".";
					})
					.join(""),
			)
			.join("\n");
	}
}

// ============================================================================
// プレイヤー（ソケットでつなぐクライアント / 内蔵 bot）
// ============================================================================

class SocketPlayer {
	constructor(side, socket, timeout) {
		this.side = side;
		this.socket = socket;
		this.timeout = timeout;
		this.buffer = "";
		this.lines = [];
		this.waiting = null;
		this.closed = false;
		socket.on("data", (data) => {
			this.buffer += data.toString();
			let i = this.buffer.indexOf("\n");
			while (i >= 0) {
				this.lines.push(this.buffer.slice(0, i).replace(/\r$/, ""));
				this.buffer = this.buffer.slice(i + 1);
				i = this.buffer.indexOf("\n");
			}
			this.flush();
		});
		const onClose = () => {
			this.closed = true;
			this.flush();
		};
		socket.on("close", onClose);
		socket.on("error", onClose);
	}

	flush() {
		if (!this.waiting) return;
		if (this.lines.length > 0) {
			this.waiting.resolve(this.lines.shift());
		} else if (this.closed) {
			this.waiting.reject(new Error("が切断した"));
		} else {
			return;
		}
		clearTimeout(this.waiting.timer);
		this.waiting = null;
	}

	read(timeout = this.timeout) {
		return new Promise((resolve, reject) => {
			const timer = timeout
				? setTimeout(() => {
						this.waiting = null;
						reject(new Error("が時間切れになった"));
					}, timeout)
				: undefined;
			this.waiting = { resolve, reject, timer };
			this.flush();
		});
	}

	send(line) {
		if (!this.closed) this.socket.write(`${line}\r\n`);
	}

	async play(game) {
		try {
			this.send("@");
			const gr = await this.read();
			if (gr !== "gr") {
				game.lose(this.side, `が gr の代わりに "${gr}" を送った`);
				this.send(`0${"0".repeat(9)}`);
				return;
			}
			const ready = game.command(this.side, "gr");
			this.send(`${game.result ? 0 : 1}${ready}`);
			if (game.result) return;

			const cmd = await this.read();
			const data = game.command(this.side, cmd);
			this.send(`${game.result ? 0 : 1}${data}`);
			if (game.result) return;

			const hash = await this.read();
			if (hash !== "#")
				game.lose(this.side, `が # の代わりに "${hash}" を送った`);
		} catch (error) {
			game.lose(this.side, error.message);
		}
	}

	// 試合終了を伝える（自分の番の途中で終わった場合はすでに伝わっている）
	async notifyEnd(game) {
		try {
			this.send("@");
			await this.read(2000);
			this.send(
				`0${game.around(this.side, game.players[this.side].pos.x, game.players[this.side].pos.y)}`,
			);
		} catch {}
		this.socket.end();
	}
}

class BotPlayer {
	constructor(side, strategy) {
		this.side = side;
		this.strategy = strategy;
	}

	async play(game) {
		const ready = game.command(this.side, "gr");
		if (game.result) return;
		game.command(this.side, this.decide(ready));
	}

	decide(ready) {
		// ready は左上から右下への9マス。上下左右はそれぞれ 1, 7, 3, 5 番目
		const neighbors = { u: ready[1], d: ready[7], l: ready[3], r: ready[5] };
		const dirs = Object.keys(neighbors);
		switch (this.strategy) {
			case "put": {
				const enemy = dirs.find((d) => neighbors[d] === "1");
				return enemy ? `p${enemy}` : "su";
			}
			case "random": {
				const safe = dirs.filter(
					(d) => neighbors[d] === "0" || neighbors[d] === "3",
				);
				if (safe.length === 0) return "su";
				return `w${safe[Math.floor(Math.random() * safe.length)]}`;
			}
			default:
				return "su";
		}
	}

	async notifyEnd() {}
}

// ソケットでの接続を1つ待ち、最初の1行（名前）を受け取る
function acceptPlayer(side, port, timeout) {
	return new Promise((resolve, reject) => {
		const server = net.createServer(async (socket) => {
			server.close();
			const player = new SocketPlayer(side, socket, timeout);
			const name = await player.read(0).catch(() => "");
			log(`[接続] ${side} に "${name}" が接続しました`);
			resolve(player);
		});
		server.on("error", reject);
		server.listen(port, () =>
			log(`[待機] ${side} はポート ${port} で接続を待っています`),
		);
	});
}

// コマンドを起動し、IP・ポート・名前の質問に順に答える
function launchCommand(side, command, port) {
	const answers = ["127.0.0.1", String(port), side.toLowerCase()];
	// シェルを通さずに起動する（Windows の cmd.exe は dist/player.exe のような / 区切りを受け付けないため）
	const [file, ...args] = command.split(/\s+/);
	const child = spawn(file, args);
	child.on("error", (error) =>
		log(`  [${side}] 起動できません: ${error.message}`),
	);
	const forward = (data) => {
		const text = data.toString();
		for (const line of text.split(/\r?\n/))
			if (line) log(`  [${side}] ${line}`);
		const prompts = text.split("> ").length - 1;
		for (let i = 0; i < prompts && answers.length > 0; i++)
			child.stdin.write(`${answers.shift()}\n`);
	};
	child.stdout.on("data", forward);
	child.stderr.on("data", forward);
	return child;
}

// ============================================================================
// メイン
// ============================================================================

let quiet = false;
function log(message) {
	if (!quiet) console.log(message);
}

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			cool: { type: "string", default: "wait" },
			hot: { type: "string", default: "bot:stay" },
			turns: { type: "string" },
			port: { type: "string", default: "2009" },
			timeout: { type: "string", default: "10000" },
			view: { type: "boolean", default: false },
			quiet: { type: "boolean", default: false },
			expect: { type: "string" },
		},
	});
	quiet = values.quiet;

	const mapPath = positionals[0] ?? "maps/dev1.map";
	const map = loadMap(mapPath);
	const game = new Game(map, Number(values.turns ?? map.turns));
	const timeout = Number(values.timeout);
	const children = [];

	log(`[マップ] ${map.name}（${mapPath}） ${game.turns}ターン`);

	const players = {};
	await Promise.all(
		SIDES.map(async (side, i) => {
			const spec = values[side.toLowerCase()];
			if (spec.startsWith("bot:")) {
				players[side] = new BotPlayer(side, spec.slice(4));
				return;
			}
			const port = Number(values.port) + i;
			const accepted = acceptPlayer(side, port, timeout);
			if (spec.startsWith("cmd:")) {
				const child = launchCommand(side, spec.slice(4), port);
				children.push(child);
				const exited = new Promise((_, reject) =>
					child.on("close", () =>
						reject(new Error(`${side} のコマンドが接続する前に終了しました`)),
					),
				);
				players[side] = await Promise.race([accepted, exited]);
				return;
			}
			if (spec !== "wait") throw new Error(`${side} の指定が不正です: ${spec}`);
			players[side] = await accepted;
		}),
	);

	log("[開始] ゲームを開始します");
	for (let turn = game.turns; turn > 0 && !game.result; turn--) {
		log(`-----残${turn}ターン-----`);
		for (const side of SIDES) {
			await players[side].play(game);
			if (game.result) break;
		}
		if (values.view) log(game.render());
	}
	if (!game.result) game.judgeByItems("タイムアップ");

	await Promise.all(SIDES.map((side) => players[side].notifyEnd(game)));

	const { winner, reason } = game.result;
	const outcome = winner ? winner.toLowerCase() : "draw";
	quiet = false;
	log(`[決着] ${winner ? `${winner} の勝ちです` : "引き分けです"}: ${reason}`);
	log(`[結果] ${outcome}`);

	// 起動したコマンドが自分で終わるのを少し待ち、残っていれば止める
	await new Promise((r) => setTimeout(r, 500));
	for (const child of children) if (child.exitCode === null) child.kill();

	if (values.expect && values.expect !== outcome) {
		console.error(
			`[NG] 期待した結果は ${values.expect} でしたが ${outcome} でした`,
		);
		process.exit(1);
	}
	process.exit(0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

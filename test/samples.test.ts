/**
 * サンプルをモックサーバーで対戦させて、結果を確かめる
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

// マップの上で sample を COOL として動かし、結果（cool / hot / draw）を返す
function play(sample: string, map: string, port: number): string {
	const result = spawnSync(
		process.execPath,
		[
			"tools/mock-server.js",
			map,
			"--cool",
			`cmd:node ${sample}`,
			"--port",
			String(port),
			"--quiet",
		],
		{ encoding: "utf8", timeout: 120000 },
	);
	const outcome = result.stdout.match(/\[結果\] (\w+)/);
	assert.ok(outcome, `結果が出ませんでした:\n${result.stdout}${result.stderr}`);
	return outcome[1];
}

test("1.ts は外周をぐるぐる回るだけで、真ん中のアイテムを取れない", () => {
	assert.equal(
		play("samples/chaser/1.ts", "tools/maps/loop-items.map", 2101),
		"draw",
	);
});

test("7.ts は何回も来たマスに気づいて脱出し、真ん中のアイテムを取りに行ける", () => {
	assert.equal(
		play("samples/chaser/7.ts", "tools/maps/loop-items.map", 2103),
		"cool",
	);
});

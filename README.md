# CHaser Node.js

[U-16プログラミングコンテスト](https://www.procon-asahikawa.org/) の競技部門で利用される対戦型プラットフォーム『CHaser』のNode.js向けクライアントライブラリです。

Node.js 23以降でTypeScriptファイルを直接実行できるようになったため、タイプミスを減らしコードの品質を向上させる目的でTypeScriptを採用しています。

## 環境構築

### CHaser Serverのダウンロード

[CHaser Server](https://github.com/u16procon/chaser-server/releases) のリリース一覧からダウンロードしてください。zipファイルを展開後、AsahikawaProcon-Server.exe を実行することで起動できます。

### Node.js のインストール

[Node.jsのダウンロードページ](https://nodejs.org/en/download/prebuilt-installer/current) から環境にあった Node.js をインストールしてください。

Windows で Prebuilt Installer 24.2.0 を使って動作確認しています。

### 依存パッケージのインストール

```sh
npm install
```

## 開発環境の設定

### VSCode 拡張機能（推奨）

このプロジェクトでは、コードフォーマットとリントに [Biome](https://biomejs.dev/) を使用しています。
VSCodeで開発する場合は、Biome拡張機能のインストールを推奨します。

プロジェクトを開くと、拡張機能のインストールを促すメッセージが表示されます。または、以下の方法で手動でインストールできます：

1. VSCodeの拡張機能タブを開く（Ctrl+Shift+X / Cmd+Shift+X）
2. "Biome" で検索
3. "Biome" 拡張機能をインストール

Biomeの設定は `biome.json` に記述されています。

## 実行方法

### コマンドラインから実行

TCPユーザーの待機開始後、実行後の質問で何も入力せずに 3回Enter入力 することでCOOLとして接続できます。

```sh
# TypeScriptファイルを直接実行
node sample.ts

# デフォルトは 127.0.0.1
サーバーのIPアドレスを入力してください >
# デフォルトは 2009
ポート番号を入力してください >
# デフォルトは test
ユーザー名を入力してください >
```

### VSCodeでデバッグ実行

VSCodeでより便利にデバッグしながら開発できます：

1. `sample.ts` をVSCodeで開く
2. **F5キー** を押す

### exe にビルドする（SEA）

Node.js 標準の [SEA（Single Executable Applications）](https://nodejs.org/api/single-executable-applications.html) で、`main.js` を Windows 用の exe 1ファイルにまとめられます。Node.js 25.5 以降が必要です。

```sh
npm run build
```

`main.js` と `chaser.ts` を esbuild で `dist/player.js` にまとめてから、`dist/player.exe` を作ります。できた exe はダブルクリックで起動でき、Node.js が入っていない PC でも動きます。

### モックサーバーで試す

CHaser Server を起動しなくても、`tools/mock-server.js` で対戦を試せます。本物と同じ手順で通信し、勝ち・負け・引き分けまで判定します。

```sh
# 内蔵 bot（HOT）と対戦。COOL はポート 2009 で接続を待つので、別のターミナルで exe や node main.js を起動してつなぐ
npm run mock -- maps/dev1.map

# exe を自動で起動して対戦し、盤面も表示する
npm run mock -- tools/maps/win-items.map --cool "cmd:dist/player.exe" --view
```

| オプション | 意味 |
| --- | --- |
| `--cool` / `--hot` | `wait`（接続を待つ）、`cmd:<コマンド>`（起動して自動でつなぐ）、`bot:stay` / `bot:random` / `bot:put`（内蔵 bot）。既定は COOL が `wait`、HOT が `bot:stay` |
| `--turns N` | ターン数（既定はマップの `T:`） |
| `--port` | COOL のポート（既定 2009）。HOT はその次の番号 |
| `--view` | 毎ターン盤面を表示する |
| `--quiet` | 結果だけ表示する |
| `--expect cool\|hot\|draw` | 結果が違えば終了コード 1 で終わる |

`tools/maps/` には、右に進み続けるだけのプレイヤー（今の `main.js`）で勝ち・負け・引き分けを確かめるためのマップがあります。細かいルールの仮定は `tools/mock-server.js` の冒頭に書いています。

## プロジェクト構成

- `chaser.ts` - CHaserクライアントライブラリ本体
- `sample.ts` - サンプル実装（右方向に進み続けるだけの簡単な例）
- `tsconfig.json` - TypeScript設定ファイル
- `biome.json` - Biome（フォーマッター・リンター）の設定ファイル
- `.vscode/` - VSCode用の設定ファイル
  - `launch.json` - デバッグ設定
  - `extensions.json` - 推奨拡張機能

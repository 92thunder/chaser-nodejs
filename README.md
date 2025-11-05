# CHaser Node.js

[U-16プログラミングコンテスト](https://www.procon-asahikawa.org/) の競技部門で利用される対戦型プラットフォーム『CHaser』のNode.js向けクライアントライブラリです。

## 環境構築

### CHaser Serverのダウンロード

[CHaser Server](https://github.com/u16procon/chaser-server/releases) のリリース一覧からダウンロードしてください。zipファイルを展開後、AsahikawaProcon-Server.exe を実行することで起動できます。

### Node.js のインストール

[Node.jsのダウンロードページ](https://nodejs.org/en/download/prebuilt-installer/current) から環境にあった Node.js をインストールしてください。

Windows で Prebuilt Installer 20.17.0 を使って動作確認しています。

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
2. **F5キー** を押す、または「実行とデバッグ」パネルから「Launch Program」を選択
3. 統合ターミナルにプロンプトが表示されるので、必要に応じて入力（デフォルト値を使う場合は3回Enterキー）

ブレークポイントを設定することで、コードの実行を止めて変数の値を確認できます。

## プロジェクト構成

- `chaser.ts` - CHaserクライアントライブラリ本体
- `sample.ts` - サンプル実装（右方向に進み続けるだけの簡単な例）
- `tsconfig.json` - TypeScript設定ファイル
- `biome.json` - Biome（フォーマッター・リンター）の設定ファイル
- `.vscode/` - VSCode用の設定ファイル
  - `launch.json` - デバッグ設定
  - `extensions.json` - 推奨拡張機能

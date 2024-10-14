# CHaser Node.js

[U-16プログラミングコンテスト](https://www.procon-asahikawa.org/) の競技部門で利用される対戦型プラットフォーム『CHaser』のNode.js向けクライアントライブラリです。

## 環境構築

### CHaser Serverのダウンロード

[CHaser Server](https://github.com/u16procon/chaser-server/releases) のリリース一覧からダウンロードしてください。zipファイルを展開後、AsahikawaProcon-Server.exe を実行することで起動できます。

### Node.js のインストール

[Node.jsのダウンロードページ](https://nodejs.org/en/download/prebuilt-installer/current) から環境にあった Node.js をインストールしてください。

Windows で Prebuilt Installer 20.17.0 を使って動作確認しています。

### 実行

TCPユーザーの待機開始後、実行後の質問で何も入力せずに 3回Enter入力 することでCOOLとして接続できます。

```sh
# 実行
node sample.js
# デフォルトは 127.0.0.1
サーバーのIPアドレスを入力してください >
# デフォルトは 2009
ポート番号を入力してください >
# デフォルトは test
ユーザー名を入力してください >
```

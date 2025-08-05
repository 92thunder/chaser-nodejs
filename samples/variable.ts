import type { Direction } from "../chaser";

// 数値型
let count = 0;
console.log(count);
count = count + 1;
console.log(count);
count++;
console.log(count);

// 文字列型
let name = "higashi kagurakky";
console.log(name);
name = "yamada taro";
console.log(name);

// オリジナルの型 (Direction)
let direction: Direction = "right";
console.log(direction);
// エラーになる
// direction = "test"
direction = "left";
console.log(direction);

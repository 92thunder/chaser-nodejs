for (let count = 0; count < 10; count++) {
	console.log(count);
}

let count = 0;
while (true) {
	count++;
	if (9 < count) break;
	// countが5の時は次のループへ
	if (count === 5) {
		continue;
	}
	console.log(count);
}

export {};

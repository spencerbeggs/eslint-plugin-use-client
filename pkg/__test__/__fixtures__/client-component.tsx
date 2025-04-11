"use client";

import { useState, useEffect } from "react";

export default function ClientComponent() {
	const [count, setCount] = useState(0);

	useEffect(() => {
		document.title = `Count: ${String(count)}`;
	}, [count]);

	return (
		<button
			onClick={() => {
				setCount(count + 1);
			}}
		>
			{count}
		</button>
	);
}

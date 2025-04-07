"use client";

import React, { useState } from "react";

export function NamedComponent() {
	const [state] = useState(0);
	return <div>{state}</div>;
}

export const AnotherComponent = () => {
	const [count, setCount] = useState(0);
	return (
		<button
			onClick={() => {
				setCount(count + 1);
			}}
		>
			{count}
		</button>
	);
};

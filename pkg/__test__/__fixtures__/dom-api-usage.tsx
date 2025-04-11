import React from "react";

export default function DomApiUsage() {
	function handleClick() {
		document.title = "Clicked";
	}

	return <button onClick={handleClick}>Click me</button>;
}

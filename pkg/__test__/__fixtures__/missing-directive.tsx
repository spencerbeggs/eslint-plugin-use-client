import { useState } from "react";

export default function MissingDirective() {
	const [state] = useState(0);
	return <div>{state}</div>;
}

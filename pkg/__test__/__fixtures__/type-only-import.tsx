import React from "react";
import type { default as ClientComponent } from "./client-component.jsx";

interface Props {
	client: typeof ClientComponent;
}

export default function ServerComponent({ client }: Props) {
	return <div>Server renders: {client.name}</div>;
}

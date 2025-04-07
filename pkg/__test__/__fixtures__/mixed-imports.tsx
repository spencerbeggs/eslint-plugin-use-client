import { useState } from "react";
import { headers, useRouter } from "../__mocks__/next.js";

export default async function MixedImports() {
	const headersList = await headers();
	const [state, setState] = useState(0);
	const router = useRouter();

	return (
		<div>
			{headersList.get("user-agent")}
			<button
				onClick={() => {
					setState(state + 1);
					router.push("/");
				}}
			>
				{state}
			</button>
		</div>
	);
}

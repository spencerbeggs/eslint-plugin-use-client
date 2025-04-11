import { lazy, Suspense } from "react";

const ClientModule = lazy(() => import("./client-module.jsx"));

export default function DynamicImport() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<ClientModule />
		</Suspense>
	);
}

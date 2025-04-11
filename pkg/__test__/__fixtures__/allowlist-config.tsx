import { headers, usePathname, useRouter } from "../__mocks__/next.js";

export default async function AllowlistComponent() {
	const headersList = await headers();
	const router = useRouter();
	const pathname = usePathname();

	return (
		<ul>
			<li>{headersList.get("user-agent")}</li>
			<li>{pathname}</li>
			<li>{router.pathname}</li>
		</ul>
	);
}

// eslint-disable-next-line @typescript-eslint/require-await
export const headers = async () => ({ get: (_key: string) => "mock-user-agent" });
export const useRouter = () => ({
	pathname: "/",
	push: (_pathname: string) => {
		return true;
	}
});
export const usePathname = () => "/";

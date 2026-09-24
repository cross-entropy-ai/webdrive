// The server supplies a relative <base> that resolves to the external mount
// point, including prefixes stripped by a reverse proxy such as code-server.
export function appBasePath(): string {
	return typeof document === "undefined"
		? "/"
		: new URL(document.baseURI).pathname;
}

export function appUrl(path: string): string {
	return `${appBasePath()}${path.replace(/^\/+/, "")}`;
}

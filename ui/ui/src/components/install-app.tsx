import { useEffect, useState } from "react";
import { Button } from "./button";
import { Icon } from "./icon";
import { Modal } from "./modal";

type InstallPrompt = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallApp() {
	const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
	const [installed, setInstalled] = useState(false);
	const [helpOpen, setHelpOpen] = useState(false);
	const [installing, setInstalling] = useState(false);
	useEffect(() => {
		const standalone = window.matchMedia("(display-mode: standalone)");
		const update = () =>
			setInstalled(
				standalone.matches ||
					(navigator as Navigator & { standalone?: boolean }).standalone ===
						true,
			);
		const beforeInstall = (event: Event) => {
			event.preventDefault();
			setPrompt(event as InstallPrompt);
		};
		const onInstalled = () => {
			setInstalled(true);
			setPrompt(null);
			setHelpOpen(false);
		};
		update();
		standalone.addEventListener("change", update);
		window.addEventListener("beforeinstallprompt", beforeInstall);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			standalone.removeEventListener("change", update);
			window.removeEventListener("beforeinstallprompt", beforeInstall);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	const install = async () => {
		if (!prompt) {
			setHelpOpen(true);
			return;
		}
		setInstalling(true);
		try {
			await prompt.prompt();
			const choice = await prompt.userChoice;
			if (choice.outcome === "accepted") setInstalled(true);
		} catch {
			setHelpOpen(true);
		} finally {
			setPrompt(null);
			setInstalling(false);
		}
	};
	if (installed) return null;
	return (
		<>
			<button
				type="button"
				className="icon-btn"
				title="Install Webdrive"
				aria-label="Install Webdrive"
				disabled={installing}
				onClick={() => void install()}
			>
				<Icon icon="solar:download-square-linear" width={19} />
			</button>
			<Modal open={helpOpen} onClose={() => setHelpOpen(false)}>
				<Modal.Header>Install Webdrive</Modal.Header>
				<Modal.Body>
					{!window.isSecureContext ? (
						<p>
							Open Webdrive over HTTPS (or localhost) to install it as an app.
						</p>
					) : (
						<>
							<p>Install Webdrive to open your files in its own app window.</p>
							<ul>
								<li>
									Chrome / Edge: use the address bar install icon or the browser
									menu's install option.
								</li>
								<li>
									iPhone / iPad: open in Safari, tap Share, then Add to Home
									Screen.
								</li>
								<li>Mac Safari: choose File → Add to Dock.</li>
							</ul>
							<p>
								If no install option appears, your browser may not support
								installation or the app may already be installed. File access
								requires a connection to your server.
							</p>
						</>
					)}
					<Button onClick={() => setHelpOpen(false)}>Got it</Button>
				</Modal.Body>
			</Modal>
		</>
	);
}

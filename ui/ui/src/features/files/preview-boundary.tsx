import { Component, type ReactNode } from "react";
import { downloadUrl } from "../../lib/api";

// A failed lazy chunk or document renderer must not take down the file browser.
export class PreviewBoundary extends Component<
	{ path: string; children: ReactNode },
	{ failed: boolean }
> {
	override state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	override render() {
		if (this.state.failed)
			return (
				<div className="datatable-state" role="alert">
					<p>The preview could not be loaded.</p>
					<button
						className="btn btn-ghost"
						onClick={() => window.location.reload()}
					>
						Reload preview
					</button>
					<a className="btn btn-ghost" href={downloadUrl(this.props.path)}>
						Download file
					</a>
				</div>
			);
		return this.props.children;
	}
}

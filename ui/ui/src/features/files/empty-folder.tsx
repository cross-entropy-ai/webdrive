import { Button } from "../../components/button";
import { Icon } from "../../components/icon";

export function EmptyFolder({
	filtered,
	hiddenOnly,
	onShowHidden,
	onClear,
	onUpload,
}: {
	filtered: boolean;
	hiddenOnly: boolean;
	onShowHidden: () => void;
	onClear: () => void;
	onUpload: () => void;
}) {
	return (
		<div className="empty-state">
			<div className="empty-state-icon">
				<Icon
					icon={
						filtered
							? "solar:minimalistic-magnifer-linear"
							: "solar:folder-bold-duotone"
					}
					width={36}
				/>
			</div>
			<h2>
				{filtered
					? "No matching files"
					: hiddenOnly
						? "No visible files"
						: "Room for something new"}
			</h2>
			<p>
				{filtered
					? "Try another name or clear your search."
					: hiddenOnly
						? "This folder only contains hidden files or folders."
						: "Drop files here, or upload something to get started."}
			</p>
			<Button
				variant="primary"
				onClick={filtered ? onClear : hiddenOnly ? onShowHidden : onUpload}
			>
				{filtered
					? "Clear search"
					: hiddenOnly
						? "Show hidden files"
						: "Upload files"}
			</Button>
		</div>
	);
}

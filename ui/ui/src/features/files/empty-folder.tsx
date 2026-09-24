import { Button } from "../../components/button";
import { Icon } from "../../components/icon";

export function EmptyFolder({
	filtered,
	onClear,
	onUpload,
}: {
	filtered: boolean;
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
			<h2>{filtered ? "No matching files" : "Room for something new"}</h2>
			<p>
				{filtered
					? "Try another name or clear your search."
					: "Drop files here, or upload something to get started."}
			</p>
			<Button variant="primary" onClick={filtered ? onClear : onUpload}>
				{filtered ? "Clear search" : "Upload files"}
			</Button>
		</div>
	);
}

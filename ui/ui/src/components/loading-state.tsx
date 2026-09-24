export function LoadingState({ label }: { label: string }) {
	return (
		<div className="loading-state" role="status" aria-label={label}>
			<span className="loading-label">{label}</span>
			<div className="loading-skeleton" aria-hidden="true">
				{[0, 1, 2, 3, 4].map((row) => (
					<div className="skeleton-row" key={row}>
						<span />
						<span />
					</div>
				))}
			</div>
		</div>
	);
}

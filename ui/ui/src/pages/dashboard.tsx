import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { formatBytes } from "../lib/format";

type SystemStats = {
	hostname: string;
	uptime_seconds: number;
	cpu: { count: number; arch: string; os: string; load_average: number[] };
	memory: { total: number; used: number; go_alloc: number; go_sys: number };
	disks: { mount: string; total: number; free: number; used: number }[];
	network: { name: string; addrs: string[] }[];
	go_runtime: { version: string; goroutines: number; num_gc: number };
};

function formatUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (d > 0) return `${d}d ${h}h ${m}m`;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

function pct(used: number, total: number): number {
	if (total === 0) return 0;
	return (used / total) * 100;
}

function barColor(v: number): string {
	if (v > 90) return "var(--danger)";
	if (v > 70) return "var(--warning)";
	return "var(--accent)";
}

function Bar({ value }: { value: number }) {
	return (
		<div className="usage-bar">
			<div
				className="usage-bar-fill"
				style={{
					width: `${Math.min(value, 100)}%`,
					backgroundColor: barColor(value),
				}}
			/>
		</div>
	);
}

function Card({
	icon,
	title,
	children,
}: {
	icon: string;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="stat-card">
			<div className="stat-card-header">
				<Icon icon={icon} width={13} className="text-muted" />
				<span className="text-sm text-muted">{title}</span>
			</div>
			<div className="stat-card-body">{children}</div>
		</div>
	);
}

function Row({
	icon,
	label,
	value,
}: {
	icon?: string;
	label: string;
	value: React.ReactNode;
}) {
	return (
		<div className="stat-row">
			<span className="text-muted stat-row-label">
				{icon && <Icon icon={icon} width={12} />}
				{label}
			</span>
			<span className="font-medium">{value}</span>
		</div>
	);
}

function SectionLabel({ children }: { children: string }) {
	return <div className="dash-section-label">{children}</div>;
}

// Filter to useful addresses: IPv4 and non-link-local IPv6
function filterAddrs(addrs: string[]): string[] {
	return addrs.filter((a) => {
		if (a.startsWith("fe80:")) return false;
		return true;
	});
}

export function Dashboard() {
	const [stats, setStats] = useState<SystemStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const load = () => {
			fetch("/api/system")
				.then((r) => {
					if (!r.ok) throw new Error(r.statusText);
					return r.json() as Promise<SystemStats>;
				})
				.then((d) => {
					if (!cancelled) setStats(d);
				})
				.catch((e) => {
					if (!cancelled) setError(e instanceof Error ? e.message : String(e));
				});
		};
		load();
		const interval = setInterval(load, 5000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []);

	if (error) {
		return (
			<div className="page-shell">
				<div className="error-box">Error: {error}</div>
			</div>
		);
	}

	if (!stats) {
		return (
			<div className="page-shell">
				<div className="datatable-state">loading...</div>
			</div>
		);
	}

	const memPct = pct(stats.memory.used, stats.memory.total);
	const load = stats.cpu.load_average;
	const loadPct = stats.cpu.count > 0 ? (load[0] / stats.cpu.count) * 100 : 0;

	// Filter network interfaces to those with useful addresses
	const netIfaces = stats.network
		.map((iface) => ({ ...iface, addrs: filterAddrs(iface.addrs) }))
		.filter((iface) => iface.addrs.length > 0);

	return (
		<div className="page-shell animate-fadeUp dash-layout">
			{/* ── Overview ── */}
			<SectionLabel>Overview</SectionLabel>
			<div className="stat-grid-3">
				<Card icon="solar:server-square-linear" title="System">
					<div className="stat-rows">
						<Row
							icon="solar:monitor-linear"
							label="Hostname"
							value={stats.hostname}
						/>
						<Row
							icon="solar:cpu-linear"
							label="OS / Arch"
							value={`${stats.cpu.os} / ${stats.cpu.arch}`}
						/>
						<Row
							icon="solar:clock-circle-linear"
							label="Uptime"
							value={formatUptime(stats.uptime_seconds)}
						/>
					</div>
				</Card>

				<Card icon="solar:cpu-bolt-linear" title="CPU">
					<div className="stat-rows">
						<Row
							icon="solar:cpu-linear"
							label="Cores"
							value={stats.cpu.count}
						/>
						<Row
							icon="solar:graph-linear"
							label="Load Avg"
							value={`${load[0]?.toFixed(2)}  ${load[1]?.toFixed(2)}  ${load[2]?.toFixed(2)}`}
						/>
						<Bar value={loadPct} />
						<Row
							icon="solar:tuning-linear"
							label="Load / Cores"
							value={`${loadPct.toFixed(0)}%`}
						/>
					</div>
				</Card>

				<Card icon="solar:slider-vertical-linear" title="Memory">
					<div className="stat-rows">
						<Row
							icon="solar:chart-square-linear"
							label="Used / Total"
							value={`${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`}
						/>
						<Bar value={memPct} />
						<Row
							icon="solar:tuning-linear"
							label="Usage"
							value={`${memPct.toFixed(1)}%`}
						/>
					</div>
				</Card>
			</div>

			{/* ── Storage ── */}
			<SectionLabel>Storage</SectionLabel>
			<div className="stat-grid">
				{stats.disks.map((disk) => {
					const dp = pct(disk.used, disk.total);
					return (
						<Card
							key={disk.mount}
							icon="solar:hard-drive-linear"
							title={disk.mount}
						>
							<div className="stat-rows">
								<Row
									icon="solar:chart-square-linear"
									label="Used / Total"
									value={`${formatBytes(disk.used)} / ${formatBytes(disk.total)}`}
								/>
								<Bar value={dp} />
								<Row
									icon="solar:tuning-linear"
									label="Usage"
									value={`${dp.toFixed(1)}%`}
								/>
								<Row
									icon="solar:inbox-unread-linear"
									label="Free"
									value={formatBytes(disk.free)}
								/>
							</div>
						</Card>
					);
				})}
			</div>

			{/* ── Network ── */}
			{netIfaces.length > 0 && (
				<>
					<SectionLabel>Network</SectionLabel>
					<div className="stat-grid">
						<Card icon="solar:global-linear" title="Interfaces">
							<div className="stat-rows">
								{netIfaces.map((iface) => (
									<Row
										key={iface.name}
										icon="solar:link-linear"
										label={iface.name}
										value={iface.addrs.join(", ")}
									/>
								))}
							</div>
						</Card>
					</div>
				</>
			)}

			{/* ── Runtime ── */}
			<SectionLabel>Runtime</SectionLabel>
			<div className="stat-grid">
				<Card icon="solar:code-linear" title="Go">
					<div className="stat-rows">
						<Row
							icon="solar:tag-linear"
							label="Version"
							value={stats.go_runtime.version}
						/>
						<Row
							icon="solar:bolt-linear"
							label="Goroutines"
							value={stats.go_runtime.goroutines}
						/>
						<Row
							icon="solar:restart-linear"
							label="GC Cycles"
							value={stats.go_runtime.num_gc}
						/>
						<Row
							icon="solar:chart-square-linear"
							label="Alloc"
							value={formatBytes(stats.memory.go_alloc)}
						/>
						<Row
							icon="solar:server-square-linear"
							label="Sys"
							value={formatBytes(stats.memory.go_sys)}
						/>
					</div>
				</Card>
			</div>
		</div>
	);
}

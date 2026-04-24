import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

type SystemStats = {
	hostname: string;
	uptime_seconds: number;
	cpu: { count: number; arch: string; os: string };
	memory: { total: number; used: number; go_alloc: number; go_sys: number };
	disk: { path: string; total: number; free: number; used: number };
};

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	let n = bytes;
	let i = 0;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
	const d = Math.floor(seconds / 86400);
	const h = Math.floor((seconds % 86400) / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (d > 0) return `${d}d ${h}h ${m}m`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

function pct(used: number, total: number): string {
	if (total === 0) return "0";
	return ((used / total) * 100).toFixed(1);
}

function StatCard({
	icon,
	label,
	children,
}: {
	icon: string;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="stat-card">
			<div className="stat-card-header">
				<Icon icon={icon} width={14} className="text-muted" />
				<span className="text-sm text-muted">{label}</span>
			</div>
			<div className="stat-card-body">{children}</div>
		</div>
	);
}

function Bar({ used, total }: { used: number; total: number }) {
	const p = total > 0 ? (used / total) * 100 : 0;
	return (
		<div className="usage-bar">
			<div className="usage-bar-fill" style={{ width: `${p}%` }} />
		</div>
	);
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

	return (
		<div className="page-shell animate-fadeUp">
			<div className="stat-grid">
				<StatCard icon="solar:server-square-linear" label="System">
					<div className="stat-rows">
						<div className="stat-row">
							<span className="text-muted">Hostname</span>
							<span className="font-medium">{stats.hostname}</span>
						</div>
						<div className="stat-row">
							<span className="text-muted">OS / Arch</span>
							<span className="font-medium">{stats.cpu.os} / {stats.cpu.arch}</span>
						</div>
						<div className="stat-row">
							<span className="text-muted">Uptime</span>
							<span className="font-medium">{formatUptime(stats.uptime_seconds)}</span>
						</div>
						<div className="stat-row">
							<span className="text-muted">CPUs</span>
							<span className="font-medium">{stats.cpu.count}</span>
						</div>
					</div>
				</StatCard>

				<StatCard icon="solar:cpu-bolt-linear" label="Memory">
					<div className="stat-rows">
						<div className="stat-row">
							<span className="text-muted">Used / Total</span>
							<span className="font-medium">
								{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}
							</span>
						</div>
						<Bar used={stats.memory.used} total={stats.memory.total} />
						<div className="stat-row">
							<span className="text-muted">Usage</span>
							<span className="font-medium">{pct(stats.memory.used, stats.memory.total)}%</span>
						</div>
						<div className="stat-row">
							<span className="text-muted">Go Alloc</span>
							<span className="text-muted">{formatBytes(stats.memory.go_alloc)}</span>
						</div>
					</div>
				</StatCard>

				<StatCard icon="solar:hard-drive-linear" label={`Disk — ${stats.disk.path}`}>
					<div className="stat-rows">
						<div className="stat-row">
							<span className="text-muted">Used / Total</span>
							<span className="font-medium">
								{formatBytes(stats.disk.used)} / {formatBytes(stats.disk.total)}
							</span>
						</div>
						<Bar used={stats.disk.used} total={stats.disk.total} />
						<div className="stat-row">
							<span className="text-muted">Usage</span>
							<span className="font-medium">{pct(stats.disk.used, stats.disk.total)}%</span>
						</div>
						<div className="stat-row">
							<span className="text-muted">Free</span>
							<span className="font-medium">{formatBytes(stats.disk.free)}</span>
						</div>
					</div>
				</StatCard>
			</div>
		</div>
	);
}

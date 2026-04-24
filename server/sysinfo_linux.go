package server

import (
	"os"
	"strings"
	"syscall"
)

type sysMemory struct {
	total uint64
	used  uint64
}

func getSystemMemory() sysMemory {
	var info syscall.Sysinfo_t
	if err := syscall.Sysinfo(&info); err != nil {
		return sysMemory{}
	}
	unit := uint64(info.Unit)
	total := info.Totalram * unit
	free := (info.Freeram + info.Bufferram) * unit
	return sysMemory{
		total: total,
		used:  total - free,
	}
}

func getLoadAverage() []float64 {
	var info syscall.Sysinfo_t
	if err := syscall.Sysinfo(&info); err != nil {
		return []float64{0, 0, 0}
	}
	// Sysinfo loads are scaled by 65536
	return []float64{
		float64(info.Loads[0]) / 65536.0,
		float64(info.Loads[1]) / 65536.0,
		float64(info.Loads[2]) / 65536.0,
	}
}

func getSystemMounts() []string {
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return []string{"/"}
	}
	var mounts []string
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		mount := fields[1]
		fstype := fields[2]
		// Skip virtual filesystems
		if fstype == "proc" || fstype == "sysfs" || fstype == "devtmpfs" ||
			fstype == "devpts" || fstype == "tmpfs" || fstype == "cgroup" ||
			fstype == "cgroup2" || fstype == "securityfs" || fstype == "debugfs" ||
			fstype == "fusectl" || fstype == "configfs" || fstype == "pstore" ||
			fstype == "hugetlbfs" || fstype == "mqueue" || fstype == "overlay" {
			continue
		}
		mounts = append(mounts, mount)
	}
	if len(mounts) == 0 {
		return []string{"/"}
	}
	return mounts
}

package server

import (
	"os"
	"strconv"
	"strings"
	"syscall"
)

type sysMemory struct {
	total uint64
	used  uint64
}

func getSystemMemory() sysMemory {
	// Try cgroup v2 first (container-aware)
	if mem := getCgroupV2Memory(); mem.total > 0 {
		return mem
	}
	// Try cgroup v1
	if mem := getCgroupV1Memory(); mem.total > 0 {
		return mem
	}
	// Fallback to sysinfo (host-level)
	var info syscall.Sysinfo_t
	if err := syscall.Sysinfo(&info); err != nil {
		return sysMemory{}
	}
	unit := uint64(info.Unit)
	total := info.Totalram * unit
	free := (info.Freeram + info.Bufferram) * unit
	return sysMemory{total: total, used: total - free}
}

func getCgroupV2Memory() sysMemory {
	maxBytes, err := readUint64File("/sys/fs/cgroup/memory.max")
	if err != nil || maxBytes == 0 {
		return sysMemory{}
	}
	// "max" means no limit — fall back to sysinfo
	currentBytes, err := readUint64File("/sys/fs/cgroup/memory.current")
	if err != nil {
		return sysMemory{}
	}
	return sysMemory{total: maxBytes, used: currentBytes}
}

func getCgroupV1Memory() sysMemory {
	maxBytes, err := readUint64File("/sys/fs/cgroup/memory/memory.limit_in_bytes")
	if err != nil || maxBytes == 0 || maxBytes > 1<<62 {
		// Very large value means "no limit"
		return sysMemory{}
	}
	usageBytes, err := readUint64File("/sys/fs/cgroup/memory/memory.usage_in_bytes")
	if err != nil {
		return sysMemory{}
	}
	return sysMemory{total: maxBytes, used: usageBytes}
}

func readUint64File(path string) (uint64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	s := strings.TrimSpace(string(data))
	if s == "max" {
		return 0, nil
	}
	return strconv.ParseUint(s, 10, 64)
}

func getLoadAverage() []float64 {
	// /proc/loadavg works in containers (shows host load, which is standard)
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return []float64{0, 0, 0}
	}
	fields := strings.Fields(string(data))
	result := make([]float64, 3)
	for i := 0; i < 3 && i < len(fields); i++ {
		result[i], _ = strconv.ParseFloat(fields[i], 64)
	}
	return result
}

func getSystemMounts() []string {
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return []string{"/"}
	}
	skipFS := map[string]bool{
		"proc": true, "sysfs": true, "devtmpfs": true, "devpts": true,
		"tmpfs": true, "cgroup": true, "cgroup2": true, "securityfs": true,
		"debugfs": true, "fusectl": true, "configfs": true, "pstore": true,
		"hugetlbfs": true, "mqueue": true,
	}
	skipMounts := map[string]bool{
		"/proc": true, "/sys": true, "/dev": true, "/dev/pts": true,
		"/dev/shm": true, "/dev/mqueue": true,
	}
	var mounts []string
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		mount := fields[1]
		fstype := fields[2]
		if skipFS[fstype] || skipMounts[mount] {
			continue
		}
		// Skip /sys/* and /proc/* submounts
		if strings.HasPrefix(mount, "/sys/") || strings.HasPrefix(mount, "/proc/") {
			continue
		}
		mounts = append(mounts, mount)
	}
	if len(mounts) == 0 {
		return []string{"/"}
	}
	return mounts
}

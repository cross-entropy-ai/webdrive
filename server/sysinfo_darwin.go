package server

import (
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"unsafe"
)

type sysMemory struct {
	total uint64
	used  uint64
}

func getSystemMemory() sysMemory {
	var m sysMemory

	mib := [2]int32{6 /* CTL_HW */, 24 /* HW_MEMSIZE */}
	var size uint64
	length := uintptr(8)
	_, _, _ = syscall.Syscall6(
		syscall.SYS___SYSCTL,
		uintptr(unsafe.Pointer(&mib[0])),
		2,
		uintptr(unsafe.Pointer(&size)),
		uintptr(unsafe.Pointer(&length)),
		0, 0,
	)
	m.total = size

	out, err := exec.Command("vm_stat").Output()
	if err != nil {
		return m
	}
	pageSize := uint64(16384)
	lines := strings.Split(string(out), "\n")
	if strings.Contains(lines[0], "page size of") {
		parts := strings.Fields(lines[0])
		if len(parts) > 0 {
			if ps, err := strconv.ParseUint(parts[len(parts)-1], 10, 64); err == nil {
				pageSize = ps
			}
		}
	}
	pages := map[string]uint64{}
	for _, line := range lines[1:] {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(strings.TrimRight(parts[1], "."))
		if n, err := strconv.ParseUint(val, 10, 64); err == nil {
			pages[key] = n
		}
	}
	active := pages["Pages active"]
	wired := pages["Pages wired down"]
	compressed := pages["Pages occupied by compressor"]
	m.used = (active + wired + compressed) * pageSize

	return m
}

func getLoadAverage() []float64 {
	out, err := exec.Command("sysctl", "-n", "vm.loadavg").Output()
	if err != nil {
		return []float64{0, 0, 0}
	}
	s := strings.Trim(strings.TrimSpace(string(out)), "{}")
	fields := strings.Fields(s)
	result := make([]float64, 3)
	for i := 0; i < 3 && i < len(fields); i++ {
		result[i], _ = strconv.ParseFloat(fields[i], 64)
	}
	return result
}

func getSystemMounts() []string {
	out, err := exec.Command("df", "-P").Output()
	if err != nil {
		return []string{"/"}
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var mounts []string
	for _, line := range lines[1:] {
		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}
		mount := fields[len(fields)-1]
		// Skip virtual/system filesystems
		if strings.HasPrefix(mount, "/dev") || strings.HasPrefix(mount, "/proc") ||
			strings.HasPrefix(mount, "/sys") || mount == "/private/var/vm" {
			continue
		}
		mounts = append(mounts, mount)
	}
	if len(mounts) == 0 {
		return []string{"/"}
	}
	return mounts
}

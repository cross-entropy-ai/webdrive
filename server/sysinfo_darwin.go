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

	// Total memory via sysctl
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

	// Used memory from vm_stat (pages * page_size)
	out, err := exec.Command("vm_stat").Output()
	if err != nil {
		return m
	}
	pageSize := uint64(16384) // default for Apple Silicon
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

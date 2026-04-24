package server

import "syscall"

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

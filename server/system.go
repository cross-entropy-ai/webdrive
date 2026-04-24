package server

import (
	"net/http"
	"os"
	"runtime"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

type cpuInfo struct {
	Count   int    `json:"count"`
	Arch    string `json:"arch"`
	OS      string `json:"os"`
}

type memInfo struct {
	Total     uint64 `json:"total"`
	Used      uint64 `json:"used"`
	GoAlloc   uint64 `json:"go_alloc"`
	GoSys     uint64 `json:"go_sys"`
}

type diskInfo struct {
	Path      string `json:"path"`
	Total     uint64 `json:"total"`
	Free      uint64 `json:"free"`
	Used      uint64 `json:"used"`
}

type systemStats struct {
	Hostname string   `json:"hostname"`
	Uptime   int64    `json:"uptime_seconds"`
	CPU      cpuInfo  `json:"cpu"`
	Memory   memInfo  `json:"memory"`
	Disk     diskInfo `json:"disk"`
}

var startTime = time.Now()

func (h *handler) systemInfo(c *gin.Context) {
	hostname, _ := os.Hostname()

	// CPU
	cpu := cpuInfo{
		Count: runtime.NumCPU(),
		Arch:  runtime.GOARCH,
		OS:    runtime.GOOS,
	}

	// Go runtime memory
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// System memory (platform-specific via sysctl/sysinfo)
	sysMem := getSystemMemory()

	mem := memInfo{
		Total:   sysMem.total,
		Used:    sysMem.used,
		GoAlloc: m.Alloc,
		GoSys:   m.Sys,
	}

	// Disk usage for the served root directory
	var stat syscall.Statfs_t
	disk := diskInfo{Path: h.root}
	if err := syscall.Statfs(h.root, &stat); err == nil {
		disk.Total = stat.Blocks * uint64(stat.Bsize)
		disk.Free = stat.Bavail * uint64(stat.Bsize)
		disk.Used = disk.Total - disk.Free
	}

	c.JSON(http.StatusOK, systemStats{
		Hostname: hostname,
		Uptime:   int64(time.Since(startTime).Seconds()),
		CPU:      cpu,
		Memory:   mem,
		Disk:     disk,
	})
}

package server

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"runtime"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

type cpuInfo struct {
	Count       int       `json:"count"`
	Arch        string    `json:"arch"`
	OS          string    `json:"os"`
	LoadAverage []float64 `json:"load_average"`
}

type memInfo struct {
	Total   uint64 `json:"total"`
	Used    uint64 `json:"used"`
	GoAlloc uint64 `json:"go_alloc"`
	GoSys   uint64 `json:"go_sys"`
}

type diskInfo struct {
	Mount string `json:"mount"`
	Total uint64 `json:"total"`
	Free  uint64 `json:"free"`
	Used  uint64 `json:"used"`
}

type netInterface struct {
	Name  string   `json:"name"`
	Addrs []string `json:"addrs"`
}

type goRuntime struct {
	Version    string `json:"version"`
	Goroutines int    `json:"goroutines"`
	NumGC      uint32 `json:"num_gc"`
}

type systemStats struct {
	Hostname  string         `json:"hostname"`
	Uptime    int64          `json:"uptime_seconds"`
	CPU       cpuInfo        `json:"cpu"`
	Memory    memInfo        `json:"memory"`
	Disks     []diskInfo     `json:"disks"`
	Network   []netInterface `json:"network"`
	GoRuntime goRuntime      `json:"go_runtime"`
}

var startTime = time.Now()

func (h *handler) systemInfo(c *gin.Context) {
	hostname, _ := os.Hostname()

	loadAvg := getLoadAverage()

	cpu := cpuInfo{
		Count:       runtime.NumCPU(),
		Arch:        runtime.GOARCH,
		OS:          runtime.GOOS,
		LoadAverage: loadAvg,
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	sysMem := getSystemMemory()
	mem := memInfo{
		Total:   sysMem.total,
		Used:    sysMem.used,
		GoAlloc: m.Alloc,
		GoSys:   m.Sys,
	}

	disks := getMountedDisks()

	// Network interfaces
	var netIfaces []netInterface
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil || len(addrs) == 0 {
			continue
		}
		var addrStrs []string
		for _, a := range addrs {
			addrStrs = append(addrStrs, a.String())
		}
		netIfaces = append(netIfaces, netInterface{
			Name:  iface.Name,
			Addrs: addrStrs,
		})
	}

	goRT := goRuntime{
		Version:    runtime.Version(),
		Goroutines: runtime.NumGoroutine(),
		NumGC:      m.NumGC,
	}

	c.JSON(http.StatusOK, systemStats{
		Hostname:  hostname,
		Uptime:    int64(time.Since(startTime).Seconds()),
		CPU:       cpu,
		Memory:    mem,
		Disks:     disks,
		Network:   netIfaces,
		GoRuntime: goRT,
	})
}

func getMountedDisks() []diskInfo {
	mounts := getSystemMounts()
	var disks []diskInfo
	seen := make(map[string]bool)
	for _, mount := range mounts {
		var stat syscall.Statfs_t
		if err := syscall.Statfs(mount, &stat); err != nil {
			continue
		}
		total := stat.Blocks * uint64(stat.Bsize)
		if total == 0 {
			continue
		}
		// Deduplicate by total+free to avoid platform-specific Fsid access
		free := stat.Bavail * uint64(stat.Bsize)
		key := fmt.Sprintf("%d-%d", total, free)
		if seen[key] {
			continue
		}
		seen[key] = true
		disks = append(disks, diskInfo{
			Mount: mount,
			Total: total,
			Free:  free,
			Used:  total - free,
		})
	}
	return disks
}

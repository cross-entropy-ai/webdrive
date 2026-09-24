package server

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type handler struct {
	root string
}

func (h *handler) info(c *gin.Context) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}
	c.JSON(http.StatusOK, gin.H{"hostname": hostname, "root": h.root})
}

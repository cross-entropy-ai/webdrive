package server

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type termResize struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func (h *handler) terminalWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Determine shell
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/sh"
	}

	cmd := exec.Command(shell)
	cmd.Dir = h.root
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte("Failed to start shell: "+err.Error()))
		return
	}
	defer ptmx.Close()

	var once sync.Once
	done := make(chan struct{})
	cleanup := func() { once.Do(func() { close(done) }) }

	// PTY → WebSocket
	go func() {
		defer cleanup()
		buf := make([]byte, 32768)
		for {
			n, err := ptmx.Read(buf)
			if err != nil {
				return
			}
			if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				return
			}
		}
	}()

	// WebSocket → PTY
	go func() {
		defer cleanup()
		for {
			mt, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			if mt == websocket.TextMessage {
				// Check for resize messages
				var resize termResize
				if json.Unmarshal(msg, &resize) == nil && resize.Type == "resize" {
					pty.Setsize(ptmx, &pty.Winsize{
						Cols: resize.Cols,
						Rows: resize.Rows,
					})
					continue
				}
			}
			if _, err := ptmx.Write(msg); err != nil {
				return
			}
		}
	}()

	<-done
	cmd.Process.Kill()
	cmd.Wait()
}

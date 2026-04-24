package logger

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

// ANSI Color Codes
const (
	ColorReset  = "\033[0m"
	ColorRed    = "\033[31m"
	ColorGreen  = "\033[32m"
	ColorYellow = "\033[33m"
	ColorBlue   = "\033[34m"
	ColorCyan   = "\033[36m"
	ColorGray   = "\033[90m"
)

func timestamp() string {
	return time.Now().Format("15:04:05")
}

// printf is the base format for all logs: [time] | [prefix] | [msg]
func printf(prefix, color, format string, args ...interface{}) {
	msg := fmt.Sprintf(format, args...)
	fmt.Printf("%s%s%s | %s%-7s%s | %s\n", ColorGray, timestamp(), ColorReset, color, prefix, ColorReset, msg)
}

func Info(format string, args ...interface{}) {
	printf("INFO", ColorBlue, format, args...)
}

func Success(format string, args ...interface{}) {
	printf("SUCCESS", ColorGreen, format, args...)
}

func Warn(format string, args ...interface{}) {
	printf("WARN", ColorYellow, format, args...)
}

func Error(format string, args ...interface{}) {
	printf("ERROR", ColorRed, format, args...)
}

func Fatal(format string, args ...interface{}) {
	printf("FATAL", ColorRed, format, args...)
	os.Exit(1)
}

// Middleware returns a Gin middleware that uses our unified logger format
func Middleware() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		statusColor := param.StatusCodeColor()
		methodColor := param.MethodColor()
		resetColor := param.ResetColor()

		// Build the main message part: status | latency | method path err
		msg := fmt.Sprintf("%s %3d %s | %s%10v%s | %s%-7s%s %s %s",
			statusColor, param.StatusCode, resetColor,
			ColorCyan, param.Latency, ColorReset,
			methodColor, param.Method, resetColor,
			param.Path,
			param.ErrorMessage,
		)

		return fmt.Sprintf("%s%s%s | %s%-7s%s | %s\n",
			ColorGray, param.TimeStamp.Format("15:04:05"), ColorReset,
			ColorCyan, "GIN", ColorReset,
			msg,
		)
	})
}

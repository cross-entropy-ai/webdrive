BIN       := webdrive
CMD       := ./cmd/webdrive
UI_DIR    := ui/ui
DIST_DIR  := $(UI_DIR)/dist

# Colors and formatting
CYAN   := \033[1;36m
GREEN  := \033[1;32m
YELLOW := \033[1;33m
NC     := \033[0m

# Step loggers
step    = printf "$(CYAN)➜ %s$(NC)\n" $(1)
success = printf "$(GREEN)✓ %s$(NC)\n" $(1)

.PHONY: all help deps fmt build build-ui build-server clean

all: help

## help: display this help message
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@awk '/^[a-zA-Z\-\_0-9:]+:/ { \
		helpMessage = match(lastLine, /^## (.*)/); \
		if (helpMessage) { \
			helpCommand = $$1; sub(/:$$/, "", helpCommand); \
			helpMessage = substr(lastLine, RSTART + 3, RLENGTH); \
			printf "  $(CYAN)%-15s$(NC) %s\n", helpCommand, helpMessage; \
		} \
	} \
	{ lastLine = $$0 }' $(MAKEFILE_LIST)

## deps: install UI dependencies and tidy Go modules
deps:
	@if [ ! -d $(UI_DIR)/node_modules ]; then \
	  $(call step, "Installing UI dependencies..."); \
	  cd $(UI_DIR) && bun install; \
	  $(call success, "UI dependencies installed"); \
	fi
	@$(call step, "Tidying Go modules...")
	@go mod tidy
	@$(call success, "Go modules tidied")

## fmt: format Go code (go fmt) and frontend code (biome via bun)
fmt: deps
	@$(call step, "Formatting code...")
	@go fmt ./...
	@cd $(UI_DIR) && bun run fmt
	@$(call success, "Code formatting completed")

## build: build the UI into ui/ui/dist, then compile the single binary
build: build-ui build-server
	@$(call success, "Successfully built $(BIN)")

## build-ui: build the React frontend into ui/ui/dist
build-ui: deps
	@$(call step, "Building UI frontend...")
	@rm -rf $(DIST_DIR)
	@mkdir -p $(DIST_DIR)
	@touch $(DIST_DIR)/.gitkeep
	@cd $(UI_DIR) && bunx @tailwindcss/cli -i ./src/index.css -o ./src/tailwind.css --minify
	@cd $(UI_DIR) && bun build ./src/index.html \
	  --outdir=dist \
	  --target=browser \
	  --minify \
	  --define:process.env.NODE_ENV='"production"'
	@$(call success, "UI build completed")

## build-server: compile the Go binary (assumes UI is already in ui/ui/dist)
build-server:
	@$(call step, "Compiling Go backend...")
	@go build -o $(BIN) $(CMD)
	@$(call success, "Backend compiled")

## clean: remove build artifacts (keeps dist/.gitkeep so \`go build\` still works)
clean:
	@$(call step, "Cleaning build artifacts...")
	@rm -f $(BIN)
	@rm -rf $(DIST_DIR)
	@mkdir -p $(DIST_DIR)
	@touch $(DIST_DIR)/.gitkeep
	@$(call success, "Clean completed")

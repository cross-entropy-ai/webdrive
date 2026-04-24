BIN       := webdrive
CMD       := ./cmd/webdrive
UI_DIR    := ui/ui
DIST_DIR  := $(UI_DIR)/dist

.PHONY: all build ui backend install-ui dev clean fmt tidy

all: build

## build: build the UI into ui/ui/dist, then compile the single binary
build: ui backend

## ui: install deps (if needed) and build the React frontend into ui/ui/dist
ui: install-ui
	rm -rf $(DIST_DIR)
	mkdir -p $(DIST_DIR)
	touch $(DIST_DIR)/.gitkeep
	cd $(UI_DIR) && bun build ./src/index.html \
	  --outdir=dist \
	  --target=browser \
	  --minify \
	  --define:process.env.NODE_ENV='"production"'

install-ui:
	@if [ ! -d $(UI_DIR)/node_modules ]; then \
	  cd $(UI_DIR) && bun install; \
	fi

## backend: compile the Go binary (assumes UI is already in ui/ui/dist)
backend:
	go build -o $(BIN) $(CMD)

## dev: run the Go backend with `go run`
dev:
	go run $(CMD)

## fmt: format Go code (go fmt) and frontend code (biome via bun)
fmt: install-ui
	go fmt ./...
	cd $(UI_DIR) && bun run fmt

tidy:
	go mod tidy

## clean: remove build artifacts (keeps dist/.gitkeep so `go build` still works)
clean:
	rm -f $(BIN)
	rm -rf $(DIST_DIR)
	mkdir -p $(DIST_DIR)
	touch $(DIST_DIR)/.gitkeep

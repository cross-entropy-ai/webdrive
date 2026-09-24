package server

import (
	"context"
	"encoding/json"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

const searchLimit = 100

type searchEntry struct {
	Name          string `json:"name"`
	Path          string `json:"path"`
	RelativePath  string `json:"relative_path"`
	IsDir         bool   `json:"is_dir"`
	score         float64
	filenameMatch bool
}

type searchResponse struct {
	Entries []searchEntry `json:"entries"`
	HasMore bool          `json:"has_more"`
	Partial bool          `json:"partial"`
}

func (h *handler) search(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if utf8.RuneCountInString(query) > 128 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "search query is too long"})
		return
	}
	scope := normalize(c.Query("path"))
	full, err := h.resolve(scope)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Do not traverse symlink directories outside the configured workspace.
	full, err = filepath.EvalSymlinks(full)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "search folder is unavailable"})
		return
	}
	root, err := filepath.EvalSymlinks(h.root)
	rel, relErr := filepath.Rel(root, full)
	if err != nil || relErr != nil || !validRelPath(rel) {
		c.JSON(http.StatusForbidden, gin.H{"error": "search folder is outside the workspace"})
		return
	}
	info, err := os.Stat(full)
	if err != nil || !info.IsDir() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "not a directory"})
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	c.Header("Cache-Control", "no-store")
	if c.Query("stream") != "1" {
		c.JSON(http.StatusOK, searchTree(ctx, full, scope, query, searchLimit))
		return
	}
	// Flush an initial frame and progressive results so large trees do not hold
	// the UI waiting for a complete scan. Every request has its own cancellable
	// HTTP goroutine; unrelated listings and previews remain independent.
	c.Header("Content-Type", "application/x-ndjson")
	c.Header("X-Accel-Buffering", "no")
	encoder := json.NewEncoder(c.Writer)
	emit := func(result searchResponse, done bool) {
		if err := encoder.Encode(struct {
			searchResponse
			Done bool `json:"done"`
		}{result, done}); err != nil {
			cancel()
			return
		}
		c.Writer.Flush()
	}
	emit(searchResponse{Entries: []searchEntry{}}, false)
	result := searchTreeProgress(ctx, full, scope, query, searchLimit, func(result searchResponse) { emit(result, false) })
	if c.Request.Context().Err() == nil {
		emit(result, true)
	}
}

// Walk names only, without opening file contents or following symlinks. Keep
// just the best results, but continue scanning so late matches can rank first.
func searchTree(ctx context.Context, full, scope, query string, limit int) searchResponse {
	return searchTreeProgress(ctx, full, scope, query, limit, nil)
}

func searchTreeProgress(ctx context.Context, full, scope, query string, limit int, progress func(searchResponse)) searchResponse {
	result := searchResponse{Entries: []searchEntry{}}
	var lastEmission time.Time
	needle := []rune(strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return unicode.ToLower(r)
	}, query))
	if len(needle) == 0 || limit <= 0 {
		return result
	}
	err := filepath.WalkDir(full, func(filename string, entry fs.DirEntry, err error) error {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err != nil {
			result.Partial = true
			return nil
		}
		if filename == full || entry.Type()&os.ModeSymlink != 0 {
			return nil
		}
		rel, err := filepath.Rel(full, filename)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		score, matched := fuzzyScore(entry.Name(), needle)
		filenameMatch := matched
		if !matched {
			score, matched = fuzzyScore(rel, needle)
		}
		if !matched {
			return nil
		}
		candidate := searchEntry{Name: entry.Name(), Path: path.Join(scope, rel), RelativePath: rel, IsDir: entry.IsDir(), score: score, filenameMatch: filenameMatch}
		index := sort.Search(len(result.Entries), func(i int) bool {
			other := result.Entries[i]
			if candidate.filenameMatch != other.filenameMatch {
				return candidate.filenameMatch
			}
			if candidate.score != other.score {
				return candidate.score > other.score
			}
			return candidate.RelativePath < other.RelativePath
		})
		if len(result.Entries) == limit {
			result.HasMore = true
		}
		if index < limit {
			result.Entries = append(result.Entries, searchEntry{})
			copy(result.Entries[index+1:], result.Entries[index:])
			result.Entries[index] = candidate
			if len(result.Entries) > limit {
				result.Entries = result.Entries[:limit]
			}
		}
		if progress != nil && time.Since(lastEmission) >= 120*time.Millisecond {
			progress(result)
			lastEmission = time.Now()
		}
		return nil
	})
	if err != nil || ctx.Err() != nil {
		result.Partial = true
	}
	return result
}

// Same subsequence scoring as the current-folder finder, over Unicode runes.
func fuzzyScore(name string, needle []rune) (float64, bool) {
	letters := []rune(name)
	if len(needle) > len(letters) {
		return 0, false
	}
	best, matched := 0.0, false
	for start, r := range letters {
		if unicode.ToLower(r) != needle[0] {
			continue
		}
		cursor, previous, count, score := start, -1, 0, 0.0
		for _, wanted := range needle {
			for cursor < len(letters) && unicode.ToLower(letters[cursor]) != wanted {
				cursor++
			}
			if cursor == len(letters) {
				break
			}
			boundary := cursor == 0
			if cursor > 0 {
				before := letters[cursor-1]
				boundary = unicode.IsSpace(before) || strings.ContainsRune("._-/", before) || (before >= 'a' && before <= 'z' && letters[cursor] >= 'A' && letters[cursor] <= 'Z')
			}
			score += 10
			if boundary {
				score += 12
			}
			if previous >= 0 {
				if cursor == previous+1 {
					score += 18
				}
				score -= float64(cursor - previous - 1)
			}
			previous = cursor
			cursor++
			count++
		}
		if count != len(needle) {
			continue
		}
		score -= float64(start*2) + float64(len(letters))*0.01
		if start == 0 {
			score += 30
		}
		if len(needle) == len(letters) {
			score += 100
		}
		if !matched || score > best {
			best, matched = score, true
		}
	}
	return best, matched
}

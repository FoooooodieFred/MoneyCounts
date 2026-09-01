package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/FoooooodieFred/MoneyCounts/internal/store"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx       context.Context
	storePath string
	flushMu   sync.Mutex
	flushDone chan struct{}
}

type OpenedFile struct {
	Name      string `json:"name"`
	Contents  string `json:"contents"`
	Size      int    `json:"size"`
	Cancelled bool   `json:"cancelled"`
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	path, err := store.Path()
	if err != nil {
		path = filepath.Join(".", "MoneyCounts", "store.json")
	}
	a.storePath = path
}

func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	done := make(chan struct{}, 1)
	a.flushMu.Lock()
	a.flushDone = done
	a.flushMu.Unlock()
	runtime.EventsEmit(ctx, "moneycounts:before-close")
	select {
	case <-done:
	case <-time.After(2 * time.Second):
	}
	return false
}

func (a *App) NotifyFlushed() {
	a.flushMu.Lock()
	defer a.flushMu.Unlock()
	if a.flushDone == nil {
		return
	}
	select {
	case a.flushDone <- struct{}{}:
	default:
	}
}

func (a *App) LoadStore() (string, error) {
	data, err := store.Read(a.storePath)
	if err != nil {
		return store.EmptyStoreJSON, err
	}
	return string(data), nil
}

func (a *App) SaveStore(contents string) error {
	return store.Write(a.storePath, []byte(contents))
}

type StoreInfo struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

func (a *App) StoreInfo() StoreInfo {
	size, err := store.FileSize(a.storePath)
	if err != nil {
		return StoreInfo{Path: a.storePath, Size: 0}
	}
	return StoreInfo{Path: a.storePath, Size: size}
}

func (a *App) OpenURL(url string) {
	if a.ctx == nil || strings.TrimSpace(url) == "" {
		return
	}
	runtime.BrowserOpenURL(a.ctx, url)
}

func (a *App) SaveTextFile(defaultFilename string, contents string) (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFilename,
		Title:           "保存文件",
	})
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(path) == "" {
		return "", nil
	}
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		return "", err
	}
	return path, nil
}

func (a *App) OpenTextFile(filterPattern string) (OpenedFile, error) {
	pattern := strings.TrimSpace(filterPattern)
	if pattern == "" {
		pattern = "*.*"
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "打开文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "Files", Pattern: pattern},
		},
	})
	if err != nil {
		return OpenedFile{}, err
	}
	if strings.TrimSpace(path) == "" {
		return OpenedFile{Cancelled: true}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return OpenedFile{}, err
	}
	return OpenedFile{
		Name:     filepath.Base(path),
		Contents: string(data),
		Size:     len(data),
	}, nil
}

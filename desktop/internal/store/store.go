package store

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const (
	AppName        = "MoneyCounts"
	StoreFileName  = "store.json"
	EmptyStoreJSON = `{"app":"MoneyCounts","kind":"desktop-store","version":1,"keys":{}}`
)

type File struct {
	App     string            `json:"app"`
	Kind    string            `json:"kind"`
	Version int               `json:"version"`
	Keys    map[string]string `json:"keys"`
}

func Path() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, AppName, StoreFileName), nil
}

func Read(path string) ([]byte, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []byte(EmptyStoreJSON), nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return []byte(EmptyStoreJSON), nil
	}
	return data, nil
}

func FileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, nil
		}
		return 0, err
	}
	return info.Size(), nil
}

func Write(path string, data []byte) error {
	if !json.Valid(data) {
		return fmt.Errorf("store contents are not valid JSON")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, "store-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer func() {
		_ = os.Remove(tmpName)
	}()
	if err := tmp.Chmod(0o600); err != nil {
		// Windows and some filesystems ignore Unix modes; still write the file.
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		_ = os.Remove(path)
		if err2 := os.Rename(tmpName, path); err2 != nil {
			return err
		}
	}
	_ = os.Chmod(path, 0o600)
	return nil
}

package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

const LocationFileName = "store-location.json"

type locationFile struct {
	Path string `json:"path"`
}

func DefaultPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, AppName, StoreFileName), nil
}

func LocationConfigPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, AppName, LocationFileName), nil
}

func ResolveCustomPath(def, custom string) string {
	trimmed := strings.TrimSpace(custom)
	if trimmed == "" || !filepath.IsAbs(trimmed) {
		return def
	}
	return trimmed
}

func Path() (string, error) {
	def, err := DefaultPath()
	if err != nil {
		return "", err
	}
	locFile, err := LocationConfigPath()
	if err != nil {
		return def, nil
	}
	data, err := os.ReadFile(locFile)
	if err != nil {
		return def, nil
	}
	var parsed locationFile
	if json.Unmarshal(data, &parsed) != nil {
		return def, nil
	}
	return ResolveCustomPath(def, parsed.Path), nil
}

func SaveLocation(path string) error {
	locFile, err := LocationConfigPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(locFile), 0o700); err != nil {
		return err
	}
	payload, err := json.Marshal(locationFile{Path: path})
	if err != nil {
		return err
	}
	return os.WriteFile(locFile, payload, 0o600)
}

func ClearLocation() error {
	locFile, err := LocationConfigPath()
	if err != nil {
		return err
	}
	if err := os.Remove(locFile); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

package store

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteThenRead(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "store.json")
	payload := []byte(`{"app":"MoneyCounts","kind":"desktop-store","version":1,"keys":{"a":"1"}}`)
	if err := Write(path, payload); err != nil {
		t.Fatal(err)
	}
	got, err := Read(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(payload) {
		t.Fatalf("got %s", got)
	}
}

func TestReadMissingReturnsEmptyStore(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing.json")
	got, err := Read(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != EmptyStoreJSON {
		t.Fatalf("got %s", got)
	}
}

func TestWriteRejectsInvalidJSON(t *testing.T) {
	path := filepath.Join(t.TempDir(), "store.json")
	if err := Write(path, []byte("not-json")); err == nil {
		t.Fatal("expected error")
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("file should not exist, err=%v", err)
	}
}

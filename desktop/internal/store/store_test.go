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

func TestFileSizeMissingIsZero(t *testing.T) {
	got, err := FileSize(filepath.Join(t.TempDir(), "missing.json"))
	if err != nil {
		t.Fatal(err)
	}
	if got != 0 {
		t.Fatalf("got %d", got)
	}
}

func TestResolveCustomPath(t *testing.T) {
	def := "/tmp/default/store.json"
	if got := ResolveCustomPath(def, ""); got != def {
		t.Fatalf("empty: %s", got)
	}
	if got := ResolveCustomPath(def, "relative.json"); got != def {
		t.Fatalf("relative: %s", got)
	}
	custom := "/var/ledger/store.json"
	if got := ResolveCustomPath(def, custom); got != custom {
		t.Fatalf("abs: %s", got)
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

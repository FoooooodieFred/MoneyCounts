package llmproxy

import "testing"

func TestNormalizeChatCompletionsURL(t *testing.T) {
	cases := map[string]string{
		"https://api.openai.com/v1":                          "https://api.openai.com/v1/chat/completions",
		"https://api.openai.com/v1/":                         "https://api.openai.com/v1/chat/completions",
		"https://api.openai.com/v1/chat/completions":         "https://api.openai.com/v1/chat/completions",
		"https://api.minimax.chat/v1/text/chatcompletion_v2": "https://api.minimax.chat/v1/text/chatcompletion_v2",
	}
	for input, want := range cases {
		if got := NormalizeChatCompletionsURL(input); got != want {
			t.Fatalf("%s: got %s want %s", input, got, want)
		}
	}
}

func TestIsAllowedLlmBaseURL(t *testing.T) {
	if !IsAllowedLlmBaseURL("https://api.openai.com/v1") {
		t.Fatal("https should be allowed")
	}
	if !IsAllowedLlmBaseURL("http://localhost:11434/v1") {
		t.Fatal("localhost http should be allowed")
	}
	if IsAllowedLlmBaseURL("http://example.com/v1") {
		t.Fatal("remote http should be rejected")
	}
	if IsAllowedLlmBaseURL("https://user:pass@api.openai.com/v1") {
		t.Fatal("userinfo should be rejected")
	}
}

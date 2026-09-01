// Package llmproxy ports src/lib/llmProxy.ts for the Wails asset server.
// Keep URL allowlist, timeouts, and payload limits in sync with the TypeScript copy.
package llmproxy

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	maxMessages         = 24
	maxMessageChars     = 20_000
	maxCompletionTokens = 16_384
	requestTimeout      = 120 * time.Second
)

var localHosts = map[string]struct{}{
	"localhost": {},
	"127.0.0.1": {},
	"[::1]":     {},
	"::1":       {},
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatBody struct {
	BaseURL     string        `json:"baseUrl"`
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	Temperature *float64      `json:"temperature"`
	JSONMode    *bool         `json:"jsonMode"`
	MaxTokens   *int          `json:"maxTokens"`
}

func NormalizeChatCompletionsURL(baseURL string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	lower := strings.ToLower(trimmed)
	if strings.HasSuffix(lower, "/chat/completions") {
		return trimmed
	}
	if strings.HasSuffix(lower, "/chatcompletion_v2") {
		return trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err == nil {
		path := strings.TrimRight(parsed.Path, "/")
		if path == "" {
			path = "/"
		}
		if path != "/" && path != "/v1" && !strings.HasSuffix(path, "/v1") {
			return trimmed
		}
	}
	return trimmed + "/chat/completions"
}

func IsAllowedLlmBaseURL(baseURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || parsed.Host == "" {
		return false
	}
	if parsed.User != nil {
		return false
	}
	switch parsed.Scheme {
	case "https":
		return parsed.Hostname() != ""
	case "http":
		host := parsed.Hostname()
		_, ok := localHosts[host]
		return ok
	default:
		return false
	}
}

func jsonError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func isChatRole(role string) bool {
	return role == "system" || role == "user" || role == "assistant"
}

func HandleLlmChat(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	apiKey := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(apiKey) >= 7 && strings.EqualFold(apiKey[:7], "Bearer ") {
		apiKey = strings.TrimSpace(apiKey[7:])
	}
	if apiKey == "" {
		jsonError(w, "缺少 API Key。", http.StatusUnauthorized)
		return
	}

	var body chatBody
	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(&body); err != nil {
		jsonError(w, "请求体不是合法 JSON。", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(body.BaseURL) == "" {
		jsonError(w, "请提供 API Base URL。", http.StatusBadRequest)
		return
	}
	if !IsAllowedLlmBaseURL(body.BaseURL) {
		jsonError(w, "API 地址只允许 https，或本机 http://localhost。", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Model) == "" {
		jsonError(w, "请提供模型名。", http.StatusBadRequest)
		return
	}
	if len(body.Messages) == 0 {
		jsonError(w, "messages 不能为空。", http.StatusBadRequest)
		return
	}
	if len(body.Messages) > maxMessages {
		jsonError(w, "messages 过多。", http.StatusBadRequest)
		return
	}
	for _, message := range body.Messages {
		if !isChatRole(message.Role) {
			jsonError(w, "message.role / content 无效。", http.StatusBadRequest)
			return
		}
		if len(message.Content) > maxMessageChars {
			jsonError(w, "单条 message 过长。", http.StatusBadRequest)
			return
		}
	}

	temperature := 0.0
	if body.Temperature != nil {
		temperature = *body.Temperature
	}
	payload := map[string]any{
		"model":       strings.TrimSpace(body.Model),
		"messages":    body.Messages,
		"temperature": temperature,
		"stream":      false,
	}
	jsonMode := true
	if body.JSONMode != nil {
		jsonMode = *body.JSONMode
	}
	if jsonMode {
		payload["response_format"] = map[string]string{"type": "json_object"}
	}
	if body.MaxTokens != nil && *body.MaxTokens > 0 {
		tokens := *body.MaxTokens
		if tokens > maxCompletionTokens {
			tokens = maxCompletionTokens
		}
		payload["max_tokens"] = tokens
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		jsonError(w, "无法连接模型接口。", http.StatusBadGateway)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, NormalizeChatCompletionsURL(body.BaseURL), bytes.NewReader(raw))
	if err != nil {
		jsonError(w, "无法连接模型接口。", http.StatusBadGateway)
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: requestTimeout}
	resp, err := client.Do(req)
	if err != nil {
		if r.Context().Err() != nil || strings.Contains(strings.ToLower(err.Error()), "timeout") {
			jsonError(w, "模型请求超时。", http.StatusGatewayTimeout)
			return
		}
		jsonError(w, "无法连接模型接口。", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	text, err := io.ReadAll(resp.Body)
	if err != nil {
		jsonError(w, "无法连接模型接口。", http.StatusBadGateway)
		return
	}
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json; charset=utf-8"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(text)
}

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if q := strings.Index(path, "?"); q >= 0 {
			path = path[:q]
		}
		if path != "/api/llm/chat" {
			next.ServeHTTP(w, r)
			return
		}
		HandleLlmChat(w, r)
	})
}

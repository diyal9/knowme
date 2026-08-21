package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"

	"knowme/server/internal/config"
	"knowme/server/internal/handler"
	"knowme/server/internal/store"
)

const defaultFeishuAllowlist = "feishu.search_docs, feishu.read_doc, feishu.list_wiki_spaces, feishu.list_wiki_nodes, feishu.get_wiki_node"

func testEngine(t *testing.T, adminKey string) (*httptest.Server, store.Store) {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	st, err := store.OpenSQLite(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		Listen:       ":0",
		AdminKey:     adminKey,
		DBDriver:     "sqlite",
		DBDSN:        dbPath,
		RateLimitRPS: 1000,
	}
	engine := handler.NewEngine(cfg, st)
	srv := httptest.NewServer(engine)
	t.Cleanup(func() {
		srv.Close()
		_ = st.Close()
	})
	return srv, st
}

func TestHealthzAndPublicConfig(t *testing.T) {
	srv, _ := testEngine(t, "secret")
	res, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("healthz status=%d", res.StatusCode)
	}
	if res.Header.Get("X-Request-Id") == "" {
		t.Fatal("missing request id")
	}

	res2, err := http.Get(srv.URL + "/v1/config/public")
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	var body map[string]any
	_ = json.NewDecoder(res2.Body).Decode(&body)
	if body["ok"] != true {
		t.Fatalf("expected ok public config: %#v", body)
	}
}

func noRedirectClient() *http.Client {
	return &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func TestWebLoginRedirects(t *testing.T) {
	srv, st := testEngine(t, "dev-key")
	ctx := context.Background()
	if err := st.EnsureSeedUser(ctx, "admin", "pass123", store.RoleAdmin); err != nil {
		t.Fatal(err)
	}
	res, err := noRedirectClient().Get(srv.URL + "/admin/config")
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatalf("expected redirect to login, got %d", res.StatusCode)
	}
}

func TestWebLoginSession(t *testing.T) {
	srv, st := testEngine(t, "dev-key")
	ctx := context.Background()
	if err := st.EnsureSeedUser(ctx, "admin", "pass123", store.RoleAdmin); err != nil {
		t.Fatal(err)
	}
	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 1 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
	form := url.Values{"username": {"admin"}, "password": {"pass123"}}
	res, err := client.PostForm(srv.URL+"/admin/login", form)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatalf("login status=%d", res.StatusCode)
	}
	res2, err := client.Get(srv.URL + "/admin/config")
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("config page status=%d", res2.StatusCode)
	}
}

func TestPutPublicConfigRequiresAdminKey(t *testing.T) {
	srv, _ := testEngine(t, "dev-key")
	payload, _ := json.Marshal(map[string]any{"feature_flags": map[string]any{"beta": true}})
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/v1/admin/config/public", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.StatusCode)
	}

	req2, _ := http.NewRequest(http.MethodPut, srv.URL+"/v1/admin/config/public", bytes.NewReader(payload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Admin-Key", "dev-key")
	res2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatal(err)
	}
	defer res2.Body.Close()
	if res2.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res2.StatusCode)
	}
	var saved map[string]any
	_ = json.NewDecoder(res2.Body).Decode(&saved)
	cfg, _ := saved["config"].(map[string]any)
	flags, _ := cfg["feature_flags"].(map[string]any)
	if flags["beta"] != true {
		t.Fatalf("unexpected config: %#v", saved)
	}
}

func TestProductActivationAndMe(t *testing.T) {
	srv, _ := testEngine(t, "dev-key")
	createBody := bytes.NewBufferString(`{"plan_id":"trial","count":1}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/admin/activation-codes", createBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Key", "dev-key")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("create code status=%d", res.StatusCode)
	}
	var created struct {
		Items []struct {
			Code string `json:"Code"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	if len(created.Items) != 1 || created.Items[0].Code == "" {
		t.Fatalf("unexpected codes: %#v", created)
	}

	body, _ := json.Marshal(map[string]string{"code": created.Items[0].Code, "device_id": "device-test-1"})
	activationRes, err := http.Post(srv.URL+"/v1/activation/activate", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer activationRes.Body.Close()
	if activationRes.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(activationRes.Body)
		t.Fatalf("activation status=%d body=%s", activationRes.StatusCode, raw)
	}
	var activation struct {
		Token string `json:"access_token"`
	}
	if err := json.NewDecoder(activationRes.Body).Decode(&activation); err != nil {
		t.Fatal(err)
	}
	if activation.Token == "" {
		t.Fatal("missing access token")
	}

	meReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+activation.Token)
	meRes, err := http.DefaultClient.Do(meReq)
	if err != nil {
		t.Fatal(err)
	}
	defer meRes.Body.Close()
	if meRes.StatusCode != http.StatusOK {
		t.Fatalf("me status=%d", meRes.StatusCode)
	}
	usageReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/usage/events", bytes.NewBufferString(`{"request_id":"req-1","model":"gpt-4o-mini","business_type":"code","prompt_tokens":12,"completion_tokens":8}`))
	usageReq.Header.Set("Content-Type", "application/json")
	usageReq.Header.Set("Authorization", "Bearer "+activation.Token)
	usageRes, err := http.DefaultClient.Do(usageReq)
	if err != nil {
		t.Fatal(err)
	}
	defer usageRes.Body.Close()
	if usageRes.StatusCode != http.StatusAccepted {
		t.Fatalf("usage status=%d", usageRes.StatusCode)
	}
	quotaReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/quota", nil)
	quotaReq.Header.Set("Authorization", "Bearer "+activation.Token)
	quotaRes, err := http.DefaultClient.Do(quotaReq)
	if err != nil {
		t.Fatal(err)
	}
	defer quotaRes.Body.Close()
	if quotaRes.StatusCode != http.StatusOK {
		t.Fatalf("quota status=%d", quotaRes.StatusCode)
	}
	var quota struct {
		Data struct {
			DailyUsed int64 `json:"DailyUsed"`
		} `json:"quota"`
	}
	if err := json.NewDecoder(quotaRes.Body).Decode(&quota); err != nil {
		t.Fatal(err)
	}
	if quota.Data.DailyUsed != 20 {
		t.Fatalf("unexpected quota: %#v", quota)
	}

	modelsRes, err := http.Get(srv.URL + "/v1/models")
	if err != nil {
		t.Fatal(err)
	}
	defer modelsRes.Body.Close()
	if modelsRes.StatusCode != http.StatusOK {
		t.Fatalf("models status=%d", modelsRes.StatusCode)
	}
}

func TestProductActivationRequiresDeviceLimit(t *testing.T) {
	srv, _ := testEngine(t, "dev-key")
	createBody := bytes.NewBufferString(`{"plan_id":"trial","count":1}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/admin/activation-codes", createBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Key", "dev-key")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var created struct {
		Items []struct {
			Code string `json:"Code"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	code := created.Items[0].Code
	activate := func(device string) int {
		body, _ := json.Marshal(map[string]string{"code": code, "device_id": device})
		response, err := http.Post(srv.URL+"/v1/activation/activate", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		return response.StatusCode
	}
	if status := activate("device-one"); status != http.StatusOK {
		t.Fatalf("first activation status=%d", status)
	}
	if status := activate("device-two"); status != http.StatusUnauthorized {
		t.Fatalf("second activation status=%d", status)
	}
}

func TestChatCompletionsRecordsProviderUsage(t *testing.T) {
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer provider-key" {
			t.Fatalf("missing provider authorization")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chat-1","choices":[{"message":{"role":"assistant","content":"hello"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`))
	}))
	defer provider.Close()
	t.Setenv("KNOWME_OPENAI_BASE_URL", provider.URL)
	t.Setenv("KNOWME_OPENAI_API_KEY", "provider-key")
	srv, _ := testEngine(t, "dev-key")
	createBody := bytes.NewBufferString(`{"plan_id":"trial","count":1}`)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/admin/activation-codes", createBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Admin-Key", "dev-key")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var created struct {
		Items []struct {
			Code string `json:"Code"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]string{"code": created.Items[0].Code, "device_id": "gateway-device"})
	activationRes, err := http.Post(srv.URL+"/v1/activation/activate", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer activationRes.Body.Close()
	var activation struct {
		Token string `json:"access_token"`
	}
	if err := json.NewDecoder(activationRes.Body).Decode(&activation); err != nil {
		t.Fatal(err)
	}
	chatReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/chat/completions", bytes.NewBufferString(`{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}`))
	chatReq.Header.Set("Content-Type", "application/json")
	chatReq.Header.Set("Authorization", "Bearer "+activation.Token)
	chatRes, err := http.DefaultClient.Do(chatReq)
	if err != nil {
		t.Fatal(err)
	}
	defer chatRes.Body.Close()
	if chatRes.StatusCode != http.StatusOK {
		t.Fatalf("chat status=%d", chatRes.StatusCode)
	}
	quotaReq, _ := http.NewRequest(http.MethodGet, srv.URL+"/v1/quota", nil)
	quotaReq.Header.Set("Authorization", "Bearer "+activation.Token)
	quotaRes, err := http.DefaultClient.Do(quotaReq)
	if err != nil {
		t.Fatal(err)
	}
	defer quotaRes.Body.Close()
	var quota struct {
		Data struct {
			DailyUsed int64 `json:"DailyUsed"`
		} `json:"quota"`
	}
	if err := json.NewDecoder(quotaRes.Body).Decode(&quota); err != nil {
		t.Fatal(err)
	}
	if quota.Data.DailyUsed != 15 {
		t.Fatalf("expected 15 used tokens, got %#v", quota)
	}
}

func TestWebConfigSavesFeishuAllowlistFromMultiSelect(t *testing.T) {
	srv, st := testEngine(t, "dev-key")
	ctx := context.Background()
	if err := st.EnsureSeedUser(ctx, "admin", "pass123", store.RoleAdmin); err != nil {
		t.Fatal(err)
	}

	jar, _ := cookiejar.New(nil)
	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 1 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}

	loginForm := url.Values{"username": {"admin"}, "password": {"pass123"}}
	loginRes, err := client.PostForm(srv.URL+"/admin/login", loginForm)
	if err != nil {
		t.Fatal(err)
	}
	loginRes.Body.Close()
	if loginRes.StatusCode != http.StatusFound {
		t.Fatalf("login status=%d", loginRes.StatusCode)
	}

	saveForm := url.Values{
		"provider":         {"dashscope"},
		"model":            {"qwen-plus"},
		"endpoint":         {"https://example/v1/chat/completions"},
		"feature_flags":    {"{}"},
		"feishu_allowlist": {""},
	}
	saveForm.Add("feishu_allowlist_items", "feishu.search_docs")
	saveForm.Add("feishu_allowlist_items", "feishu.get_wiki_node")
	saveRes, err := client.PostForm(srv.URL+"/admin/config", saveForm)
	if err != nil {
		t.Fatal(err)
	}
	saveRes.Body.Close()
	if saveRes.StatusCode != http.StatusOK {
		t.Fatalf("save status=%d", saveRes.StatusCode)
	}

	publicRes, err := http.Get(srv.URL + "/v1/config/public")
	if err != nil {
		t.Fatal(err)
	}
	defer publicRes.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(publicRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	cfg, _ := payload["config"].(map[string]any)
	policy, _ := cfg["connector_policy"].(map[string]any)
	allowlist, _ := policy["feishu_allowlist"].(string)
	if allowlist != "feishu.search_docs, feishu.get_wiki_node" {
		t.Fatalf("unexpected allowlist: %q", allowlist)
	}

	saveForm = url.Values{
		"provider":         {"dashscope"},
		"model":            {"qwen-plus"},
		"endpoint":         {"https://example/v1/chat/completions"},
		"feature_flags":    {"{}"},
		"feishu_allowlist": {""},
	}
	saveRes, err = client.PostForm(srv.URL+"/admin/config", saveForm)
	if err != nil {
		t.Fatal(err)
	}
	saveRes.Body.Close()
	if saveRes.StatusCode != http.StatusOK {
		t.Fatalf("save status=%d", saveRes.StatusCode)
	}

	publicRes, err = http.Get(srv.URL + "/v1/config/public")
	if err != nil {
		t.Fatal(err)
	}
	defer publicRes.Body.Close()
	payload = map[string]any{}
	if err := json.NewDecoder(publicRes.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	cfg, _ = payload["config"].(map[string]any)
	policy, _ = cfg["connector_policy"].(map[string]any)
	allowlist, _ = policy["feishu_allowlist"].(string)
	if allowlist != defaultFeishuAllowlist {
		t.Fatalf("expected default allowlist, got %q", allowlist)
	}
}

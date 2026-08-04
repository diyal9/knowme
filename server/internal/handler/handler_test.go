package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
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
		"provider":        {"dashscope"},
		"model":           {"qwen-plus"},
		"endpoint":        {"https://example/v1/chat/completions"},
		"feature_flags":   {"{}"},
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
		"provider":        {"dashscope"},
		"model":           {"qwen-plus"},
		"endpoint":        {"https://example/v1/chat/completions"},
		"feature_flags":   {"{}"},
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

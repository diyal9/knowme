package handler

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"knowme/server/internal/store"
	"knowme/server/web"
)

const sessionCookie = web.SessionCookie
const sessionTTL = 24 * time.Hour

var feishuAllowlistToolOrder = []string{
	"feishu.search_docs",
	"feishu.read_doc",
	"feishu.list_wiki_spaces",
	"feishu.list_wiki_nodes",
	"feishu.get_wiki_node",
}

var feishuAllowlistToolLabels = map[string]string{
	"feishu.search_docs":      "搜索文档（feishu.search_docs）",
	"feishu.read_doc":         "读取文档（feishu.read_doc）",
	"feishu.list_wiki_spaces": "列出知识库空间（feishu.list_wiki_spaces）",
	"feishu.list_wiki_nodes":  "列出知识库节点（feishu.list_wiki_nodes）",
	"feishu.get_wiki_node":    "获取知识库节点（feishu.get_wiki_node）",
}

func (s *Server) registerWeb(r *gin.Engine) {
	staticSub, _ := fs.Sub(web.FS, "static")
	r.StaticFS("/admin/static", http.FS(staticSub))

	tpl := template.Must(template.ParseFS(web.FS, "templates/*.html"))

	r.GET("/admin/login", func(c *gin.Context) {
		if _, ok := s.currentUser(c); ok {
			c.Redirect(http.StatusFound, "/admin/config")
			return
		}
		_ = tpl.ExecuteTemplate(c.Writer, "login.html", gin.H{"Error": c.Query("error")})
	})

	r.POST("/admin/login", func(c *gin.Context) {
		user, pass := strings.TrimSpace(c.PostForm("username")), c.PostForm("password")
		u, err := s.store.AuthenticateUser(c.Request.Context(), user, pass)
		if err != nil {
			_ = tpl.ExecuteTemplate(c.Writer, "login.html", gin.H{"Error": "用户名或密码错误"})
			return
		}
		sid, err := s.store.CreateSession(c.Request.Context(), u.ID, sessionTTL)
		if err != nil {
			c.String(http.StatusInternalServerError, "session error")
			return
		}
		c.SetCookie(sessionCookie, sid, int(sessionTTL.Seconds()), "/", "", false, true)
		c.Redirect(http.StatusFound, "/admin/config")
	})

	r.POST("/admin/logout", s.requireWebAuth(), func(c *gin.Context) {
		if sid, err := c.Cookie(sessionCookie); err == nil {
			_ = s.store.DeleteSession(c.Request.Context(), sid)
		}
		c.SetCookie(sessionCookie, "", -1, "/", "", false, true)
		c.Redirect(http.StatusFound, "/admin/login")
	})

	r.GET("/admin", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/admin/dashboard")
	})

	adminWeb := r.Group("/admin")
	adminWeb.Use(s.requireWebAuth())
	adminWeb.GET("/dashboard", func(c *gin.Context) {
		plans, _ := s.store.ListPlans(c.Request.Context())
		activations, _ := s.store.ListActivations(c.Request.Context())
		models, _ := s.store.ListModels(c.Request.Context(), true)
		_ = tpl.ExecuteTemplate(c.Writer, "dashboard.html", gin.H{"User": s.webUser(c), "Plans": plans, "Activations": activations, "Models": models, "Saved": c.Query("saved") == "1", "Error": c.Query("error")})
	})
	adminWeb.GET("/activation-codes", func(c *gin.Context) {
		plans, _ := s.store.ListPlans(c.Request.Context())
		_ = tpl.ExecuteTemplate(c.Writer, "activation-codes.html", gin.H{"User": s.webUser(c), "Plans": plans, "Codes": c.QueryArray("code"), "Error": c.Query("error")})
	})
	adminWeb.POST("/activations/:id/status", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/dashboard?error=无权限")
			return
		}
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err == nil {
			err = s.store.SetActivationStatus(c.Request.Context(), id, c.PostForm("status"))
		}
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/dashboard?error="+url.QueryEscape(err.Error()))
			return
		}
		c.Redirect(http.StatusFound, "/admin/dashboard?saved=1")
	})
	adminWeb.POST("/activations/:id/extend", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/dashboard?error=无权限")
			return
		}
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		days, parseErr := strconv.Atoi(c.PostForm("days"))
		if err == nil && parseErr == nil {
			err = s.store.ExtendActivation(c.Request.Context(), id, days)
		} else if err == nil {
			err = parseErr
		}
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/dashboard?error="+url.QueryEscape(err.Error()))
			return
		}
		c.Redirect(http.StatusFound, "/admin/dashboard?saved=1")
	})
	adminWeb.POST("/activation-codes", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/activation-codes?error=无权限")
			return
		}
		count := 1
		if n, err := strconv.Atoi(c.PostForm("count")); err == nil {
			count = n
		}
		items, err := s.store.CreateActivationCodes(c.Request.Context(), strings.TrimSpace(c.PostForm("plan_id")), count, nil)
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/activation-codes?error="+url.QueryEscape(err.Error()))
			return
		}
		query := "?"
		for _, item := range items {
			query += "code=" + url.QueryEscape(item.Code) + "&"
		}
		c.Redirect(http.StatusFound, "/admin/activation-codes"+query)
	})
	adminWeb.GET("/models", func(c *gin.Context) {
		models, _ := s.store.ListModels(c.Request.Context(), true)
		_ = tpl.ExecuteTemplate(c.Writer, "models.html", gin.H{"User": s.webUser(c), "Models": models, "Saved": c.Query("saved") == "1", "Error": c.Query("error")})
	})
	adminWeb.GET("/usage", func(c *gin.Context) {
		summary, _ := s.store.GetUsageSummary(c.Request.Context(), nil, nil)
		_ = tpl.ExecuteTemplate(c.Writer, "usage.html", gin.H{"User": s.webUser(c), "Summary": summary})
	})
	adminWeb.GET("/announcements", func(c *gin.Context) {
		items, _ := s.store.ListAnnouncements(c.Request.Context(), false)
		_ = tpl.ExecuteTemplate(c.Writer, "announcements.html", gin.H{"User": s.webUser(c), "Items": items, "Saved": c.Query("saved") == "1", "Error": c.Query("error")})
	})
	adminWeb.POST("/announcements", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/announcements?error=无权限")
			return
		}
		_, err := s.store.CreateAnnouncement(c.Request.Context(), store.Announcement{Title: c.PostForm("title"), Body: c.PostForm("body"), Level: c.PostForm("level"), MinVersion: c.PostForm("min_version"), Published: c.PostForm("published") == "on"})
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/announcements?error="+url.QueryEscape(err.Error()))
			return
		}
		c.Redirect(http.StatusFound, "/admin/announcements?saved=1")
	})
	adminWeb.GET("/version-policy", func(c *gin.Context) {
		policy, _ := s.store.GetVersionPolicy(c.Request.Context())
		_ = tpl.ExecuteTemplate(c.Writer, "version-policy.html", gin.H{"User": s.webUser(c), "Policy": policy, "Saved": c.Query("saved") == "1", "Error": c.Query("error")})
	})
	adminWeb.GET("/providers", func(c *gin.Context) {
		providers, _ := s.store.ListProviders(c.Request.Context())
		_ = tpl.ExecuteTemplate(c.Writer, "providers.html", gin.H{"User": s.webUser(c), "Providers": providers, "Saved": c.Query("saved") == "1", "Error": c.Query("error")})
	})
	adminWeb.POST("/providers", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/providers?error=无权限")
			return
		}
		priority := 100
		if n, err := strconv.Atoi(c.PostForm("priority")); err == nil {
			priority = n
		}
		err := s.store.UpsertProvider(c.Request.Context(), store.Provider{ID: c.PostForm("id"), Label: c.PostForm("label"), BaseURL: c.PostForm("base_url"), Priority: priority, Enabled: c.PostForm("enabled") == "on"})
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/providers?error="+url.QueryEscape(err.Error()))
			return
		}
		c.Redirect(http.StatusFound, "/admin/providers?saved=1")
	})
	adminWeb.POST("/version-policy", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/version-policy?error=无权限")
			return
		}
		_, err := s.store.SetVersionPolicy(c.Request.Context(), store.VersionPolicy{LatestVersion: c.PostForm("latest_version"), MinimumVersion: c.PostForm("minimum_version"), ForceUpdate: c.PostForm("force_update") == "on", DownloadURL: c.PostForm("download_url"), ReleaseNotes: c.PostForm("release_notes")})
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/version-policy?error="+url.QueryEscape(err.Error()))
			return
		}
		c.Redirect(http.StatusFound, "/admin/version-policy?saved=1")
	})
	adminWeb.POST("/models", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/models?error=无权限")
			return
		}
		model := store.Model{ID: strings.TrimSpace(c.PostForm("id")), Label: strings.TrimSpace(c.PostForm("label")), Provider: strings.TrimSpace(c.PostForm("provider")), ContextWindow: 32768, MaxOutput: 4096, SupportsTools: c.PostForm("supports_tools") == "on", Enabled: c.PostForm("enabled") == "on", RequiredPlan: strings.TrimSpace(c.PostForm("required_plan"))}
		if n, err := strconv.Atoi(c.PostForm("context_window")); err == nil && n > 0 {
			model.ContextWindow = n
		}
		if n, err := strconv.Atoi(c.PostForm("max_output")); err == nil && n > 0 {
			model.MaxOutput = n
		}
		if err := s.store.UpsertModel(c.Request.Context(), model); err != nil {
			c.Redirect(http.StatusFound, "/admin/models?error="+url.QueryEscape(err.Error()))
			return
		}
		c.Redirect(http.StatusFound, "/admin/models?saved=1")
	})
	adminWeb.GET("/config", func(c *gin.Context) {
		u := s.webUser(c)
		data := s.configFormData(c, u, false, "", "")
		_ = tpl.ExecuteTemplate(c.Writer, "config.html", data)
	})
	adminWeb.POST("/config", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			data := s.configFormData(c, u, false, "", "无写入权限")
			_ = tpl.ExecuteTemplate(c.Writer, "config.html", data)
			return
		}
		cfg, err := s.buildConfigFromForm(c)
		if err != nil {
			data := s.configFormData(c, u, false, "", err.Error())
			_ = tpl.ExecuteTemplate(c.Writer, "config.html", data)
			return
		}
		pc, err := s.store.SetPublicConfig(c.Request.Context(), cfg)
		if err != nil {
			data := s.configFormData(c, u, false, "", "保存失败")
			_ = tpl.ExecuteTemplate(c.Writer, "config.html", data)
			return
		}
		data := s.configFormData(c, u, true, pc.UpdatedAt.Format(time.RFC3339), "")
		_ = tpl.ExecuteTemplate(c.Writer, "config.html", data)
	})
	adminWeb.GET("/users", func(c *gin.Context) {
		u := s.webUser(c)
		users, _ := s.store.ListUsers(c.Request.Context())
		_ = tpl.ExecuteTemplate(c.Writer, "users.html", gin.H{
			"User":      u,
			"Users":     users,
			"CanManage": u.Role == store.RoleAdmin,
			"UserError": c.Query("error"),
			"UserSaved": c.Query("saved") == "1",
		})
	})
	adminWeb.POST("/users", func(c *gin.Context) {
		u := s.webUser(c)
		if u.Role != store.RoleAdmin {
			c.Redirect(http.StatusFound, "/admin/users?error=无权限")
			return
		}
		err := s.store.CreateUser(c.Request.Context(),
			strings.TrimSpace(c.PostForm("username")),
			c.PostForm("password"),
			c.PostForm("role"),
		)
		if err != nil {
			c.Redirect(http.StatusFound, "/admin/users?error=创建失败（可能重名）")
			return
		}
		c.Redirect(http.StatusFound, "/admin/users?saved=1")
	})
}

func (s *Server) requireWebAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, ok := s.currentUser(c); !ok {
			c.Redirect(http.StatusFound, "/admin/login")
			c.Abort()
			return
		}
		c.Next()
	}
}

func (s *Server) currentUser(c *gin.Context) (store.User, bool) {
	sid, err := c.Cookie(sessionCookie)
	if err != nil || sid == "" {
		return store.User{}, false
	}
	u, err := s.store.UserBySession(c.Request.Context(), sid)
	if err != nil {
		return store.User{}, false
	}
	c.Set("webUser", u)
	return u, true
}

func (s *Server) webUser(c *gin.Context) store.User {
	if v, ok := c.Get("webUser"); ok {
		if u, ok := v.(store.User); ok {
			return u
		}
	}
	u, _ := s.currentUser(c)
	return u
}

func (s *Server) configFormData(c *gin.Context, u store.User, saved bool, updatedAt, errMsg string) gin.H {
	pc, _ := s.store.GetPublicConfig(c.Request.Context())
	cfg := pc.Config
	profile, _ := cfg["model_profile"].(map[string]any)
	flags, _ := cfg["feature_flags"].(map[string]any)
	policy, _ := cfg["connector_policy"].(map[string]any)
	flagsJSON, _ := json.MarshalIndent(flags, "", "  ")
	allowlist := ""
	if policy != nil {
		if v, ok := policy["feishu_allowlist"].(string); ok {
			allowlist = v
		}
	}
	allowlistOptions, allowlistValue := feishuAllowlistOptions(allowlist)
	return gin.H{
		"User":             u,
		"CanWrite":         u.Role == store.RoleAdmin,
		"Provider":         strField(profile, "provider"),
		"Model":            strField(profile, "model"),
		"Endpoint":         strField(profile, "endpoint"),
		"FeatureFlagsJSON": string(flagsJSON),
		"FeishuAllowlist":  allowlistValue,
		"FeishuTools":      allowlistOptions,
		"Saved":            saved,
		"UpdatedAt":        updatedAt,
		"Error":            errMsg,
	}
}

func strField(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func (s *Server) buildConfigFromForm(c *gin.Context) (map[string]any, error) {
	pc, err := s.store.GetPublicConfig(c.Request.Context())
	if err != nil {
		return nil, err
	}
	cfg := clonePublicConfig(pc.Config)
	profile := map[string]any{
		"provider": strings.TrimSpace(c.PostForm("provider")),
		"model":    strings.TrimSpace(c.PostForm("model")),
		"endpoint": strings.TrimSpace(c.PostForm("endpoint")),
	}
	cfg["model_profile"] = profile
	flagsRaw := strings.TrimSpace(c.PostForm("feature_flags"))
	if flagsRaw == "" {
		cfg["feature_flags"] = map[string]any{}
	} else {
		var flags map[string]any
		if err := json.Unmarshal([]byte(flagsRaw), &flags); err != nil {
			return nil, err
		}
		cfg["feature_flags"] = flags
	}
	allowlistItems := normalizeFeishuAllowlist(c.PostFormArray("feishu_allowlist_items"), c.PostForm("feishu_allowlist"))
	cfg["connector_policy"] = map[string]any{
		"feishu_allowlist": strings.Join(allowlistItems, ", "),
	}
	return cfg, nil
}

func feishuAllowlistOptions(raw string) ([]gin.H, string) {
	selected := normalizeFeishuAllowlist(nil, raw)
	if len(selected) == 0 {
		selected = append([]string{}, feishuAllowlistToolOrder...)
	}

	selectedSet := make(map[string]struct{}, len(selected))
	for _, item := range selected {
		selectedSet[item] = struct{}{}
	}

	options := make([]gin.H, 0, len(feishuAllowlistToolOrder))
	for _, name := range feishuAllowlistToolOrder {
		_, ok := selectedSet[name]
		options = append(options, gin.H{
			"Name":     name,
			"Label":    feishuAllowlistToolLabels[name],
			"Selected": ok,
		})
	}

	for _, name := range selected {
		if _, known := feishuAllowlistToolLabels[name]; known {
			continue
		}
		options = append(options, gin.H{
			"Name":     name,
			"Label":    fmt.Sprintf("自定义工具（%s）", name),
			"Selected": true,
		})
	}

	return options, strings.Join(selected, ", ")
}

func normalizeFeishuAllowlist(selected []string, fallbackCSV string) []string {
	rawItems := selected
	if len(rawItems) == 0 {
		rawItems = strings.Split(fallbackCSV, ",")
	}

	seen := map[string]struct{}{}
	normalizedInput := make([]string, 0, len(rawItems))
	for _, item := range rawItems {
		name := strings.TrimSpace(item)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		normalizedInput = append(normalizedInput, name)
	}
	if len(normalizedInput) == 0 {
		return append([]string{}, feishuAllowlistToolOrder...)
	}

	ordered := make([]string, 0, len(normalizedInput))
	added := map[string]struct{}{}
	for _, name := range feishuAllowlistToolOrder {
		if _, ok := seen[name]; ok {
			ordered = append(ordered, name)
			added[name] = struct{}{}
		}
	}
	for _, name := range normalizedInput {
		if _, ok := added[name]; ok {
			continue
		}
		ordered = append(ordered, name)
	}
	return ordered
}

func clonePublicConfig(src map[string]any) map[string]any {
	if src == nil {
		return map[string]any{}
	}
	b, _ := json.Marshal(src)
	var out map[string]any
	_ = json.Unmarshal(b, &out)
	if out == nil {
		return map[string]any{}
	}
	return out
}

package handler

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
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
		c.Redirect(http.StatusFound, "/admin/config")
	})

	adminWeb := r.Group("/admin")
	adminWeb.Use(s.requireWebAuth())
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
			"User":        u,
			"Users":       users,
			"CanManage":   u.Role == store.RoleAdmin,
			"UserError":   c.Query("error"),
			"UserSaved":   c.Query("saved") == "1",
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
		"User":              u,
		"CanWrite":          u.Role == store.RoleAdmin,
		"Provider":          strField(profile, "provider"),
		"Model":             strField(profile, "model"),
		"Endpoint":          strField(profile, "endpoint"),
		"FeatureFlagsJSON":  string(flagsJSON),
		"FeishuAllowlist":   allowlistValue,
		"FeishuTools":       allowlistOptions,
		"Saved":             saved,
		"UpdatedAt":         updatedAt,
		"Error":             errMsg,
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

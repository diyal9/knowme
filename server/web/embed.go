package web

import "embed"

//go:embed templates/* static/*
var FS embed.FS

const SessionCookie = "km_admin_session"

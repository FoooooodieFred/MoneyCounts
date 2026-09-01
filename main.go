package main

import (
	"embed"

	"github.com/FoooooodieFred/MoneyCounts/internal/llmproxy"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:            "MoneyCounts",
		Width:            1280,
		Height:           840,
		MinWidth:         960,
		MinHeight:        640,
		BackgroundColour: &options.RGBA{R: 226, G: 235, B: 240, A: 255},
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: llmproxy.Middleware,
		},
		OnStartup:     app.startup,
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			About: &mac.AboutInfo{
				Title:   "MoneyCounts",
				Message: "本地优先记账本",
			},
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})
	if err != nil {
		println("Error:", err.Error())
	}
}

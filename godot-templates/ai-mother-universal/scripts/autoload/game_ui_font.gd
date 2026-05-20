extends Node
## Web/桌面统一 UI 字体（含简体中文）

var regular: Font

const FONT_PATH := "res://fonts/NotoSansSC-Regular.woff2"


func _ready() -> void:
	_load()


func _load() -> void:
	if regular:
		return
	if not ResourceLoader.exists(FONT_PATH):
		push_warning("GameUIFont: missing %s — CJK labels will show tofu" % FONT_PATH)
		return
	var f := load(FONT_PATH)
	if f is Font:
		regular = f
	elif f is FontFile:
		regular = f


func apply_label(label: Label) -> void:
	if label == null:
		return
	_load()
	if regular:
		label.add_theme_font_override("font", regular)


func apply_labels(labels: Array) -> void:
	for n in labels:
		if n is Label:
			apply_label(n as Label)

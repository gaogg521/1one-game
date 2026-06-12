extends Node2D
## 汽车涂色定制

const PALETTE := [Color.RED, Color.ORANGE, Color.YELLOW, Color.GREEN, Color.CYAN, Color.BLUE, Color.PURPLE, Color.PINK, Color.WHITE, Color("#1e293b")]

var _hud := GameHud.new()
var _body := Color.RED
var _wheel := Color.BLACK
var _bg := Color("#38bdf8")
var _part := "body"
var _edits := 0
var _ended := false


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_body = GameSpecData.theme_color("playerColor", Color.RED)
	_wheel = GameSpecData.theme_color("hazardColor", Color.BLACK)
	_bg = GameSpecData.theme_color("backgroundColor", Color.CYAN)
	for i in range(PALETTE.size()):
		var sw := ColorRect.new()
		sw.color = PALETTE[i]
		sw.size = Vector2(28, 28)
		sw.position = Vector2(16 + i * 34, 480)
		sw.mouse_filter = Control.MOUSE_FILTER_STOP
		sw.gui_input.connect(_pick_color.bind(PALETTE[i]))
		add_child(sw)
	_hud.set_extra("点选 车身/轮毂/背景 后点调色盘 · 完成 5 次涂色过关")
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(0, 0, 920, 560), _bg)
	var cx := 460.0
	var cy := 240.0
	draw_rect(Rect2(cx - 90, cy - 30, 180, 50), _body)
	draw_circle(Vector2(cx - 55, cy + 28), 18, _wheel)
	draw_circle(Vector2(cx + 55, cy + 28), 18, _wheel)
	draw_rect(Rect2(cx - 20, cy - 22, 50, 22), Color("#bae6fd"))


func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed:
		return
	match event.keycode:
		KEY_1:
			_part = "body"
		KEY_2:
			_part = "wheel"
		KEY_3:
			_part = "bg"


func _pick_color(event: InputEvent, col: Color) -> void:
	if _ended or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed:
		return
	match _part:
		"body":
			_body = col
		"wheel":
			_wheel = col
		"bg":
			_bg = col
	_edits += 1
	queue_redraw()
	_hud.set_score("涂色 %d/5 · 当前编辑 %s" % [_edits, _part])
	if _edits >= 5:
		_finish(true)


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("定制完成", "")

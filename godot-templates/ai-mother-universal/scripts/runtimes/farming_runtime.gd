extends Node2D
## 网格种植：播种 / 浇水 / 收获

enum TileState { EMPTY, SEEDED, GROWING, READY }

var _hud := GameHud.new()
var _cols := 4
var _rows := 4
var _coins := 50
var _harvests := 0
var _goal := 8
var _cell := 72.0
var _ox := 120.0
var _oy := 100.0
var _states: Array = []
var _progress: Array = []
var _crop_ids: Array = []
var _selected := 0
var _ended := false
var _tiles: Node2D


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var f := GameSpecData.farming()
	_cols = int(f.get("cols", 4))
	_rows = int(f.get("rows", 4))
	_coins = int(f.get("startingCoins", 50))
	_goal = int(f.get("harvestGoal", 8))
	_tiles = Node2D.new()
	add_child(_tiles)
	for i in range(_cols * _rows):
		_states.append(TileState.EMPTY)
		_progress.append(0.0)
		_crop_ids.append("")
	_build_tiles()
	_refresh_hud()
	_hud.set_extra("点击空地播种 · 生长中点击浇水 · 成熟点击收获 · 空格切换种子")


func _build_tiles() -> void:
	for ch in _tiles.get_children():
		ch.queue_free()
	for r in range(_rows):
		for c in range(_cols):
			var idx := r * _cols + c
			var btn := ColorRect.new()
			btn.color = Color("#365314")
			btn.size = Vector2(_cell - 6, _cell - 6)
			btn.position = Vector2(_ox + c * _cell, _oy + r * _cell)
			btn.mouse_filter = Control.MOUSE_FILTER_STOP
			btn.gui_input.connect(_on_tile.bind(idx))
			btn.set_meta("idx", idx)
			_tiles.add_child(btn)


func _on_tile(event: InputEvent, idx: int) -> void:
	if _ended or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed:
		return
	var st: int = _states[idx]
	if st == TileState.EMPTY:
		if _coins < 5:
			_hud.show_banner("金币不足", "")
			return
		_coins -= 5
		_states[idx] = TileState.SEEDED
		_crop_ids[idx] = "carrot"
	elif st == TileState.SEEDED:
		_states[idx] = TileState.GROWING
		_progress[idx] = 0.0
	elif st == TileState.GROWING:
		_progress[idx] = minf(1.0, _progress[idx] + 0.35)
		if _progress[idx] >= 1.0:
			_states[idx] = TileState.READY
	elif st == TileState.READY:
		_coins += 12
		_harvests += 1
		_states[idx] = TileState.EMPTY
		_crop_ids[idx] = ""
		if _harvests >= _goal:
			_finish(true)
	_refresh_hud()
	_paint_tiles()


func _paint_tiles() -> void:
	var i := 0
	for ch in _tiles.get_children():
		if ch is ColorRect:
			var st: int = _states[i]
			match st:
				TileState.EMPTY:
					ch.color = Color("#365314")
				TileState.SEEDED:
					ch.color = Color("#15803d").lerp(Color.WHITE, 0.3)
				TileState.GROWING:
					ch.color = Color("#22c55e").lerp(Color.WHITE, 0.2)
				TileState.READY:
					ch.color = Color("#fde047")
		i += 1


func _process(delta: float) -> void:
	if _ended:
		return
	for idx in range(_states.size()):
		if _states[idx] == TileState.GROWING:
			_progress[idx] += delta / 5.0
			if _progress[idx] >= 1.0:
				_states[idx] = TileState.READY
				_paint_tiles()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_SPACE:
		_selected = (_selected + 1) % 3


func _refresh_hud() -> void:
	_hud.set_score("收获 %d/%d · 金币 %d" % [_harvests, _goal, _coins])


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("农场目标达成" if won else "继续加油", "")

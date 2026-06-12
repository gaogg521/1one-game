extends Node2D
## 益智：match3 邻接同色消除（读 GameSpec.puzzle）

const COLORS := [Color("#f472b6"), Color("#a78bfa"), Color("#38bdf8"), Color("#4ade80"), Color("#fbbf24")]

var _hud := GameHud.new()
var _grid: Array = []
var _cols := 7
var _rows := 7
var _cell := 44.0
var _ox := 80.0
var _oy := 100.0
var _score := 0
var _moves := 0
var _move_limit := 30
var _target := 100
var _ended := false
var _cells: Node2D


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var p := GameSpecData.puzzle()
	_cols = int(p.get("cols", 7))
	_rows = int(p.get("rows", 7))
	_target = int(p.get("targetScore", 100))
	_move_limit = int(p.get("moveLimit", 30))
	_cells = Node2D.new()
	add_child(_cells)
	_init_grid()
	_draw_grid()
	_hud.set_extra("点击 2+ 相邻同色块消除 · 目标 %d 分" % _target)


func _init_grid() -> void:
	_grid.clear()
	for r in range(_rows):
		var row: Array = []
		for c in range(_cols):
			row.append(randi() % COLORS.size())
		_grid.append(row)


func _draw_grid() -> void:
	for ch in _cells.get_children():
		ch.queue_free()
	for r in range(_rows):
		for c in range(_cols):
			var v: int = _grid[r][c]
			if v < 0:
				continue
			var rect := ColorRect.new()
			rect.color = COLORS[v]
			rect.size = Vector2(_cell - 4, _cell - 4)
			rect.position = Vector2(_ox + c * _cell + 2, _oy + r * _cell + 2)
			rect.mouse_filter = Control.MOUSE_FILTER_STOP
			rect.set_meta("r", r)
			rect.set_meta("c", c)
			rect.gui_input.connect(_on_cell_input.bind(r, c))
			_cells.add_child(rect)


func _on_cell_input(event: InputEvent, r: int, c: int) -> void:
	if _ended or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	var color: int = _grid[r][c]
	if color < 0:
		return
	var group := _flood(r, c, color, {})
	if group.size() < 2:
		return
	for key in group:
		var parts: PackedStringArray = str(key).split(",")
		_grid[int(parts[0])][int(parts[1])] = -1
	_collapse()
	_score += group.size() * group.size() * 3
	_moves += 1
	_hud.set_score("得分 %d · 步数 %d/%d" % [_score, _moves, _move_limit])
	GameJuice.burst(self, Vector2(_ox + c * _cell, _oy + r * _cell), COLORS[color], mini(group.size(), 12))
	_draw_grid()
	if _score >= _target:
		_finish(true)
	elif _moves >= _move_limit:
		_finish(false)


func _flood(r: int, c: int, color: int, seen: Dictionary) -> Dictionary:
	var key := "%d,%d" % [r, c]
	if seen.has(key):
		return seen
	if r < 0 or c < 0 or r >= _rows or c >= _cols:
		return seen
	if _grid[r][c] != color:
		return seen
	seen[key] = true
	_flood(r - 1, c, color, seen)
	_flood(r + 1, c, color, seen)
	_flood(r, c - 1, color, seen)
	_flood(r, c + 1, color, seen)
	return seen


func _collapse() -> void:
	for c in range(_cols):
		var stack: Array = []
		for r in range(_rows - 1, -1, -1):
			if _grid[r][c] >= 0:
				stack.append(_grid[r][c])
		for r in range(_rows):
			var idx := _rows - 1 - r
			_grid[r][c] = stack[idx] if idx < stack.size() else randi() % COLORS.size()


func _finish(won: bool) -> void:
	if _ended:
		return
	_ended = true
	_hud.show_banner("益智完成" if won else "步数用尽", "得分 %d" % _score)

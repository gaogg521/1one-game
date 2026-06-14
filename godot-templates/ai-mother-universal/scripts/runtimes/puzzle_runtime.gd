extends Node2D
## 益智 Secondary：match3 3D · 找不同/翻牌/拼图 2D overlay（读 samplePlayProfile）

const COLORS := [Color("#f472b6"), Color("#a78bfa"), Color("#38bdf8"), Color("#4ade80"), Color("#fbbf24")]

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport
@onready var _viewport_container: SubViewportContainer = $ViewportContainer

var _hud := GameHud.new()
var _camera: Camera3D
var _overlay: Control
var _mode := "match3"
var _profile: Dictionary = {}

var _grid: Array = []
var _cols := 7
var _rows := 7
var _cell := 0.62
var _score := 0
var _moves := 0
var _move_limit := 30
var _target := 100
var _ended := false
var _cell_nodes: Array[MeshInstance3D] = []
var _bloom_scale := 1.0
var _memory_timer_sec := 0.0
var _memory_timer_left := 0.0
var _memory_timer_warned := false

var _diff_marks: Array[bool] = []
var _found_diff := 0
var _cards: Array[Dictionary] = []
var _flipped: Array[Dictionary] = []
var _jigsaw_done := 0
var _jigsaw_slots: Array[Control] = []


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var p := GameSpecData.puzzle()
	_mode = str(p.get("mode", "match3"))
	_cols = int(p.get("cols", 7))
	_rows = int(p.get("rows", 7))
	_target = int(p.get("targetScore", 100))
	_move_limit = int(p.get("moveLimit", 30))
	_profile = GameSpecData.sample_play_profile().get("puzzle", {})
	if not _profile is Dictionary:
		_profile = {}
	_bloom_scale = float(_profile.get("match3BloomScale", 1.0))
	_memory_timer_sec = float(_profile.get("memoryTimerSec", 0.0))
	_memory_timer_left = _memory_timer_sec
	if int(_profile.get("diffCount", 0)) > 0 and _mode == "spotDifference":
		_target = int(_profile.get("diffCount", _target))
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#1a2220")))
	_camera = Runtime3DEnv.make_camera(_world, true)
	_overlay = Control.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_overlay)
	match _mode:
		"spotDifference":
			_setup_spot_difference()
		"memoryMatch":
			_setup_memory_match()
		"jigsaw":
			_setup_jigsaw()
		_:
			_setup_match3()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _process(delta: float) -> void:
	if _ended or _mode != "memoryMatch" or _memory_timer_sec <= 0.0:
		return
	_memory_timer_left -= delta
	var left := int(maxf(0.0, ceil(_memory_timer_left)))
	_hud.set_score("得分 %d · 剩余 %ds" % [_score, left])
	if left <= 10 and not _memory_timer_warned:
		_memory_timer_warned = true
		GameJuice.flash_background(self, Color("#fb7185"), 0.16)
		GameJuice.shake_node(self, 3.0, 0.08)
	if _memory_timer_left <= 0.0:
		_finish(false)


func _setup_match3() -> void:
	_viewport_container.visible = true
	_hud.set_extra("点击 2+ 相邻同色块消除 · 目标 %d 分" % _target)
	_init_grid()
	_draw_grid()
	_hud.set_score("得分 %d · 步数 %d/%d" % [_score, _moves, _move_limit])


func _setup_spot_difference() -> void:
	_viewport_container.modulate = Color(1, 1, 1, 0.35)
	var whimsical := bool(_profile.get("whimsicalPanels", false))
	var panel_a := Color("#a78bfa") if whimsical else Color("#6366f1")
	var panel_b := Color("#f472b6") if whimsical else Color("#6366f1")
	var pw := 280.0
	var ph := 220.0
	var y := 100.0
	var lx := 460.0 - pw - 12.0
	var rx := 460.0 + 12.0
	_hud.set_extra("Whimsy 找不同 · 找出 %d 处" % _target if whimsical else "找不同 · 找出 %d 处" % _target)
	_diff_marks.resize(_target)
	for i in _target:
		_diff_marks[i] = false
	for side in [[lx, panel_a], [rx, panel_b]]:
		var panel := ColorRect.new()
		panel.position = Vector2(side[0], y)
		panel.size = Vector2(pw, ph)
		panel.color = side[1]
		panel.color.a = 0.28 if whimsical else 0.38
		_overlay.add_child(panel)
	if whimsical:
		for pt in [Vector2(lx + 12, y + 12), Vector2(lx + pw - 12, y + ph - 12), Vector2(rx + pw - 12, y + 12), Vector2(rx + 12, y + ph - 12)]:
			GameJuice.burst(self, pt, Color("#fcd34d"), 4)
	for i in _target:
		var on_left := i % 2 == 0
		var base_x := lx if on_left else rx
		var pt := Vector2(
			base_x + pw * (0.18 + float((i * 13) % 62) / 100.0),
			y + ph * (0.16 + float((i * 11) % 68) / 100.0)
		)
		var mark := ColorRect.new()
		mark.size = Vector2(20, 20)
		mark.position = pt - mark.size * 0.5
		mark.color = Color("#f472b6") if whimsical else Color("#fde047")
		mark.visible = false
		_overlay.add_child(mark)
		var hit := Button.new()
		hit.position = pt - Vector2(22, 22)
		hit.size = Vector2(44, 44)
		hit.modulate = Color(1, 1, 1, 0.01)
		hit.pressed.connect(_on_diff_found.bind(i, mark, pt, whimsical))
		_overlay.add_child(hit)
	_hud.set_score("已找到 %d / %d" % [_found_diff, _target])


func _on_diff_found(idx: int, mark: ColorRect, pt: Vector2, whimsical: bool) -> void:
	if _ended or _diff_marks[idx]:
		return
	_diff_marks[idx] = true
	mark.visible = true
	_found_diff += 1
	_score += 20
	_moves += 1
	_hud.set_score("已找到 %d / %d · 得分 %d" % [_found_diff, _target, _score])
	var col := Color("#f472b6") if whimsical else theme_particle()
	GameJuice.burst(self, pt, col, 14)
	GameJuice.shake_node(self, 2.5, 0.07)
	if _found_diff >= _target:
		_finish(true)
	elif _moves >= _move_limit:
		_finish(false)


func _setup_memory_match() -> void:
	_viewport_container.modulate = Color(1, 1, 1, 0.25)
	var pairs := (_cols * _rows) / 2
	var deck: Array[int] = []
	for i in pairs:
		deck.append(i)
		deck.append(i)
	deck.shuffle()
	var cell := minf(64.0, (920.0 - 40.0) / float(_cols))
	var ox := (920.0 - cell * float(_cols)) * 0.5
	var oy := 90.0
	var timed := _memory_timer_sec > 0.0
	_hud.set_extra("翻牌配对 · 计时 %ds" % int(_memory_timer_sec) if timed else "翻牌配对 · 步数 %d/%d" % [_moves, _move_limit])
	for i in deck.size():
		var c := i % _cols
		var r := int(float(i) / float(_cols))
		var x := ox + float(c) * cell + cell * 0.5
		var y := oy + float(r) * cell + cell * 0.5
		var card := {
			"id": deck[i],
			"face": false,
			"matched": false,
			"x": x,
			"y": y,
			"btn": null,
			"label": null,
		}
		var btn := Button.new()
		btn.position = Vector2(x - (cell - 8) * 0.5, y - (cell - 8) * 0.5)
		btn.size = Vector2(cell - 8, cell - 8)
		btn.text = "?"
		if timed:
			btn.add_theme_color_override("font_color", Color("#f472b6"))
		card["btn"] = btn
		card["label"] = btn
		btn.pressed.connect(_on_card_pressed.bind(card))
		_overlay.add_child(btn)
		_cards.append(card)
	_hud.set_score("得分 %d · 配对 0/%d" % [_score, pairs])


func _on_card_pressed(card: Dictionary) -> void:
	if _ended or card["face"] or card["matched"] or _flipped.size() >= 2:
		return
	card["face"] = true
	var btn: Button = card["btn"]
	btn.text = str(int(card["id"]) + 1)
	btn.modulate = COLORS[int(card["id"]) % COLORS.size()]
	_flipped.append(card)
	if _flipped.size() < 2:
		return
	_moves += 1
	var a: Dictionary = _flipped[0]
	var b: Dictionary = _flipped[1]
	if int(a["id"]) == int(b["id"]):
		a["matched"] = true
		b["matched"] = true
		_score += 15
		_flipped.clear()
		GameJuice.burst(self, Vector2(a["x"], a["y"]), COLORS[int(a["id"]) % COLORS.size()], 12)
		_hud.set_score("得分 %d · 步数 %d/%d" % [_score, _moves, _move_limit])
		if _cards.all(func(c): return c["matched"]):
			_finish(true)
	else:
		GameJuice.shake_node(self, 2.0, 0.06)
		await get_tree().create_timer(0.55).timeout
		if not is_instance_valid(self) or _ended:
			return
		for c in [a, b]:
			c["face"] = false
			var bbtn: Button = c["btn"]
			bbtn.text = "?"
			bbtn.modulate = Color.WHITE
		_flipped.clear()
	if _moves >= _move_limit and not _cards.all(func(c): return c["matched"]):
		_finish(false)


func _setup_jigsaw() -> void:
	_viewport_container.modulate = Color(1, 1, 1, 0.2)
	var kids := bool(_profile.get("kidsJigsaw", false))
	var large := bool(_profile.get("jigsawLargeBlocks", false))
	var total := _cols * _rows
	var block_scale := 1.18 if large else 1.0
	var size := minf(88.0 * block_scale, minf(720.0 / float(_cols + 1), 280.0 / float(_rows + 2)))
	var sx := 460.0 - (float(_cols) * size) * 0.5
	var sy := 280.0 - (float(_rows) * size) * 0.5
	if kids:
		var frame := Panel.new()
		frame.position = Vector2(sx - 16, sy - 16)
		frame.size = Vector2(float(_cols) * size + 32, float(_rows) * size + 32)
		frame.add_theme_stylebox_override("panel", _kids_frame_style())
		_overlay.add_child(frame)
		_hud.set_extra("儿童拼图 · 拖拽大块 · 星星奖励")
	else:
		_hud.set_extra("拼图 %dx%d · %d 块" % [_cols, _rows, total])
	for i in total:
		var c := i % _cols
		var r := int(float(i) / float(_cols))
		var tx := sx + float(c) * size
		var ty := sy + float(r) * size
		var slot := ColorRect.new()
		slot.position = Vector2(tx, ty)
		slot.size = Vector2(size - 4, size - 4)
		slot.color = Color("#334155")
		slot.set_meta("filled", false)
		_jigsaw_slots.append(slot)
		_overlay.add_child(slot)
		var px := 36.0 + float(i % _cols) * (size + 6.0)
		var py := 420.0 + float(int(float(i) / float(_cols))) * (size + 6.0)
		var piece := Button.new()
		piece.position = Vector2(px, py)
		piece.size = Vector2(size - 8, size - 8)
		piece.modulate = COLORS[i % COLORS.size()]
		piece.text = str(i + 1)
		piece.pressed.connect(_on_jigsaw_piece.bind(piece, i, size))
		_overlay.add_child(piece)
	_hud.set_score("完成 %d / %d" % [_jigsaw_done, total])


func _kids_frame_style() -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0, 0, 0, 0)
	sb.border_width_left = 4
	sb.border_width_top = 4
	sb.border_width_right = 4
	sb.border_width_bottom = 4
	sb.border_color = Color("#fcd34d")
	sb.corner_radius_top_left = 12
	sb.corner_radius_top_right = 12
	sb.corner_radius_bottom_left = 12
	sb.corner_radius_bottom_right = 12
	return sb


func _on_jigsaw_piece(piece: Button, slot_idx: int, size: float) -> void:
	if _ended or slot_idx < 0 or slot_idx >= _jigsaw_slots.size():
		return
	var slot: Control = _jigsaw_slots[slot_idx]
	if slot.get_meta("filled", false):
		return
	piece.position = slot.position + Vector2(2, 2)
	slot.set_meta("filled", true)
	_jigsaw_done += 1
	_score += 10
	var kids := bool(_profile.get("kidsJigsaw", false))
	GameJuice.burst(self, slot.position + slot.size * 0.5, COLORS[slot_idx % COLORS.size()], 10)
	if kids and bool(_profile.get("starReward", true)):
		GameJuice.burst(self, slot.position + Vector2(slot.size.x * 0.5, -12), Color("#fcd34d"), 6)
	_hud.set_score("完成 %d / %d · 得分 %d" % [_jigsaw_done, _jigsaw_slots.size(), _score])
	if _jigsaw_done >= _jigsaw_slots.size():
		_finish(true)


func theme_particle() -> Color:
	return GameSpecData.theme_color("playerColor", Color("#38bdf8"))


func _init_grid() -> void:
	_grid.clear()
	for r in range(_rows):
		var row: Array = []
		for c in range(_cols):
			row.append(randi() % COLORS.size())
		_grid.append(row)


func _draw_grid() -> void:
	for n in _cell_nodes:
		if is_instance_valid(n):
			n.queue_free()
	_cell_nodes.clear()
	var ox := -(float(_cols) * _cell) * 0.5 + _cell * 0.5
	var oz := -(float(_rows) * _cell) * 0.5 + _cell * 0.5
	for r in range(_rows):
		for c in range(_cols):
			var v: int = _grid[r][c]
			if v < 0:
				continue
			var mesh := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(_cell * 0.88, 0.35, _cell * 0.88)
			mesh.mesh = box
			mesh.position = Vector3(ox + float(c) * _cell, 0.2, oz + float(r) * _cell)
			var mat := StandardMaterial3D.new()
			mat.albedo_color = COLORS[v]
			mesh.material_override = mat
			mesh.set_meta("r", r)
			mesh.set_meta("c", c)
			_world.add_child(mesh)
			_cell_nodes.append(mesh)


func _unhandled_input(event: InputEvent) -> void:
	if _ended or _mode != "match3" or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT or _camera == null:
		return
	var hit := Runtime3DEnv.raycast_world(_viewport, _camera, _viewport.get_mouse_position())
	for mesh in _cell_nodes:
		if mesh.global_position.distance_to(hit) < _cell * 0.55:
			_on_cell(int(mesh.get_meta("r", -1)), int(mesh.get_meta("c", -1)))
			return


func _on_cell(r: int, c: int) -> void:
	if r < 0 or c < 0:
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
	var bloom := int(group.size() * group.size() * 3 * _bloom_scale)
	_score += bloom
	_moves += 1
	if _camera:
		var ox := -(float(_cols) * _cell) * 0.5 + _cell * 0.5
		var oz := -(float(_rows) * _cell) * 0.5 + _cell * 0.5
		var cx := ox + float(c) * _cell
		var cz := oz + float(r) * _cell
		var world := _world.to_global(Vector3(cx, 0.35, cz))
		var col: Color = COLORS[color] if color >= 0 and color < COLORS.size() else Color.WHITE
		GameJuice.burst(self, _camera.unproject_position(world), col, mini(int(6 * _bloom_scale), 16))
		GameJuice.flash_background(self, col, 0.14)
		GameJuice.shake_node(self, 2.0 + group.size() * 0.25, 0.07)
	_hud.set_score("得分 %d · 步数 %d/%d" % [_score, _moves, _move_limit])
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
	_hud.show_banner("益智完成" if won else "挑战结束", "得分 %d" % _score)
	if won:
		GameJuice.flash_background(self, Color("#8ec5ff"), 0.18)
		GameJuice.shake_node(self, 4.0, 0.1)

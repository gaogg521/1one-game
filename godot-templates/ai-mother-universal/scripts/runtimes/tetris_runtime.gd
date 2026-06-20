extends Node2D
## 俄罗斯方块 · 3D 视图（最简可玩）
## - 7 形方块（I/O/T/S/Z/J/L）从顶部落下
## - ← → 移动 / ↑ 旋转 / ↓ 软降 / 空格 硬降 / P 暂停
## - 满行消除 +1 行；每消 10 行提速；达成 targetLines 通关
## - 方块堆到顶部失败

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _camera: Camera3D
var _ended = false
var _paused = false

var _cols = 10
var _rows = 20
var _target_lines = 30
var _speed_ms = 800
var _speed_step_ms = 80
var _cell = 0.42  # 3D 单元尺寸

var _grid: Array = []          # _grid[r][c] = 0 空 / 1..7 颜色索引
var _active_kind = 0          # 0..6
var _active_rot = 0           # 0..3
var _active_row = 0
var _active_col = 0
var _next_kind = 0
var _bag: Array = []

var _score = 0
var _lines = 0
var _lines_since_speedup = 0
var _drop_accum_ms = 0.0

# 渲染节点缓存
var _board_cells: Array = []   # Array[MeshInstance3D] 全网格 mesh
var _active_cells: Array = []  # 当前活动方块的 mesh（每帧重建）
var _next_mesh: MeshInstance3D = null
var _pause_label: Label3D = null

# 7 形方块定义：每种 4 个旋转状态，每个状态 4 个 {r,c} 偏移
const KINDS := ["I", "O", "T", "S", "Z", "J", "L"]
const COLORS := [
	Color("#22d3ee"),  # I 青
	Color("#facc15"),  # O 黄
	Color("#a855f7"),  # T 紫
	Color("#4ade80"),  # S 绿
	Color("#f87171"),  # Z 红
	Color("#3b82f6"),  # J 蓝
	Color("#fb923c"),  # L 橙
]
const SHAPES := [
	# I
	[
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(0, 2), Vector2i(0, 3)],
		[Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1), Vector2i(3, 1)],
		[Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2), Vector2i(1, 3)],
		[Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2), Vector2i(3, 2)],
	],
	# O
	[
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1)],
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1)],
	],
	# T
	[
		[Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2)],
		[Vector2i(0, 1), Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 1)],
		[Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 1)],
		[Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(2, 1)],
	],
	# S
	[
		[Vector2i(0, 1), Vector2i(0, 2), Vector2i(1, 0), Vector2i(1, 1)],
		[Vector2i(0, 1), Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 2)],
		[Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 0), Vector2i(2, 1)],
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(1, 1), Vector2i(2, 1)],
	],
	# Z
	[
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 1), Vector2i(1, 2)],
		[Vector2i(0, 2), Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 1)],
		[Vector2i(1, 0), Vector2i(1, 1), Vector2i(2, 1), Vector2i(2, 2)],
		[Vector2i(0, 1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(2, 0)],
	],
	# J
	[
		[Vector2i(0, 0), Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2)],
		[Vector2i(0, 1), Vector2i(0, 2), Vector2i(1, 1), Vector2i(2, 1)],
		[Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 2)],
		[Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 0), Vector2i(2, 1)],
	],
	# L
	[
		[Vector2i(0, 2), Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2)],
		[Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1), Vector2i(2, 2)],
		[Vector2i(1, 0), Vector2i(1, 1), Vector2i(1, 2), Vector2i(2, 0)],
		[Vector2i(0, 0), Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1)],
	],
]


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var bp = _tetris_blueprint()
	_cols = int(bp.get("gridWidth", 10))
	_rows = int(bp.get("gridHeight", 20))
	_target_lines = int(bp.get("targetLines", 30))
	_speed_ms = int(bp.get("startSpeedMs", 800))
	_speed_step_ms = int(bp.get("speedStepMs", 80))
	_build_scene()
	_init_grid()
	_bag = _refill_bag()
	_next_kind = _draw_from_bag()
	_spawn_piece()
	_hud.set_extra("← → 移动 · ↑ 旋转 · ↓ 软降 · 空格 硬降 · P 暂停")
	_hud.show_banner("俄罗斯方块", "消除 %d 行通关" % _target_lines, 1.6)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _tetris_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	if true:
		return GameSpecData.tetris()
	return {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 1.0, float(_cols) * _cell * 1.6)
	_camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)
	# 底板
	var floor_mesh = MeshInstance3D.new()
	var pm = PlaneMesh.new()
	pm.size = Vector2(float(_cols) * _cell + 0.4, float(_rows) * _cell + 0.4)
	floor_mesh.mesh = pm
	floor_mesh.position = Vector3(0, -0.05, 0)
	var fm = StandardMaterial3D.new()
	fm.albedo_color = Color(0.06, 0.09, 0.16, 0.9)
	floor_mesh.material_override = fm
	_world.add_child(floor_mesh)
	# Next 预览标签
	var lbl = Label3D.new()
	lbl.text = "Next"
	lbl.font_size = 48
	lbl.position = Vector3(float(_cols) * _cell * 0.5 + 1.2, 2.0, -float(_rows) * _cell * 0.5 + 1.0)
	lbl.modulate = Color(0.85, 0.9, 1.0)
	_world.add_child(lbl)


func _init_grid() -> void:
	_grid.clear()
	for r in range(_rows):
		var row = []
		for c in range(_cols):
			row.append(0)
		_grid.append(row)


func _refill_bag() -> Array:
	var b = [0, 1, 2, 3, 4, 5, 6]
	b.shuffle()
	return b


func _draw_from_bag() -> int:
	if _bag.is_empty():
		_bag = _refill_bag()
	return int(_bag.pop_front())


func _piece_cells(kind: int, rot: int, row: int, col: int) -> Array:
	var out = []
	var shape = SHAPES[kind][rot]
	for cell in shape:
		out.append({"r": row + int(cell[0]), "c": col + int(cell[1])})
	return out


func _fits(kind: int, rot: int, row: int, col: int) -> bool:
	var cells = _piece_cells(kind, rot, row, col)
	for cell in cells:
		var r = int(cell["r"])
		var c = int(cell["c"])
		if r < 0 or r >= _rows or c < 0 or c >= _cols:
			return false
		if int(_grid[r][c]) != 0:
			return false
	return true


func _spawn_piece() -> bool:
	var kind = _next_kind
	_next_kind = _draw_from_bag()
	var spawn_col = maxi(0, int(float(_cols) / 2.0) - 2)
	if kind == 1:  # O
		spawn_col = maxi(0, int(float(_cols) / 2.0) - 1)
	_active_kind = kind
	_active_rot = 0
	_active_row = 0
	_active_col = spawn_col
	if not _fits(_active_kind, _active_rot, _active_row, _active_col):
		return false
	return true


func _try_move(dir: int) -> void:
	if _ended or _paused:
		return
	if _fits(_active_kind, _active_rot, _active_row, _active_col + dir):
		_active_col += dir
		GameAudio.play_bleep(GameBleeps.Kind.FIRE)


func _try_rotate() -> void:
	if _ended or _paused:
		return
	if _active_kind == 1:  # O 不旋转
		return
	var new_rot = (_active_rot + 1) % 4
	var kicks = [[0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0]]
	for k in kicks:
		if _fits(_active_kind, new_rot, _active_row + int(k[0]), _active_col + int(k[1])):
			_active_rot = new_rot
			_active_row += int(k[0])
			_active_col += int(k[1])
			GameAudio.play_bleep(GameBleeps.Kind.FIRE)
			return


func _soft_drop() -> void:
	if _ended or _paused:
		return
	if _fits(_active_kind, _active_rot, _active_row + 1, _active_col):
		_active_row += 1
		_score += 1
	else:
		_lock_piece()


func _hard_drop() -> void:
	if _ended or _paused:
		return
	var dropped = 0
	while _fits(_active_kind, _active_rot, _active_row + 1, _active_col):
		_active_row += 1
		dropped += 1
	_score += dropped * 2
	GameAudio.play_bleep(GameBleeps.Kind.FIRE)
	_lock_piece()


func _lock_piece() -> void:
	var cells = _piece_cells(_active_kind, _active_rot, _active_row, _active_col)
	for cell in cells:
		var r = int(cell["r"])
		var c = int(cell["c"])
		if r >= 0 and r < _rows and c >= 0 and c < _cols:
			_grid[r][c] = _active_kind + 1  # 1..7
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	_clear_lines()
	if not _spawn_piece():
		_end(false)
		return
	if not _fits(_active_kind, _active_rot, _active_row, _active_col):
		_end(false)


func _clear_lines() -> void:
	var cleared = []
	for r in range(_rows):
		var full = true
		for c in range(_cols):
			if int(_grid[r][c]) == 0:
				full = false
				break
		if full:
			cleared.append(r)
	if cleared.is_empty():
		_refresh_hud()
		return
	# 从下往上移除
	for r in cleared:
		_grid.remove_at(r)
		var empty = []
		for c in range(_cols):
			empty.append(0)
		_grid.insert(0, empty)
	var n = cleared.size()
	var table = [0, 100, 300, 500, 800]
	_score += int(table[n]) if n < table.size() else 800
	_lines += n
	_lines_since_speedup += n
	while _lines_since_speedup >= 10:
		_lines_since_speedup -= 10
		_speed_ms = maxi(120, _speed_ms - _speed_step_ms)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameJuice.flash_background(self, COLORS[_active_kind], 0.18)
	GameJuice.shake_node(self, 2.0 + float(n), 0.08)
	_refresh_hud()
	if _lines >= _target_lines:
		_end(true)


func _process(delta: float) -> void:
	if _ended or _paused:
		return
	var step_ms = _speed_ms
	if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_DOWN):
		step_ms = mini(60, _speed_ms)
	_drop_accum_ms += delta * 1000.0
	if _drop_accum_ms >= float(step_ms):
		_drop_accum_ms = 0.0
		if _fits(_active_kind, _active_rot, _active_row + 1, _active_col):
			_active_row += 1
			if Input.is_action_pressed("ui_down") or Input.is_key_pressed(KEY_DOWN):
				_score += 1
		else:
			_lock_piece()
	_redraw_board()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		GameAudio.boot_interactive()
		match event.keycode:
			KEY_LEFT:
				_try_move(-1)
			KEY_RIGHT:
				_try_move(1)
			KEY_UP:
				_try_rotate()
			KEY_SPACE:
				_hard_drop()
			KEY_P:
				_toggle_pause()


func _toggle_pause() -> void:
	if _ended:
		return
	_paused = not _paused
	if _paused:
		_pause_label = Label3D.new()
		_pause_label.text = "已暂停 · 按 P 继续"
		_pause_label.font_size = 64
		_pause_label.position = Vector3(0, 2.5, 0)
		_pause_label.modulate = Color("#fde047")
		_world.add_child(_pause_label)
	else:
		if _pause_label != null and is_instance_valid(_pause_label):
			_pause_label.queue_free()
		_pause_label = null


func _cell_world_pos(r: int, c: int) -> Vector3:
	var ox = -(float(_cols) * _cell) * 0.5 + _cell * 0.5
	var oz = -(float(_rows) * _cell) * 0.5 + _cell * 0.5
	return Vector3(ox + float(c) * _cell, _cell * 0.5, oz + float(r) * _cell)


func _make_block(color: Color) -> MeshInstance3D:
	var mesh = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(_cell * 0.9, _cell * 0.9, _cell * 0.9)
	mesh.mesh = box
	var mat = StandardMaterial3D.new()
	mat.albedo_color = color
	mesh.material_override = mat
	return mesh


func _redraw_board() -> void:
	# 清旧
	for n in _board_cells:
		if is_instance_valid(n):
			n.queue_free()
	_board_cells.clear()
	for n in _active_cells:
		if is_instance_valid(n):
			n.queue_free()
	_active_cells.clear()
	# 已固定
	for r in range(_rows):
		for c in range(_cols):
			var v = int(_grid[r][c])
			if v == 0:
				continue
			var m = _make_block(COLORS[v - 1])
			m.position = _cell_world_pos(r, c)
			_world.add_child(m)
			_board_cells.append(m)
	# 当前方块
	var cells = _piece_cells(_active_kind, _active_rot, _active_row, _active_col)
	for cell in cells:
		var r = int(cell["r"])
		var c = int(cell["c"])
		if r < 0:
			continue
		var m = _make_block(COLORS[_active_kind])
		m.position = _cell_world_pos(r, c)
		_world.add_child(m)
		_active_cells.append(m)
	# Next 预览
	if _next_mesh != null and is_instance_valid(_next_mesh):
		_next_mesh.queue_free()
		_next_mesh = null
	_next_mesh = _make_next_preview(_next_kind)


func _make_next_preview(kind: int) -> MeshInstance3D:
	var holder = MeshInstance3D.new()
	holder.mesh = BoxMesh.new()
	holder.mesh.size = Vector3(_cell * 4.0, _cell * 0.05, _cell * 4.0)
	var hm = StandardMaterial3D.new()
	hm.albedo_color = Color(0.1, 0.15, 0.25, 0.5)
	hm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	holder.material_override = hm
	holder.position = Vector3(float(_cols) * _cell * 0.5 + 1.2, 1.4, -float(_rows) * _cell * 0.5 + 1.0)
	_world.add_child(holder)
	_board_cells.append(holder)  # 跟随清理
	var shape = SHAPES[kind][0]
	for cell in shape:
		var m = _make_block(COLORS[kind])
		var local = Vector3(float(cell[1]) * _cell - _cell * 1.5, _cell * 0.5, float(cell[0]) * _cell - _cell * 1.5)
		m.position = holder.position + local
		_world.add_child(m)
		_board_cells.append(m)
	return holder


func _refresh_hud() -> void:
	_hud.set_score(%s %d · %s %d/%d · %s %dms" % [GameSpecData.tr("score"), _score, GameSpecData.tr("lines"), _lines, _target_lines, GameSpecData.tr("speed"), _speed_ms] % [_score, _lines, _target_lines, _speed_ms])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("胜利！", "消行 %d · 分数 %d" % [_lines, _score], 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "消行 %d · 分数 %d" % [_lines, _score], 2.0)

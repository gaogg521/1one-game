extends Node2D
## 真 2048 合并 · 3D 视图
## - N×N 网格（默认 4×4，可配 5×5 / 6×6）
## - 玩家按 ← → ↑ ↓ 滑动，所有方块同方向移动
## - 同值方块碰撞 → 合并为 2 倍；每次有效移动后随机生成 1 个新方块（2 或 4）
## - 达到 targetTile 通关 / 网格满且无法移动 → 失败
## - HUD：当前最大块 + 分数 + 移动数
##
## 兼容 GameSpecData.raw.get("merge2048", {}) 兜底读取蓝图字段。

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _camera: Camera3D
var _ended = false
var _input_locked = false

# ── 蓝图（从 GameSpecData.raw["merge2048"] 读取，缺失则兜底） ──
var _grid_size = 4
var _target_tile = 2048
var _spawn_per_move = 1
var _max_moves = 1000

# ── 游戏状态 ──
var _grid: Array = []        # Array[Array[int]]，0 表示空格
var _score = 0
var _moves = 0
var _max_tile = 0

# ── 渲染 ──
# _tile_views[r][c] = {"mesh": MeshInstance3D, "label": Label3D} 或 null
var _tile_views: Array = []
var _tile_size = 1.4        # 单格世界尺寸
var _tile_gap = 0.12
var _board_origin = Vector3.ZERO


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_apply_blueprint()
	_build_scene()
	_init_grid()
	# 初始 2 个方块
	_spawn_random_tile()
	_spawn_random_tile()
	_recompute_max_tile()
	_render_tiles(true)
	_hud.set_extra("← → ↑ ↓ 滑动合并 · 相同数字合并为 2 倍 · 达成 %d 通关" % _target_tile)
	_hud.show_banner("2048", "滑动合并到 %d" % _target_tile, 1.6)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 兼容写法：GameSpecData.raw.get("merge2048", {}) 兜底
func _apply_blueprint() -> void:
	var raw: Dictionary = GameSpecData.raw.get("merge2048", {}) if GameSpecData.raw.has("merge2048") else {}
	# gridSize：4 / 5 / 6（防御性 clamp）
	var gs = int(raw.get("gridSize", 4))
	_grid_size = clampi(gs, 4, 6)
	# targetTile：2048 / 4096 / 8192
	var tt = int(raw.get("targetTile", 2048))
	if tt == 2048 or tt == 4096 or tt == 8192:
		_target_tile = tt
	else:
		_target_tile = 2048
	# spawnPerMove：1 或 2
	var spm = int(raw.get("spawnPerMove", 1))
	_spawn_per_move = 2 if spm == 2 else 1
	# maxMoves：200..1000
	var mm = int(raw.get("maxMoves", 1000))
	_max_moves = clampi(mm, 200, 1000)


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 6.5, 7.5)
	_camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)
	# 棋盘底板
	var total_w: float = float(_grid_size) * (_tile_size + _tile_gap) + _tile_gap
	_board_origin = Vector3(-total_w / 2.0 + _tile_size / 2.0 + _tile_gap, 0.0, -total_w / 2.0 + _tile_size / 2.0 + _tile_gap)
	var board_mesh = MeshInstance3D.new()
	var bp = PlaneMesh.new()
	bp.size = Vector2(total_w + 0.4, total_w + 0.4)
	board_mesh.mesh = bp
	board_mesh.position = Vector3(0, -0.05, 0)
	var bm = StandardMaterial3D.new()
	bm.albedo_color = Color(0.73, 0.68, 0.62, 0.95)
	board_mesh.material_override = bm
	_world.add_child(board_mesh)
	# 各格槽（凹陷感）
	for r in range(_grid_size):
		for c in range(_grid_size):
			var pos = _cell_world_pos(r, c)
			var slot = MeshInstance3D.new()
			var sp = PlaneMesh.new()
			sp.size = Vector2(_tile_size, _tile_size)
			slot.mesh = sp
			slot.position = Vector3(pos.x, 0.0, pos.z)
			var sm = StandardMaterial3D.new()
			sm.albedo_color = Color(0.80, 0.76, 0.70, 0.85)
			slot.material_override = sm
			_world.add_child(slot)


func _init_grid() -> void:
	_grid.clear()
	for r in range(_grid_size):
		var row: Array = []
		for c in range(_grid_size):
			row.append(0)
		_grid.append(row)
	_tile_views.clear()
	for r in range(_grid_size):
		var row: Array = []
		for c in range(_grid_size):
			row.append(null)
		_tile_views.append(row)


## 计算格子 (r,c) 的世界坐标（XZ 平面，Y=0）
func _cell_world_pos(r: int, c: int) -> Vector3:
	var x: float = _board_origin.x + float(c) * (_tile_size + _tile_gap)
	var z: float = _board_origin.z + float(r) * (_tile_size + _tile_gap)
	return Vector3(x, 0.0, z)


## 在空格中随机生成一个新方块（2 概率 90%，4 概率 10%）
func _spawn_random_tile() -> void:
	var empties: Array = []
	for r in range(_grid_size):
		for c in range(_grid_size):
			if int(_grid[r][c]) == 0:
				empties.append({"r": r, "c": c})
	if empties.is_empty():
		return
	var pick: Dictionary = empties[randi_range(0, empties.size() - 1)]
	var is_four = randf() < 0.1
	_grid[int(pick["r"])][int(pick["c"])] = 4 if is_four else 2


func _recompute_max_tile() -> void:
	var m = 0
	for r in range(_grid_size):
		for c in range(_grid_size):
			var v = int(_grid[r][c])
			if v > m:
				m = v
	_max_tile = m


## 把一行/一列沿移动方向「压缩 + 合并」。
## line 是按移动方向排好序的数值数组（首个元素为最远端）。
func _compress_line(line: Array) -> Dictionary:
	var filtered: Array = []
	for v in line:
		if int(v) != 0:
			filtered.append(int(v))
	var result: Array = []
	var gained = 0
	var merged = false
	var i = 0
	while i < filtered.size():
		if i + 1 < filtered.size() and int(filtered[i]) == int(filtered[i + 1]):
			var merged_val = int(filtered[i]) * 2
			result.append(merged_val)
			gained += merged_val
			merged = true
			i += 2
		else:
			result.append(int(filtered[i]))
			i += 1
	while result.size() < line.size():
		result.append(0)
	return {"result": result, "gained": gained, "merged": merged}


## 按方向取出一行/一列的数值数组（已按移动方向排序，[0] = 最远端）
func _extract_line(index: int, dir: String) -> Array:
	var out: Array = []
	if dir == "left":
		for c in range(_grid_size):
			out.append(int(_grid[index][c]))
	elif dir == "right":
		var c = _grid_size - 1
		while c >= 0:
			out.append(int(_grid[index][c]))
			c -= 1
	elif dir == "up":
		for r in range(_grid_size):
			out.append(int(_grid[r][index]))
	else:
		# down
		var r = _grid_size - 1
		while r >= 0:
			out.append(int(_grid[r][index]))
			r -= 1
	return out


## 把压缩后的数组写回 grid（按移动方向）
func _write_line(index: int, dir: String, line: Array) -> void:
	if dir == "left":
		for c in range(_grid_size):
			_grid[index][c] = int(line[c])
	elif dir == "right":
		var c = _grid_size - 1
		var i = 0
		while c >= 0:
			_grid[index][c] = int(line[i])
			c -= 1
			i += 1
	elif dir == "up":
		for r in range(_grid_size):
			_grid[r][index] = int(line[r])
	else:
		# down
		var r = _grid_size - 1
		var i = 0
		while r >= 0:
			_grid[r][index] = int(line[i])
			r -= 1
			i += 1


func _queue_move(dir: String) -> void:
	if _ended or _input_locked:
		return
	GameAudio.boot_interactive()
	_input_locked = true
	var before = _snapshot_grid()
	var total_gained = 0
	var any_merged = false
	for i in range(_grid_size):
		var line = _extract_line(i, dir)
		var comp = _compress_line(line)
		_write_line(i, dir, comp["result"])
		total_gained += int(comp["gained"])
		if bool(comp["merged"]):
			any_merged = true
	var changed = not _grids_equal(before, _snapshot_grid())
	if changed:
		_moves += 1
		_score += total_gained
		_recompute_max_tile()
		if any_merged and total_gained > 0:
			GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
		else:
			GameAudio.play_bleep(GameBleeps.Kind.FIRE)
		# 移动后生成新块
		for s in range(_spawn_per_move):
			_spawn_random_tile()
		_render_tiles(false)
		_refresh_hud()
		# 通关 / 失败判定
		if _max_tile >= _target_tile:
			_end(true)
			return
		if _moves >= _max_moves:
			_end(false)
			return
		if not _has_any_move():
			_end(false)
			return
	else:
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
	# 短锁防止连按
	get_tree().create_timer(0.09).timeout.connect(func(): _input_locked = false)


func _snapshot_grid() -> Array:
	var out: Array = []
	for r in range(_grid_size):
		var row: Array = []
		for c in range(_grid_size):
			row.append(int(_grid[r][c]))
		out.append(row)
	return out


func _grids_equal(a: Array, b: Array) -> bool:
	for r in range(_grid_size):
		for c in range(_grid_size):
			if int(a[r][c]) != int(b[r][c]):
				return false
	return true


## 检查是否还有任何合法移动（有空格 或 有相邻同值）
func _has_any_move() -> bool:
	for r in range(_grid_size):
		for c in range(_grid_size):
			if int(_grid[r][c]) == 0:
				return true
			var v = int(_grid[r][c])
			if c + 1 < _grid_size and int(_grid[r][c + 1]) == v:
				return true
			if r + 1 < _grid_size and int(_grid[r + 1][c]) == v:
				return true
	return false


## 渲染当前 grid 状态到方块视图
func _render_tiles(instant: bool) -> void:
	# 清理旧视图
	for r in range(_grid_size):
		for c in range(_grid_size):
			var v = _tile_views[r][c]
			if v != null:
				var mesh: MeshInstance3D = v["mesh"]
				var label: Label3D = v["label"]
				mesh.queue_free()
				label.queue_free()
				_tile_views[r][c] = null
	# 重建
	for r in range(_grid_size):
		for c in range(_grid_size):
			var val = int(_grid[r][c])
			if val <= 0:
				continue
			var pos = _cell_world_pos(r, c)
			var mesh = MeshInstance3D.new()
			var pm = PlaneMesh.new()
			pm.size = Vector2(_tile_size - 0.04, _tile_size - 0.04)
			mesh.mesh = pm
			mesh.position = Vector3(pos.x, 0.1, pos.z)
			var mat = StandardMaterial3D.new()
			mat.albedo_color = _tile_color(val)
			mesh.material_override = mat
			_world.add_child(mesh)
			var label = Label3D.new()
			label.text = str(val)
			label.font_size = _font_size_for(val)
			label.position = Vector3(pos.x, 0.3, pos.z)
			label.modulate = _text_color(val)
			label.pixel_size = 0.012
			_world.add_child(label)
			_tile_views[r][c] = {"mesh": mesh, "label": label}
			if not instant:
				mesh.scale = Vector3(0.6, 0.6, 0.6)
				label.scale = Vector3(0.6, 0.6, 0.6)
				var tween = create_tween()
				tween.tween_property(mesh, "scale", Vector3.ONE, 0.14).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
				tween.parallel().tween_property(label, "scale", Vector3.ONE, 0.14)


## 不同数字方块的视觉颜色（与经典 2048 调色接近）
func _tile_color(value: int) -> Color:
	match value:
		2:
			return Color(0.93, 0.89, 0.85, 1.0)
		4:
			return Color(0.93, 0.88, 0.78, 1.0)
		8:
			return Color(0.95, 0.69, 0.47, 1.0)
		16:
			return Color(0.96, 0.58, 0.39, 1.0)
		32:
			return Color(0.96, 0.49, 0.37, 1.0)
		64:
			return Color(0.96, 0.37, 0.23, 1.0)
		128:
			return Color(0.93, 0.81, 0.45, 1.0)
		256:
			return Color(0.93, 0.80, 0.38, 1.0)
		512:
			return Color(0.93, 0.78, 0.31, 1.0)
		1024:
			return Color(0.93, 0.77, 0.25, 1.0)
		2048:
			return Color(0.93, 0.76, 0.18, 1.0)
		_:
			return Color(0.24, 0.23, 0.20, 1.0)


func _text_color(value: int) -> Color:
	if value == 2 or value == 4:
		return Color(0.47, 0.43, 0.40)
	return Color(0.98, 0.96, 0.95)


func _font_size_for(value: int) -> int:
	var digits = str(value).length()
	var base = int(_tile_size * 36.0)
	if digits <= 2:
		return base
	elif digits == 3:
		return int(base * 0.85)
	elif digits == 4:
		return int(base * 0.72)
	return int(base * 0.6)


func _refresh_hud() -> void:
	var right_str = "最大 %d · 目标 %d" % [_max_tile, _target_tile]
	var act_str = "移动 %d/%d" % [_moves, _max_moves]
	_hud.set_score("★ %d   %s   %s" % [_score, right_str, act_str])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("通关！", "最大 %d · 分数 %d · 移动 %d" % [_max_tile, _score, _moves], 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "最大 %d · 分数 %d · 移动 %d" % [_max_tile, _score, _moves], 2.0)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()
		if event.keycode == KEY_LEFT or event.keycode == KEY_A:
			_queue_move("left")
		elif event.keycode == KEY_RIGHT or event.keycode == KEY_D:
			_queue_move("right")
		elif event.keycode == KEY_UP or event.keycode == KEY_W:
			_queue_move("up")
		elif event.keycode == KEY_DOWN or event.keycode == KEY_S:
			_queue_move("down")


func _process(_delta: float) -> void:
	if _ended:
		return
	# HUD 持续刷新（保证最大块/分数实时同步）
	_refresh_hud()

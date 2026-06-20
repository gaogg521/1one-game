extends Node2D
## 水果忍者（3D 简化版）· 与 Phaser 端玩法对齐
## - 水果用 SphereMesh + 颜色材质，从底部抛物线抛出
## - 鼠标拖拽切割（InputEventMouseMotion 检测轨迹经过水果）
## - 炸弹用黑色 SphereMesh；切到炸弹扣命 + 红屏闪
## - GameHud 显示分数 + 命 + 时间倒计时
## - 达到目标分通关；时间到 / 命 0 失败

const FRUIT_COLORS := [
	Color("#ef4444"), Color("#f97316"), Color("#facc15"),
	Color("#22c55e"), Color("#8b5cf6"), Color("#ec4899"), Color("#06b6d4"),
]

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud := GameHud.new()
var _camera: Camera3D
var _ended := false

var _target_score := 75
var _time_limit_sec := 75.0
var _spawn_interval := 1.0
var _bomb_chance := 0.2
var _lives := 3
var _max_lives := 3
var _score := 0

var _elapsed := 0.0
var _next_spawn := 0.0
var _combo := 0
var _combo_expire := 0.0
var _hurt_flash_until := 0.0

var _fruits: Array = []   # Array[Dictionary] {mesh, vx, vy, radius, kind, sliced, color}
var _halves: Array = []   # Array[Dictionary] {mesh, vx, vy, rot, life, color}
var _splashes: Array = [] # Array[Dictionary] {mesh, vx, vy, life}

var _trail: Array = []    # Array[Vector2] screen-space points
var _trail_last_pos: Vector2 = Vector2.ZERO
var _trail_has_last := false


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var bp := _blueprint()
	_target_score = int(bp.get("targetScore", 75))
	_time_limit_sec = float(bp.get("timeLimitMs", 75000)) / 1000.0
	_spawn_interval = float(bp.get("spawnIntervalMs", 1000)) / 1000.0
	_bomb_chance = float(bp.get("bombChance", 0.2))
	_max_lives = int(GameSpecData.gameplay_i("lives", 3))
	_lives = _max_lives
	_build_scene()
	_hud.set_extra("鼠标拖拽切水果 · 避开炸弹 · 目标 %d 分" % _target_score)
	_hud.show_banner("划屏切水果！", "目标 %d 分" % _target_score, 1.6)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 兼容写法：优先 GameSpecData.raw["fruitNinja"]，否则直接读 samplePlayProfile 兜底
func _blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	if true:
		return GameSpecData.fruit_ninja()
	return {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 0, 11.0)
	_camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	_camera.current = true
	_camera.fov = 55.0
	_world.add_child(_camera)


func _process(delta: float) -> void:
	if _ended:
		return
	_elapsed += delta
	var time_left := maxf(0.0, _time_limit_sec - _elapsed)
	# 每秒刷新 HUD
	if int(time_left) != int(maxf(0.0, _time_limit_sec - (_elapsed - delta))):
		_refresh_hud()
	if time_left <= 0.0:
		_end(_score >= _target_score)
		return

	# combo 超时归零
	if _combo > 0 and _elapsed > _combo_expire:
		_combo = 0

	# 抛出
	if _elapsed >= _next_spawn:
		var progress := 1.0 - time_left / _time_limit_sec
		var accel := 1.0 - progress * 0.25
		_spawn_fruit_or_bomb()
		_next_spawn = _elapsed + _spawn_interval * accel

	# 水果物理（屏幕空间像素 → 3D 世界坐标）
	var g := 900.0
	for f in _fruits:
		if not f["sliced"]:
			f["vy"] = float(f["vy"]) + g * delta
			f["x"] = float(f["x"]) + float(f["vx"]) * delta
			f["y"] = float(f["y"]) + float(f["vy"]) * delta
			f["rot"] = float(f["rot"]) + float(f["rot_speed"]) * delta
			var mesh: MeshInstance3D = f["mesh"]
			mesh.position = _screen_to_world(Vector2(f["x"], f["y"]))
			mesh.rotation.y = float(f["rot"])
	# 清理落出底部的水果（漏切不扣命）
	var view_h := float(_viewport.size.y)
	_fruits = _fruits.filter(func(f):
		if f["sliced"]:
			var m: MeshInstance3D = f["mesh"]
			if m: m.queue_free()
			return false
		if float(f["y"]) > view_h + 60.0:
			var m2: MeshInstance3D = f["mesh"]
			if m2: m2.queue_free()
			return false
		return true)

	# 半片物理
	for h in _halves:
		h["vy"] = float(h["vy"]) + g * delta
		h["x"] = float(h["x"]) + float(h["vx"]) * delta
		h["y"] = float(h["y"]) + float(h["vy"]) * delta
		h["life"] = float(h["life"]) - delta * 1000.0
		var mesh: MeshInstance3D = h["mesh"]
		mesh.position = _screen_to_world(Vector2(h["x"], h["y"]))
		mesh.rotation.y = float(h["rot"])
		mesh.rotation.x = float(h["rot"]) * 0.7
		var life_ratio := clampf(float(h["life"]) / 1400.0, 0.0, 1.0)
		mesh.scale = Vector3(life_ratio, life_ratio, life_ratio) * 0.7
	_halves = _halves.filter(func(h):
		if float(h["life"]) <= 0.0:
			var m: MeshInstance3D = h["mesh"]
			if m: m.queue_free()
			return false
		return true)

	# 飞溅粒子
	for s in _splashes:
		s["vy"] = float(s["vy"]) + g * 0.6 * delta
		s["x"] = float(s["x"]) + float(s["vx"]) * delta
		s["y"] = float(s["y"]) + float(s["vy"]) * delta
		s["life"] = float(s["life"]) - delta * 1000.0
		var mesh: MeshInstance3D = s["mesh"]
		mesh.position = _screen_to_world(Vector2(s["x"], s["y"]))
		var mat := mesh.material_override as StandardMaterial3D
		if mat:
			mat.albedo_color.a = clampf(float(s["life"]) / 600.0, 0.0, 1.0)
	_splashes = _splashes.filter(func(s):
		if float(s["life"]) <= 0.0:
			var m: MeshInstance3D = s["mesh"]
			if m: m.queue_free()
			return false
		return true)


func _unhandled_input(event: InputEvent) -> void:
	if _ended:
		return
	if event is InputEventMouseMotion and event.button_mask & MOUSE_BUTTON_MASK_LEFT:
		var pos: Vector2 = event.position
		if _trail_has_last:
			_check_slice(_trail_last_pos, pos)
		_trail_last_pos = pos
		_trail_has_last = true
		_trail.append(pos)
		if _trail.size() > 24:
			_trail.pop_front()
		GameAudio.boot_interactive()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_trail_last_pos = event.position
		_trail_has_last = true
		GameAudio.boot_interactive()


## 划线段 (a→b) 经过水果→切片
func _check_slice(a: Vector2, b: Vector2) -> void:
	var seg_len := a.distance_to(b)
	if seg_len < 6.0:
		return
	for f in _fruits:
		if f["sliced"]:
			continue
		var d := _point_to_segment_dist(Vector2(f["x"], f["y"]), a, b)
		if d <= float(f["radius"]) + 8.0:
			_slice_fruit(f, b)


func _point_to_segment_dist(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len_sq := ab.length_squared()
	if len_sq <= 0.0001:
		return p.distance_to(a)
	var t: float = clampf((p - a).dot(ab) / len_sq, 0.0, 1.0)
	return p.distance_to(a + ab * t)


func _slice_fruit(f: Dictionary, slice_pos: Vector2) -> void:
	f["sliced"] = true
	var kind := str(f["kind"])
	if kind == "bomb":
		_on_bomb_slice(f)
		return
	var dir_angle := (slice_pos - Vector2(f["x"], f["y"])).angle() + PI / 2.0
	_spawn_half(f, dir_angle, 180.0)
	_spawn_half(f, dir_angle + PI, 180.0)
	_spawn_splash(Vector2(f["x"], f["y"]), f["color"], 12)
	# 隐藏原始水果
	var mesh: MeshInstance3D = f["mesh"]
	if mesh:
		mesh.visible = false
	# combo
	if _elapsed > _combo_expire:
		_combo = 0
	_combo += 1
	_combo_expire = _elapsed + 0.7
	var base_gain := 10
	var combo_bonus := _combo - 2 if _combo >= 3 else 0
	if combo_bonus < 0:
		combo_bonus = 0
	var gain := base_gain + combo_bonus * 5
	_score += gain
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	_refresh_hud()
	if _score >= _target_score:
		_end(true)


func _on_bomb_slice(f: Dictionary) -> void:
	var mesh: MeshInstance3D = f["mesh"]
	if mesh:
		mesh.visible = false
	_spawn_splash(Vector2(f["x"], f["y"]), Color(0.9, 0.2, 0.2), 18)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	GameJuice.shake_node(self, 8.0, 0.18)
	GameJuice.flash_background(self, Color(1.0, 0.1, 0.1), 0.32)
	_hurt_flash_until = _elapsed + 0.32
	_lives -= 1
	_combo = 0
	_refresh_hud()
	if _lives <= 0:
		_end(false)


func _spawn_half(f: Dictionary, dir_angle: float, speed: float) -> void:
	var mesh := MeshInstance3D.new()
	var sm := SphereMesh.new()
	var r := float(f["radius"]) * 0.7
	sm.radius = r * 0.01
	sm.height = r * 0.02
	mesh.mesh = sm
	mesh.position = _screen_to_world(Vector2(f["x"], f["y"]))
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(f["color"])
	mesh.material_override = mat
	_world.add_child(mesh)
	var vx: float = cos(dir_angle) * speed + float(f["vx"]) * 0.4
	var vy: float = sin(dir_angle) * speed + float(f["vy"]) * 0.4
	_halves.append({
		"mesh": mesh, "vx": vx, "vy": vy,
		"rot": float(f["rot"]), "rot_speed": (randf() - 0.5) * 0.3,
		"life": 1400.0, "color": f["color"],
		"x": float(f["x"]), "y": float(f["y"]),
	})


func _spawn_splash(pos: Vector2, color: Color, count: int) -> void:
	for i in range(count):
		var mesh := MeshInstance3D.new()
		var sm := SphereMesh.new()
		var r := float(randi_range(2, 5))
		sm.radius = r * 0.01
		sm.height = r * 0.02
		mesh.mesh = sm
		mesh.position = _screen_to_world(pos)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = color
		mesh.material_override = mat
		_world.add_child(mesh)
		var ang := randf() * TAU
		var sp := float(randi_range(80, 260))
		_splashes.append({
			"mesh": mesh, "vx": cos(ang) * sp, "vy": sin(ang) * sp - 60.0,
			"life": 600.0, "x": pos.x, "y": pos.y,
		})


func _spawn_fruit_or_bomb() -> void:
	var view_w := float(_viewport.size.x)
	var view_h := float(_viewport.size.y)
	var is_bomb := randf() < _bomb_chance
	var radius: float = 26.0 if is_bomb else float(randi_range(22, 34))
	var color: Color = Color("#1f2937") if is_bomb else FRUIT_COLORS[randi_range(0, FRUIT_COLORS.size() - 1)]
	var x: float = float(randi_range(80, int(view_w) - 80))
	var y: float = view_h + radius + 10.0
	var target_peak_y: float = float(randi_range(80, int(view_h * 0.35)))
	var g := 900.0
	var rise: float = y - target_peak_y
	var vy: float = -sqrt(maxf(40.0, 2.0 * g * rise))
	var toward_center: float = (view_w * 0.5 - x) * 0.0025
	var vx: float = float(randi_range(-60, 60)) + toward_center * 60.0

	var mesh := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = radius * 0.01
	sm.height = radius * 0.02
	mesh.mesh = sm
	mesh.position = _screen_to_world(Vector2(x, y))
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mesh.material_override = mat
	_world.add_child(mesh)

	_fruits.append({
		"mesh": mesh, "x": x, "y": y, "vx": vx, "vy": vy,
		"rot": 0.0, "rot_speed": (randf() - 0.5) * 0.18,
		"radius": radius, "kind": "bomb" if is_bomb else "fruit",
		"sliced": false, "color": color,
	})


## 屏幕像素坐标 → 3D 世界坐标（正交简化：x∈[0,920]→[-5,5], y∈[0,560]→[3,-3]）
func _screen_to_world(screen: Vector2) -> Vector3:
	var view_w := float(_viewport.size.x)
	var view_h := float(_viewport.size.y)
	if view_w <= 0.0 or view_h <= 0.0:
		return Vector3.ZERO
	var wx: float = (screen.x / view_w - 0.5) * 10.0
	var wy: float = (0.5 - screen.y / view_h) * 6.0
	return Vector3(wx, wy, 0.0)


func _refresh_hud() -> void:
	var time_left := maxf(0.0, _time_limit_sec - _elapsed)
	var lives_str := ""
	for i in range(maxi(0, _lives)):
		lives_str += "♥"
	_hud.set_score(%s %d · %s %d · %s · %ds" % [GameSpecData.tr("score"), _score, GameSpecData.tr("target"), _target_score, lives_str, int(ceil(time_left))] % [_score, _target_score, lives_str, int(ceil(time_left))])


func _end(won: bool) -> void:
	if _ended:
		return
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("胜利！", "得分 %d" % _score, 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "再试一次", 2.0)

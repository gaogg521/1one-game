extends Node2D
## 无尽跑酷（神庙逃亡 / Subway Surfers 风格 3 道跑酷）· 3D 视图
## - 3 条道（PlaneMesh 铺地），CharacterBody3D + CapsuleMesh 角色
## - 障碍 / 金币向角色方向移动（角色固定 z，世界向 +z 滚动）
## - 输入 ←→ 切道 / ↑ 跳 / ↓ 滑铲
## - 撞障碍 3 次失败；达到 targetScore 通关
##
## GameSpecData 没有 endless_runner() 访问器，用 raw.get("endlessRunner", {}) 兜底。

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud := GameHud.new()
var _camera: Camera3D
var _player: CharacterBody3D
var _player_mesh: MeshInstance3D
var _ended := false

var _lanes := 3
var _lane_w := 2.0
var _player_lane := 1  # 0=左 1=中 2=右
var _target_lane_x := 0.0
var _speed := 8.0      # 世界滚动速度（单位/秒）
var _base_speed := 8.0
var _score := 0
var _target_score := 3000
var _lives := 3
var _obstacle_density := 0.4
var _is_jumping := false
var _is_sliding := false
var _slide_timer := 0.0
var _player_vy := 0.0
var _player_y := 0.0
var _spawn_timer := 0.0
var _coin_timer := 0.0
var _invuln := 0.0
var _distance := 0.0

var _obstacles: Array = []   # Array[Dictionary] {node, kind, lane, passed}
var _coins: Array = []       # Array[Dictionary] {node, lane, collected}

const LANE_DEPTH := 60.0     # 障碍生成 z（远端）
const PLAYER_Z := 0.0
const DESPAWN_Z := -8.0      # 越过角色后销毁
const GROUND_Y := 0.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var bp := _endless_runner_blueprint()
	_lanes = clampi(int(bp.get("lanes", 3)), 2, 5)
	_target_score = int(bp.get("targetScore", 3000))
	_base_speed = float(bp.get("speed", 480)) * 0.018  # 像素/秒 → 单位/秒
	_speed = _base_speed
	_obstacle_density = clampf(float(bp.get("obstacleDensity", 0.4)), 0.1, 0.8)
	_lives = GameSpecData.gameplay_i("lives", 3)
	_lane_w = 6.0 / float(_lanes)
	_build_scene()
	_hud.set_extra("←→ 切道 · ↑ 跳 · ↓ 滑铲 · 收集金币")
	_hud.show_banner("无尽跑酷", "达到 %d 分通关" % _target_score, 1.6)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 兼容写法：autoload 没有 endless_runner() 访问器，直接读 raw["endlessRunner"]
func _endless_runner_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	var er = GameSpecData.endless_runner()
	return er if er is Dictionary else {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	# 摄像机：第三人称，角色后方高处
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 5.5, -7.5)
	_camera.look_at(Vector3(0, 1.0, 6.0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)
	# 3 条道（PlaneMesh 铺地）
	for i in range(_lanes):
		var lane := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = Vector2(_lane_w, 120.0)
		lane.mesh = pm
		lane.position = Vector3(_lane_center_x(i), GROUND_Y, 30.0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.18, 0.22, 0.28, 1.0) if i % 2 == 0 else Color(0.22, 0.26, 0.32, 1.0)
		lane.material_override = mat
		_world.add_child(lane)
	# 道线
	for i in range(_lanes + 1):
		var line := MeshInstance3D.new()
		var lm := PlaneMesh.new()
		lm.size = Vector2(0.15, 120.0)
		line.mesh = lm
		line.position = Vector3(-3.0 + i * _lane_w, 0.01, 30.0)
		var lm2 := StandardMaterial3D.new()
		lm2.albedo_color = Color(0.99, 0.85, 0.2, 0.8)
		line.material_override = lm2
		_world.add_child(line)
	# 玩家：CharacterBody3D + CapsuleMesh
	_player = CharacterBody3D.new()
	_player.position = Vector3(0, 1.0, PLAYER_Z)
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.45
	cap.height = 1.6
	col.shape = cap
	_player.add_child(col)
	_player_mesh = MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.45
	cm.height = 1.6
	_player_mesh.mesh = cm
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = GameSpecData.theme_color("playerColor", Color("#38bdf8"))
	_player_mesh.material_override = pmat
	_player.add_child(_player_mesh)
	_world.add_child(_player)
	_target_lane_x = _lane_center_x(_player_lane)


func _lane_center_x(lane: int) -> float:
	# 居中：道 0 在最左
	var total_w := _lane_w * float(_lanes)
	return -total_w / 2.0 + _lane_w * (float(lane) + 0.5)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not _ended:
		GameAudio.boot_interactive()
		match event.keycode:
			KEY_LEFT, KEY_A:
				_shift_lane(-1)
			KEY_RIGHT, KEY_D:
				_shift_lane(1)
			KEY_UP, KEY_W, KEY_SPACE:
				_try_jump()
			KEY_DOWN, KEY_S:
				_try_slide()


func _shift_lane(dir: int) -> void:
	var next := _player_lane + dir
	if next < 0 or next >= _lanes:
		return
	_player_lane = next
	_target_lane_x = _lane_center_x(_player_lane)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _try_jump() -> void:
	if _is_jumping or _is_sliding:
		return
	_is_jumping = true
	_player_vy = 7.5
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _try_slide() -> void:
	if _is_sliding:
		return
	_is_sliding = true
	_slide_timer = 0.6
	_player_mesh.scale.y = 0.5
	_player_mesh.scale.x = 1.3
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _process(delta: float) -> void:
	if _ended:
		return
	# 速度递增：每 500 分 +10%
	var tier := int(_score / 500)
	_speed = _base_speed * (1.0 + float(tier) * 0.1)
	# 平滑切道
	_player.position.x = lerp(_player.position.x, _target_lane_x, clampf(delta * 12.0, 0.0, 1.0))
	# 跳跃物理
	if _is_jumping:
		_player_vy -= 22.0 * delta
		_player_y += _player_vy * delta
		if _player_y <= 0.0:
			_player_y = 0.0
			_player_vy = 0.0
			_is_jumping = false
		_player.position.y = 1.0 + _player_y
	# 滑铲计时
	if _is_sliding:
		_slide_timer -= delta
		if _slide_timer <= 0.0:
			_is_sliding = false
			_player_mesh.scale.y = 1.0
			_player_mesh.scale.x = 1.0
	# 无敌冷却
	if _invuln > 0.0:
		_invuln -= delta
	# 生成节奏
	var spawn_gap := 2.0 + (1.0 - _obstacle_density) * 2.4
	_spawn_timer += delta
	if _spawn_timer >= spawn_gap:
		_spawn_timer = 0.0
		_spawn_obstacle()
	var coin_gap := 0.9 + (1.0 - _obstacle_density) * 0.5
	_coin_timer += delta
	if _coin_timer >= coin_gap:
		_coin_timer = 0.0
		if randf() < 0.6:
			_spawn_coin()
	# 滚动 + 碰撞
	_scroll_world(delta)
	_distance += _speed * delta
	_refresh_hud()


func _spawn_obstacle() -> void:
	var lane := randi_range(0, _lanes - 1)
	var kind_roll := randf()
	var kind := "barrier"
	if kind_roll < 0.4:
		kind = "barrier"
	elif kind_roll < 0.7:
		kind = "high"
	else:
		kind = "low"
	var node := MeshInstance3D.new()
	var box := BoxShape3D.new()
	var col := CollisionShape3D.new()
	var bm := BoxMesh.new()
	var hazard_col := GameSpecData.theme_color("hazardColor", Color("#ef4444"))
	if kind == "barrier":
		bm.size = Vector3(1.6, 2.0, 0.6)
		box.size = Vector3(1.6, 2.0, 0.6)
	elif kind == "high":
		# 高栏：横杆在顶部，需滑铲
		bm.size = Vector3(1.8, 0.5, 0.4)
		box.size = Vector3(1.8, 0.5, 0.4)
		node.position.y = 1.6
	else:
		# 低栏：矮，需跳
		bm.size = Vector3(1.6, 0.7, 0.5)
		box.size = Vector3(1.6, 0.7, 0.5)
		node.position.y = 0.35
	node.mesh = bm
	col.shape = box
	var area := Area3D.new()
	area.add_child(col)
	node.add_child(area)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = hazard_col
	node.material_override = mat
	node.position = Vector3(_lane_center_x(lane), node.position.y, LANE_DEPTH)
	_world.add_child(node)
	_obstacles.append({"node": node, "kind": kind, "lane": lane, "passed": false})


func _spawn_coin() -> void:
	var lane := randi_range(0, _lanes - 1)
	var node := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.35
	cm.bottom_radius = 0.35
	cm.height = 0.1
	node.mesh = cm
	node.rotation.z = deg_to_rad(90.0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("collectibleColor", Color("#fcd34d"))
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 0.6
	node.material_override = mat
	node.position = Vector3(_lane_center_x(lane), 1.2, LANE_DEPTH)
	_world.add_child(node)
	_coins.append({"node": node, "lane": lane, "collected": false})


func _scroll_world(delta: float) -> void:
	var dz := _speed * delta
	# 障碍
	for i in range(_obstacles.size() - 1, -1, -1):
		var ob: Dictionary = _obstacles[i]
		var node: MeshInstance3D = ob["node"]
		node.position.z -= dz
		var kind := str(ob["kind"])
		var lane := int(ob["lane"])
		# 碰撞检测
		if not bool(ob["passed"]) and node.position.z <= PLAYER_Z + 0.6 and node.position.z >= PLAYER_Z - 0.6:
			ob["passed"] = true
			if lane == _player_lane:
				var avoided := false
				if kind == "high" and _is_sliding:
					avoided = true
				elif kind == "low" and _is_jumping and _player_y > 0.6:
					avoided = true
				# barrier 无法避
				if not avoided:
					_on_hit_obstacle()
		if node.position.z < DESPAWN_Z:
			node.queue_free()
			_obstacles.remove_at(i)
	# 金币
	for i in range(_coins.size() - 1, -1, -1):
		var co: Dictionary = _coins[i]
		var node: MeshInstance3D = co["node"]
		node.position.z -= dz
		node.rotation.x += delta * 3.0
		var lane := int(co["lane"])
		if not bool(co["collected"]) and node.position.z <= PLAYER_Z + 0.5 and node.position.z >= PLAYER_Z - 0.5:
			if lane == _player_lane:
				co["collected"] = true
				_on_collect_coin(node)
				node.queue_free()
				_coins.remove_at(i)
				continue
		if node.position.z < DESPAWN_Z:
			node.queue_free()
			_coins.remove_at(i)


func _on_collect_coin(node: MeshInstance3D) -> void:
	_score += 10
	GameJuice.burst(self, _camera.unproject_position(node.position), GameSpecData.theme_color("collectibleColor", Color("#fcd34d")), 8)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	if _score >= _target_score:
		_end(true)


func _on_hit_obstacle() -> void:
	if _invuln > 0.0:
		return
	_lives -= 1
	_invuln = 1.2
	GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.18)
	GameJuice.shake_node(self, 6.0, 0.14)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	_refresh_hud()
	if _lives <= 0:
		_end(false)


func _refresh_hud() -> void:
	var speed_pct := int(_speed / _base_speed * 100.0)
	_hud.set_score("分 %d / %d · 命 %d · 速度 %d%% · 距离 %dm" %
		[_score, _target_score, _lives, speed_pct, int(_distance)])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("通关！", "达成目标分数", 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "再试一次", 2.0)

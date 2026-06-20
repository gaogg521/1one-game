extends Node2D
## 恐怖监控运行时（FNAF 式）：
## - 监控室 + 多个 Area3D 摄像头位置
## - 玩家按 1/2/3/4 切换主视图（移动 Camera3D 到对应位置）
## - 怪物按 spawnIntervalMs 在某个摄像头位置生成
## - 玩家在对应摄像头 + 怪物存在时按空格关门（消耗电力）
## - 怪物停留超过反应窗口未关门 → 跳脸判负
## - 撑过夜晚时长（60s）× nights 夜 = 胜利

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _camera: Camera3D
var _hud := GameHud.new()
var _ended := false
var _particle_mult := 1.0
var _part_color := Color.GOLD

# 蓝图参数（从 spec.horror 读取，缺失走默认）
var _nights := 3
var _cameras_count := 4
var _monster_spawn_ms := 7500.0
var _door_cooldown_ms := 4000.0
var _power_max := 100.0

# 运行时状态
var _power := 100.0
var _night := 1
var _night_end_at := 0.0
var _next_spawn_at := 0.0
var _door_ready_at := 0.0
var _active_cam := 0
var _game_time := 0.0

# 摄像头位置 + 怪物节点
var _cam_nodes: Array = [] # 每个元素 {pos: Vector3, monster: MeshInstance3D, present: bool, at: float, door_closed: bool, door_until: float, label: Label3D}
var _monster_scene_mat: StandardMaterial3D

const REACTION_GRACE_MS := 5200.0
const DOOR_HOLD_MS := 1400.0
const POWER_PER_DOOR := 6.0
const POWER_PER_SWITCH := 1.0
const POWER_DRAIN_PER_SEC := 1.2
const NIGHT_DURATION_MS := 60000.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_load_horror_blueprint()
	_power = _power_max
	_power_max = float(_power_max)
	_part_color = GameSpecData.theme_color("hazardColor", Color(0.86, 0.15, 0.15))
	_particle_mult = GameSpecData.particle_intensity_mult()
	_hud.set_extra("1-6 切换摄像头 · 空格关门 · 撑过 %d 夜胜利" % _nights)
	_build_world()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_night_end_at = _game_time + NIGHT_DURATION_MS / 1000.0
	_next_spawn_at = _game_time + _monster_spawn_ms / 1000.0


func _load_horror_blueprint() -> void:
	# 通过 GameSpecData.horror() 访问器读取蓝图
	var h = GameSpecData.horror()
	if h is Dictionary:
		_nights = int(h.get("nights", 3))
		_cameras_count = int(h.get("cameras", 4))
		_monster_spawn_ms = float(h.get("monsterSpawnIntervalMs", 7500.0))
		_door_cooldown_ms = float(h.get("doorCooldownMs", 4000.0))
		_power_max = float(h.get("powerMax", 100.0))
	# 兜底：clamp 到 schema 边界
	_nights = clampi(_nights, 1, 7)
	_cameras_count = clampi(_cameras_count, 3, 6)
	_monster_spawn_ms = clampf(_monster_spawn_ms, 3000.0, 15000.0)
	_door_cooldown_ms = clampf(_door_cooldown_ms, 1500.0, 10000.0)
	_power_max = clampf(_power_max, 50.0, 200.0)


func _build_world() -> void:
	_add_environment()
	# 监控室中心
	_add_platform(Vector3(0, 0, 0), Vector3(8, 0.3, 6))
	# 摄像头位置：围绕监控室一圈排列
	var radius := 9.0
	_monster_scene_mat = StandardMaterial3D.new()
	_monster_scene_mat.albedo_color = Color(0.86, 0.12, 0.12)
	_monster_scene_mat.emission_enabled = true
	_monster_scene_mat.emission = Color(1.0, 0.1, 0.05)
	_monster_scene_mat.emission_energy_multiplier = 1.4
	for i in range(_cameras_count):
		var angle := (float(i) / float(_cameras_count)) * TAU + PI / 2.0
		var pos := Vector3(cos(angle) * radius, 1.5, sin(angle) * radius)
		# 摄像头标记柱
		var marker := MeshInstance3D.new()
		var m := BoxMesh.new()
		m.size = Vector3(0.4, 2.4, 0.4)
		marker.mesh = m
		marker.position = pos
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.3, 0.5, 0.8)
		marker.material_override = mat
		_world.add_child(marker)
		# 标签
		var lbl := Label3D.new()
		lbl.text = "CAM %d" % (i + 1)
		lbl.position = pos + Vector3(0, 1.6, 0)
		lbl.font_size = 48
		_world.add_child(lbl)
		# 怪物占位（默认隐藏）
		var mon := MeshInstance3D.new()
		var mm := BoxMesh.new()
		mm.size = Vector3(1.2, 2.0, 1.2)
		mon.mesh = mm
		mon.position = pos
		mon.material_override = _monster_scene_mat
		mon.visible = false
		_world.add_child(mon)
		_cam_nodes.append({
			"pos": pos,
			"monster": mon,
			"present": false,
			"at": 0.0,
			"door_closed": false,
			"door_until": 0.0,
			"label": lbl,
		})

	_camera = Camera3D.new()
	_camera.current = true
	_world.add_child(_camera)
	_update_camera()


func _add_environment() -> void:
	var env_n := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.03, 0.04, 0.06)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.08, 0.08, 0.12)
	env.fog_enabled = true
	env.fog_light_color = Color(0.05, 0.05, 0.08)
	env.fog_density = 0.08
	env_n.environment = env
	_world.add_child(env_n)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, 32, 0)
	sun.light_energy = 0.25
	sun.light_color = Color(0.4, 0.45, 0.6)
	_world.add_child(sun)


func _add_platform(pos: Vector3, size: Vector3) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	col.shape = shape
	body.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.12, 0.14, 0.18)
	vis.material_override = mat
	body.add_child(vis)
	_world.add_child(body)


func _update_camera() -> void:
	if _camera == null:
		return
	if _active_cam >= 0 and _active_cam < _cam_nodes.size():
		var cam_pos: Vector3 = _cam_nodes[_active_cam]["pos"]
		# 摄像头视图：从摄像头位置看向监控室中心
		_camera.position = cam_pos + Vector3(0, 1.2, 0)
		_camera.look_at(Vector3(0, 1.0, 0), Vector3.UP)
	else:
		_camera.position = Vector3(0, 6, 12)
		_camera.look_at(Vector3(0, 1, 0), Vector3.UP)


func _switch_cam(target: int) -> void:
	if _ended:
		return
	if target < 0 or target >= _cam_nodes.size():
		return
	if target == _active_cam:
		return
	_active_cam = target
	_power = maxf(0.0, _power - POWER_PER_SWITCH)
	_update_camera()
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _try_close_door() -> void:
	if _ended:
		return
	if _game_time < _door_ready_at:
		return
	if _active_cam < 0 or _active_cam >= _cam_nodes.size():
		return
	_door_ready_at = _game_time + _door_cooldown_ms / 1000.0
	_power = maxf(0.0, _power - POWER_PER_DOOR)
	var entry: Dictionary = _cam_nodes[_active_cam]
	entry["door_closed"] = true
	entry["door_until"] = _game_time + DOOR_HOLD_MS / 1000.0
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	# 若当前摄像头有怪物，关门即清除
	if bool(entry.get("present", false)):
		_kill_monster(entry, true)


func _kill_monster(entry: Dictionary, blocked: bool) -> void:
	entry["present"] = false
	var mon: MeshInstance3D = entry.get("monster", null)
	if mon:
		mon.visible = false
	if blocked:
		var pos: Vector3 = entry.get("pos", Vector3.ZERO)
		GameParticles.spawn(_world, pos, "burst_hit", _part_color, _particle_mult)


func _spawn_monster() -> void:
	if _ended:
		return
	var free_list: Array = []
	for e in _cam_nodes:
		if not bool(e.get("present", false)):
			free_list.append(e)
	if free_list.is_empty():
		return
	var entry: Dictionary = free_list[randi() % free_list.size()]
	entry["present"] = true
	entry["at"] = _game_time
	var mon: MeshInstance3D = entry.get("monster", null)
	if mon:
		mon.visible = true
		mon.scale = Vector3(0.2, 0.2, 0.2)
		var tw := create_tween()
		tw.tween_property(mon, "scale", Vector3(1, 1, 1), 0.35).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)


func _trigger_jumpscare() -> void:
	if _ended:
		return
	_ended = true
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	GameJuice.flash_background(self, Color(0.86, 0.1, 0.1), 0.6)
	GameJuice.shake_node(self, 14.0, 0.5)
	_hud.show_banner("被抓住了！", "怪物闯入监控室", 2.4)
	# 在监控室中心爆散
	GameParticles.spawn(_world, Vector3(0, 1.5, 0), "burst_death", _part_color, _particle_mult * 1.5)
	_end(false)


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("天亮了！", "你活过了 %d 夜" % _nights, 2.6)
		GameParticles.spawn(_world, Vector3(0, 2, 0), "burst_collect", _part_color, _particle_mult * 2.0)
	else:
		if not _hud.banner or not _hud.banner.visible:
			_hud.show_banner("坠落", "再试一次", 2.0)


func _physics_process(delta: float) -> void:
	if _ended:
		return
	_game_time += delta
	_power = maxf(0.0, _power - POWER_DRAIN_PER_SEC * delta)

	# 怪物生成
	if _game_time >= _next_spawn_at:
		_spawn_monster()
		var accel := maxf(0.65, 1.0 - (float(_night) - 1.0) * 0.12)
		_next_spawn_at = _game_time + (_monster_spawn_ms / 1000.0) * accel

	# 检查每个摄像头：怪物超时未关门 → 跳脸
	for e in _cam_nodes:
		if bool(e.get("present", false)):
			var at: float = float(e.get("at", 0.0))
			if _game_time - at > REACTION_GRACE_MS / 1000.0:
				_trigger_jumpscare()
				return
		# 门关闭到期
		if bool(e.get("door_closed", false)):
			var du: float = float(e.get("door_until", 0.0))
			if _game_time >= du:
				e["door_closed"] = false

	# 电力耗尽 → 失败
	if _power <= 0.0:
		_power = 0.0
		_trigger_jumpscare()
		return

	# 夜晚结束 → 下一夜 / 胜利
	if _game_time >= _night_end_at:
		if _night >= _nights:
			_end(true)
			return
		_night += 1
		_night_end_at = _game_time + NIGHT_DURATION_MS / 1000.0
		# 清空所有摄像头怪物
		for e in _cam_nodes:
			if bool(e.get("present", false)):
				_kill_monster(e, false)
			e["door_closed"] = false
		_hud.show_banner("第 %d 夜开始" % _night, "", 1.6)
		GameAudio.play_bleep(GameBleeps.Kind.PICKUP)

	# 输入
	if Input.is_key_pressed(KEY_1):
		_switch_cam(0)
	elif Input.is_key_pressed(KEY_2):
		_switch_cam(1)
	elif Input.is_key_pressed(KEY_3):
		_switch_cam(2)
	elif Input.is_key_pressed(KEY_4):
		_switch_cam(3)
	elif _cameras_count >= 5 and Input.is_key_pressed(KEY_5):
		_switch_cam(4)
	elif _cameras_count >= 6 and Input.is_key_pressed(KEY_6):
		_switch_cam(5)
	if Input.is_action_just_pressed("ui_accept") or Input.is_key_pressed(KEY_SPACE):
		_try_close_door()

	# HUD 刷新
	var cd_left := maxf(0.0, _door_ready_at - _game_time)
	var cd_str := "门就绪" if cd_left <= 0.0 else "门 %.1fs" % cd_left
	var time_left := maxf(0.0, _night_end_at - _game_time)
	_hud.set_score("第 %d/%d 夜 · CAM %d · 电力 %d · 剩余 %.1fs · %s" % [_night, _nights, _active_cam + 1, int(_power), time_left, cd_str])


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()

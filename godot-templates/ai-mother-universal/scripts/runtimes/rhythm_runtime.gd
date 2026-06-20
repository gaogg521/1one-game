extends Node2D
## 3D 节奏音游：4 条轨道，节点从远向近移动到判定线，玩家按 D/F/J/K 命中。
## - GameSpecData.raw.rhythm 提供蓝图（bpm/lanes/patternDensity/hitWindowMs/totalNotes/speedMult）
## - GameSpecData.shader_pack() 通过 GameMaterials.make_from_pack 实例化 material
## - 命中触发 GameParticles.spawn("burst_collect")
## - HUD 用 GameHud

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud := GameHud.new()
var _camera: Camera3D
var _ended := false

# 蓝图
var _bpm := 120.0
var _lanes := 4
var _pattern_density := 0.65
var _hit_window_ms := 140.0
var _total_notes := 50
var _speed_mult := 1.0

# 游戏状态
var _score := 0
var _combo := 0
var _max_combo := 0
var _notes_hit := 0
var _notes_missed := 0
var _notes_spawned := 0
var _win_score := 0
var _max_miss := 0

# 节奏/移动
var _beat_sec := 0.5
var _spawn_interval := 0.5
var _spawn_timer := 0.0
var _fall_speed := 4.0  # 世界单位/秒，z 方向
var _judge_z := 0.0     # 判定线 z
var _spawn_z := -10.0   # 远端出生 z
var _game_time := 0.0
var _particle_mult := 1.0
var _part_color := Color.GOLD

# 节点池：每个节点 = MeshInstance3D，附带 lane
var _notes: Array = []
# 轨道按键映射
const LANE_KEYS := [KEY_D, KEY_F, KEY_J, KEY_K]
const LANE_LABELS := ["D", "F", "J", "K"]
# 轨道 x 坐标（在 _build_world 中初始化）
var _lane_x: Array = []
# 轨道按键瞬时按下标志（在 _unhandled_input 中累加，_physics_process 中消费）
var _lane_pressed: Array = []
# 轨道高亮 mesh（按下时闪）
var _lane_flash_mesh: Array = []
# 轨道分隔/底色
var _track_meshes: Array = []
# 判定线 mesh
var _judge_line_mesh: MeshInstance3D


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_load_blueprint()
	_win_score = GameSpecData.gameplay_i("winScore", int(float(_total_notes) * 0.6 * 100))
	_max_miss = int(float(_total_notes) * 0.4)
	_part_color = GameSpecData.theme_color("collectibleColor", _part_color)
	_particle_mult = GameSpecData.particle_intensity_mult()
	_beat_sec = 60.0 / _bpm
	_spawn_interval = _beat_sec
	# 下落速度：z 距离 / (2 拍 * speedMult)
	_fall_speed = absf(_spawn_z - _judge_z) / (_beat_sec * 2.0 * _speed_mult)
	for i in range(_lanes):
		_lane_pressed.append(false)
	_hud.set_extra("D / F / J / K 命中下落节点 · Perfect +100 / Good +50")
	_build_world()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _load_blueprint() -> void:
	var bp = GameSpecData.rhythm()
	if not bp is Dictionary:
		bp = {}
	if bp.has("bpm"):
		_bpm = float(bp["bpm"])
	if bp.has("lanes"):
		_lanes = clampi(int(bp["lanes"]), 3, 6)
	# 固定 4 条轨道（与按键映射对齐）
	_lanes = 4
	if bp.has("patternDensity"):
		_pattern_density = clampf(float(bp["patternDensity"]), 0.2, 1.0)
	if bp.has("hitWindowMs"):
		_hit_window_ms = clampf(float(bp["hitWindowMs"]), 60.0, 220.0)
	if bp.has("totalNotes"):
		_total_notes = clampi(int(bp["totalNotes"]), 12, 160)
	if bp.has("speedMult"):
		_speed_mult = clampf(float(bp["speedMult"]), 0.6, 2.0)


func _build_world() -> void:
	_add_environment()
	# 4 条轨道平面，沿 x 排列，z 从 _spawn_z 到 _judge_z
	var spacing := 1.2
	var total_w := spacing * float(_lanes)
	var start_x := -total_w / 2.0 + spacing / 2.0
	for i in range(_lanes):
		var lx := start_x + float(i) * spacing
		_lane_x.append(lx)
		# 轨道底色平面
		var plane := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = Vector2(spacing * 0.9, absf(_spawn_z - _judge_z))
		plane.mesh = pm
		plane.position = Vector3(lx, 0.0, (_spawn_z + _judge_z) / 2.0)
		# 让平面朝向 +y（默认 PlaneMesh 法线为 +y，符合地板）
		var mat := StandardMaterial3D.new()
		var lane_col := _lane_color(i)
		mat.albedo_color = lane_col.darkened(0.7)
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		plane.material_override = mat
		_world.add_child(plane)
		_track_meshes.append(plane)
		# 按键闪光 mesh（按下时变亮）
		var flash := MeshInstance3D.new()
		var fm := PlaneMesh.new()
		fm.size = Vector2(spacing * 0.85, 1.0)
		flash.mesh = fm
		flash.position = Vector3(lx, 0.05, _judge_z)
		var fmat := StandardMaterial3D.new()
		fmat.albedo_color = Color(1, 1, 1, 0)
		fmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		fmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		flash.material_override = fmat
		_world.add_child(flash)
		_lane_flash_mesh.append(flash)
	# 判定线：一条横跨所有轨道的细长 box
	_judge_line_mesh = MeshInstance3D.new()
	var jm := BoxMesh.new()
	jm.size = Vector3(total_w, 0.06, 0.08)
	_judge_line_mesh.mesh = jm
	_judge_line_mesh.position = Vector3(0.0, 0.03, _judge_z)
	var jmat := StandardMaterial3D.new()
	jmat.albedo_color = Color(0.99, 0.88, 0.16)
	jmat.emission_enabled = true
	jmat.emission = Color(0.99, 0.88, 0.16)
	jmat.emission_energy_multiplier = 1.2
	_judge_line_mesh.material_override = jmat
	_world.add_child(_judge_line_mesh)
	# 相机：俯视斜角
	_camera = Camera3D.new()
	_camera.current = true
	_camera.position = Vector3(0.0, 4.5, 2.0)
	_camera.look_at(Vector3(0.0, 0.0, _judge_z - 2.0), Vector3.UP)
	_world.add_child(_camera)


func _add_environment() -> void:
	var env_n := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = GameSpecData.theme_color("backgroundColor", Color("#0b1220"))
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = env.background_color.lightened(0.2)
	env_n.environment = env
	_world.add_child(env_n)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, 32, 0)
	sun.light_energy = 1.0
	sun.shadow_enabled = true
	_world.add_child(sun)


func _lane_color(lane: int) -> Color:
	var palette := [
		Color("#38bdf8"),
		Color("#4ade80"),
		Color("#fbbf24"),
		Color("#f472b6"),
		Color("#a78bfa"),
		Color("#f87171"),
	]
	return palette[lane % palette.size()]


func _physics_process(delta: float) -> void:
	if _ended:
		return
	_game_time += delta
	# 消费按键
	for i in range(_lanes):
		if _lane_pressed[i]:
			_lane_pressed[i] = false
			_handle_lane_press(i)
	# 生成节点
	_spawn_timer += delta
	if _spawn_timer >= _spawn_interval and _notes_spawned < _total_notes:
		_spawn_timer = 0.0
		_try_spawn_note()
	# 移动节点 + miss 检测
	var dz := _fall_speed * delta
	var win_sec := _hit_window_ms / 1000.0
	for i in range(_notes.size() - 1, -1, -1):
		var note: Dictionary = _notes[i]
		if note.get("hit", false) or note.get("missed", false):
			continue
		var mesh: MeshInstance3D = note.get("mesh", null)
		if mesh == null:
			continue
		var z := mesh.position.z + dz
		mesh.position.z = z
		# 越过判定线超过 hit window → miss
		var past_sec := (z - _judge_z) / _fall_speed
		if past_sec > win_sec:
			note["missed"] = true
			_notes_missed += 1
			_combo = 0
			_show_feedback("Miss", note.get("lane", 0), Color("#ef4444"))
			if mesh:
				mesh.queue_free()
			_notes.remove_at(i)
			if _notes_missed >= _max_miss:
				_end(false)
				return
	# 清理已命中的 mesh（飞出视野）
	for i in range(_notes.size() - 1, -1, -1):
		var note: Dictionary = _notes[i]
		var mesh: MeshInstance3D = note.get("mesh", null)
		if note.get("hit", false) and mesh and mesh.position.z > 6.0:
			mesh.queue_free()
			_notes.remove_at(i)
	# 全部生成且场上无节点 → 收尾
	if _notes_spawned >= _total_notes and _notes.is_empty():
		_end(_score >= _win_score)
	_refresh_hud()


func _try_spawn_note() -> void:
	# 按 pattern_density 概率决定本拍是否生成
	if randf() > _pattern_density:
		return
	var lane := randi() % _lanes
	_spawn_note(lane)


func _spawn_note(lane: int) -> void:
	var lx: float = _lane_x[lane]
	var mesh := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.9, 0.18, 0.5)
	mesh.mesh = bm
	mesh.position = Vector3(lx, 0.12, _spawn_z)
	var col := _lane_color(lane)
	mesh.material_override = GameMaterials.make_from_pack(GameSpecData.shader_pack(), col)
	_world.add_child(mesh)
	# 节点上贴按键提示（Label3D 标签）
	var label := Label3D.new()
	label.text = LANE_LABELS[lane]
	label.font_size = 48
	label.position = Vector3(0, 0.0, 0)
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	mesh.add_child(label)
	_notes.append({
		"lane": lane,
		"mesh": mesh,
		"hit": false,
		"missed": false,
		"spawned_at": _game_time,
	})
	_notes_spawned += 1


func _handle_lane_press(lane: int) -> void:
	if _ended:
		return
	# 轨道闪光
	_flash_lane(lane)
	# 寻找该轨道最接近判定线且未处理的节点
	var best_idx := -1
	var best_delta := INF
	var win_sec := _hit_window_ms / 1000.0
	for i in range(_notes.size()):
		var note: Dictionary = _notes[i]
		if note.get("hit", false) or note.get("missed", false):
			continue
		if int(note.get("lane", -1)) != lane:
			continue
		var mesh: MeshInstance3D = note.get("mesh", null)
		if mesh == null:
			continue
		var delta_sec := absf((mesh.position.z - _judge_z) / _fall_speed)
		if delta_sec < best_delta:
			best_delta = delta_sec
			best_idx = i
	if best_idx < 0 or best_delta > win_sec:
		# 空按：断连击
		_combo = 0
		return
	var note: Dictionary = _notes[best_idx]
	note["hit"] = true
	_notes_hit += 1
	_combo += 1
	_max_combo = maxi(_max_combo, _combo)
	var gain := 50
	var grade := "Good"
	if best_delta < win_sec * 0.4:
		grade = "Perfect"
		gain = 100
	# 连击奖励：每 10 连击 +20
	var combo_bonus := int(_combo / 10) * 20
	_score += gain + combo_bonus
	_show_feedback(grade, lane, Color("#fde047") if grade == "Perfect" else Color("#4ade80"))
	# 命中粒子
	var lx: float = _lane_x[lane]
	GameParticles.spawn(_world, Vector3(lx, 0.3, _judge_z), "burst_collect", _part_color, _particle_mult)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	if _score >= _win_score:
		_end(true)


func _flash_lane(lane: int) -> void:
	var mesh: MeshInstance3D = _lane_flash_mesh[lane]
	if mesh == null:
		return
	var mat: StandardMaterial3D = mesh.material_override
	if mat == null:
		return
	mat.albedo_color = Color(1, 1, 1, 0.5)
	# 用 Tween 渐隐
	var tw := create_tween()
	tw.tween_method(
		func(a: float): mat.albedo_color = Color(1, 1, 1, a),
		0.5, 0.0, 0.2
	)


func _show_feedback(text: String, lane: int, color: Color) -> void:
	# 用 HUD banner 简化反馈（避免 3D 文本复杂度）
	# 仅 Perfect/Good/Miss 简短提示；为减少 banner 抖动，仅 Perfect 时显示
	if text == "Perfect" and _combo > 0 and _combo % 5 == 0:
		_hud.show_banner("Perfect x%d" % _combo, "", 0.8)


func _refresh_hud() -> void:
	var lives_left := maxi(0, _max_miss - _notes_missed)
	_hud.set_score("分数 %d · 连击 %d · 进度 %d/%d · 命 %d" % [_score, _combo, _notes_hit, _total_notes, lives_left])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1, 0.7), 0.35)
		_hud.show_banner("通关！", "最大连击 %d" % _max_combo, 2.4)
		GameParticles.spawn(_world, Vector3(0, 0.5, _judge_z), "burst_collect", _part_color, _particle_mult * 2.0)
	else:
		_hud.show_banner("失败", "再试一次", 2.0)
		GameParticles.spawn(_world, Vector3(0, 0.5, _judge_z), "burst_death", _part_color, _particle_mult)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed and not event.echo:
		GameAudio.boot_interactive()
		var code: int = int(event.keycode)
		for i in range(_lanes):
			if code == LANE_KEYS[i]:
				_lane_pressed[i] = true
				break

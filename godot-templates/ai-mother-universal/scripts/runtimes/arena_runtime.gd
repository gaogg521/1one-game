extends Node2D
## 3D 俯视角竞技场：avoider / collector / survivor — 导演、护盾、收集

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

const PAD_PX := 48.0

var _player: CharacterBody3D
var _camera: Camera3D
var _hazards_root: Node3D
var _collectibles_root: Node3D
var _hud := GameHud.new()
var _director := GameDirector.new()
var _tid := "avoider"
var _game_time := 0.0
var _score := 0
var _lives := 3
var _win := 10
var _spawn_cd := 0.0
var _ended := false
var _invuln := 0.0
var _shield := 0
var _magnet_until := 0.0
var _slow_until := 0.0
var _skill_cd := 0.0
var _intensity := 0.55
var _goal_shift_until := 0.0
var _goal_shift_need := 5
var _goal_shift_have := 0
var _golden_window := false
var _survival_tick := 0.0
var _player_speed := 5.2
var _bounds_rect := Rect2()


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_tid = GameSpecData.arena_mode()
	_apply_sample_profile()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_lives = GameSpecData.gameplay_i("lives", 3)
	_win = GameSpecData.gameplay_i("winScore", 10)
	_intensity = float(GameSpecData.director().get("intensity", 0.55))
	_player_speed = GameSpecData.gameplay_f("playerSpeed", 260) * 0.02
	_bounds_rect = Rect2(PAD_PX, PAD_PX, Runtime3DEnv.MAP_W - PAD_PX * 2.0, Runtime3DEnv.MAP_H - PAD_PX * 2.0)
	_director.load_from_spec()
	_director.banner.connect(func(t, m): _hud.show_banner(t, m))
	_director.spawn_mini_boss.connect(_spawn_boss_hazard)
	_director.golden_pickup_window.connect(_on_golden_pickup)
	_build_world()
	_hint_mode()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _apply_sample_profile() -> void:
	var ap := GameSpecData.sample_play_profile().get("arena", {})
	if ap is Dictionary and ap.size() > 0:
		_intensity = float(ap.get("intensity", _intensity))
		var speed_scale := float(ap.get("speedScale", 1.0))
		_player_speed = GameSpecData.gameplay_f("playerSpeed", 260) * 0.02 * speed_scale


func _build_world() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#1a2220")))
	_camera = Runtime3DEnv.make_camera(_world, true)
	_add_ground()
	_hazards_root = Node3D.new()
	_hazards_root.name = "Hazards"
	_world.add_child(_hazards_root)
	_collectibles_root = Node3D.new()
	_collectibles_root.name = "Collectibles"
	_world.add_child(_collectibles_root)
	_player = _make_player()
	_world.add_child(_player)


func _add_ground() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(Runtime3DEnv.MAP_W * Runtime3DEnv.SCALE, 0.2, Runtime3DEnv.MAP_H * Runtime3DEnv.SCALE)
	col.shape = shape
	floor_body.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = shape.size
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("backgroundColor", Color("#1a2220")).lightened(0.08)
	vis.material_override = mat
	floor_body.add_child(vis)
	floor_body.position = Vector3(0, -0.1, 0)
	_world.add_child(floor_body)


func _make_player() -> CharacterBody3D:
	var body := CharacterBody3D.new()
	body.position = Runtime3DEnv.px_to_world(Vector2(400, 300), 0.55)
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.36
	cap.height = 0.72
	col.shape = cap
	body.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := CapsuleMesh.new()
	mesh.radius = 0.36
	mesh.height = 0.72
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("playerColor", Color.GREEN)
	vis.material_override = mat
	body.add_child(vis)
	var ref := RuntimeReferenceRegistry.protagonist_texture
	if ref:
		var spr := Sprite3D.new()
		spr.texture = ref
		spr.pixel_size = 0.01
		spr.position = Vector3(0, 0.15, 0.28)
		spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		body.add_child(spr)
		vis.visible = false
	return body


func _hint_mode() -> void:
	var mode := ""
	match _tid:
		"collector":
			mode = "收集 %s · 躲避 %s" % [GameSpecData.labels("collectible", "宝物"), GameSpecData.labels("hazard", "威胁")]
		"survivor":
			mode = "生存 · %s" % GameSpecData.labels("hazard", "威胁")
		"avoider":
			mode = "躲避 %s" % GameSpecData.labels("hazard", "威胁")
		_:
			mode = "竞技场"
	_hud.set_extra("%s · WASD移动 · Shift技能 · 目标 %d" % [mode, _win])


func _physics_process(delta: float) -> void:
	if _ended or _player == null:
		return
	_game_time += delta
	var progress := clampf(float(_score) / float(maxi(_win, 1)), 0.0, 1.0)
	var d_out := _director.tick(progress, delta)
	if d_out.get("coin_gain", 0) > 0 and _tid == "collector":
		_score += 1
	if _director.goal_shift_until > _game_time and _goal_shift_until <= _game_time:
		_goal_shift_until = _director.goal_shift_until
		_goal_shift_need = int(4 + _director.active_strength * 5)
		_goal_shift_have = 0
	_invuln = maxf(0.0, _invuln - delta)
	_skill_cd = maxf(0.0, _skill_cd - delta)
	if d_out.get("time_slow", false):
		_slow_until = 0.5
	_move_player(delta)
	_tick_survival_score(delta)
	_spawn_cd -= delta
	var interval := GameSpecData.gameplay_f("spawnIntervalMs", 800) / 1000.0
	interval *= lerpf(1.2, 0.55, _intensity)
	interval *= float(d_out.get("spawn_relief", 1.0))
	interval /= maxf(float(d_out.get("spawn_boost", 1.0)), 0.35)
	if _spawn_cd <= 0.0:
		_spawn_cd = interval
		_spawn_hazard()
		if _tid == "collector" and (randf() < 0.42 or _golden_window):
			_spawn_collectible(_golden_window)
		if _director.active_type == "finalBarrage" and _tid == "avoider":
			_spawn_hazard(1.0, 1.1)
	_tick_hazards(delta)
	if _magnet_until > 0.0:
		_magnet_until -= delta
		_magnet_collect()
	_hud.set_score("分 %d/%d · 命 %d · 盾 %d" % [_score, _win, _lives, _shield])
	if _score >= _win:
		_end(true)


func _tick_survival_score(delta: float) -> void:
	if _tid == "collector":
		return
	_survival_tick += delta
	var every := 1.8 if _tid == "survivor" else 2.4
	if _survival_tick >= every:
		_survival_tick = 0.0
		_score += 1
		if _game_time < _goal_shift_until:
			_goal_shift_have += 1


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and _camera:
		Runtime3DEnv.raycast_world(_viewport, _camera, _viewport.get_mouse_position())
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()
		if event.keycode == KEY_SHIFT:
			_try_skill()


func _try_skill() -> void:
	if _skill_cd > 0.0:
		return
	_skill_cd = 8.0
	_shield += 1
	_hud.flash_banner("护盾 +1")


func _move_player(_delta: float) -> void:
	var dir := Input.get_vector("move_left", "move_right", "ui_up", "ui_down")
	if dir.length_squared() < 0.01:
		dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var vel := Vector3(dir.x, 0.0, dir.y).normalized() * _player_speed
	_player.velocity = vel
	_player.move_and_slide()
	var px := Runtime3DEnv.world_to_px(_player.position)
	px = px.clamp(_bounds_rect.position, _bounds_rect.position + _bounds_rect.size)
	_player.position = Runtime3DEnv.px_to_world(px, _player.position.y)


func _spawn_boss_hazard() -> void:
	for i in range(3):
		_spawn_hazard(1.6, 1.35)


func _spawn_hazard(size_mul: float = 1.0, speed_mul: float = 1.0) -> void:
	var body := CharacterBody3D.new()
	var radius := 0.28 * size_mul
	var col := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = radius
	col.shape = shape
	body.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("hazardColor", Color.ORANGE)
	vis.material_override = mat
	body.add_child(vis)
	var mt := RuntimeReferenceRegistry.next_monster_texture()
	if mt:
		var spr := Sprite3D.new()
		spr.texture = mt
		spr.pixel_size = 0.008 * size_mul
		spr.position = Vector3(0, radius * 0.6, 0)
		spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		body.add_child(spr)
		vis.visible = false
	_hazards_root.add_child(body)
	var edge := randi() % 4
	var pos_px := Vector2(400, 300)
	match edge:
		0: pos_px = Vector2(randf_range(PAD_PX, Runtime3DEnv.MAP_W - PAD_PX), PAD_PX)
		1: pos_px = Vector2(randf_range(PAD_PX, Runtime3DEnv.MAP_W - PAD_PX), Runtime3DEnv.MAP_H - PAD_PX)
		2: pos_px = Vector2(PAD_PX, randf_range(PAD_PX, Runtime3DEnv.MAP_H - PAD_PX))
		3: pos_px = Vector2(Runtime3DEnv.MAP_W - PAD_PX, randf_range(PAD_PX, Runtime3DEnv.MAP_H - PAD_PX))
	body.position = Runtime3DEnv.px_to_world(pos_px, 0.5)
	var spd := GameSpecData.gameplay_f("hazardSpeed", 180) * Runtime3DEnv.SCALE
	spd *= lerpf(0.85, 1.25, _intensity) * speed_mul
	if _slow_until > 0.0:
		spd *= 0.55
		_slow_until -= get_physics_process_delta_time()
	var to_player := _player.global_position - body.global_position
	to_player.y = 0.0
	body.set_meta("vel", to_player.normalized() * spd)
	body.set_meta("size_mul", size_mul)


func _on_golden_pickup(active: bool) -> void:
	_golden_window = active
	if active:
		for _i in range(3):
			_spawn_collectible(true)


func _spawn_collectible(golden: bool = false) -> void:
	var area := Area3D.new()
	var radius := 0.22 if golden else 0.2
	var col := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = radius
	col.shape = shape
	area.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	var col_c := Color.GOLD if golden else GameSpecData.theme_color("collectibleColor", Color.GOLD)
	mat.albedo_color = col_c
	mat.emission_enabled = true
	mat.emission = col_c * 0.35
	vis.material_override = mat
	area.add_child(vis)
	area.set_meta("golden", golden)
	_collectibles_root.add_child(area)
	var pos_px := Vector2(randf_range(PAD_PX + 24, Runtime3DEnv.MAP_W - PAD_PX - 24), randf_range(PAD_PX + 24, Runtime3DEnv.MAP_H - PAD_PX - 24))
	area.position = Runtime3DEnv.px_to_world(pos_px, 0.45)
	area.body_entered.connect(_on_pickup.bind(area))


func _on_pickup(body: Node3D, area: Area3D) -> void:
	if body != _player or _ended:
		return
	var gain := 2 if area.get_meta("golden", false) else 1
	_score += gain
	if _game_time < _goal_shift_until:
		_goal_shift_have += gain
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	if _camera:
		GameJuice.burst(self, _camera.unproject_position(area.global_position), GameSpecData.theme_color("collectibleColor", Color.GOLD), 8)
	GameJuice.flash_background(self, GameSpecData.theme_color("collectibleColor", Color.GOLD), 0.18)
	area.queue_free()


func _tick_hazards(delta: float) -> void:
	var hit_dist := 0.44
	var to_remove: Array[Node] = []
	for child in _hazards_root.get_children():
		if not child is CharacterBody3D:
			continue
		var hv: Vector3 = child.get_meta("vel", Vector3.ZERO)
		child.position += hv * delta
		var flat := Vector2(child.position.x - _player.position.x, child.position.z - _player.position.z)
		if flat.length() < hit_dist:
			if _invuln <= 0.0:
				if _shield > 0:
					_shield -= 1
					if _camera:
						GameJuice.burst(self, _camera.unproject_position(child.global_position), Color(0.5, 0.85, 1), 6)
					GameJuice.flash_background(self, Color(0.5, 0.85, 1), 0.15)
				else:
					_lives -= 1
					_invuln = 1.0
					GameAudio.play_bleep(GameBleeps.Kind.HIT)
					GameJuice.shake_node(self, 7.0, 0.14)
					GameJuice.flash_background(self, GameSpecData.theme_color("hazardColor", Color.ORANGE), 0.3)
					if _lives <= 0:
						_end(false)
			to_remove.append(child)
		else:
			var px := Runtime3DEnv.world_to_px(child.position)
			if not Rect2(-60, -60, 920, 720).has_point(px):
				to_remove.append(child)
	for n in to_remove:
		n.queue_free()


func _magnet_collect() -> void:
	for c in _collectibles_root.get_children():
		if not c is Area3D:
			continue
		c.position = c.position.lerp(_player.position, 0.12)
		var flat := Vector2(c.position.x - _player.position.x, c.position.z - _player.position.z)
		if flat.length() < 0.36:
			_score += 1
			GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
			if _camera:
				GameJuice.burst(self, _camera.unproject_position(c.global_position), GameSpecData.theme_color("collectibleColor", Color.GOLD), 6)
			c.queue_free()


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.55, 1, 0.65), 0.32)
		GameJuice.shake_node(self, 3.0, 0.08)
	_hud.show_banner("胜利！" if won else "失败", "", 2.2)

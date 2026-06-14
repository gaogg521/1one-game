extends Node2D
## 3D 横版平台：SubViewport 侧视滚动、收集与陷阱（Astrocade 级）

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _player: CharacterBody3D
var _camera: Camera3D
var _hud := GameHud.new()
var _director := GameDirector.new()
var _score := 0
var _lives := 3
var _win := 28
var _ended := false
var _invuln := 0.0
var _world_w := 48.0
var _game_time := 0.0
var _part_color := Color.GOLD
var _goal_shift_until := 0.0
var _goal_shift_need := 6
var _goal_shift_have := 0
var _goal_shift_ok := false
var _move_speed := 7.5
var _jump_v := 9.5
var _gravity := 22.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_director.load_from_spec()
	_director.banner.connect(func(t, m): _hud.show_banner(t, m))
	_director.goal_shift_ended.connect(_on_goal_shift_ended)
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_lives = GameSpecData.gameplay_i("lives", 3)
	_win = GameSpecData.gameplay_i("winScore", 28)
	var plat := GameSpecData.platformer()
	if plat.has("suggestedWinScore"):
		_win = maxi(_win, int(plat.get("suggestedWinScore", _win)))
	var plat_pf := GameSpecData.sample_play_profile().get("platformer", {})
	if plat_pf is Dictionary and bool(plat_pf.get("treasureHeist", false)):
		_hud.set_extra("WASD/方向键 · 空格跳跃 · 偷取金色目标 · Shift 摆荡")
	elif plat_pf is Dictionary and bool(plat_pf.get("laserSentries", false)):
		_hud.set_extra("WASD/方向键 · 空格跳跃 · 避开激光哨戒")
	else:
		_hud.set_extra("WASD/方向键移动 · 空格跳跃 · 收集 %s" % GameSpecData.labels("collectible", "能量核"))
	_move_speed = GameSpecData.gameplay_f("playerSpeed", 300) * 0.025
	_jump_v = GameSpecData.gameplay_f("jumpStrength", 430) * 0.022
	_part_color = GameSpecData.theme_color("collectibleColor", _part_color)
	_build_world()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _build_world() -> void:
	_add_environment()
	var ground_y := 0.0
	var plat := GameSpecData.platformer()
	var layers := int(plat.get("levelLayers", 48))
	var cols := clampi(int(float(layers) / 6.5), 10, 18)
	for i in range(cols):
		var px := 3.0 + i * 4.5
		_add_platform(Vector3(px, ground_y, 0), Vector3(3.6, 0.35, 2.2))
		if i % 2 == 0:
			_add_platform(Vector3(px + 1.2, ground_y + 1.4, 0), Vector3(1.6, 0.3, 1.8))
			_add_gem(Vector3(px + 1.2, ground_y + 2.0, 0))
		if i > 0 and i % 3 == 0:
			_add_spike(Vector3(px - 0.6, ground_y + 0.35, 0))
	_add_platform(Vector3(1.5, ground_y, 0), Vector3(4.5, 0.35, 2.4))
	_world_w = 3.0 + cols * 4.5

	_player = CharacterBody3D.new()
	_player.position = Vector3(1.5, 1.2, 0)
	var pcol := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.05
	pcol.shape = cap
	_player.add_child(pcol)
	var pmesh := MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.38
	cm.height = 1.05
	pmesh.mesh = cm
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = GameSpecData.theme_color("playerColor", Color.GOLD)
	pmesh.material_override = pmat
	_player.add_child(pmesh)
	var ref := RuntimeReferenceRegistry.protagonist_texture
	if ref:
		var spr := Sprite3D.new()
		spr.texture = ref
		spr.pixel_size = 0.012
		spr.position = Vector3(0, 0.1, 0.35)
		spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_player.add_child(spr)
		pmesh.visible = false
	_world.add_child(_player)

	_camera = Camera3D.new()
	_camera.current = true
	_world.add_child(_camera)
	_update_camera()


func _add_environment() -> void:
	var env_n := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = GameSpecData.theme_color("backgroundColor", Color("#1a2220"))
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = env.background_color.lightened(0.2)
	env_n.environment = env
	_world.add_child(env_n)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, 32, 0)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
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
	mat.albedo_color = GameSpecData.theme_color("playerColor", Color.GREEN).darkened(0.35)
	vis.material_override = mat
	body.add_child(vis)
	_world.add_child(body)


func _add_gem(pos: Vector3) -> void:
	var area := Area3D.new()
	area.position = pos
	var col := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.28
	col.shape = shape
	area.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.28
	mesh.height = 0.56
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = _part_color
	mat.emission_enabled = true
	mat.emission = _part_color * 0.35
	vis.material_override = mat
	area.add_child(vis)
	area.body_entered.connect(_on_gem.bind(area))
	_world.add_child(area)


func _add_spike(pos: Vector3) -> void:
	var area := Area3D.new()
	area.position = pos
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.9, 0.45, 0.9)
	col.shape = shape
	area.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = shape.size
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("hazardColor", Color.ORANGE)
	vis.material_override = mat
	area.add_child(vis)
	area.body_entered.connect(_on_spike)
	_world.add_child(area)


func _on_gem(body: Node3D, area: Area3D) -> void:
	if body != _player or _ended:
		return
	var pos := area.global_position
	_score += 1
	if _game_time < _goal_shift_until:
		_goal_shift_have += 1
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	if _camera:
		GameJuice.burst(self, _camera.unproject_position(pos), _part_color, 10)
	GameJuice.flash_background(self, _part_color, 0.18)
	area.queue_free()
	if _goal_shift_have >= _goal_shift_need and _game_time < _goal_shift_until:
		_goal_shift_ok = true
	if _score >= _win:
		_end(true)


func _on_spike(body: Node3D) -> void:
	if body != _player or _invuln > 0.0:
		return
	_hurt()


func _hurt() -> void:
	_lives -= 1
	_invuln = 1.4
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	GameJuice.shake_node(self, 8.0, 0.16)
	GameJuice.flash_background(self, GameSpecData.theme_color("hazardColor", Color.ORANGE), 0.32)
	if _lives <= 0:
		_end(false)


func _physics_process(delta: float) -> void:
	if _ended or _player == null:
		return
	_game_time += delta
	var progress := clampf(float(_score) / float(maxi(_win, 1)), 0.0, 1.0)
	var d_out := _director.tick(progress, delta)
	if d_out.get("coin_gain", 0) > 0:
		_score += 1
	if _director.active_type == "goalShift" and _goal_shift_until <= _game_time:
		_goal_shift_until = _director.goal_shift_until
		_goal_shift_need = int(4 + _director.active_strength * 5)
		_goal_shift_have = 0
		_goal_shift_ok = false
	var gs_left := ""
	if _game_time < _goal_shift_until:
		gs_left = " · 目标 %d/%d" % [_goal_shift_have, _goal_shift_need]
	_invuln = maxf(0.0, _invuln - delta)

	var dir := Input.get_axis("ui_left", "ui_right")
	if Input.is_key_pressed(KEY_A):
		dir -= 1.0
	if Input.is_key_pressed(KEY_D):
		dir += 1.0
	var vel := _player.velocity
	vel.x = dir * _move_speed
	vel.z = 0.0
	if _player.is_on_floor() and (Input.is_action_just_pressed("ui_accept") or Input.is_key_pressed(KEY_SPACE) or Input.is_key_pressed(KEY_W)):
		vel.y = _jump_v
	vel.y -= _gravity * delta
	_player.velocity = vel
	_player.move_and_slide()
	_update_camera()

	_hud.set_score("收集 %d / %d · 命 %d%s" % [_score, _win, _lives, gs_left])


func _update_camera() -> void:
	if _camera == null or _player == null:
		return
	var cx := clampf(_player.position.x, 2.0, _world_w - 2.0)
	_camera.position = Vector3(cx, 4.2, 9.5)
	_camera.look_at(Vector3(cx, 1.0, 0), Vector3.UP)


func _on_goal_shift_ended(_success: bool) -> void:
	if _goal_shift_ok:
		_score += 5
		_hud.show_banner("冲刺达成", "额外收集奖励", 1.8)
		GameJuice.flash_background(self, Color(0.6, 1, 0.75), 0.28)
	else:
		_hud.show_banner("冲刺结束", "下一段继续", 1.4)


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1, 0.7), 0.35)
		_hud.show_banner("通关！", "章节完成", 2.4)
	else:
		_hud.show_banner("坠落", "再试一次", 2.0)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()

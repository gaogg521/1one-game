extends Node2D
## 3D 俯视角射击：自动开火、敌舰下压、波次与导演

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _player: CharacterBody3D
var _camera: Camera3D
var _bullets_root: Node3D
var _enemies_root: Node3D
var _enemy_bullets_root: Node3D
var _hud = GameHud.new()
var _director = GameDirector.new()
var _score = 0
var _lives = 3
var _wave = 0
var _win_score = 50
var _fire_cd = 0.0
var _enemy_fire_cd = 0.0
var _spawn_cd = 0.0
var _enemies_left = 0
var _wave_clearing = false
var _between_waves_until = 0.0
var _ended = false
var _invuln = 0.0
var _player_speed = 5.6
var _bullet_speed = 10.4
var _game_time = 0.0
var _score_mult = 1.0
var _burst_until = 0.0
var _shots_fired = 0
var _bounds_x = Vector2(-7.2, 7.2)
var _player_z = 4.4
var _orbit_mode = false
var _orbit_angle = -PI * 0.5
var _orbit_speed = 0.0018
var _planet_center = Vector3.ZERO
var _sniper_scope = false
var _particle_mult = 1.0
var _player_mat: Material


func _ready() -> void:
	GameAudio.boot_interactive()
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_particle_mult = GameSpecData.particle_intensity_mult()
	var sp = GameSpecData.sample_play_profile().get("shooter", {})
	if sp is Dictionary:
		_orbit_mode = bool(sp.get("orbitChopper", false))
		_sniper_scope = bool(sp.get("sniperScope", false))
	_win_score = GameSpecData.gameplay_i("winScore", 50)
	_lives = GameSpecData.gameplay_i("lives", 3)
	_player_speed = GameSpecData.gameplay_f("playerSpeed", 280) * 0.02
	_bullet_speed = GameSpecData.gameplay_f("jumpStrength", 520) * 0.02
	_bounds_x = Vector2(40.0 * Runtime3DEnv.SCALE - Runtime3DEnv.MAP_W * Runtime3DEnv.SCALE * 0.5,
		760.0 * Runtime3DEnv.SCALE - Runtime3DEnv.MAP_W * Runtime3DEnv.SCALE * 0.5)
	_wave = 1
	_director.load_from_spec()
	_director.banner.connect(func(t, m): _hud.show_banner(t, m))
	_director.spawn_mini_boss.connect(_spawn_boss_enemy)
	_director.goal_shift_ended.connect(_on_goal_shift_ended)
	_player_z = Runtime3DEnv.px_to_world(Vector2(400, 520), 0).z
	_build_world()
	_start_wave()
	if _orbit_mode:
		_hud.set_extra("环绕星球 · 左右调速 · 自动斩击")
	elif _sniper_scope:
		_hud.set_extra("狙击瞄准 · 绿圈锁定 · 自动开火")
		queue_redraw()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _build_world() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f1520")))
	_camera = Runtime3DEnv.make_camera(_world, true)
	_add_ground()
	_bullets_root = Node3D.new()
	_bullets_root.name = "Bullets"
	_world.add_child(_bullets_root)
	_enemies_root = Node3D.new()
	_enemies_root.name = "Enemies"
	_world.add_child(_enemies_root)
	_enemy_bullets_root = Node3D.new()
	_enemy_bullets_root.name = "EnemyBullets"
	_world.add_child(_enemy_bullets_root)
	_player = _make_player()
	_world.add_child(_player)
	if _orbit_mode:
		_planet_center = Vector3(0, 0.6, 0)
		var planet = MeshInstance3D.new()
		var sph = SphereMesh.new()
		sph.radius = 2.2
		sph.height = 4.4
		planet.mesh = sph
		planet.position = _planet_center
		var pmat = StandardMaterial3D.new()
		pmat.albedo_color = Color("#22c55e")
		planet.material_override = pmat
		_world.add_child(planet)
		_sync_orbit_player()


func _add_ground() -> void:
	var floor_body = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(Runtime3DEnv.MAP_W * Runtime3DEnv.SCALE, 0.2, Runtime3DEnv.MAP_H * Runtime3DEnv.SCALE)
	col.shape = shape
	floor_body.add_child(col)
	var vis = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = shape.size
	vis.mesh = mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color("#141c28")
	vis.material_override = mat
	floor_body.add_child(vis)
	floor_body.position = Vector3(0, -0.1, 0)
	_world.add_child(floor_body)


func _make_player() -> CharacterBody3D:
	var body = CharacterBody3D.new()
	body.position = Runtime3DEnv.px_to_world(Vector2(400, 520), 0.55)
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(0.7, 0.35, 0.9)
	col.shape = box
	body.add_child(col)
	var vis = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = box.size
	vis.mesh = mesh
	_player_mat = GameMaterials.make_from_pack(GameSpecData.shader_pack(), GameSpecData.theme_color("playerColor", Color.CYAN))
	vis.material_override = _player_mat
	body.add_child(vis)
	var ref = RuntimeReferenceRegistry.protagonist_texture
	if ref:
		var spr = Sprite3D.new()
		spr.texture = ref
		spr.pixel_size = 0.01
		spr.position = Vector3(0, 0.2, 0.35)
		spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		body.add_child(spr)
		vis.visible = false
	return body


func _start_wave() -> void:
	_enemies_left = 4 + _wave * 2
	_spawn_cd = 0.45
	_wave_clearing = false
	GameJuice.shake_node(self, 3.0, 0.1)
	_hud.show_banner("第 %d 波" % _wave, "编队接近", 1.4)


func _physics_process(delta: float) -> void:
	if _ended or _player == null:
		return
	_game_time += delta
	var progress = clampf(float(_score) / float(maxi(_win_score, 1)), 0.0, 1.0)
	var d_out = _director.tick(progress, delta)
	if _director.active_type == "coinRain" or _game_time < _director.coin_rain_until:
		_score_mult = 2.0
	else:
		_score_mult = 1.0
	if _director.active_type == "goalShift":
		_burst_until = _director.goal_shift_until
	if float(d_out.get("spawn_boost", 1.0)) > 1.2 and _spawn_cd > 0.05:
		_spawn_cd *= 0.65
	_invuln = maxf(0.0, _invuln - delta)
	_move_player(delta)
	_fire_cd -= delta
	if _fire_cd <= 0.0:
		_fire_cd = _player_fire_interval()
		_fire_player_salvo()
	_enemy_fire_cd -= delta
	_spawn_cd -= delta
	if _spawn_cd <= 0.0 and _enemies_left > 0:
		_spawn_enemy()
		_enemies_left -= 1
		_spawn_cd = maxf(0.35, GameSpecData.gameplay_f("spawnIntervalMs", 900) / 1000.0 * 0.45)
	_tick_bullets(delta)
	_tick_enemy_bullets(delta)
	_tick_enemies(delta)
	_hud.set_score("击落 %d / %d · 生命 %d · 波 %d" % [_score, _win_score, _lives, _wave])
	if _between_waves_until > 0.0:
		_between_waves_until = maxf(0.0, _between_waves_until - delta)
	elif (
		not _wave_clearing
		and _enemies_root.get_child_count() == 0
		and _enemies_left <= 0
		and _spawn_cd <= 0.05
		and not _ended
	):
		_wave_clearing = true
		_between_waves_until = 0.65
		_wave += 1
		_start_wave()
	if _score >= _win_score:
		_end(true)


func _move_player(_delta: float) -> void:
	if _orbit_mode:
		var steer = Input.get_vector("move_left", "move_right", "ui_left", "ui_right")
		_orbit_speed = clampf(_orbit_speed + steer.x * _delta * 0.0012, 0.0009, 0.0034)
		_orbit_angle += _orbit_speed * _delta * 60.0
		_sync_orbit_player()
		return
	var dir = Input.get_vector("move_left", "move_right", "ui_left", "ui_right")
	_player.velocity = Vector3(dir.x * _player_speed, 0.0, 0.0)
	_player.move_and_slide()
	_player.position.x = clampf(_player.position.x, _bounds_x.x, _bounds_x.y)
	_player.position.z = _player_z


func _sync_orbit_player() -> void:
	if _player == null:
		return
	var rx = 2.55
	var rz = 1.65
	_player.position = _planet_center + Vector3(cos(_orbit_angle) * rx, 0.35, sin(_orbit_angle) * rz)
	_player.rotation.y = _orbit_angle + PI * 0.5
	_player.velocity = Vector3.ZERO


func _intensity() -> float:
	return clampf(float(_score) / float(maxi(_win_score, 1)), 0.0, 1.0)


func _is_rapid_fire() -> bool:
	if _game_time < _burst_until:
		return true
	if _director.active_type == "finalBarrage":
		return true
	return _intensity() >= 0.72


func _player_fire_interval() -> float:
	if _is_rapid_fire():
		return 0.11
	return maxf(0.12, 0.26 - _intensity() * 0.06)


func _fire_player_salvo() -> void:
	var col = GameSpecData.theme_color("collectibleColor", Color.YELLOW)
	var rapid = _is_rapid_fire()
	var speed = _bullet_speed * (1.35 if rapid else 1.0)
	var origin = _player.position + Vector3(0, 0.2, -0.45)
	var spreads: Array[float] = [0.0]
	if rapid:
		spreads = [-0.36, 0.0, 0.36]
	for ox in spreads:
		_make_bullet(origin + Vector3(ox, 0, 0), Vector3(ox * 0.08, 0, -speed), col, true)
	if _camera:
		GameJuice.burst(self, _camera.unproject_position(origin), col, 4)
	_shots_fired += 1
	if _shots_fired % 4 == 0:
		GameAudio.play_bleep(GameBleeps.Kind.FIRE)
	if rapid and _shots_fired % 4 == 0:
		GameJuice.shake_node(self, 2.5, 0.06)
	elif not rapid and _shots_fired % 8 == 0:
		GameJuice.shake_node(self, 1.2, 0.04)


func _spawn_boss_enemy() -> void:
	_spawn_enemy(5, 0.55, 1.5)


func _spawn_enemy(hp: int = 2, speed_mul: float = 1.0, scale_mul: float = 1.0) -> void:
	var spawn_px = Vector2(randf_range(60.0, 740.0), -20.0)
	var node = Node3D.new()
	node.position = Runtime3DEnv.px_to_world(spawn_px, 0.55)
	var vis = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = Vector3(0.65 * scale_mul, 0.35 * scale_mul, 0.8 * scale_mul)
	vis.mesh = mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("hazardColor", Color.ORANGE_RED)
	vis.material_override = mat
	node.add_child(vis)
	var mt = RuntimeReferenceRegistry.next_monster_texture()
	if mt:
		var spr = Sprite3D.new()
		spr.texture = mt
		spr.pixel_size = 0.009 * scale_mul
		spr.position = Vector3(0, 0.2, 0)
		spr.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		node.add_child(spr)
		vis.visible = false
	_enemies_root.add_child(node)
	node.set_meta("data", {
		"hp": hp,
		"is_boss": hp >= 5,
		"speed": GameSpecData.gameplay_f("hazardSpeed", 100) * Runtime3DEnv.SCALE * speed_mul,
	})


func _tick_enemies(delta: float) -> void:
	for c in _enemies_root.get_children():
		if not c is Node3D:
			continue
		var d: Dictionary = c.get_meta("data", {})
		c.position.z += float(d.get("speed", 1.8)) * delta
		var flat = Vector2(c.position.x - _player.position.x, c.position.z - _player.position.z)
		if _invuln <= 0.0 and flat.length() < 0.56:
			_hurt()
		if c.position.z > 6.4:
			c.queue_free()
		if _enemy_fire_cd <= 0.0 and c.position.z > -4.0 and c.position.z < 2.0:
			_enemy_fire_cd = maxf(0.8, GameSpecData.gameplay_f("spawnIntervalMs", 1200) / 1000.0)
			_spawn_enemy_bullet(c.position + Vector3(0, 0.1, 0.35))


func _spawn_enemy_bullet(from: Vector3) -> void:
	var to = _player.position - from
	to.y = 0.0
	var dir = to.normalized()
	_make_bullet(from, dir * 5.2, Color(1, 0.35, 0.35), false)


func _make_bullet(pos: Vector3, vel: Vector3, col: Color, friendly: bool) -> void:
	var n = Node3D.new()
	n.position = pos
	var vis = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = Vector3(0.12, 0.12, 0.28)
	vis.mesh = mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = col
	mat.emission_enabled = true
	mat.emission = col * 0.3
	vis.material_override = mat
	n.add_child(vis)
	# 子弹拖尾粒子（friendly 子弹挂常驻拖尾；enemy 子弹简化）
	if friendly:
		GameParticles.attach(n, "trail_bullet", col, _particle_mult * 0.6, false)
	n.set_meta("b", {"vel": vel, "friendly": friendly})
	if friendly:
		_bullets_root.add_child(n)
	else:
		_enemy_bullets_root.add_child(n)


func _tick_bullets(delta: float) -> void:
	for c in _bullets_root.get_children():
		_move_bullet_node(c, delta, true)


func _tick_enemy_bullets(delta: float) -> void:
	for c in _enemy_bullets_root.get_children():
		_move_bullet_node(c, delta, false)


func _move_bullet_node(c: Node, delta: float, friendly: bool) -> void:
	if not c is Node3D:
		return
	var b: Dictionary = c.get_meta("b", {})
	c.position += b.get("vel", Vector3.ZERO) as Vector3 * delta
	if friendly:
		for e in _enemies_root.get_children():
			var flat = Vector2(c.position.x - e.position.x, c.position.z - e.position.z)
			if flat.length() < 0.44:
				var d: Dictionary = e.get_meta("data", {})
				d["hp"] = int(d.get("hp", 1)) - 1
				e.set_meta("data", d)
				if int(d.get("hp", 0)) <= 0:
					var is_boss = bool(d.get("is_boss", false))
					_score += int((2 if is_boss else 1) * _score_mult)
					GameAudio.play_bleep(GameBleeps.Kind.EXPLODE if not is_boss else GameBleeps.Kind.WIN)
					# 深度版：GPUParticles3D 替代 2D ColorRect 爆散
					var burst_name = "burst_death" if is_boss else "burst_hit"
					GameParticles.spawn(_world, e.global_position, burst_name, GameSpecData.theme_color("hazardColor", Color.ORANGE), _particle_mult * (2.0 if is_boss else 1.0))
					if is_boss:
						# Boss 死亡：dissolve shader 动画 + 强化震屏
						_dissolve_node(e)
						GameJuice.flash_background(self, Color(1, 0.7, 0.2), 0.22)
						GameJuice.shake_node(self, 5.0, 0.12)
					e.queue_free()
				c.queue_free()
				return
	else:
		var flat_p = Vector2(c.position.x - _player.position.x, c.position.z - _player.position.z)
		if _invuln <= 0.0 and flat_p.length() < 0.4:
			_hurt()
			c.queue_free()
			return
	if c.position.z < -6.5 or c.position.z > 6.8 or c.position.x < -8.5 or c.position.x > 8.5:
		c.queue_free()


func _on_goal_shift_ended(_ok: bool) -> void:
	if _ok:
		_hud.show_banner("火力窗口", "得分倍率提升中", 1.2)
	else:
		_hud.show_banner("窗口结束", "", 1.0)


func _hurt() -> void:
	_lives -= 1
	_invuln = 1.2
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	GameJuice.shake_node(self, 7.0, 0.15)
	GameJuice.flash_background(self, Color(1, 0.35, 0.35), 0.28)
	# player 受击 shader 闪白
	if _player_mat:
		GameMaterials.flash(_player_mat, 3.0)
		GameMaterials.drop_intensity(_player_mat, 3.0, 1.0, 0.2, self)
	if _player:
		GameParticles.spawn(_world, _player.position + Vector3(0, 0.2, 0), "burst_hit", Color(1, 0.4, 0.4), _particle_mult)
	if _lives <= 0:
		_end(false)


## Boss 死亡 dissolve 动画：替换 mesh material 为 dissolve shader + tween dissolve_amount
func _dissolve_node(target: Node3D) -> void:
	if target == null:
		return
	var vis = target.get_child_or_null(0) as MeshInstance3D
	if vis == null:
		return
	var hazard_col = GameSpecData.theme_color("hazardColor", Color.ORANGE_RED)
	var mat = GameMaterials.make_from_pack("dissolve", hazard_col, 1.5)
	vis.material_override = mat
	GameMaterials.set_dissolve(mat, 0.0)
	var tw = create_tween()
	tw.tween_method(
		func(v: float) -> void: GameMaterials.set_dissolve(mat, v),
		0.0,
		1.0,
		1.0,
	)


func _end(won: bool) -> void:
	_ended = true
	_hud.show_banner("胜利！" if won else "战机坠毁", "", 2.2)


func _draw() -> void:
	if not _sniper_scope or _ended:
		return
	var rect = get_viewport_rect()
	var center = rect.size * 0.5
	var radius = minf(rect.size.x, rect.size.y) * 0.31
	draw_arc(center, radius, 0.0, TAU, 72, Color(0.29, 0.87, 0.5, 0.55), 3.0)
	draw_circle(center, 4.0, Color(0.93, 0.27, 0.27, 0.92))


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and _camera:
		Runtime3DEnv.raycast_world(_viewport, _camera, _viewport.get_mouse_position())
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()

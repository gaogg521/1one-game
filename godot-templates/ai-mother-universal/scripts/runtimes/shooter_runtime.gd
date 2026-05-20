extends Node2D
## 俯视角射击：自动开火、敌舰下压、敌方弹幕、波次与技能

@onready var _player: CharacterBody2D = $Player
@onready var _bullets: Node2D = $Bullets
@onready var _enemies: Node2D = $Enemies
@onready var _enemy_bullets: Node2D = $EnemyBullets

var _hud := GameHud.new()
var _director := GameDirector.new()
var _score := 0
var _lives := 3
var _wave := 0
var _win_score := 50
var _fire_cd := 0.0
var _enemy_fire_cd := 0.0
var _spawn_cd := 0.0
var _enemies_left := 0
var _wave_clearing := false
var _between_waves_until := 0.0
var _ended := false
var _invuln := 0.0
var _player_speed := 280.0
var _bullet_speed := 520.0
var _game_time := 0.0
var _score_mult := 1.0
var _burst_until := 0.0
var _shots_fired := 0
var _muzzle_layer: Node2D


func _ready() -> void:
	GameAudio.boot_interactive()
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_win_score = GameSpecData.gameplay_i("winScore", 50)
	_lives = GameSpecData.gameplay_i("lives", 3)
	_player_speed = GameSpecData.gameplay_f("playerSpeed", 280)
	_bullet_speed = GameSpecData.gameplay_f("jumpStrength", 520)
	_wave = 1
	_director.load_from_spec()
	_director.banner.connect(func(t, m): _hud.show_banner(t, m))
	_director.spawn_mini_boss.connect(_spawn_boss_enemy)
	_director.goal_shift_ended.connect(_on_goal_shift_ended)
	_muzzle_layer = Node2D.new()
	_muzzle_layer.z_index = 40
	add_child(_muzzle_layer)
	_start_wave()
	_swap_player_visual()


func _is_space_theme() -> bool:
	var blob := "%s %s %s %s" % [
		GameSpecData.title(),
		GameSpecData.subtitle(),
		GameSpecData.labels("player", ""),
		GameSpecData.labels("hazard", ""),
	]
	blob = blob.to_lower()
	return (
		"星" in blob
		or "舰" in blob
		or "太空" in blob
		or "space" in blob
		or "star" in blob
		or "war" in blob
	)


func _swap_player_visual() -> void:
	var vis := _player.get_node_or_null("Visual")
	if vis:
		vis.queue_free()
	var uv := UnitVisual.new()
	uv.kind = UnitVisual.Kind.STARSHIP
	uv.unit_id = "hero"
	_player.add_child(uv)


func _start_wave() -> void:
	_enemies_left = 4 + _wave * 2
	_spawn_cd = 0.45
	_wave_clearing = false
	GameJuice.shake_node(self, 3.0, 0.1)
	_hud.show_banner("第 %d 波" % _wave, "编队接近", 1.4)


func _physics_process(delta: float) -> void:
	if _ended:
		return
	_game_time += delta
	var progress := clampf(float(_score) / float(maxi(_win_score, 1)), 0.0, 1.0)
	var d_out := _director.tick(progress, delta)
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
		and _enemies.get_child_count() == 0
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


func _move_player(delta: float) -> void:
	var dir := Input.get_vector("move_left", "move_right", "ui_left", "ui_right")
	_player.velocity = Vector2(dir.x * _player_speed, 0)
	_player.move_and_slide()
	_player.position.x = clampf(_player.position.x, 40.0, 760.0)


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
	var col := GameSpecData.theme_color("collectibleColor", Color.YELLOW)
	var rapid := _is_rapid_fire()
	var speed := _bullet_speed * (1.35 if rapid else 1.0)
	var origin := _player.position + Vector2(0, -24)
	var spreads: Array[float] = [0.0]
	if rapid:
		spreads = [-18.0, 0.0, 18.0]
	for ox in spreads:
		var b := _make_bullet(
			origin + Vector2(ox, 0),
			Vector2(ox * 1.5, -speed),
			col,
			true
		)
		_bullets.add_child(b["node"] as Node2D)
	_muzzle_flash(origin, col)
	_shots_fired += 1
	if _shots_fired % 4 == 0:
		GameAudio.play_bleep(GameBleeps.Kind.FIRE)
	if rapid and _shots_fired % 4 == 0:
		GameJuice.shake_node(self, 2.5, 0.06)
	elif not rapid and _shots_fired % 8 == 0:
		GameJuice.shake_node(self, 1.2, 0.04)


func _muzzle_flash(at: Vector2, col: Color) -> void:
	if _muzzle_layer == null or not is_instance_valid(_muzzle_layer):
		return
	var flash := ColorRect.new()
	flash.size = Vector2(14, 8)
	flash.position = at + Vector2(-7, -4)
	flash.color = Color(col.r, col.g, col.b, 0.85)
	_muzzle_layer.add_child(flash)
	var tw := flash.create_tween()
	tw.tween_property(flash, "modulate:a", 0.0, 0.08)
	tw.tween_callback(flash.queue_free)


func _spawn_boss_enemy() -> void:
	_spawn_enemy(5, 0.55, 1.5)


func _spawn_enemy(hp: int = 2, speed_mul: float = 1.0, scale_mul: float = 1.0) -> void:
	var x := randf_range(60.0, 740.0)
	var node := Node2D.new()
	node.position = Vector2(x, -20)
	var vis := UnitVisual.new()
	vis.kind = UnitVisual.Kind.INTERCEPTOR
	vis.unit_id = "tank" if hp >= 4 else "grunt"
	vis.scale = Vector2(scale_mul, scale_mul)
	var mt := RuntimeReferenceRegistry.next_monster_texture()
	if mt:
		vis.overlay_texture = mt
	node.add_child(vis)
	_enemies.add_child(node)
	node.set_meta("data", {
		"hp": hp,
		"is_boss": hp >= 5,
		"speed": GameSpecData.gameplay_f("hazardSpeed", 100) * speed_mul,
	})


func _tick_enemies(delta: float) -> void:
	for c in _enemies.get_children():
		if not c is Node2D:
			continue
		var d: Dictionary = c.get_meta("data", {})
		c.position.y += float(d.get("speed", 90)) * delta
		if _invuln <= 0.0 and c.position.distance_to(_player.position) < 28.0:
			_hurt()
		if c.position.y > 640:
			c.queue_free()
		if _enemy_fire_cd <= 0.0 and c.position.y > 40 and c.position.y < 400:
			_enemy_fire_cd = maxf(0.8, GameSpecData.gameplay_f("spawnIntervalMs", 1200) / 1000.0)
			_spawn_enemy_bullet(c.position + Vector2(0, 20))


func _spawn_enemy_bullet(from: Vector2) -> void:
	var dir := (_player.position - from).normalized()
	var b := _make_bullet(from, dir * 260.0, Color(1, 0.35, 0.35), false)
	_enemy_bullets.add_child(b["node"] as Node2D)


func _make_bullet(pos: Vector2, vel: Vector2, col: Color, friendly: bool) -> Dictionary:
	var n := Node2D.new()
	n.position = pos
	var r := ColorRect.new()
	r.size = Vector2(6, 14)
	r.position = Vector2(-3, -7)
	r.color = col
	n.add_child(r)
	n.set_meta("b", {"vel": vel, "friendly": friendly})
	return {"node": n}


func _tick_bullets(delta: float) -> void:
	for c in _bullets.get_children():
		_move_bullet_node(c, delta, true)


func _tick_enemy_bullets(delta: float) -> void:
	for c in _enemy_bullets.get_children():
		_move_bullet_node(c, delta, false)


func _move_bullet_node(c: Node, delta: float, friendly: bool) -> void:
	if not c is Node2D:
		return
	var b: Dictionary = c.get_meta("b", {})
	c.position += b.get("vel", Vector2.ZERO) as Vector2 * delta
	if friendly:
		for e in _enemies.get_children():
			if c.position.distance_to(e.position) < 22.0:
				var d: Dictionary = e.get_meta("data", {})
				d["hp"] = int(d.get("hp", 1)) - 1
				e.set_meta("data", d)
				if int(d.get("hp", 0)) <= 0:
					var is_boss := bool(d.get("is_boss", false))
					_score += int((2 if is_boss else 1) * _score_mult)
					GameAudio.play_bleep(GameBleeps.Kind.EXPLODE if not is_boss else GameBleeps.Kind.WIN)
					var burst_n := 14 if is_boss else 8
					GameJuice.burst(self, e.global_position, GameSpecData.theme_color("hazardColor", Color.ORANGE), burst_n)
					if is_boss:
						GameJuice.flash_background(self, Color(1, 0.7, 0.2), 0.22)
						GameJuice.shake_node(self, 5.0, 0.12)
					e.queue_free()
				c.queue_free()
				return
	else:
		if _invuln <= 0.0 and c.position.distance_to(_player.position) < 20.0:
			_hurt()
			c.queue_free()
			return
	if c.position.y < -40 or c.position.y > 640 or c.position.x < -20 or c.position.x > 820:
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
	if _lives <= 0:
		_end(false)


func _end(won: bool) -> void:
	_ended = true
	_hud.show_banner("胜利！" if won else "战机坠毁", "", 2.2)

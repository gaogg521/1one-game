extends Node2D
## 竞技场专业版：avoider / collector / survivor — 导演强度、技能、道具

@onready var _player: CharacterBody2D = $ArenaPlayer
@onready var _hazards: Node2D = $Hazards
@onready var _collectibles: Node2D = $Collectibles

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
var _pad := 48.0
var _goal_shift_until := 0.0
var _goal_shift_need := 5
var _goal_shift_have := 0
var _golden_window := false


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_tid = GameSpecData.template_id()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_lives = GameSpecData.gameplay_i("lives", 3)
	_win = GameSpecData.gameplay_i("winScore", 10)
	_intensity = float(GameSpecData.director().get("intensity", 0.55))
	_pad = 48.0
	_director.load_from_spec()
	_director.banner.connect(func(t, m): _hud.show_banner(t, m))
	_director.spawn_mini_boss.connect(_spawn_boss_hazard)
	_director.golden_pickup_window.connect(_on_golden_pickup)
	var vis := _player.get_node_or_null("Visual") as ColorRect
	if vis:
		vis.color = GameSpecData.theme_color("playerColor", Color.GREEN)
	_apply_player_reference_sprite()
	_hint_mode()


func _apply_player_reference_sprite() -> void:
	var tex := RuntimeReferenceRegistry.protagonist_texture
	if tex == null:
		return
	var spr := Sprite2D.new()
	spr.texture = tex
	var sz := tex.get_size()
	var sc := 36.0 / maxf(sz.x, sz.y)
	spr.scale = Vector2(sc, sc)
	spr.position = Vector2(0, -16)
	_player.add_child(spr)
	var vis := _player.get_node_or_null("Visual") as ColorRect
	if vis:
		vis.visible = false


func _hint_mode() -> void:
	var mode := ""
	match _tid:
		"collector":
			mode = "收集 %s · 躲避 %s" % [GameSpecData.labels("collectible", "宝物"), GameSpecData.labels("hazard", "威胁")]
		"survivor":
			mode = "生存 · %s" % GameSpecData.labels("hazard", "威胁")
		"avoider":
			mode = "躲避 %s" % GameSpecData.labels("hazard", "威胁")]
		_:
			mode = "竞技场"
	_hud.set_extra("%s · WASD移动 · Shift技能 · 目标 %d" % [mode, _win])


func _physics_process(delta: float) -> void:
	if _ended:
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


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_SHIFT:
		_try_skill()


func _try_skill() -> void:
	if _skill_cd > 0.0:
		return
	_skill_cd = 8.0
	_shield += 1
	_hud.flash_banner("护盾 +1")


func _move_player(delta: float) -> void:
	var dir := Input.get_vector("move_left", "move_right", "ui_up", "ui_down")
	if dir.length_squared() < 0.01:
		dir = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	_player.velocity = dir.normalized() * GameSpecData.gameplay_f("playerSpeed", 260)
	_player.move_and_slide()
	var r := Rect2(_pad, _pad, 800.0 - _pad * 2.0, 600.0 - _pad * 2.0)
	_player.position = _player.position.clamp(r.position, r.position + r.size)


func _spawn_boss_hazard() -> void:
	for i in range(3):
		_spawn_hazard(1.6, 1.35)


func _spawn_hazard(size_mul: float = 1.0, speed_mul: float = 1.0) -> void:
	var body := CharacterBody2D.new()
	var col := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 14.0
	col.shape = shape
	body.add_child(col)
	var vis := UnitVisual.new()
	vis.kind = UnitVisual.Kind.ENEMY
	vis.unit_id = "tank" if size_mul > 1.2 else "grunt"
	vis.scale = Vector2(size_mul, size_mul)
	var mt := RuntimeReferenceRegistry.next_monster_texture()
	if mt:
		vis.overlay_texture = mt
	body.add_child(vis)
	_hazards.add_child(body)
	var edge := randi() % 4
	var pos := Vector2(400, 300)
	match edge:
		0: pos = Vector2(randf_range(_pad, 800 - _pad), _pad)
		1: pos = Vector2(randf_range(_pad, 800 - _pad), 600 - _pad)
		2: pos = Vector2(_pad, randf_range(_pad, 600 - _pad))
		3: pos = Vector2(800 - _pad, randf_range(_pad, 600 - _pad))
	body.position = pos
	var spd := GameSpecData.gameplay_f("hazardSpeed", 180) * lerpf(0.85, 1.25, _intensity) * speed_mul
	if _slow_until > 0.0:
		spd *= 0.55
		_slow_until -= get_physics_process_delta_time()
	body.set_meta("vel", (_player.global_position - body.global_position).normalized() * spd)
	body.set_meta("size_mul", size_mul)


func _on_golden_pickup(active: bool) -> void:
	_golden_window = active
	if active:
		for _i in range(3):
			_spawn_collectible(true)


func _spawn_collectible(golden: bool = false) -> void:
	var area := Area2D.new()
	var col := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 10.0
	col.shape = shape
	area.add_child(col)
	var vis := ColorRect.new()
	vis.size = Vector2(20, 20)
	vis.position = Vector2(-10, -10)
	vis.color = Color.GOLD if golden else GameSpecData.theme_color("collectibleColor", Color.GOLD)
	if golden:
		vis.size = Vector2(28, 28)
		vis.position = Vector2(-14, -14)
	area.add_child(vis)
	area.set_meta("golden", golden)
	_collectibles.add_child(area)
	area.position = Vector2(randf_range(_pad + 24, 776), randf_range(_pad + 24, 576))
	area.body_entered.connect(_on_pickup.bind(area))


func _on_pickup(body: Node2D, area: Area2D) -> void:
	if body != _player or _ended:
		return
	var gain := 2 if area.get_meta("golden", false) else 1
	_score += gain
	if _game_time < _goal_shift_until:
		_goal_shift_have += gain
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameJuice.burst(self, area.global_position, GameSpecData.theme_color("collectibleColor", Color.GOLD), 8)
	area.queue_free()
	if _score >= _win:
		_end(true)


func _tick_hazards(delta: float) -> void:
	var to_remove: Array[Node] = []
	for child in _hazards.get_children():
		if not child is CharacterBody2D:
			continue
		var hv: Vector2 = child.get_meta("vel", Vector2.ZERO)
		child.position += hv * delta
		if child.global_position.distance_to(_player.global_position) < 22.0:
			if _invuln <= 0.0:
				if _shield > 0:
					_shield -= 1
					GameJuice.burst(self, child.global_position, Color(0.5, 0.85, 1), 6)
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
		elif not Rect2(-60, -60, 920, 720).has_point(child.position):
			to_remove.append(child)
	for n in to_remove:
		n.queue_free()


func _magnet_collect() -> void:
	for c in _collectibles.get_children():
		if c is Area2D:
			c.position = c.position.lerp(_player.position, 0.12)
			if c.position.distance_to(_player.position) < 18.0:
				_score += 1
				GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
				GameJuice.burst(self, c.global_position, GameSpecData.theme_color("collectibleColor", Color.GOLD), 6)
				c.queue_free()
				if _score >= _win:
					_end(true)


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.55, 1, 0.65), 0.32)
		GameJuice.shake_node(self, 3.0, 0.08)
	_hud.show_banner("胜利！" if won else "失败", "", 2.2)

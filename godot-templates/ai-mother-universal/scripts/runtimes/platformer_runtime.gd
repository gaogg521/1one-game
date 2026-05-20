extends Node2D
## 横版平台：滚动关卡、收集、尖刺、导演事件 + 手感反馈

@onready var _player: CharacterBody2D = $Player
@onready var _platforms: Node2D = $Platforms
@onready var _gems: Node2D = $Gems
@onready var _hazards: Node2D = $Hazards

var _hud := GameHud.new()
var _director := GameDirector.new()
var _score := 0
var _lives := 3
var _win := 28
var _ended := false
var _invuln := 0.0
var _cam_x := 0.0
var _world_w := 3200.0
var _game_time := 0.0
var _part_color := Color.GOLD
var _goal_shift_until := 0.0
var _goal_shift_need := 6
var _goal_shift_have := 0
var _goal_shift_ok := false


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
	_part_color = GameSpecData.theme_color("collectibleColor", _part_color)
	_build_level()
	if _player.has_method("apply_from_spec"):
		_player.apply_from_spec()
	_apply_player_reference_sprite()
	_hud.set_extra("WASD/方向键移动 · 空格跳跃 · 收集 %s" % GameSpecData.labels("collectible", "能量核"))


func _apply_player_reference_sprite() -> void:
	var tex := RuntimeReferenceRegistry.protagonist_texture
	if tex == null:
		return
	var spr := Sprite2D.new()
	spr.name = "RefSprite"
	spr.texture = tex
	var sz := tex.get_size()
	var sc := 40.0 / maxf(sz.x, sz.y)
	spr.scale = Vector2(sc, sc)
	spr.position = Vector2(0, -22)
	_player.add_child(spr)
	var vis := _player.get_node_or_null("Visual") as ColorRect
	if vis:
		vis.visible = false


func _build_level() -> void:
	var ground_y := 520.0
	var cols := 8
	for i in range(cols):
		var px := 180.0 + i * 360.0
		_add_platform(Vector2(px, ground_y), Vector2(280, 24))
		if i % 2 == 0:
			_add_platform(Vector2(px + 80, ground_y - 120), Vector2(120, 18))
			_add_gem(Vector2(px + 80, ground_y - 150))
		if i > 0 and i % 3 == 0:
			_add_spike(Vector2(px - 40, ground_y - 8))
	_add_platform(Vector2(120, ground_y), Vector2(400, 24))
	_world_w = 180.0 + cols * 360.0


func _add_platform(pos: Vector2, size: Vector2) -> void:
	var body := StaticBody2D.new()
	body.position = pos
	var col := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = size
	col.shape = shape
	body.add_child(col)
	var vis := ColorRect.new()
	vis.size = size
	vis.position = Vector2(-size.x / 2, -size.y)
	vis.color = GameSpecData.theme_color("playerColor", Color.GREEN).darkened(0.35)
	body.add_child(vis)
	_platforms.add_child(body)


func _add_gem(pos: Vector2) -> void:
	var area := Area2D.new()
	area.position = pos
	var col := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 12.0
	col.shape = shape
	area.add_child(col)
	var vis := ColorRect.new()
	vis.size = Vector2(22, 22)
	vis.position = Vector2(-11, -11)
	vis.color = _part_color
	area.add_child(vis)
	area.body_entered.connect(_on_gem.bind(area))
	_gems.add_child(area)


func _add_spike(pos: Vector2) -> void:
	var area := Area2D.new()
	area.position = pos
	var col := CollisionShape2D.new()
	var shape := RectangleShape2D.new()
	shape.size = Vector2(36, 20)
	col.shape = shape
	area.add_child(col)
	var vis := ColorRect.new()
	vis.size = Vector2(36, 20)
	vis.position = Vector2(-18, -20)
	vis.color = GameSpecData.theme_color("hazardColor", Color.ORANGE)
	area.add_child(vis)
	area.body_entered.connect(_on_spike)
	_hazards.add_child(area)


func _on_gem(body: Node2D, area: Area2D) -> void:
	if body != _player or _ended:
		return
	var pos := area.global_position
	_score += 1
	if _game_time < _goal_shift_until:
		_goal_shift_have += 1
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameJuice.burst(self, pos, _part_color, 10)
	GameJuice.flash_background(self, _part_color, 0.18)
	area.queue_free()
	if _goal_shift_have >= _goal_shift_need and _game_time < _goal_shift_until:
		_goal_shift_ok = true
	if _score >= _win:
		_end(true)


func _on_spike(body: Node2D) -> void:
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
	if _ended:
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
	_cam_x = clampf(_player.position.x - 400.0, 0.0, _world_w - 800.0)
	position.x = -_cam_x
	_hud.set_score("收集 %d / %d · 命 %d%s" % [_score, _win, _lives, gs_left])


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

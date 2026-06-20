extends Node2D
## 3D 俯视角 MOBA 1v1：玩家英雄 vs AI 英雄，各 N 座塔，3 技能槽。
## WASD 移动 · Q 直线射击 · W 范围爆破 · E 位移 · 空格普攻 · 推掉全部敌方塔通关。

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

const PAD_PX := 60.0

var _player: CharacterBody3D
var _player_mesh: MeshInstance3D
var _ai: CharacterBody3D
var _ai_mesh: MeshInstance3D
var _camera: Camera3D
var _hud := GameHud.new()

var _player_hp := 200
var _player_hp_max := 200
var _ai_hp := 200
var _ai_hp_max := 200

var _towers: Array = []  # [{body, vis, hp, max_hp, side, alive}]
var _player_speed := 4.0
var _ai_speed := 3.0
var _attack_range := 2.2
var _ai_attack_range := 2.0
var _player_attack_cd := 0.0
var _ai_attack_cd := 0.0
var _ai_difficulty := 0.55
var _tower_to_win := 2

var _q_cd := 0.0
var _w_cd := 0.0
var _e_cd := 0.0
const Q_CD := 2.5
const W_CD := 5.0
const E_CD := 3.5

var _ended := false
var _game_time := 0.0
var _particle_mult := 1.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var bp := _moba_blueprint()
	_player_hp_max = int(bp.get("playerHp", 200))
	_player_hp = _player_hp_max
	_ai_hp_max = _player_hp_max
	_ai_hp = _ai_hp_max
	_ai_difficulty = float(bp.get("aiDifficulty", 0.55))
	_tower_to_win = int(bp.get("towersToWin", 2))
	_player_speed = GameSpecData.gameplay_f("playerSpeed", 200) * 0.022
	_ai_speed = _player_speed * (0.6 + _ai_difficulty * 0.45)
	_particle_mult = GameSpecData.particle_intensity_mult()
	_build_world()
	_hud.set_extra("WASD移动 · Q直线 / W范围 / E位移 · 空格普攻 · 推掉全部敌方塔")
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 通过 GameSpecData.raw 访问 moba blueprint（避免修改 GameSpecData 模块）。
func _moba_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	var m = GameSpecData.moba()
	return m if m is Dictionary else {}


func _build_world() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#1a2220")))
	_camera = Runtime3DEnv.make_camera(_world, true)
	_add_ground()
	_player = _make_hero(true, Runtime3DEnv.px_to_world(Vector2(140, 300), 0.55))
	_world.add_child(_player)
	_player_mesh = _player.get_child(1) as MeshInstance3D
	_ai = _make_hero(false, Runtime3DEnv.px_to_world(Vector2(780, 300), 0.55))
	_world.add_child(_ai)
	_ai_mesh = _ai.get_child(1) as MeshInstance3D
	_build_towers()


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


func _make_hero(is_player: bool, pos: Vector3) -> CharacterBody3D:
	var body := CharacterBody3D.new()
	body.position = pos
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
	var color := GameSpecData.theme_color("playerColor", Color.GOLD) if is_player else GameSpecData.theme_color("hazardColor", Color.ORANGE)
	vis.material_override = GameMaterials.make_from_pack(GameSpecData.shader_pack(), color)
	body.add_child(vis)
	if is_player:
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


func _build_towers() -> void:
	var count := clampi(_tower_to_win + 1, 2, 3)
	for i in range(count):
		var ratio := 0.5 if count == 1 else float(i) / float(count - 1)
		var y_px := 300.0 + (ratio - 0.5) * 320.0
		_spawn_tower("player", Vector2(230.0, y_px))
		_spawn_tower("ai", Vector2(690.0, y_px))


func _spawn_tower(side: String, pos_px: Vector2) -> void:
	var body := StaticBody3D.new()
	body.position = Runtime3DEnv.px_to_world(pos_px, 0.45)
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.7, 1.2, 0.7)
	col.shape = shape
	body.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = shape.size
	vis.mesh = mesh
	var color := Color(0.38, 0.65, 0.98) if side == "player" else Color(0.97, 0.45, 0.45)
	vis.material_override = GameMaterials.make_from_pack(GameSpecData.shader_pack(), color)
	body.add_child(vis)
	_world.add_child(body)
	_towers.append({"body": body, "vis": vis, "hp": 100, "max_hp": 100, "side": side, "alive": true})


func _physics_process(delta: float) -> void:
	if _ended or _player == null:
		return
	_game_time += delta
	_player_attack_cd = maxf(0.0, _player_attack_cd - delta)
	_ai_attack_cd = maxf(0.0, _ai_attack_cd - delta)
	_q_cd = maxf(0.0, _q_cd - delta)
	_w_cd = maxf(0.0, _w_cd - delta)
	_e_cd = maxf(0.0, _e_cd - delta)
	_move_player(delta)
	_update_ai(delta)
	_try_auto_attack()
	var player_t := _count_towers("player")
	var ai_t := _count_towers("ai")
	_hud.set_score("HP %d/%d · AI HP %d/%d · 我塔 %d · 敌塔 %d" % [_player_hp, _player_hp_max, _ai_hp, _ai_hp_max, player_t, ai_t])


func _move_player(delta: float) -> void:
	var dx := 0.0
	var dz := 0.0
	if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
		dx -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
		dx += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
		dz -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
		dz += 1.0
	var v := Vector3(dx, 0.0, dz)
	if v.length_squared() > 0.0:
		v = v.normalized() * _player_speed
	_player.velocity = v
	_player.move_and_slide()
	var px := Runtime3DEnv.world_to_px(_player.position)
	px = px.clamp(Vector2(PAD_PX, PAD_PX), Vector2(Runtime3DEnv.MAP_W - PAD_PX, Runtime3DEnv.MAP_H - PAD_PX))
	_player.position = Runtime3DEnv.px_to_world(px, _player.position.y)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not _ended:
		GameAudio.boot_interactive()
		match event.keycode:
			KEY_Q: _cast_q()
			KEY_W: _cast_w()
			KEY_E: _cast_e()
			KEY_SPACE: _do_player_attack()


func _cast_q() -> void:
	if _q_cd > 0.0:
		return
	_q_cd = Q_CD
	# 远程直线：朝 AI 方向发射，距离内命中 AI/塔
	var dir := _ai.global_position - _player.global_position
	dir.y = 0.0
	var dist := dir.length()
	if dist < 7.2:
		_deal_damage_to_ai(18)
		_burst(_ai.global_position, Color(0.99, 0.88, 0.28))
	if dist < 7.2:
		var t := _find_ai_tower_along(_player.global_position, dir.normalized(), 7.2)
		if t:
			_deal_damage_to_tower(t, 30)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)


func _cast_w() -> void:
	if _w_cd > 0.0:
		return
	_w_cd = W_CD
	var r := 2.6
	var dist := _player.global_position.distance_to(_ai.global_position)
	if dist <= r:
		_deal_damage_to_ai(25)
	for t in _towers:
		if not t.alive or t.side != "ai":
			continue
		if _player.global_position.distance_to(t.body.global_position) <= r:
			_deal_damage_to_tower(t, 18)
	_burst(_player.global_position, GameSpecData.theme_color("collectibleColor", Color.GOLD))
	GameAudio.play_bleep(GameBleeps.Kind.HIT)


func _cast_e() -> void:
	if _e_cd > 0.0:
		return
	_e_cd = E_CD
	var dir := _ai.global_position - _player.global_position
	dir.y = 0.0
	if dir.length_squared() < 0.001:
		dir = Vector3(1, 0, 0)
	dir = dir.normalized() * 2.4
	_player.position += dir
	var px := Runtime3DEnv.world_to_px(_player.position)
	px = px.clamp(Vector2(PAD_PX, PAD_PX), Vector2(Runtime3DEnv.MAP_W - PAD_PX, Runtime3DEnv.MAP_H - PAD_PX))
	_player.position = Runtime3DEnv.px_to_world(px, _player.position.y)
	_burst(_player.global_position, GameSpecData.theme_color("playerColor", Color.GOLD))
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _do_player_attack() -> void:
	if _player_attack_cd > 0.0:
		return
	_player_attack_cd = 0.6
	var dist := _player.global_position.distance_to(_ai.global_position)
	if dist <= _attack_range:
		_deal_damage_to_ai(12)
		return
	var t := _find_closest_ai_tower(_player.global_position, _attack_range)
	if t:
		_deal_damage_to_tower(t, 10)


func _try_auto_attack() -> void:
	if _player_attack_cd > 0.0:
		return
	var dist := _player.global_position.distance_to(_ai.global_position)
	if dist <= _attack_range:
		_do_player_attack()
		return
	var t := _find_closest_ai_tower(_player.global_position, _attack_range)
	if t:
		_do_player_attack()


func _find_closest_ai_tower(origin: Vector3, max_dist: float) -> Dictionary:
	var best := {}
	var best_d := max_dist
	for t in _towers:
		if not t.alive or t.side != "ai":
			continue
		var d := origin.distance_to(t.body.global_position)
		if d < best_d:
			best_d = d
			best = t
	return best


func _find_ai_tower_along(origin: Vector3, dir: Vector3, max_len: float) -> Dictionary:
	var best := {}
	var best_t := max_len
	for t in _towers:
		if not t.alive or t.side != "ai":
			continue
		var body := t["body"] as Node3D
		if body == null:
			continue
		var rel: Vector3 = body.global_position - origin
		rel.y = 0.0
		var proj: float = rel.dot(dir)
		if proj <= 0.0 or proj > best_t:
			continue
		var perp := absf(rel.x * dir.z - rel.z * dir.x)
		if perp < 0.55 and proj < best_t:
			best_t = proj
			best = t
	return best


func _update_ai(delta: float) -> void:
	var to_player := _player.global_position - _ai.global_position
	to_player.y = 0.0
	var dist := to_player.length()
	var want := _ai_attack_range * 0.85
	var v := Vector3.ZERO
	if dist > want:
		v = to_player.normalized() * _ai_speed
	if _ai_difficulty < 0.55:
		var wob := (1.0 - _ai_difficulty) * 0.4
		v += Vector3(sin(_game_time * 3.0) * wob, 0.0, cos(_game_time * 2.7) * wob) * _ai_speed
	_ai.velocity = v
	_ai.move_and_slide()
	var px := Runtime3DEnv.world_to_px(_ai.position)
	px = px.clamp(Vector2(PAD_PX, PAD_PX), Vector2(Runtime3DEnv.MAP_W - PAD_PX, Runtime3DEnv.MAP_H - PAD_PX))
	_ai.position = Runtime3DEnv.px_to_world(px, _ai.position.y)
	if _ai_attack_cd <= 0.0 and dist <= _ai_attack_range:
		_ai_attack_cd = 0.8
		_deal_damage_to_player(8 + int(_ai_difficulty * 6.0))


func _deal_damage_to_ai(amount: int) -> void:
	if _ended:
		return
	_ai_hp = maxi(0, _ai_hp - amount)
	GameMaterials.flash(_ai_mesh.material_override, 3.0)
	GameJuice.shake_node(self, 6.0, 0.10)
	if _ai_hp <= 0:
		_end(true)


func _deal_damage_to_player(amount: int) -> void:
	if _ended:
		return
	_player_hp = maxi(0, _player_hp - amount)
	GameMaterials.flash(_player_mesh.material_override, 3.0)
	GameJuice.shake_node(self, 7.0, 0.12)
	GameJuice.flash_background(self, GameSpecData.theme_color("hazardColor", Color.ORANGE), 0.22)
	if _player_hp <= 0:
		_end(false)


func _deal_damage_to_tower(t: Dictionary, amount: int) -> void:
	if _ended or not t.alive:
		return
	t.hp = maxi(0, int(t.hp) - amount)
	GameMaterials.flash(t.vis.material_override, 3.0)
	_burst(t.body.global_position, Color(0.99, 0.88, 0.28))
	if int(t.hp) <= 0:
		t.alive = false
		t.body.queue_free()
		_check_win_condition()


func _check_win_condition() -> void:
	var ai_left := _count_towers("ai")
	var player_left := _count_towers("player")
	if ai_left == 0:
		_end(true)
	elif player_left == 0:
		_end(false)


func _count_towers(side: String) -> int:
	var n := 0
	for t in _towers:
		if t.alive and t.side == side:
			n += 1
	return n


func _burst(pos: Vector3, color: Color) -> void:
	GameParticles.spawn(_world, pos + Vector3(0, 0.3, 0), "burst_hit", color, _particle_mult)


func _end(won: bool) -> void:
	if _ended:
		return
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.55, 1, 0.65), 0.32)
		GameJuice.shake_node(self, 3.0, 0.08)
		_hud.show_banner("胜利！", "推掉敌方全部塔", 2.4)
		if _player:
			GameParticles.spawn(_world, _player.position + Vector3(0, 0.5, 0), "burst_collect", GameSpecData.theme_color("collectibleColor", Color.GOLD), _particle_mult * 2.0)
	else:
		_hud.show_banner("失败", "英雄倒下", 2.0)
		if _player:
			GameParticles.spawn(_world, _player.position + Vector3(0, 0.5, 0), "burst_death", GameSpecData.theme_color("hazardColor", Color.ORANGE), _particle_mult)

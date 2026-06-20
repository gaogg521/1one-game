extends Node2D
## 3D 1v1 格斗（与 Phaser FightingScene 对齐）：
## - 玩家 + AI 都是 CharacterBody3D + CapsuleMesh
## - 玩家按 J/K/L/U 出招 + A/D 移动
## - AI 随机出招（难度由 spec.fighting.aiDifficulty 驱动）
## - 命中：扣血 + shader 闪白（GameMaterials.flash + drop_intensity）+ 受击粒子（burst_hit）
## - 3 局 2 胜；GameHud 显示血量 + 回合比分

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _player: CharacterBody3D
var _player_mesh: MeshInstance3D
var _ai: CharacterBody3D
var _ai_mesh: MeshInstance3D
var _camera: Camera3D
var _hud := GameHud.new()

var _hp_max := 100
var _player_hp := 100
var _ai_hp := 100
var _ai_difficulty := 0.55
var _rounds_total := 3
var _rounds_to_win := 2
var _player_wins := 0
var _ai_wins := 0
var _round_index := 0

var _player_cd := 0.0
var _ai_cd := 0.0
var _player_flash := 0.0
var _ai_flash := 0.0
var _player_stagger := 0.0
var _ai_stagger := 0.0
var _player_blocking := false
var _ai_blocking := false
var _ai_next_decision := 0.0

var _phase := "intro"  # intro / fighting / roundEnd / matchEnd
var _phase_until := 0.0
var _game_time := 0.0
var _ended := false
var _particle_mult := 1.0
var _move_speed := 5.5

# 招式表：damage / range / cooldown / flash / knockback
const _MOVE_LIGHT   := { "damage": 6,  "range": 1.8, "cd": 0.26, "flash": 0.14, "kb": 0.6 }
const _MOVE_HEAVY   := { "damage": 14, "range": 2.0, "cd": 0.62, "flash": 0.26, "kb": 1.4 }
const _MOVE_BLOCK   := { "damage": 0,  "range": 0.0, "cd": 0.42, "flash": 0.0,  "kb": 0.0 }
const _MOVE_SPECIAL := { "damage": 22, "range": 2.4, "cd": 1.40, "flash": 0.36, "kb": 2.4 }

const _ARENA_LEFT := -4.0
const _ARENA_RIGHT := 4.0
const _GROUND_Y := 0.0
const _FIGHTER_GAP := 1.2  # 两 fighter 中心最小间距（米）

var _part_color := Color.GOLD
var _hazard_color := Color.ORANGE


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_apply_blueprint()
	_hud.set_extra("A/D 移动 · J 轻拳 · K 重拳 · L 格挡 · U 特殊技 · 3 局 2 胜")
	_part_color = GameSpecData.theme_color("collectibleColor", Color.GOLD)
	_hazard_color = GameSpecData.theme_color("hazardColor", Color.ORANGE)
	_build_world()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_start_round(0)



func _apply_blueprint() -> void:
	var f := _fighting_data()
	_rounds_total = int(f.get("rounds", 3))
	_rounds_to_win = int(ceil(float(_rounds_total) / 2.0))
	_hp_max = int(f.get("playerHp", 100))
	_ai_difficulty = float(f.get("aiDifficulty", 0.55))
	_particle_mult = GameSpecData.particle_intensity_mult()


## GameSpecData.fighting() 访问器已暴露在 autoload。
func _fighting_data() -> Dictionary:
	GameSpecData.ensure_loaded()
	var f = GameSpecData.fighting()
	return f if f is Dictionary else {}


func _build_world() -> void:
	_add_environment()
	# 地面平板
	var floor_body := StaticBody3D.new()
	floor_body.position = Vector3(0, _GROUND_Y - 0.05, 0)
	var fcol := CollisionShape3D.new()
	var fshape := BoxShape3D.new()
	fshape.size = Vector3(12, 0.1, 6)
	fcol.shape = fshape
	floor_body.add_child(fcol)
	var fvis := MeshInstance3D.new()
	var fmesh := BoxMesh.new()
	fmesh.size = Vector3(12, 0.1, 6)
	fvis.mesh = fmesh
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = GameSpecData.theme_color("backgroundColor", Color("#1a2220")).darkened(0.2)
	fvis.material_override = fmat
	floor_body.add_child(fvis)
	_world.add_child(floor_body)

	_player = _make_fighter(Vector3(_ARENA_LEFT + 1.2, 1.0, 0), Color(0.22, 0.74, 0.97))
	_ai = _make_fighter(Vector3(_ARENA_RIGHT - 1.2, 1.0, 0), Color(0.97, 0.45, 0.45))
	_player_mesh = _player.get_node("Mesh")
	_ai_mesh = _ai.get_node("Mesh")

	_camera = Camera3D.new()
	_camera.current = true
	_world.add_child(_camera)
	_update_camera()


func _make_fighter(pos: Vector3, color: Color) -> CharacterBody3D:
	var body := CharacterBody3D.new()
	body.position = pos
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.2
	col.shape = cap
	body.add_child(col)
	var mesh := MeshInstance3D.new()
	mesh.name = "Mesh"
	var cm := CapsuleMesh.new()
	cm.radius = 0.38
	cm.height = 1.2
	mesh.mesh = cm
	mesh.material_override = GameMaterials.make_from_pack(GameSpecData.shader_pack(), color)
	body.add_child(mesh)
	_world.add_child(body)
	return body


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


func _start_round(idx: int) -> void:
	_round_index = idx
	_player_hp = _hp_max
	_ai_hp = _hp_max
	_player_cd = 0.0
	_ai_cd = 0.0
	_player_flash = 0.0
	_ai_flash = 0.0
	_player_stagger = 0.0
	_ai_stagger = 0.0
	_player_blocking = false
	_ai_blocking = false
	_player.position = Vector3(_ARENA_LEFT + 1.2, 1.0, 0)
	_ai.position = Vector3(_ARENA_RIGHT - 1.2, 1.0, 0)
	_phase = "intro"
	_phase_until = _game_time + 1.2
	_hud.show_banner("第 %d 回合" % (idx + 1), "Ready", 1.2)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _physics_process(delta: float) -> void:
	if _ended:
		return
	_game_time += delta
	_player_cd = maxf(0.0, _player_cd - delta)
	_ai_cd = maxf(0.0, _ai_cd - delta)
	_player_flash = maxf(0.0, _player_flash - delta)
	_ai_flash = maxf(0.0, _ai_flash - delta)
	_player_stagger = maxf(0.0, _player_stagger - delta)
	_ai_stagger = maxf(0.0, _ai_stagger - delta)

	if _phase == "intro":
		if _game_time >= _phase_until:
			_phase = "fighting"
			_hud.show_banner("开打！", "", 0.7)
			GameAudio.play_bleep(GameBleeps.Kind.HIT)
		_refresh_hud()
		return

	if _phase == "fighting":
		_tick_player(delta)
		_tick_ai(delta)
		_tick_facing()
		_check_round_outcome()

	if _phase == "roundEnd":
		if _game_time >= _phase_until:
			if _player_wins >= _rounds_to_win or _ai_wins >= _rounds_to_win or _round_index + 1 >= _rounds_total:
				_end_match()
			else:
				_start_round(_round_index + 1)

	_refresh_hud()


func _tick_player(delta: float) -> void:
	if _player_stagger > 0.0:
		_player_blocking = false
		return
	var dir := 0.0
	if Input.is_key_pressed(KEY_A):
		dir -= 1.0
	if Input.is_key_pressed(KEY_D):
		dir += 1.0
	var nx := _player.position.x + dir * _move_speed * delta
	# 不允许穿过 AI
	var ai_x := _ai.position.x
	if dir > 0 and nx > ai_x - _FIGHTER_GAP:
		nx = ai_x - _FIGHTER_GAP
	elif dir < 0 and nx < ai_x + _FIGHTER_GAP:
		# 玩家在 AI 左侧向左移，允许（仅受场地边界约束）
		pass
	nx = clampf(nx, _ARENA_LEFT, _ARENA_RIGHT)
	_player.position.x = nx

	_player_blocking = Input.is_key_pressed(KEY_L) and _player_cd <= 0.0

	if Input.is_key_pressed(KEY_J) and _player_cd <= 0.0 and not _player_blocking:
		_try_move(_player, _ai, "light", true)
	elif Input.is_key_pressed(KEY_K) and _player_cd <= 0.0 and not _player_blocking:
		_try_move(_player, _ai, "heavy", true)
	elif Input.is_key_pressed(KEY_U) and _player_cd <= 0.0 and not _player_blocking:
		_try_move(_player, _ai, "special", true)


func _tick_ai(delta: float) -> void:
	if _ai_stagger > 0.0:
		_ai_blocking = false
		return
	var dx := _player.position.x - _ai.position.x
	var dist := absf(dx)
	var ideal := 2.0
	var vx := 0.0
	if dist > ideal + 0.2:
		vx = signf(dx) * _move_speed * 0.8
	elif dist < ideal - 0.4:
		vx = -signf(dx) * _move_speed * 0.6
	_ai.position.x = clampf(_ai.position.x + vx * delta, _ARENA_LEFT, _ARENA_RIGHT)

	if _game_time < _ai_next_decision:
		_ai_blocking = false
		return
	var base_gap := 0.9 - _ai_difficulty * 0.5
	_ai_next_decision = _game_time + base_gap + randf_range(0.0, 0.2)

	# 玩家正在出招 → 高难度 AI 倾向格挡
	var player_attacking := _player_cd > 0.0 and _player_cd > 0.05
	if player_attacking and randf() < (0.18 + _ai_difficulty * 0.45) and dist < 2.6:
		_ai_blocking = true
		_ai_cd = 0.32
		return
	_ai_blocking = false

	if dist <= 2.4 and _ai_cd <= 0.0:
		var roll := randf()
		if roll < 0.55:
			_try_move(_ai, _player, "light", false)
		elif roll < 0.82:
			_try_move(_ai, _player, "heavy", false)
		elif roll < 0.93:
			_ai_blocking = true
			_ai_cd = 0.32
		else:
			_try_move(_ai, _player, "special", false)


func _tick_facing() -> void:
	# 双方面向对方（仅影响视觉/判定方向，capsule 旋转无可见差别，留作扩展）
	pass


func _try_move(attacker: CharacterBody3D, target: CharacterBody3D, move_key: String, is_player: bool) -> void:
	var def: Dictionary
	match move_key:
		"light":   def = _MOVE_LIGHT
		"heavy":   def = _MOVE_HEAVY
		"block":   def = _MOVE_BLOCK
		"special": def = _MOVE_SPECIAL
		_:         return
	if is_player:
		_player_cd = def.cd
	else:
		_ai_cd = def.cd
	if def.damage == 0:
		# 格挡单独走（这里 _try_move 不处理 block，block 在 tick 中按住触发）
		return
	_fx_attack(attacker, def, is_player)
	GameAudio.play_bleep(GameBleeps.Kind.HIT if move_key == "heavy" or move_key == "special" else GameBleeps.Kind.PICKUP)
	# 命中判定：在攻击范围内
	var dist := absf(target.position.x - attacker.position.x)
	if dist <= def.range:
		_apply_hit(target, def, is_player)


func _apply_hit(target: CharacterBody3D, def: Dictionary, by_player: bool) -> void:
	var blocking := false
	var target_mesh: MeshInstance3D
	var dmg := int(def.damage)
	if by_player:
		# 命中 AI
		blocking = _ai_blocking
		target_mesh = _ai_mesh
		if blocking:
			dmg = int(round(float(dmg) * 0.3))
		_ai_hp = maxi(0, _ai_hp - dmg)
		_ai_flash = def.flash
		_ai_stagger = minf(0.42, def.flash + 0.12)
		if blocking:
			_fx_block(_ai)
		_knockback(_ai, by_player, def)
		_emit_hit_fx(target, dmg, blocking, def)
		GameMaterials.flash(target_mesh.material_override, 3.0)
		GameMaterials.drop_intensity(target_mesh.material_override, 3.0, 1.0, 0.18, self)
	else:
		# 命中玩家
		blocking = _player_blocking
		target_mesh = _player_mesh
		if blocking:
			dmg = int(round(float(dmg) * 0.3))
		_player_hp = maxi(0, _player_hp - dmg)
		_player_flash = def.flash
		_player_stagger = minf(0.42, def.flash + 0.12)
		if blocking:
			_fx_block(_player)
		_knockback(_player, by_player, def)
		_emit_hit_fx(target, dmg, blocking, def)
		GameMaterials.flash(target_mesh.material_override, 3.0)
		GameMaterials.drop_intensity(target_mesh.material_override, 3.0, 1.0, 0.18, self)


func _knockback(target: CharacterBody3D, by_player: bool, def: Dictionary) -> void:
	# 被击退方向：玩家命中 AI → AI 向右退；AI 命中玩家 → 玩家向左退
	var dir := 1.0 if by_player else -1.0
	var nx := clampf(target.position.x + dir * float(def.kb), _ARENA_LEFT, _ARENA_RIGHT)
	var tween := create_tween()
	tween.tween_property(target, "position:x", nx, 0.16).set_ease(Tween.EASE_OUT)


func _fx_attack(attacker: CharacterBody3D, def: Dictionary, is_player: bool) -> void:
	# 出招视觉：在攻击者前方闪现一个白色 box
	var box := MeshInstance3D.new()
	var m := BoxMesh.new()
	m.size = Vector3(float(def.range) * 0.6, 0.8, 0.4)
	box.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1, 1, 1, 0.85)
	mat.emission_enabled = true
	mat.emission = Color.WHITE
	mat.emission_energy_multiplier = 2.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	box.material_override = mat
	var dir := 1.0 if is_player else -1.0
	box.position = attacker.position + Vector3(dir * (0.5 + float(def.range) * 0.3), 0.0, 0.0)
	_world.add_child(box)
	var tw := create_tween()
	tw.tween_property(mat, "albedo_color:a", 0.0, 0.16).set_ease(Tween.EASE_OUT)
	tw.tween_callback(box.queue_free)


func _fx_block(fighter: CharacterBody3D) -> void:
	var ring := MeshInstance3D.new()
	var m := SphereMesh.new()
	m.radius = 0.7
	m.height = 1.4
	ring.mesh = m
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.99, 0.88, 0.28, 0.35)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = mat
	ring.position = fighter.position
	_world.add_child(ring)
	var tw := create_tween()
	tw.tween_property(mat, "albedo_color:a", 0.0, 0.2).set_ease(Tween.EASE_OUT)
	tw.tween_callback(ring.queue_free)


func _emit_hit_fx(target: CharacterBody3D, dmg: int, blocking: bool, def: Dictionary) -> void:
	GameJuice.shake_node(self, 6.0 if def.get("damage", 0) < 15 else 10.0, 0.16)
	GameJuice.flash_background(self, _hazard_color, 0.28)
	GameParticles.spawn(_world, target.position + Vector3(0, 0.5, 0), "burst_hit", _hazard_color, _particle_mult)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)


func _check_round_outcome() -> void:
	if _player_hp <= 0 or _ai_hp <= 0:
		if _player_hp <= 0 and _ai_hp <= 0:
			# 双倒：重打本回合
			_hud.show_banner("双倒！重打", "", 1.6)
			_phase = "roundEnd"
			_phase_until = _game_time + 1.6
			return
		var player_won := _ai_hp <= 0 and _player_hp > 0
		if player_won:
			_player_wins += 1
		else:
			_ai_wins += 1
		_phase = "roundEnd"
		_phase_until = _game_time + 1.6
		_hud.show_banner("本回合胜！" if player_won else "本回合负", "", 1.6)
		GameAudio.play_bleep(GameBleeps.Kind.WIN if player_won else GameBleeps.Kind.HIT)


func _refresh_hud() -> void:
	_hud.set_score("玩家 HP %d/%d · AI HP %d/%d · 比分 %d-%d (R%d/%d)" % [
		maxi(0, _player_hp), _hp_max,
		maxi(0, _ai_hp), _hp_max,
		_player_wins, _ai_wins,
		_round_index + 1, _rounds_total,
	])


func _end_match() -> void:
	var won := _player_wins >= _ai_wins
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1, 0.7), 0.35)
		_hud.show_banner("比赛胜利！", "%d-%d" % [_player_wins, _ai_wins], 2.4)
		if _player:
			GameParticles.spawn(_world, _player.position + Vector3(0, 0.5, 0), "burst_collect", _part_color, _particle_mult * 2.0)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		_hud.show_banner("比赛失败", "%d-%d" % [_player_wins, _ai_wins], 2.0)
		if _player:
			GameParticles.spawn(_world, _player.position + Vector3(0, 0.5, 0), "burst_death", _part_color, _particle_mult)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)


func _update_camera() -> void:
	if _camera == null:
		return
	_camera.position = Vector3(0, 2.2, 7.5)
	_camera.look_at(Vector3(0, 1.0, 0), Vector3.UP)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()

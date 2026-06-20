extends Node2D
## 3D 体育运动（投篮/射门抛物线模型，与 Phaser SportsScene 对齐）：
## - 玩家是地面上的发射器，左右移动对准目标
## - 按住空格蓄力，松开 → apply_impulse 给球（抛物线由重力 + 初速产生）
## - 球是 RigidBody3D + SphereMesh
## - 球进入篮筐/球门 Area3D → _score += 1 + GameParticles.spawn("burst_collect")
## - 限时倒计时；达 targetScore 通关 / 时间到失败
## - GameHud 显示分数/时间/进度
## - 蓝图来自 GameSpecData.sports() 访问器

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _player: CharacterBody3D
var _player_mesh: MeshInstance3D
var _camera: Camera3D
var _goal: Node3D
var _goal_area: Area3D
var _hud := GameHud.new()
var _ended := false

# 蓝图
var _sport := "basketball"
var _target_score := 15
var _time_limit_sec := 75.0
var _ai_difficulty := 0.5
var _gravity := 9.8
var _ball_speed := 10.0

# 游戏状态
var _score := 0
var _game_time := 0.0
var _charging := false
var _charge_start := 0.0
const MAX_CHARGE_SEC := 1.2
const MIN_POWER := 5.0
const MAX_POWER := 11.0

var _particle_mult := 1.0
var _part_color := Color.GOLD
var _move_speed := 6.0
var _drift_range := 1.6
var _drift_phase := 0.0
var _goal_base_x := 0.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_load_blueprint()
	_part_color = GameSpecData.theme_color("collectibleColor", _part_color)
	_particle_mult = GameSpecData.particle_intensity_mult()
	_hud.set_extra("← → / A D 移动 · 空格蓄力 · 松开抛球 · 进框得分")
	_build_world()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _load_blueprint() -> void:
	var bp = GameSpecData.sports()
	if not bp is Dictionary:
		bp = {}
	if bp.has("sport"):
		_sport = str(bp["sport"])
	if bp.has("targetScore"):
		_target_score = clampi(int(bp["targetScore"]), 3, 50)
	if bp.has("timeLimitMs"):
		_time_limit_sec = clampf(float(bp["timeLimitMs"]) / 1000.0, 20.0, 180.0)
	if bp.has("aiDifficulty"):
		_ai_difficulty = clampf(float(bp["aiDifficulty"]), 0.0, 1.0)
	if bp.has("gravity"):
		_gravity = clampf(float(bp["gravity"]), 4.0, 25.0)
	if bp.has("ballSpeed"):
		_ball_speed = clampf(float(bp["ballSpeed"]), 4.0, 20.0)


func _build_world() -> void:
	_add_environment()
	_build_ground()
	_build_goal()
	_build_player()
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
	# 物理重力（沿 Y 负向）
	ProjectSettings.set_setting("physics/3d/default_gravity", _gravity)


func _build_ground() -> void:
	var body := StaticBody3D.new()
	body.position = Vector3(0, 0, 0)
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(20, 0.4, 6)
	col.shape = shape
	body.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = shape.size
	vis.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("playerColor", Color.GREEN).darkened(0.45)
	vis.material_override = mat
	body.add_child(vis)
	_world.add_child(body)


func _build_goal() -> void:
	_goal_base_x = 0.0
	_goal = Node3D.new()
	_goal.position = Vector3(_goal_base_x, 4.2, 0)
	_world.add_child(_goal)

	# 篮板
	var back := MeshInstance3D.new()
	back.mesh = BoxMesh.new()
	back.mesh.size = Vector3(2.4, 0.18, 0.12)
	back.position = Vector3(0, 1.0, 0)
	var bm := StandardMaterial3D.new()
	bm.albedo_color = GameSpecData.theme_color("playerColor", Color.CYAN)
	back.material_override = bm
	_goal.add_child(back)

	# 篮筐/横梁
	var rim := MeshInstance3D.new()
	rim.mesh = BoxMesh.new()
	rim.mesh.size = Vector3(1.6, 0.12, 0.12)
	rim.position = Vector3(0, 0.0, 0)
	rim.material_override = bm
	_goal.add_child(rim)

	# 立柱
	for sx in [-0.8, 0.8]:
		var post := MeshInstance3D.new()
		post.mesh = BoxMesh.new()
		post.mesh.size = Vector3(0.12, 1.2, 0.12)
		post.position = Vector3(sx, -0.6, 0)
		post.material_override = bm
		_goal.add_child(post)

	# 命中判定 Area3D（与篮筐对齐）
	_goal_area = Area3D.new()
	_goal_area.position = Vector3(0, 0.0, 0)
	var acol := CollisionShape3D.new()
	var ashape := BoxShape3D.new()
	ashape.size = Vector3(1.4, 0.5, 0.5)
	acol.shape = ashape
	_goal_area.add_child(acol)
	_goal_area.body_entered.connect(_on_goal_body_entered)
	_goal.add_child(_goal_area)


func _build_player() -> void:
	_player = CharacterBody3D.new()
	_player.position = Vector3(0, 0.6, 2.5)
	var pcol := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.0
	pcol.shape = cap
	_player.add_child(pcol)
	_player_mesh = MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = 0.32
	cm.height = 1.0
	_player_mesh.mesh = cm
	var pcolor := GameSpecData.theme_color("collectibleColor", Color.GOLD)
	_player_mesh.material_override = GameMaterials.make_from_pack(GameSpecData.shader_pack(), pcolor)
	_player.add_child(_player_mesh)
	_world.add_child(_player)


func _physics_process(delta: float) -> void:
	if _ended or _player == null:
		return
	_game_time += delta

	# 倒计时
	var remain := _time_limit_sec - _game_time
	if remain <= 0.0:
		_end(_score >= _target_score)
		return

	# 目标飘动（难度越高越快）
	_drift_phase += delta * (1.0 + _ai_difficulty * 1.2)
	_goal.position.x = _goal_base_x + sin(_drift_phase) * _drift_range

	# 玩家左右移动
	var dir := Input.get_axis("ui_left", "ui_right")
	if Input.is_key_pressed(KEY_A):
		dir -= 1.0
	if Input.is_key_pressed(KEY_D):
		dir += 1.0
	var vel := _player.velocity
	vel.x = dir * _move_speed
	vel.z = 0.0
	# 轻微重力把玩家吸在地面（CharacterBody3D 自身处理）
	vel.y = 0.0
	_player.velocity = vel
	_player.move_and_slide()

	_update_camera()

	var mins := int(remain) / 60
	var secs := int(remain) % 60
	var time_str := "%d:%02d" % [mins, secs]
	_hud.set_score("进球 %d / %d · 时间 %s" % [_score, _target_score, time_str])


func _process(_delta: float) -> void:
	# 蓄力进度（在 _process 里更新 HUD 提示，蓄力判定在 input）
	if _charging:
		var held := clampf(Time.get_ticks_msec() / 1000.0 - _charge_start, 0.0, MAX_CHARGE_SEC)
		var pct := int(held / MAX_CHARGE_SEC * 100.0)
		_hud.set_extra("蓄力 %d%% · 松开空格抛球" % pct)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_SPACE:
			if not _ended and not _charging:
				_charging = true
				_charge_start = Time.get_ticks_msec() / 1000.0
		GameAudio.boot_interactive()
	elif event is InputEventKey and not event.pressed:
		if event.keycode == KEY_SPACE and _charging:
			_charging = false
			_throw_ball()
	elif event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()


func _throw_ball() -> void:
	if _ended or _player == null:
		return
	var held := clampf(Time.get_ticks_msec() / 1000.0 - _charge_start, 0.0, MAX_CHARGE_SEC)
	var t := held / MAX_CHARGE_SEC
	var power := MIN_POWER + (MAX_POWER - MIN_POWER) * t

	var ball := RigidBody3D.new()
	ball.position = _player.position + Vector3(0, 0.7, -0.4)
	var col := CollisionShape3D.new()
	var shape := SphereShape3D.new()
	shape.radius = 0.22
	col.shape = shape
	ball.add_child(col)
	var vis := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.22
	mesh.height = 0.44
	vis.mesh = mesh
	vis.material_override = GameMaterials.make_from_pack(GameSpecData.shader_pack(), _part_color)
	ball.add_child(vis)
	_world.add_child(ball)

	# 抛物线初速：水平朝目标 + 垂直向上
	var to_goal := _goal.position - ball.position
	var horiz := Vector3(to_goal.x, 0, to_goal.z)
	if horiz.length() < 0.01:
		horiz = Vector3.FORWARD
	horiz = horiz.normalized()
	var vx := horiz.x * power * 0.6
	var vz := horiz.z * power * 0.6
	var vy := power * 1.1
	ball.linear_velocity = Vector3(vx, vy, vz)

	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)

	# 兜底：5 秒后自动清理未命中的球
	if ball.get_tree():
		ball.get_tree().create_timer(5.0).timeout.connect(ball.queue_free, CONNECT_ONE_SHOT)


func _on_goal_body_entered(body: Node3D) -> void:
	if _ended:
		return
	if not body is RigidBody3D:
		return
	# 仅判定带 "ball" 标记 / 由本运行时生成的球（这里所有 RigidBody3D 都是我们的球）
	var pos := body.global_position
	body.queue_free()
	_score += 1
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameParticles.spawn(_world, pos, "burst_collect", _part_color, _particle_mult)
	GameJuice.flash_background(self, _part_color, 0.18)
	if _score >= _target_score:
		_end(true)


func _update_camera() -> void:
	if _camera == null or _player == null:
		return
	var cx := clampf(_player.position.x, -3.0, 3.0)
	_camera.position = Vector3(cx, 3.2, 7.5)
	_camera.look_at(Vector3(cx, 1.5, 0), Vector3.UP)


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1, 0.7), 0.35)
		_hud.show_banner("通关！", "达成分数目标", 2.4)
		if _player:
			GameParticles.spawn(_world, _player.position + Vector3(0, 0.8, 0), "burst_collect", _part_color, _particle_mult * 2.0)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		_hud.show_banner("时间到", "再试一次", 2.0)
		if _player:
			GameParticles.spawn(_world, _player.position + Vector3(0, 0.8, 0), "burst_death", _part_color, _particle_mult)

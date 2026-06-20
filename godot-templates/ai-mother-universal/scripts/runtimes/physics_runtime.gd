extends Node2D
## 3D 物理发泄：SubViewport 假人 + 点击冲量

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _dummy: RigidBody3D
var _camera: Camera3D
var _hud = GameHud.new()
var _score = 0
var _combo = 0
var _combo_until = 0.0
var _win = 500
var _ended = false
var _hit_impulse = 1.0
var _combo_window = 0.9
var _combo_mult = 8.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_win = GameSpecData.gameplay_i("winScore", 500)
	var pp = GameSpecData.sample_play_profile().get("physics", {})
	if pp is Dictionary:
		_hit_impulse = float(pp.get("hitImpulse", 1.0))
		_combo_window = float(pp.get("comboWindowMs", 900)) / 1000.0
		_combo_mult = 8.0 * float(pp.get("comboMultiplier", 1.0))
		if pp.has("targetHits"):
			_win = int(pp.get("targetHits", _win))
	_build_world()
	_hud.set_extra("点击假人猛击 · 连击加分 · 目标 %d" % _win)
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _build_world() -> void:
	var env_n = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = GameSpecData.theme_color("backgroundColor", Color("#1a2220"))
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = env.background_color.lightened(0.15)
	env_n.environment = env
	_world.add_child(env_n)

	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 25, 0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	_world.add_child(sun)

	var floor = StaticBody3D.new()
	floor.position = Vector3(0, -0.5, 0)
	var fcol = CollisionShape3D.new()
	var fshape = BoxShape3D.new()
	fshape.size = Vector3(14, 1, 8)
	fcol.shape = fshape
	floor.add_child(fcol)
	var fvis = MeshInstance3D.new()
	var fmesh = BoxMesh.new()
	fmesh.size = fshape.size
	fvis.mesh = fmesh
	var fmat = StandardMaterial3D.new()
	fmat.albedo_color = GameSpecData.theme_color("playerColor", Color.GRAY).darkened(0.5)
	fvis.material_override = fmat
	floor.add_child(fvis)
	_world.add_child(floor)

	_dummy = RigidBody3D.new()
	_dummy.position = Vector3(0, 2.5, 0)
	_dummy.mass = 1.2
	var dcol = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.55
	cap.height = 1.8
	dcol.shape = cap
	_dummy.add_child(dcol)
	var dvis = MeshInstance3D.new()
	var cm = CapsuleMesh.new()
	cm.radius = 0.55
	cm.height = 1.8
	dvis.mesh = cm
	var dmat = StandardMaterial3D.new()
	dmat.albedo_color = GameSpecData.theme_color("playerColor", Color.ORANGE)
	dvis.material_override = dmat
	_dummy.add_child(dvis)
	var head = MeshInstance3D.new()
	var hm = SphereMesh.new()
	hm.radius = 0.38
	hm.height = 0.76
	head.mesh = hm
	head.position = Vector3(0, 1.05, 0)
	var hmat = StandardMaterial3D.new()
	hmat.albedo_color = dmat.albedo_color.lightened(0.12)
	head.material_override = hmat
	_dummy.add_child(head)
	_world.add_child(_dummy)

	_camera = Camera3D.new()
	_camera.current = true
	_camera.position = Vector3(0, 3.5, 7.5)
	_camera.look_at(Vector3(0, 1.2, 0), Vector3.UP)
	_world.add_child(_camera)


func _unhandled_input(event: InputEvent) -> void:
	if _ended:
		return
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()
	if not event is InputEventMouseButton:
		return
	var mb = event as InputEventMouseButton
	if not mb.pressed or _dummy == null or _camera == null or _viewport == null:
		return
	var mouse = _viewport.get_mouse_position()
	var from = _camera.project_ray_origin(mouse)
	var dir = _camera.project_ray_normal(mouse)
	var hit = _ray_hit_dummy(from, dir)
	if hit.length() > 6.0:
		return
	var impulse_dir = (hit - _dummy.global_position).normalized()
	var force = clampf((8.0 - hit.length() * 0.8) * _hit_impulse, 3.0, 16.0)
	_dummy.apply_central_impulse(impulse_dir * force + Vector3(0, 2.5, 0))
	var now = Time.get_ticks_msec() / 1000.0
	if now < _combo_until:
		_combo += 1
	else:
		_combo = 1
	_combo_until = now + _combo_window
	_score += 20 + int(_combo * _combo_mult)
	_hud.set_score("得分 %d · 连击 x%d" % [_score, _combo])
	GameJuice.shake_node(self, 4.0 + _combo * 0.8, 0.12)
	if _camera:
		GameJuice.burst(self, _camera.unproject_position(_dummy.global_position), GameSpecData.theme_color("collectibleColor", Color.ORANGE), mini(6 + _combo, 14))
		GameJuice.flash_background(self, GameSpecData.theme_color("collectibleColor", Color.GOLD), 0.12 + _combo * 0.02)
	if _score >= _win:
		_finish(true)


func _ray_hit_dummy(from: Vector3, dir: Vector3) -> Vector3:
	var space = _world.get_world_3d().direct_space_state
	var query = PhysicsRayQueryParameters3D.create(from, from + dir * 40.0)
	query.collide_with_bodies = true
	var hit = space.intersect_ray(query)
	if hit.is_empty():
		return from + dir * 40.0
	return hit.get("position", from)


func _finish(won: bool) -> void:
	if _ended:
		return
	_ended = true
	_hud.show_banner("解压达成" if won else "结束", "得分 %d" % _score)

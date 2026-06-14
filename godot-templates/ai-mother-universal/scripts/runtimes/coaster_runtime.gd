extends Node2D
## 3D 空中轨道竞速：Path3D 跟车、Boost/Brake、计时 HUD

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _follow: PathFollow3D
var _camera: Camera3D
var _progress := 0.0
var _speed := 24.0
var _base_speed := 24.0
var _max_speed := 78.0
var _elapsed := 0.0
var _ended := false
var _boost := 0.0
var _brake := 0.0
var _third_person := true
var _hud := GameHud.new()
var _v_was_down := false
var _boost_was_low := true


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_base_speed = 20.0 + float(GameSpecData.director().get("intensity", 0.6)) * 14.0
	_max_speed = 55.0 + GameSpecData.gameplay_f("playerSpeed", 320) * 0.06
	var cp := GameSpecData.sample_play_profile().get("coaster", {})
	if cp is Dictionary:
		_base_speed *= float(cp.get("speedBoost", 1.0))
		_max_speed *= float(cp.get("speedBoost", 1.0))
	_speed = _base_speed * 0.55
	_build_track()
	_hint_mode()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _hint_mode() -> void:
	var coaster := GameSpecData.coaster()
	var mode := str(coaster.get("mode", "coaster"))
	if mode == "endlessRoad":
		var goal := int(coaster.get("distanceGoal", 750))
		_hud.set_extra("←/→ 换道 · 目标 %dm · 躲避障碍" % goal)
	else:
		_hud.set_extra("Boost · 空格/→ · Brake · ←/Shift · 视角 · V · 目标：跑完全程")


func _build_track() -> void:
	var coaster := GameSpecData.coaster()
	var path_arr: Array = coaster.get("path", [])
	var points: PackedVector3Array = PackedVector3Array()
	if path_arr is Array and path_arr.size() >= 2:
		for item in path_arr:
			if item is Dictionary:
				points.append(Vector3(float(item.get("x", 0)), float(item.get("y", 0)), float(item.get("z", 0))))
	if points.size() < 2:
		points = _default_loop_points()

	var curve := Curve3D.new()
	for i in range(points.size()):
		var p := points[i]
		var inl := Vector3.ZERO
		var outv := Vector3.ZERO
		if i > 0:
			inl = (p - points[i - 1]).normalized() * 2.0
		if i < points.size() - 1:
			outv = (points[i + 1] - p).normalized() * 2.0
		curve.add_point(p, inl, outv)

	var path3d := Path3D.new()
	path3d.curve = curve
	_world.add_child(path3d)

	var env := WorldEnvironment.new()
	var sky := Environment.new()
	sky.background_mode = Environment.BG_SKY
	var proc_sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	var bg := GameSpecData.theme_color("backgroundColor", Color("#38bdf8"))
	var player := GameSpecData.theme_color("playerColor", Color("#ef4444"))
	var accent := GameSpecData.theme_color("collectibleColor", Color("#fde047"))
	sky_mat.sky_top_color = bg.lightened(0.15)
	sky_mat.sky_horizon_color = bg
	sky_mat.ground_horizon_color = player.darkened(0.35)
	sky_mat.ground_bottom_color = accent.darkened(0.55)
	proc_sky.sky_material = sky_mat
	sky.sky = proc_sky
	sky.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.environment = sky
	_world.add_child(env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42, 35, 0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	_world.add_child(sun)

	_follow = PathFollow3D.new()
	_follow.loop = false
	path3d.add_child(_follow)

	var cart := _make_cart()
	_follow.add_child(cart)

	_camera = Camera3D.new()
	_camera.current = true
	_follow.add_child(_camera)
	_update_camera()

	_build_rail_visual(path3d, curve)
	_scatter_decor(points)


func _default_loop_points() -> PackedVector3Array:
	var pts: PackedVector3Array = PackedVector3Array()
	for i in range(33):
		var t := float(i) / 32.0
		pts.append(Vector3(sin(t * TAU * 2.0) * 12.0, sin(t * PI) * 8.0, t * 120.0))
	return pts


func _make_cart() -> Node3D:
	var root := Node3D.new()
	var body := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(1.4, 0.9, 2.0)
	body.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("playerColor", Color("#ef4444"))
	body.material_override = mat
	root.add_child(body)
	for sx in [-0.75, 0.75]:
		var wheel := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.28
		cyl.bottom_radius = 0.28
		cyl.height = 0.18
		wheel.mesh = cyl
		wheel.rotation_degrees = Vector3(90, 0, 0)
		wheel.position = Vector3(sx, -0.45, 0)
		var wmat := StandardMaterial3D.new()
		wmat.albedo_color = Color("#1f2937")
		wheel.material_override = wmat
		root.add_child(wheel)
	var crown := MeshInstance3D.new()
	var crown_box := BoxMesh.new()
	crown_box.size = Vector3(0.35, 0.35, 0.35)
	crown.mesh = crown_box
	crown.position = Vector3(0, 0.65, -0.2)
	var cmat := StandardMaterial3D.new()
	cmat.albedo_color = Color("#fde047")
	crown.material_override = cmat
	root.add_child(crown)
	return root


func _build_rail_visual(path3d: Path3D, curve: Curve3D) -> void:
	var steps := 120
	for i in range(steps):
		var t0 := float(i) / float(steps)
		var t1 := float(i + 1) / float(steps)
		var a := curve.sample_baked(t0 * curve.get_baked_length())
		var b := curve.sample_baked(t1 * curve.get_baked_length())
		var tie := MeshInstance3D.new()
		var tm := BoxMesh.new()
		tm.size = Vector3(2.8, 0.12, 0.35)
		tie.mesh = tm
		tie.position = (a + b) * 0.5
		tie.look_at(b, Vector3.UP)
		var tmat := StandardMaterial3D.new()
		tmat.albedo_color = GameSpecData.theme_color("hazardColor", Color("#854d0e"))
		tie.material_override = tmat
		path3d.add_child(tie)


func _scatter_decor(points: PackedVector3Array) -> void:
	for i in range(0, points.size(), 5):
		if randf() > 0.55:
			continue
		var p := points[i]
		var star := MeshInstance3D.new()
		var sm := BoxMesh.new()
		sm.size = Vector3(0.6, 0.6, 0.6)
		star.mesh = sm
		star.position = p + Vector3(randf_range(-8, 8), randf_range(4, 12), randf_range(-3, 3))
		var smat := StandardMaterial3D.new()
		smat.albedo_color = GameSpecData.theme_color("collectibleColor", Color("#fde047"))
		star.material_override = smat
		_world.add_child(star)


func _physics_process(delta: float) -> void:
	if _ended or _follow == null:
		return
	_elapsed += delta
	var boost_on := Input.is_action_pressed("ui_accept") or Input.is_key_pressed(KEY_E) or Input.is_key_pressed(KEY_RIGHT)
	var brake_on := Input.is_key_pressed(KEY_Q) or Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_SHIFT)
	_boost = lerpf(_boost, 1.0 if boost_on else 0.0, delta * 4.0)
	_brake = lerpf(_brake, 1.0 if brake_on else 0.0, delta * 5.0)
	if _boost > 0.55 and _boost_was_low:
		GameJuice.shake_node(self, 4.5, 0.1)
		GameJuice.flash_background(self, GameSpecData.theme_color("collectibleColor", Color.GOLD), 0.18)
	_boost_was_low = _boost <= 0.55
	if Input.is_key_pressed(KEY_V):
		if not _v_was_down:
			_third_person = not _third_person
			_update_camera()
		_v_was_down = true
	else:
		_v_was_down = false
	var target := _base_speed + _boost * 22.0 - _brake * 18.0
	_speed = lerpf(_speed, clampf(target, 6.0, _max_speed), delta * 2.0)
	var curve := _follow.get_parent() as Path3D
	if curve and curve.curve:
		var length := curve.curve.get_baked_length()
		_progress += (_speed * delta) / maxf(length, 1.0)
		_follow.progress_ratio = clampf(_progress, 0.0, 1.0)
		_update_camera()
	_hud.set_score("计时 %.1fs · 速度 %d · 进度 %d%%" % [_elapsed, int(_speed * 3.2), int(_progress * 100)])
	if _progress >= 1.0:
		_finish(true)


func _update_camera() -> void:
	if _camera == null:
		return
	if _third_person:
		_camera.position = Vector3(0, 2.2, 3.8)
		_camera.rotation_degrees = Vector3(-12, 0, 0)
	else:
		_camera.position = Vector3(0, 0.75, 0.2)
		_camera.rotation_degrees = Vector3(-8, 0, 0)


func _finish(won: bool) -> void:
	if _ended:
		return
	_ended = true
	var title := "完赛！" if won else "脱轨"
	var msg := "用时 %.2fs" % _elapsed if won else GameSpecData.labels("hazard", "脱轨")
	if won:
		GameJuice.flash_background(self, Color(0.55, 1, 0.65), 0.32)
		GameJuice.shake_node(self, 5.0, 0.12)
	_hud.show_banner(title, msg)
	GameAudio.play_bleep(GameBleeps.Kind.WIN if won else GameBleeps.Kind.HIT)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()

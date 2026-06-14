extends Node2D
## 3D 汽车涂色 / 陶艺拉坯定制：主题色 + 调色盘 UI（读 samplePlayProfile）

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport
@onready var _container: SubViewportContainer = $ViewportContainer

const PALETTE := [Color.RED, Color.ORANGE, Color.YELLOW, Color.GREEN, Color.CYAN, Color.BLUE, Color.PURPLE, Color.PINK, Color.WHITE, Color("#1e293b")]

var _hud := GameHud.new()
var _body := Color.RED
var _wheel := Color.BLACK
var _bg := Color("#38bdf8")
var _glaze := Color.RED
var _rim := Color.YELLOW
var _base := Color("#78350f")
var _part := "body"
var _pottery_part := "glaze"
var _edits := 0
var _edit_goal := 5
var _ended := false
var _pottery_mode := false
var _pottery_spin := 0.35
var _pottery_root: Node3D
var _glaze_mesh: MeshInstance3D
var _rim_mesh: MeshInstance3D
var _base_mesh: MeshInstance3D
var _car_root: Node3D
var _body_mesh: MeshInstance3D
var _wheel_l: MeshInstance3D
var _wheel_r: MeshInstance3D
var _floor_mesh: MeshInstance3D
var _camera: Camera3D


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var cust := GameSpecData.customization()
	var cp := GameSpecData.sample_play_profile().get("customization", {})
	_edit_goal = int(cust.get("editGoal", 5))
	if cp is Dictionary:
		if cp.has("editGoal"):
			_edit_goal = int(cp.get("editGoal", _edit_goal))
		if cp.has("potterySpin"):
			_pottery_spin = float(cp.get("potterySpin", _pottery_spin)) * 0.25
	_body = GameSpecData.theme_color("playerColor", Color.RED)
	_wheel = GameSpecData.theme_color("hazardColor", Color.BLACK)
	_bg = GameSpecData.theme_color("backgroundColor", Color.CYAN)
	_glaze = _body
	_rim = GameSpecData.theme_color("collectibleColor", Color.YELLOW)
	_base = _wheel
	_pottery_mode = str(cust.get("mode", "carPaint")) == "pottery"
	_build_scene()
	_apply_colors()
	for i in range(PALETTE.size()):
		var sw := ColorRect.new()
		sw.color = PALETTE[i]
		sw.size = Vector2(28, 28)
		sw.position = Vector2(16 + i * 34, 480)
		sw.mouse_filter = Control.MOUSE_FILTER_STOP
		sw.gui_input.connect(_pick_color.bind(PALETTE[i]))
		add_child(sw)
	if _pottery_mode:
		_hud.set_extra("陶艺 · 1=釉色 2=口沿 3=底座 · 调色盘涂色 · %d 次过关" % _edit_goal)
	else:
		_hud.set_extra("1/2/3 切换 车身/轮毂/背景 · 点调色盘涂色 · %d 次过关" % _edit_goal)
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _process(delta: float) -> void:
	if _ended or not _pottery_mode or _pottery_root == null:
		return
	_pottery_root.rotation_degrees.y += _pottery_spin * delta * 60.0


func _build_scene() -> void:
	var env_n := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = _bg.darkened(0.15)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.52, 0.58)
	env.ambient_light_energy = 0.9
	env_n.environment = env
	_world.add_child(env_n)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42, 30, 0)
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	_world.add_child(sun)

	_camera = Camera3D.new()
	_camera.position = Vector3(0, 2.8, 5.2)
	_camera.rotation_degrees = Vector3(-18, 0, 0)
	_camera.current = true
	_world.add_child(_camera)

	_car_root = Node3D.new()
	_world.add_child(_car_root)

	if _pottery_mode:
		_build_pottery()
		return

	_floor_mesh = MeshInstance3D.new()
	var floor_box := BoxMesh.new()
	floor_box.size = Vector3(12, 0.08, 8)
	_floor_mesh.mesh = floor_box
	_floor_mesh.position = Vector3(0, -0.04, 0)
	_car_root.add_child(_floor_mesh)

	_body_mesh = MeshInstance3D.new()
	var body_box := BoxMesh.new()
	body_box.size = Vector3(2.2, 0.55, 1.0)
	_body_mesh.mesh = body_box
	_body_mesh.position = Vector3(0, 0.35, 0)
	_car_root.add_child(_body_mesh)

	var cabin := MeshInstance3D.new()
	var cabin_box := BoxMesh.new()
	cabin_box.size = Vector3(1.0, 0.35, 0.85)
	cabin.mesh = cabin_box
	cabin.position = Vector3(-0.15, 0.72, 0)
	var cmat := StandardMaterial3D.new()
	cmat.albedo_color = Color("#bae6fd")
	cmat.roughness = 0.2
	cmat.metallic = 0.1
	cabin.material_override = cmat
	_car_root.add_child(cabin)

	_wheel_l = _make_wheel(Vector3(-0.75, 0.18, 0))
	_wheel_r = _make_wheel(Vector3(0.75, 0.18, 0))
	_car_root.add_child(_wheel_l)
	_car_root.add_child(_wheel_r)


func _build_pottery() -> void:
	_pottery_root = Node3D.new()
	_car_root.add_child(_pottery_root)

	var wheel := MeshInstance3D.new()
	var wheel_mesh := CylinderMesh.new()
	wheel_mesh.top_radius = 1.4
	wheel_mesh.bottom_radius = 1.4
	wheel_mesh.height = 0.12
	wheel.mesh = wheel_mesh
	wheel.position = Vector3(0, 0.06, 0)
	var wmat := StandardMaterial3D.new()
	wmat.albedo_color = Color("#57534e")
	wheel.material_override = wmat
	_pottery_root.add_child(wheel)

	_base_mesh = MeshInstance3D.new()
	var base_cyl := CylinderMesh.new()
	base_cyl.top_radius = 0.82
	base_cyl.bottom_radius = 0.88
	base_cyl.height = 0.22
	_base_mesh.mesh = base_cyl
	_base_mesh.position = Vector3(0, 0.22, 0)
	_pottery_root.add_child(_base_mesh)

	_glaze_mesh = MeshInstance3D.new()
	var body_cyl := CylinderMesh.new()
	body_cyl.top_radius = 0.58
	body_cyl.bottom_radius = 0.72
	body_cyl.height = 1.05
	_glaze_mesh.mesh = body_cyl
	_glaze_mesh.position = Vector3(0, 0.88, 0)
	_pottery_root.add_child(_glaze_mesh)

	_rim_mesh = MeshInstance3D.new()
	var rim_cyl := CylinderMesh.new()
	rim_cyl.top_radius = 0.62
	rim_cyl.bottom_radius = 0.58
	rim_cyl.height = 0.14
	_rim_mesh.mesh = rim_cyl
	_rim_mesh.position = Vector3(0, 1.48, 0)
	_pottery_root.add_child(_rim_mesh)


func _make_wheel(pos: Vector3) -> MeshInstance3D:
	var w := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 0.28
	cyl.bottom_radius = 0.28
	cyl.height = 0.22
	w.mesh = cyl
	w.rotation_degrees = Vector3(90, 0, 0)
	w.position = pos
	return w


func _pottery_part_label() -> String:
	match _pottery_part:
		"glaze":
			return "釉色"
		"rim":
			return "口沿"
		"base":
			return "底座"
	return _pottery_part


func _apply_colors() -> void:
	if _pottery_mode:
		if _glaze_mesh:
			var gmat := StandardMaterial3D.new()
			gmat.albedo_color = _glaze
			gmat.roughness = 0.28
			gmat.metallic = 0.05
			_glaze_mesh.material_override = gmat
		if _rim_mesh:
			var rmat := StandardMaterial3D.new()
			rmat.albedo_color = _rim
			rmat.roughness = 0.18
			rmat.metallic = 0.12
			_rim_mesh.material_override = rmat
		if _base_mesh:
			var bmat := StandardMaterial3D.new()
			bmat.albedo_color = _base
			bmat.roughness = 0.45
			bmat.metallic = 0.08
			_base_mesh.material_override = bmat
		return
	if _body_mesh:
		var bmat := StandardMaterial3D.new()
		bmat.albedo_color = _body
		bmat.roughness = 0.35
		bmat.metallic = 0.15
		_body_mesh.material_override = bmat
	for w in [_wheel_l, _wheel_r]:
		if w:
			var wmat := StandardMaterial3D.new()
			wmat.albedo_color = _wheel
			wmat.roughness = 0.5
			w.material_override = wmat
	if _floor_mesh:
		var fmat := StandardMaterial3D.new()
		fmat.albedo_color = _bg
		fmat.roughness = 0.8
		_floor_mesh.material_override = fmat
	if _world.get_child_count() > 0:
		var env_node = _world.get_child(0) as WorldEnvironment
		if env_node and env_node.environment:
			env_node.environment.background_color = _bg.darkened(0.15)


func _unhandled_input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed:
		return
	if _pottery_mode:
		match event.keycode:
			KEY_1:
				_pottery_part = "glaze"
			KEY_2:
				_pottery_part = "rim"
			KEY_3:
				_pottery_part = "base"
		return
	match event.keycode:
		KEY_1:
			_part = "body"
		KEY_2:
			_part = "wheel"
		KEY_3:
			_part = "bg"


func _pick_color(event: InputEvent, col: Color) -> void:
	if _ended or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed:
		return
	if _pottery_mode:
		match _pottery_part:
			"glaze":
				_glaze = col
			"rim":
				_rim = col
			"base":
				_base = col
	else:
		match _part:
			"body":
				_body = col
			"wheel":
				_wheel = col
			"bg":
				_bg = col
	_apply_colors()
	_edits += 1
	var active := _pottery_part_label() if _pottery_mode else _part
	_hud.set_score("涂色 %d/%d · %s" % [_edits, _edit_goal, active])
	if _edits >= _edit_goal:
		_finish(true)


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("定制完成", "")
	GameAudio.play_bleep(GameBleeps.Kind.WIN if won else GameBleeps.Kind.HIT)

extends Node2D
## 3D 国际象棋：主题色棋盘 + 立体棋子（Astrocade 级 Godot 视觉）

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport
@onready var _container: SubViewportContainer = $ViewportContainer

var _hud := GameHud.new()
var _cell := 1.0
var _board_origin := Vector3(-3.5, 0, -3.5)
var _pieces: Array = []
var _selected: Dictionary = {}
var _white_turn := true
var _moves := 0
var _ended := false
var _camera: Camera3D
var _piece_nodes: Dictionary = {}


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_pieces = [
		{"c": "w", "t": "K", "r": 7, "col": 4},
		{"c": "w", "t": "P", "r": 6, "col": 3},
		{"c": "w", "t": "P", "r": 6, "col": 4},
		{"c": "b", "t": "K", "r": 0, "col": 4},
		{"c": "b", "t": "P", "r": 1, "col": 2},
		{"c": "b", "t": "P", "r": 1, "col": 5},
	]
	_build_scene()
	_sync_piece_meshes()
	_hud.set_extra("白方回合 · 点击棋子再点目标格")
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _build_scene() -> void:
	var env_n := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = GameSpecData.theme_color("backgroundColor", Color("#1e293b")).darkened(0.25)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.48, 0.55)
	env.ambient_light_energy = 0.85
	env_n.environment = env
	_world.add_child(env_n)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, 35, 0)
	sun.light_energy = 1.2
	sun.shadow_enabled = true
	_world.add_child(sun)

	_camera = Camera3D.new()
	_camera.position = Vector3(0, 9.5, 8.5)
	_camera.rotation_degrees = Vector3(-52, 0, 0)
	_camera.current = true
	_world.add_child(_camera)

	var board_root := Node3D.new()
	board_root.name = "Board"
	_world.add_child(board_root)

	var light_sq := GameSpecData.theme_color("collectibleColor", Color("#d6d3d1"))
	var dark_sq := GameSpecData.theme_color("hazardColor", Color("#57534e")).darkened(0.15)
	for r in range(8):
		for c in range(8):
			var tile := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(_cell * 0.96, 0.12, _cell * 0.96)
			tile.mesh = box
			tile.position = _board_origin + Vector3(c * _cell + _cell * 0.5, 0, r * _cell + _cell * 0.5)
			var mat := StandardMaterial3D.new()
			mat.albedo_color = light_sq if (r + c) % 2 == 0 else dark_sq
			tile.material_override = mat
			board_root.add_child(tile)

	var frame := MeshInstance3D.new()
	var frame_mesh := BoxMesh.new()
	frame_mesh.size = Vector3(8.6, 0.08, 8.6)
	frame.mesh = frame_mesh
	frame.position = Vector3(0, -0.06, 0)
	var fmat := StandardMaterial3D.new()
	fmat.albedo_color = GameSpecData.theme_color("playerColor", Color("#854d0e")).darkened(0.3)
	frame.material_override = fmat
	board_root.add_child(frame)


func _sync_piece_meshes() -> void:
	for k in _piece_nodes.keys():
		var n = _piece_nodes[k]
		if is_instance_valid(n):
			n.queue_free()
	_piece_nodes.clear()
	for i in range(_pieces.size()):
		var p = _pieces[i]
		var node := _make_piece_mesh(p)
		node.position = _cell_to_world(int(p.r), int(p.col))
		_world.add_child(node)
		_piece_nodes[i] = node


func _make_piece_mesh(p: Dictionary) -> Node3D:
	var root := Node3D.new()
	var white := p.c == "w"
	var body := MeshInstance3D.new()
	if p.t == "K":
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.32
		cyl.bottom_radius = 0.38
		cyl.height = 0.55
		body.mesh = cyl
		var crown := MeshInstance3D.new()
		var cb := BoxMesh.new()
		cb.size = Vector3(0.22, 0.18, 0.22)
		crown.mesh = cb
		crown.position = Vector3(0, 0.42, 0)
		var cmat := StandardMaterial3D.new()
		cmat.albedo_color = Color("#fde047") if white else Color("#7c2d12")
		crown.material_override = cmat
		root.add_child(crown)
	else:
		var sph := SphereMesh.new()
		sph.radius = 0.28
		sph.height = 0.36
		body.mesh = sph
	var mat := StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("playerColor", Color("#f8fafc")) if white else GameSpecData.theme_color("hazardColor", Color("#1f2937"))
	mat.roughness = 0.35
	body.material_override = mat
	body.position = Vector3(0, 0.28, 0)
	root.add_child(body)
	return root


func _cell_to_world(row: int, col: int) -> Vector3:
	return _board_origin + Vector3(col * _cell + _cell * 0.5, 0.12, row * _cell + _cell * 0.5)


func _unhandled_input(event: InputEvent) -> void:
	if _ended or not _white_turn:
		return
	if not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	var cell := _mouse_to_cell(mb.position)
	if cell.x < 0:
		return
	var row := int(cell.y)
	var col := int(cell.x)
	var hit := _piece_at(row, col)
	if _selected.is_empty() and hit != null and hit.c == "w":
		_selected = hit
		_highlight_selection(true)
		return
	if not _selected.is_empty():
		var cap := _piece_at(row, col)
		if cap != null and cap.c == "b":
			_pieces.erase(cap)
		_selected.r = row
		_selected.col = col
		_selected = {}
		_highlight_selection(false)
		_moves += 1
		_white_turn = false
		_sync_piece_meshes()
		await get_tree().create_timer(0.45).timeout
		_black_move()
		if _moves >= 6:
			_finish(true)


func _mouse_to_cell(screen_pos: Vector2) -> Vector2i:
	if _container == null or _viewport == null:
		return Vector2i(-1, -1)
	var rect := _container.get_global_rect()
	if not rect.has_point(screen_pos):
		return Vector2i(-1, -1)
	var local := (screen_pos - rect.position) / rect.size
	var nx := local.x * 2.0 - 1.0
	var ny := local.y * 2.0 - 1.0
	var col := int(floor((nx + 0.72) / 1.44 * 8.0))
	var row := int(floor((ny + 0.62) / 1.24 * 8.0))
	if col < 0 or col > 7 or row < 0 or row > 7:
		return Vector2i(-1, -1)
	return Vector2i(col, row)


func _highlight_selection(on: bool) -> void:
	if _selected.is_empty():
		return
	for i in range(_pieces.size()):
		var p = _pieces[i]
		if p == _selected and _piece_nodes.has(i):
			var n = _piece_nodes[i]
			if is_instance_valid(n):
				n.scale = Vector3(1.12, 1.12, 1.12) if on else Vector3.ONE


func _piece_at(r: int, c: int):
	for p in _pieces:
		if int(p.r) == r and int(p.col) == c:
			return p
	return null


func _black_move() -> void:
	for p in _pieces:
		if p.c == "b" and p.t == "P":
			p.r = mini(7, int(p.r) + 1)
			break
	_white_turn = true
	_sync_piece_meshes()


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("对局完成" if won else "结束", "步数 %d" % _moves)
	GameAudio.play_bleep(GameBleeps.Kind.WIN if won else GameBleeps.Kind.HIT)

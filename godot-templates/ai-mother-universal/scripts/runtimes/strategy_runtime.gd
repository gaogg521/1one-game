extends Node2D
## 3D 战略地图桌：节点派兵（Astrocade 级 SubViewport）

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _nodes: Array = []
var _node_meshes: Dictionary = {}
var _node_labels: Dictionary = {}
var _link_meshes: Array = []
var _selected = ""
var _player_turn = true
var _ended = false
var _camera: Camera3D
var _win_nodes = 4
var _ai_aggression = 1.0
var _rush_mode = false


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var strat = GameSpecData.strategy()
	var sp = GameSpecData.sample_play_profile().get("strategy", {})
	if sp is Dictionary:
		_win_nodes = int(sp.get("winNodes", strat.get("winNodes", 4)))
		_ai_aggression = float(sp.get("aiAggression", 1.0))
		_rush_mode = bool(sp.get("rushMode", false))
	elif strat.has("winNodes"):
		_win_nodes = int(strat.get("winNodes", 4))
	_load_nodes(strat)
	_build_scene()
	_sync_visuals()
	if _rush_mode:
		_hud.set_extra("闪电征服 · 占领 %d 个节点即胜" % _win_nodes)
	else:
		_hud.set_extra("点击己方节点再点相邻节点派兵")
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _load_nodes(strat: Dictionary) -> void:
	if strat.has("nodes") and strat.get("nodes") is Array and strat.nodes.size() > 0:
		_nodes.clear()
		for raw_n in strat.nodes:
			if raw_n is Dictionary:
				var nx = float(raw_n.get("x", 0))
				var ny = float(raw_n.get("y", 0))
				if nx <= 1.0 and ny <= 1.0:
					nx *= 880.0
					ny *= 480.0
				_nodes.append({
					"id": str(raw_n.get("id", "")),
					"x": nx,
					"y": ny,
					"owner": str(raw_n.get("owner", "neutral")),
					"troops": float(raw_n.get("troops", 10)),
					"links": raw_n.get("links", []),
				})
		return
	_nodes = [
		{"id": "p0", "x": 160.0, "y": 220.0, "owner": "player", "troops": 24.0, "links": ["n1", "n2"]},
		{"id": "n1", "x": 360.0, "y": 160.0, "owner": "neutral", "troops": 12.0, "links": ["p0", "n3"]},
		{"id": "n2", "x": 340.0, "y": 300.0, "owner": "neutral", "troops": 10.0, "links": ["p0", "n3"]},
		{"id": "n3", "x": 560.0, "y": 230.0, "owner": "ai", "troops": 20.0, "links": ["n1", "n2", "n4"]},
		{"id": "n4", "x": 720.0, "y": 190.0, "owner": "ai", "troops": 16.0, "links": ["n3"]},
	]


func _build_scene() -> void:
	var env_n = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	var bg = GameSpecData.theme_color("backgroundColor", Color("#1e293b"))
	env.background_color = bg.darkened(0.2)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.48, 0.55)
	env.ambient_light_energy = 0.85
	env_n.environment = env
	_world.add_child(env_n)

	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, 35, 0)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	_world.add_child(sun)

	_camera = Camera3D.new()
	_camera.position = Vector3(0, 9.5, 10.5)
	_camera.rotation_degrees = Vector3(-42, 0, 0)
	_camera.current = true
	_world.add_child(_camera)

	var table = MeshInstance3D.new()
	var table_mesh = BoxMesh.new()
	table_mesh.size = Vector3(14, 0.12, 8)
	table.mesh = table_mesh
	table.position = Vector3(0, -0.06, 0)
	var tmat = StandardMaterial3D.new()
	tmat.albedo_color = bg.lightened(0.08)
	tmat.roughness = 0.75
	table.material_override = tmat
	_world.add_child(table)

	for n in _nodes:
		_spawn_node(n)
	_build_links()


func _map_pos(n: Dictionary) -> Vector3:
	var x = (float(n.x) - 440.0) * 0.018
	var z = (float(n.y) - 240.0) * 0.018
	return Vector3(x, 0.35, z)


func _owner_color(owner: String) -> Color:
	if owner == "player":
		return GameSpecData.theme_color("playerColor", Color.GREEN)
	if owner == "ai":
		return GameSpecData.theme_color("hazardColor", Color.RED)
	return Color("#64748b")


func _spawn_node(n: Dictionary) -> void:
	var root = Node3D.new()
	root.position = _map_pos(n)
	_world.add_child(root)

	var cyl = MeshInstance3D.new()
	var mesh = CylinderMesh.new()
	mesh.top_radius = 0.42
	mesh.bottom_radius = 0.42
	mesh.height = 0.55
	cyl.mesh = mesh
	cyl.position = Vector3(0, 0.28, 0)
	var mat = StandardMaterial3D.new()
	mat.albedo_color = _owner_color(n.owner)
	mat.roughness = 0.45
	cyl.material_override = mat
	root.add_child(cyl)

	var lbl = Label3D.new()
	lbl.text = str(int(n.troops))
	lbl.font_size = 28
	lbl.position = Vector3(0, 0.75, 0)
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	root.add_child(lbl)

	_node_meshes[n.id] = cyl
	_node_labels[n.id] = lbl


func _build_links() -> void:
	for m in _link_meshes:
		if is_instance_valid(m):
			m.queue_free()
	_link_meshes.clear()
	for n in _nodes:
		for lid in n.links:
			var other = _find(lid)
			if other.is_empty() or str(n.id) > str(other.id):
				continue
			var a = _map_pos(n)
			var b = _map_pos(other)
			var mid = (a + b) * 0.5
			var dir = b - a
			var length = dir.length()
			if length < 0.01:
				continue
			var bar = MeshInstance3D.new()
			var box = BoxMesh.new()
			box.size = Vector3(0.08, 0.04, length)
			bar.mesh = box
			bar.position = mid
			bar.look_at(b, Vector3.UP)
			var lmat = StandardMaterial3D.new()
			lmat.albedo_color = Color("#64748b")
			bar.material_override = lmat
			_world.add_child(bar)
			_link_meshes.append(bar)


func _sync_visuals() -> void:
	for n in _nodes:
		var cyl: MeshInstance3D = _node_meshes.get(n.id)
		var lbl: Label3D = _node_labels.get(n.id)
		if cyl and cyl.material_override:
			(cyl.material_override as StandardMaterial3D).albedo_color = _owner_color(n.owner)
		if lbl:
			lbl.text = str(int(n.troops))
		if n.id == _selected and cyl:
			(cyl.material_override as StandardMaterial3D).emission_enabled = true
			(cyl.material_override as StandardMaterial3D).emission = Color(1, 1, 0.6)
		elif cyl and cyl.material_override:
			(cyl.material_override as StandardMaterial3D).emission_enabled = false


func _unhandled_input(event: InputEvent) -> void:
	if _ended or not _player_turn or not event is InputEventMouseButton:
		return
	var mb = event as InputEventMouseButton
	if not mb.pressed:
		return
	var hit = _hit(mb.position)
	if hit.is_empty():
		return
	if _selected == "" and hit.owner == "player":
		_selected = hit.id
		_sync_visuals()
		return
	if _selected != "":
		var from = _find(_selected)
		if from.is_empty() or hit.id == from.id:
			_selected = ""
			_sync_visuals()
			return
		if not _linked(from, hit):
			return
		var send = int(from.troops / 2)
		var prev_owner = str(hit.owner)
		from.troops -= send
		if hit.owner == "player":
			hit.troops += send
		elif send > hit.troops:
			hit.owner = "player"
			hit.troops = send - hit.troops
		else:
			hit.troops -= send
		if prev_owner != "player" and str(hit.owner) == "player":
			GameJuice.burst(self, Vector2(hit.x, hit.y), _owner_color("player"), 10)
			GameJuice.flash_background(self, Color(0.55, 1, 0.65), 0.22)
			GameJuice.shake_node(self, 3.5, 0.1)
		_selected = ""
		_player_turn = false
		_sync_visuals()
		if _player_nodes() >= _win_nodes:
			_finish(true)
			return
		await get_tree().create_timer(0.28 if _rush_mode else 0.45).timeout
		_ai_turn()


func _ai_turn() -> void:
	for n in _nodes:
		if n.owner == "ai" and n.troops > 4:
			for lid in n.links:
				var t = _find(lid)
				if not t.is_empty() and t.owner != "ai":
					var send = int(n.troops * 0.5 * _ai_aggression)
					n.troops -= send
					if send > t.troops:
						t.owner = "ai"
						t.troops = send - t.troops
					else:
						t.troops -= send
					break
	_player_turn = true
	_sync_visuals()
	if _player_nodes() >= _win_nodes:
		_finish(true)


func _player_nodes() -> int:
	var c = 0
	for n in _nodes:
		if n.owner == "player":
			c += 1
	return c


func _all(owner: String) -> bool:
	for n in _nodes:
		if n.owner != owner:
			return false
	return true


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("征服完成" if won else "失败", "")
	GameAudio.play_bleep(GameBleeps.Kind.WIN if won else GameBleeps.Kind.HIT)


func _find(id: String) -> Dictionary:
	for n in _nodes:
		if n.id == id:
			return n
	return {}


func _hit(pos: Vector2) -> Dictionary:
	for n in _nodes:
		if pos.distance_to(Vector2(n.x, n.y)) < 32.0:
			return n
	return {}


func _linked(a: Dictionary, b: Dictionary) -> bool:
	return b.id in a.links or a.id in b.links

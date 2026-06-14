extends Node2D
## 3D 网格种植：SubViewport 俯视地块

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

enum TileState { EMPTY, SEEDED, GROWING, READY }

var _hud := GameHud.new()
var _camera: Camera3D
var _cols := 4
var _rows := 4
var _coins := 50
var _harvests := 0
var _goal := 8
var _cell := 1.1
var _states: Array = []
var _progress: Array = []
var _crop_ids: Array = []
var _selected := 0
var _ended := false
var _tile_nodes: Array[MeshInstance3D] = []
var _crop_nodes: Array[MeshInstance3D] = []
var _auto_water := false
var _fence_root: Node3D


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var f := GameSpecData.farming()
	var fp := GameSpecData.sample_play_profile().get("farming", {})
	_cols = int(f.get("cols", 4))
	_rows = int(f.get("rows", 4))
	_coins = int(f.get("startingCoins", 50))
	_goal = int(f.get("harvestGoal", 8))
	if fp is Dictionary:
		if fp.has("harvestGoalBoost"):
			_goal = int(round(float(_goal) * float(fp.get("harvestGoalBoost", 1.0))))
		_auto_water = bool(fp.get("autoWater", false))
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#1a2220")))
	_camera = Runtime3DEnv.make_camera(_world, true)
	for i in range(_cols * _rows):
		_states.append(TileState.EMPTY)
		_progress.append(0.0)
		_crop_ids.append("")
	_build_tiles()
	if fp is Dictionary and bool(fp.get("decorativeFence", false)):
		_build_fence()
	_refresh_hud()
	if _auto_water:
		_hud.set_extra("自动浇水 · 空格切换种子 · 点击地块播种/收获")
	else:
		_hud.set_extra("点击空地播种 · 生长中点击浇水 · 成熟点击收获 · 空格切换种子")
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _build_tiles() -> void:
	for n in _tile_nodes:
		if is_instance_valid(n):
			n.queue_free()
	for n in _crop_nodes:
		if is_instance_valid(n):
			n.queue_free()
	_tile_nodes.clear()
	_crop_nodes.clear()
	var ox := -(_cols * _cell) * 0.5 + _cell * 0.5
	var oz := -(_rows * _cell) * 0.5 + _cell * 0.5
	for r in range(_rows):
		for c in range(_cols):
			var idx := r * _cols + c
			var mesh := MeshInstance3D.new()
			var box := BoxMesh.new()
			box.size = Vector3(_cell * 0.92, 0.18, _cell * 0.92)
			mesh.mesh = box
			mesh.position = Vector3(ox + c * _cell, 0.09, oz + r * _cell)
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color("#365314")
			mesh.material_override = mat
			mesh.set_meta("idx", idx)
			_world.add_child(mesh)
			_tile_nodes.append(mesh)
			var crop := MeshInstance3D.new()
			var cm := CylinderMesh.new()
			cm.top_radius = 0.14
			cm.bottom_radius = 0.1
			cm.height = 0.08
			crop.mesh = cm
			crop.position = mesh.position + Vector3(0, 0.14, 0)
			crop.visible = false
			var cmat := StandardMaterial3D.new()
			cmat.albedo_color = Color("#22c55e")
			crop.material_override = cmat
			_world.add_child(crop)
			_crop_nodes.append(crop)
	_paint_tiles()


func _build_fence() -> void:
	if _fence_root and is_instance_valid(_fence_root):
		_fence_root.queue_free()
	_fence_root = Node3D.new()
	_world.add_child(_fence_root)
	var w := _cols * _cell + 0.35
	var d := _rows * _cell + 0.35
	for edge in [
		Vector3(0, 0.04, -d * 0.5), Vector3(0, 0.04, d * 0.5),
		Vector3(-w * 0.5, 0.04, 0), Vector3(w * 0.5, 0.04, 0),
	]:
		var bar := MeshInstance3D.new()
		var box := BoxMesh.new()
		var along_x := absf(edge.z) > absf(edge.x)
		box.size = Vector3(w if along_x else 0.12, 0.08, d if not along_x else 0.12)
		bar.mesh = box
		bar.position = edge
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color("#fde047")
		mat.emission_enabled = true
		mat.emission = Color("#fde047") * 0.25
		bar.material_override = mat
		_fence_root.add_child(bar)


func _unhandled_input(event: InputEvent) -> void:
	if _ended:
		return
	if event is InputEventKey and event.pressed and event.keycode == KEY_SPACE:
		_selected = (_selected + 1) % 3
		return
	if event is InputEventMouseButton and event.pressed and _camera:
		var hit := Runtime3DEnv.raycast_world(_viewport, _camera, _viewport.get_mouse_position())
		_try_tile_at(hit)


func _try_tile_at(world_pos: Vector3) -> void:
	var best := -1
	var best_d := 999.0
	for mesh in _tile_nodes:
		var d := mesh.global_position.distance_to(world_pos)
		if d < best_d and d < _cell * 0.65:
			best_d = d
			best = int(mesh.get_meta("idx", -1))
	if best < 0:
		return
	_on_tile_idx(best)


func _on_tile_idx(idx: int) -> void:
	var st: int = _states[idx]
	if st == TileState.EMPTY:
		if _coins < 5:
			_hud.show_banner("金币不足", "")
			return
		_coins -= 5
		_states[idx] = TileState.SEEDED
		_crop_ids[idx] = "carrot"
	elif st == TileState.SEEDED:
		_states[idx] = TileState.GROWING
		_progress[idx] = 0.0
	elif st == TileState.GROWING:
		_progress[idx] = minf(1.0, _progress[idx] + 0.35)
		if _progress[idx] >= 1.0:
			_states[idx] = TileState.READY
	elif st == TileState.READY:
		_coins += 12
		_harvests += 1
		if _camera and idx < _tile_nodes.size():
			GameJuice.burst(
				self,
				_camera.unproject_position(_tile_nodes[idx].global_position),
				Color("#fde047"),
				10,
			)
			GameJuice.flash_background(self, Color(0.9, 1, 0.5), 0.18)
		_states[idx] = TileState.EMPTY
		_crop_ids[idx] = ""
		if _harvests >= _goal:
			_finish(true)
	_refresh_hud()
	_paint_tiles()


func _paint_tiles() -> void:
	for i in range(_tile_nodes.size()):
		var mesh := _tile_nodes[i]
		var mat := mesh.material_override as StandardMaterial3D
		if mat == null:
			continue
		var crop: MeshInstance3D = _crop_nodes[i] if i < _crop_nodes.size() else null
		match _states[i]:
			TileState.EMPTY:
				mat.albedo_color = Color("#365314")
				if crop:
					crop.visible = false
			TileState.SEEDED:
				mat.albedo_color = Color("#15803d").lerp(Color.WHITE, 0.3)
				if crop:
					crop.visible = true
					crop.scale = Vector3(0.35, 0.35, 0.35)
			TileState.GROWING:
				mat.albedo_color = Color("#22c55e").lerp(Color.WHITE, 0.2)
				if crop:
					crop.visible = true
					var h := 0.35 + _progress[i] * 0.85
					crop.scale = Vector3(1.0, h, 1.0)
			TileState.READY:
				mat.albedo_color = Color("#fde047")
				if crop:
					crop.visible = true
					crop.scale = Vector3(1.15, 1.2, 1.15)
					if crop.material_override:
						(crop.material_override as StandardMaterial3D).albedo_color = Color("#fde047")


func _process(delta: float) -> void:
	if _ended:
		return
	for idx in range(_states.size()):
		if _auto_water and _states[idx] == TileState.SEEDED:
			_states[idx] = TileState.GROWING
			_progress[idx] = 0.0
		if _states[idx] == TileState.GROWING:
			_progress[idx] += delta / 5.0
			if _progress[idx] >= 1.0:
				_states[idx] = TileState.READY
			_paint_tiles()


func _refresh_hud() -> void:
	_hud.set_score("收获 %d/%d · 金币 %d" % [_harvests, _goal, _coins])


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("农场目标达成" if won else "继续加油", "")

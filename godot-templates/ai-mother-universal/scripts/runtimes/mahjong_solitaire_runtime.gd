extends Node2D
## 真麻将接龙（配对消除）· 3D 视图
## - 3 花色（万/条/筒）× 9 数字，部分牌层叠
## - 玩家点击两张相同牌 → 配对消除
## - 牌被消除后释放上层叠的牌（可点击）
## - 全部配对消除 → 通关 / 时间到失败
## - HUD：剩余对数 + 时间（GameHud）

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _camera: Camera3D
var _ended = false

var _bp: Dictionary = {}
var _tiles: Array = []        # Array[Dictionary] {tile, col, row, layer, mesh, label, area, removed, clickable}
var _selected_idx = -1        # _tiles 中当前选中的索引；-1 表示未选
var _selected_marker: MeshInstance3D = null
var _remaining_pairs = 0
var _total_pairs = 0
var _time_left_ms = 0
var _start_time = 0
var _score = 0

const TILE_W := 0.9
const TILE_H := 1.2
const SUITS = ["man", "tiao", "tong"]
const SUIT_LABELS = {"man": "万", "tiao": "条", "tong": "筒"}
const SUIT_COLORS = {
	"man": Color(0.15, 0.38, 0.92),
	"tiao": Color(0.09, 0.64, 0.29),
	"tong": Color(0.86, 0.15, 0.15),
}
const RANK_LABELS = {
	1: "一", 2: "二", 3: "三", 4: "四", 5: "五",
	6: "六", 7: "七", 8: "八", 9: "九",
}


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_bp = _mahjong_solitaire_blueprint()
	if _bp.is_empty():
		_bp = {
			"gridCols": 12, "gridRows": 6, "tileVariety": 18,
			"targetPairs": 24, "timeLimitMs": 180000, "stackLayers": 1,
		}
	_build_scene()
	_build_board()
	_refresh_clickable()
	_update_tile_visuals()
	_total_pairs = int(_bp.get("targetPairs", 24))
	_remaining_pairs = _total_pairs
	_time_left_ms = int(_bp.get("timeLimitMs", 180000))
	_start_time = Time.get_ticks_msec()
	_hud.set_extra("点击两张相同牌配对消除 · 全部消除通关")
	_hud.show_banner("麻将接龙", "配对消除所有牌", 1.6)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 兼容写法：GameSpecData 暂无 mahjongSolitaire() 访问器，直接读 raw
func _mahjong_solitaire_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	if GameSpecData.raw.has("mahjongSolitaire") and GameSpecData.raw["mahjongSolitaire"] is Dictionary:
		return GameSpecData.raw["mahjongSolitaire"]
	return {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	# 桌面木色背板
	var table = MeshInstance3D.new()
	var tm = PlaneMesh.new()
	tm.size = Vector2(16.0, 10.0)
	table.mesh = tm
	table.position = Vector3(0, 0.0, 0)
	var tmat = StandardMaterial3D.new()
	tmat.albedo_color = Color(0.20, 0.13, 0.08, 0.95)
	table.material_override = tmat
	_world.add_child(table)
	# 桌面毛毡
	var felt = MeshInstance3D.new()
	var fm = PlaneMesh.new()
	fm.size = Vector2(15.0, 9.0)
	felt.mesh = fm
	felt.position = Vector3(0, 0.02, 0)
	var fmat = StandardMaterial3D.new()
	fmat.albedo_color = Color(0.08, 0.33, 0.18, 0.85)
	felt.material_override = fmat
	_world.add_child(felt)
	# 摄像机俯视
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 11.0, 0.5)
	_camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)


func _build_board() -> void:
	var cols = int(_bp.get("gridCols", 12))
	var rows = int(_bp.get("gridRows", 6))
	var layers = int(_bp.get("stackLayers", 1))
	var pairs = int(_bp.get("targetPairs", 24))
	var variety = int(_bp.get("tileVariety", 18))
	var total_slots = cols * rows * layers
	# 防御：网格不足以容纳所需牌数时缩减
	var effective_pairs = mini(pairs, int(total_slots / 2))
	var effective_needed = effective_pairs * 2
	_bp["targetPairs"] = effective_pairs

	# 1. 生成牌组：每对两张相同花色 rank
	var tiles: Array = []
	var suit_pool = SUITS
	var variety_clamped = mini(variety, 27)  # 3 花 × 9 数字
	var variety_idx = 0
	for i in range(effective_pairs):
		var suit = suit_pool[variety_idx % 3]
		var rank = (int(variety_idx / 3) % 9) + 1
		var base_id = "%s-%d-%d" % [suit, rank, i]
		tiles.append({"suit": suit, "rank": rank, "id": base_id + "-a"})
		tiles.append({"suit": suit, "rank": rank, "id": base_id + "-b"})
		variety_idx = (variety_idx + 1) % variety_clamped

	# 2. 打乱（确定性伪随机：用 spec seed；若不可得则 randf）
	# 注意：不使用 var x = dict.get() 的 Variant 推断写法
	var seed_val = 0
	if GameSpecData.raw.has("samplePlayProfile") and GameSpecData.raw["samplePlayProfile"] is Dictionary:
		var pf = GameSpecData.raw["samplePlayProfile"]
		seed_val = int(pf.get("seed", 0))
	_shuffle_with_seed(tiles, seed_val)

	# 3. 网格几何
	var board_w = 14.0
	var board_h = 8.0
	var tile_w = minf(1.1, board_w / cols)
	var tile_h = minf(1.4, board_h / rows)
	var gap = 0.06
	var total_grid_w = cols * tile_w + (cols - 1) * gap
	var total_grid_h = rows * tile_h + (rows - 1) * gap
	var start_x = -total_grid_w / 2.0 + tile_w / 2.0
	var start_z = -total_grid_h / 2.0 + tile_h / 2.0

	# 4. 按层填入（底层先填满，上层隔一格放一张模拟层叠）
	var tile_cursor = 0
	for layer in range(layers):
		for row in range(rows):
			for col in range(cols):
				if tile_cursor >= effective_needed:
					break
				if layer > 0 and (col + row) % 2 != 0:
					continue
				var tile = tiles[tile_cursor]
				tile_cursor += 1
				var x = start_x + col * (tile_w + gap)
				var z = start_z + row * (tile_h + gap)
				# 上层向右下偏移
				var ox = layer * 0.12
				var oz = layer * -0.12
				var y = 0.05 + layer * 0.15
				var entry = _create_tile_view(tile, col, row, layer, x + ox, y, z + oz, tile_w, tile_h)
				_tiles.append(entry)


func _create_tile_view(tile: Dictionary, col: int, row: int, layer: int,
		x: float, y: float, z: float, tw: float, th: float) -> Dictionary:
	var mesh = MeshInstance3D.new()
	var pm = PlaneMesh.new()
	pm.size = Vector2(tw, th)
	mesh.mesh = pm
	mesh.position = Vector3(x, y, z)
	# PlaneMesh 默认在 XZ 平面（朝上），正好适合俯视
	var mat = StandardMaterial3D.new()
	var suit = str(tile.get("suit", "man"))
	mat.albedo_color = SUIT_COLORS.get(suit, Color(0.5, 0.5, 0.5))
	mesh.material_override = mat
	_world.add_child(mesh)
	# Area3D 命中检测
	var area = Area3D.new()
	area.position = Vector3(x, y, z)
	var col_shape = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(tw, 0.2, th)
	col_shape.shape = shape
	area.add_child(col_shape)
	_world.add_child(area)
	# Label3D 牌面文字
	var label = Label3D.new()
	var rank = int(tile.get("rank", 1))
	var suit_str = str(tile.get("suit", "man"))
	var text_str = "%s%s" % [str(RANK_LABELS.get(rank, str(rank))), str(SUIT_LABELS.get(suit_str, ""))]
	label.text = text_str
	label.font_size = 48
	label.position = Vector3(x, y + 0.1, z)
	label.modulate = Color(0.97, 0.97, 0.97)
	# Label3D 默认朝向 +Z；俯视相机在 +Y 朝下，需要旋转使其朝上
	label.rotation = Vector3(-PI / 2.0, 0, 0)
	_world.add_child(label)
	return {
		"tile": tile, "col": col, "row": row, "layer": layer,
		"mesh": mesh, "area": area, "label": label,
		"removed": false, "clickable": false,
	}


func _shuffle_with_seed(arr: Array, seed_val: int) -> void:
	# mulberry32 确定性洗牌；seed_val=0 时退化为 randf 洗牌
	var s = seed_val
	if s == 0:
		s = randi()
	var a = (s & 0xffffffff)
	var n = arr.size()
	for i in range(n - 1, 0, -1):
		a = (a + 0x6d2b79f5) & 0xffffffff
		var t_val = a ^ (a >> 15)
		t_val = (t_val * (1 | a)) & 0xffffffff
		var t2 = (t_val ^ (t_val >> 7)) & 0xffffffff
		t2 = (t2 * (61 | t_val)) & 0xffffffff
		var rnd_val = ((t2 ^ (t2 >> 14)) & 0xffffffff) / 4294967296.0
		var j = int(rnd_val * (i + 1))
		var tmp = arr[i]
		arr[i] = arr[j]
		arr[j] = tmp


func _refresh_clickable() -> void:
	for i in range(_tiles.size()):
		var t = _tiles[i]
		if t["removed"]:
			t["clickable"] = false
			continue
		var covered = false
		for j in range(_tiles.size()):
			if i == j:
				continue
			var other = _tiles[j]
			if other["removed"]:
				continue
			if other["layer"] > t["layer"] and other["col"] == t["col"] and other["row"] == t["row"]:
				covered = true
				break
		t["clickable"] = not covered


func _update_tile_visuals() -> void:
	for i in range(_tiles.size()):
		var t = _tiles[i]
		var mesh = t["mesh"] as MeshInstance3D
		var label = t["label"] as Label3D
		if t["removed"]:
			mesh.visible = false
			label.visible = false
			continue
		mesh.visible = true
		label.visible = true
		var mat = mesh.material_override as StandardMaterial3D
		if mat == null:
			mat = StandardMaterial3D.new()
			mesh.material_override = mat
		var suit = str(t["tile"].get("suit", "man"))
		var base_color = SUIT_COLORS.get(suit, Color(0.5, 0.5, 0.5))
		if t["clickable"]:
			mat.albedo_color = base_color
			label.modulate.a = 1.0
		else:
			mat.albedo_color = Color(base_color.r, base_color.g, base_color.b, 0.35)
			label.modulate.a = 0.4


func _process(_delta: float) -> void:
	if _ended:
		return
	var now = Time.get_ticks_msec()
	var elapsed = now - _start_time
	_time_left_ms = maxi(0, int(_bp.get("timeLimitMs", 180000)) - elapsed)
	_refresh_hud()
	if _time_left_ms <= 0:
		_end(false)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _ended:
			return
		_try_click_tile_at_mouse()
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()


func _try_click_tile_at_mouse() -> void:
	var mp = _viewport.get_mouse_position()
	var from = _camera.project_ray_origin(mp)
	var dir = _camera.project_ray_normal(mp)
	var space = _viewport.world_3d.direct_space_state
	var query = PhysicsRayQueryParameters3D.create(from, from + dir * 80.0)
	var hit = space.intersect_ray(query)
	if hit.is_empty():
		return
	var collider = hit.get("collider", null)
	# 找到所属 tile
	for i in range(_tiles.size()):
		var t = _tiles[i]
		if t["removed"]:
			continue
		if t["area"] == collider:
			_on_tile_click(i)
			return


func _on_tile_click(idx: int) -> void:
	var t = _tiles[idx]
	if t["removed"] or not t["clickable"]:
		return
	if _selected_idx == -1:
		_select_tile(idx)
		return
	if _selected_idx == idx:
		_clear_selection()
		return
	# 判定配对：相同花色 + 相同 rank
	var a_tile = _tiles[_selected_idx]["tile"]
	var b_tile = t["tile"]
	if str(a_tile.get("suit", "")) == str(b_tile.get("suit", "")) and int(a_tile.get("rank", 0)) == int(b_tile.get("rank", 0)):
		_remove_pair(_selected_idx, idx)
		_clear_selection()
	else:
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
		_clear_selection()
		_select_tile(idx)


func _select_tile(idx: int) -> void:
	_selected_idx = idx
	if _selected_marker != null:
		_selected_marker.queue_free()
		_selected_marker = null
	var t = _tiles[idx]
	var mesh = t["mesh"] as MeshInstance3D
	if mesh == null:
		return
	var marker = MeshInstance3D.new()
	var pm = PlaneMesh.new()
	var tw = mesh.mesh.size.x + 0.2
	var th = mesh.mesh.size.y + 0.2
	pm.size = Vector2(tw, th)
	marker.mesh = pm
	marker.position = Vector3(mesh.position.x, mesh.position.y + 0.08, mesh.position.z)
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.99, 0.88, 0.28, 0.6)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	marker.material_override = mat
	_world.add_child(marker)
	_selected_marker = marker


func _clear_selection() -> void:
	_selected_idx = -1
	if _selected_marker != null:
		_selected_marker.queue_free()
		_selected_marker = null


func _remove_pair(a_idx: int, b_idx: int) -> void:
	var a = _tiles[a_idx]
	var b = _tiles[b_idx]
	a["removed"] = true
	b["removed"] = true
	(a["mesh"] as MeshInstance3D).visible = false
	(a["label"] as Label3D).visible = false
	(b["mesh"] as MeshInstance3D).visible = false
	(b["label"] as Label3D).visible = false
	_remaining_pairs -= 1
	_score += 100
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameJuice.flash_background(self, Color(0.99, 0.88, 0.28), 0.15)
	_refresh_clickable()
	_update_tile_visuals()
	_refresh_hud()
	if _remaining_pairs <= 0:
		_end(true)


func _refresh_hud() -> void:
	var time_sec = ceili(float(_time_left_ms) / 1000.0)
	_hud.set_score("剩余对数 %d/%d · 时间 %ds · 分数 %d" % [_remaining_pairs, _total_pairs, time_sec, _score])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("胜利！", "全部配对消除", 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("时间到", "再试一次", 2.0)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)

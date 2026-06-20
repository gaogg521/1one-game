extends Node2D
## 3D 塔防：程序化路径/塔位、导演事件、建塔射击

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _camera: Camera3D
var _slots_root: Node3D
var _towers_root: Node3D
var _enemies_root: Node3D
var _projectiles_root: Node3D
var _range_preview: MeshInstance3D
var _hud = GameHud.new()
var _director = GameDirector.new()
var _path_metrics: PathMath.PathMetrics
var _path_px: PackedVector2Array = PackedVector2Array()
var _slots_px: Array[Vector2] = []
var _towers_def: Array = []
var _enemies_def: Dictionary = {}
var _waves: Array = []
var _coins: int = 120
var _base_hp: int = 30
var _wave_idx: int = 0
var _spawn_queue: Array = []
var _spawn_cd: float = 0.0
var _wave_lead: float = 0.0
var _ended = false
var _selected_tower_idx = 0
var _hover_slot: int = -1
var _goal_shift_failed = false
var _game_time = 0.0
var _enemies: Array[Dictionary] = []
var _towers: Array[Dictionary] = []
var _projectiles: Array[Dictionary] = []
var _bg_color = Color("#1a2220")
var _path_color = Color("#c4a574")
var _particle_mult = 1.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_particle_mult = GameSpecData.particle_intensity_mult()
	_director.load_from_spec()
	_director.banner.connect(_on_director_banner)
	_director.spawn_mini_boss.connect(_spawn_mini_boss)
	_director.goal_shift_ended.connect(_on_goal_shift_ended)
	_parse_blueprint()
	_build_world()
	_coins = GameSpecData.gameplay_i("startingCoins", 120)
	_base_hp = GameSpecData.gameplay_i("baseHealth", 30)
	var tp = GameSpecData.sample_play_profile().get("towerDefense", {})
	var variant = str(GameSpecData.sample_play_profile().get("variantId", ""))
	if tp is Dictionary and bool(tp.get("mergeGrid", false)):
		_coins += int(tp.get("mergeBonusCoins", 25))
		var merge_label = "合成剑塔" if variant == "blade-defender-merge" else "合成同阶枪械"
		_hud.set_extra(
			"左键建塔 · 右键升级 · %s · 奖励 +%d" % [merge_label, int(tp.get("mergeBonusCoins", 25))]
		)
	else:
		_hud.set_extra("左键建塔 · 右键升级 · 数字键 1-3 选塔 · 移入塔位看射程")
	_wave_lead = 1.0
	_goal_shift_failed = false
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _parse_blueprint() -> void:
	var td = GameSpecData.tower_defense()
	_bg_color = GameSpecData.theme_color("backgroundColor", _bg_color)
	_towers_def = td.get("towers", []) if td.has("towers") else []
	_waves = td.get("waves", []) if td.has("waves") else []
	for e in td.get("enemies", []):
		if e is Dictionary:
			_enemies_def[str(e.get("id", ""))] = e
	_path_px = PackedVector2Array()
	for p in td.get("path", []):
		if p is Dictionary:
			_path_px.append(Vector2(float(p.get("x", 0)) * Runtime3DEnv.MAP_W, float(p.get("y", 0)) * Runtime3DEnv.MAP_H))
	if _path_px.size() < 2:
		_path_px = PackedVector2Array([
			Vector2(56, 360), Vector2(200, 360), Vector2(200, 200),
			Vector2(420, 200), Vector2(420, 440), Vector2(620, 440), Vector2(744, 264),
		])
	_path_metrics = PathMath.build(_path_px)
	for s in td.get("slots", []):
		if s is Dictionary:
			_slots_px.append(Vector2(float(s.get("x", 0)) * Runtime3DEnv.MAP_W, float(s.get("y", 0)) * Runtime3DEnv.MAP_H))
	if _slots_px.is_empty():
		for i in range(_path_px.size() - 1):
			var mid = _path_px[i].lerp(_path_px[i + 1], 0.5)
			_slots_px.append(mid + Vector2(0, -52 if i % 2 == 0 else 52))
	if _towers_def.is_empty():
		_towers_def = [{
			"id": "cannon",
			"name": "炮塔",
			"buildCost": 80,
			"damage": 12,
			"range": 140,
			"cooldownMs": 600,
			"upgradeCosts": [60, 90],
		}]
	if _waves.is_empty():
		_waves = [{
			"leadInMs": 800,
			"spawns": [{"enemyId": "grunt", "count": 6, "intervalMs": 700}],
		}, {
			"leadInMs": 600,
			"spawns": [{"enemyId": "grunt", "count": 10, "intervalMs": 550}],
		}]
	if _enemies_def.is_empty():
		_enemies_def["grunt"] = {"id": "grunt", "hp": 40, "speed": 90, "reward": 8}


func _build_world() -> void:
	Runtime3DEnv.add_environment(_world, _bg_color)
	_camera = Runtime3DEnv.make_camera(_world, true)
	_add_ground()
	_draw_path()
	_slots_root = Node3D.new()
	_slots_root.name = "Slots"
	_world.add_child(_slots_root)
	_towers_root = Node3D.new()
	_towers_root.name = "Towers"
	_world.add_child(_towers_root)
	_enemies_root = Node3D.new()
	_enemies_root.name = "Enemies"
	_world.add_child(_enemies_root)
	_projectiles_root = Node3D.new()
	_projectiles_root.name = "Projectiles"
	_world.add_child(_projectiles_root)
	_build_slots()
	_range_preview = _make_range_ring()
	_world.add_child(_range_preview)
	_range_preview.visible = false


func _add_ground() -> void:
	var floor_body = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(Runtime3DEnv.MAP_W * Runtime3DEnv.SCALE, 0.2, Runtime3DEnv.MAP_H * Runtime3DEnv.SCALE)
	col.shape = shape
	floor_body.add_child(col)
	var vis = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = shape.size
	vis.mesh = mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = _bg_color.lightened(0.06)
	vis.material_override = mat
	floor_body.add_child(vis)
	floor_body.position = Vector3(0, -0.1, 0)
	_world.add_child(floor_body)


func _draw_path() -> void:
	for i in range(_path_px.size() - 1):
		var a = Runtime3DEnv.px_to_world(_path_px[i], 0.08)
		var b = Runtime3DEnv.px_to_world(_path_px[i + 1], 0.08)
		var mid = (a + b) * 0.5
		var seg = MeshInstance3D.new()
		var mesh = BoxMesh.new()
		var flat = Vector2(b.x - a.x, b.z - a.z)
		var len = flat.length()
		mesh.size = Vector3(maxf(len, 0.35), 0.16, 0.55)
		seg.mesh = mesh
		var mat = StandardMaterial3D.new()
		mat.albedo_color = _path_color
		seg.material_override = mat
		seg.position = mid
		if len > 0.01:
			seg.rotation.y = atan2(flat.x, flat.y)
		_world.add_child(seg)


func _build_slots() -> void:
	for i in range(_slots_px.size()):
		var area = Area3D.new()
		area.position = Runtime3DEnv.px_to_world(_slots_px[i], 0.12)
		area.set_meta("slot_index", i)
		var col = CollisionShape3D.new()
		var shape = CylinderShape3D.new()
		shape.radius = 0.56
		shape.height = 0.2
		col.shape = shape
		area.add_child(col)
		var vis = MeshInstance3D.new()
		var mesh = CylinderMesh.new()
		mesh.top_radius = 0.5
		mesh.bottom_radius = 0.5
		mesh.height = 0.08
		vis.mesh = mesh
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color(0.35, 0.55, 0.4, 0.55)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		vis.material_override = mat
		area.add_child(vis)
		_slots_root.add_child(area)


func _make_range_ring() -> MeshInstance3D:
	var ring = MeshInstance3D.new()
	var mesh = CylinderMesh.new()
	mesh.top_radius = 2.8
	mesh.bottom_radius = 2.8
	mesh.height = 0.04
	ring.mesh = mesh
	var mat = StandardMaterial3D.new()
	var c = GameSpecData.theme_color("playerColor", Color.GREEN)
	mat.albedo_color = Color(c.r, c.g, c.b, 0.12)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ring.material_override = mat
	return ring


func _process(delta: float) -> void:
	if _ended:
		return
	_game_time += delta
	_update_hover_slot()
	var progress = 0.0
	if _waves.size() > 0:
		progress = clampf(float(_wave_idx) / float(_waves.size()), 0.0, 1.0)
	var d_out = _director.tick(progress, delta)
	GameAudio.set_tension(progress)
	if d_out.get("coin_gain", 0) > 0:
		_coins += int(d_out.coin_gain)
	_tick_waves(delta)
	_tick_enemies(delta)
	_tick_towers(delta)
	_tick_projectiles(delta)
	_update_hud()


func _update_hover_slot() -> void:
	_hover_slot = -1
	if _camera == null or _viewport == null:
		_range_preview.visible = false
		return
	var hit = Runtime3DEnv.raycast_world(_viewport, _camera, _viewport.get_mouse_position())
	var best = -1
	var best_d = 0.7
	for i in range(_slots_px.size()):
		if not _tower_at_slot(i).is_empty():
			continue
		var w = Runtime3DEnv.px_to_world(_slots_px[i], 0.12)
		var d = Vector2(hit.x - w.x, hit.z - w.z).length()
		if d < best_d:
			best_d = d
			best = i
	_hover_slot = best
	if _hover_slot >= 0:
		var def: Dictionary = _towers_def[_selected_tower_idx % _towers_def.size()]
		var rng = float(def.get("range", 140)) * Runtime3DEnv.SCALE
		var cyl = _range_preview.mesh as CylinderMesh
		if cyl:
			cyl.top_radius = rng
			cyl.bottom_radius = rng
		_range_preview.position = Runtime3DEnv.px_to_world(_slots_px[_hover_slot], 0.14)
		_range_preview.visible = true
	else:
		_range_preview.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if _ended:
		return
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
		if _camera == null or _viewport == null:
			return
		var hit = Runtime3DEnv.raycast_world(_viewport, _camera, _viewport.get_mouse_position())
		var slot_i = _slot_at_world(hit)
		if slot_i < 0:
			return
		var mb = event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			_try_build_at_slot(slot_i)
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			_try_upgrade_slot(slot_i)
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()
		var k = (event as InputEventKey).keycode
		if k >= KEY_1 and k <= KEY_3 and not _towers_def.is_empty():
			_selected_tower_idx = k - KEY_1
			var d: Dictionary = _towers_def[_selected_tower_idx % _towers_def.size()]
			_hud.flash_banner("选中：%s" % str(d.get("name", "")))


func _slot_at_world(hit: Vector3) -> int:
	var best = -1
	var best_d = 0.7
	for i in range(_slots_px.size()):
		var w = Runtime3DEnv.px_to_world(_slots_px[i], 0.12)
		var d = Vector2(hit.x - w.x, hit.z - w.z).length()
		if d < best_d:
			best_d = d
			best = i
	return best


func _try_build_at_slot(slot_i: int) -> void:
	if not _tower_at_slot(slot_i).is_empty():
		return
	if _towers_def.is_empty():
		return
	var def: Dictionary = _towers_def[_selected_tower_idx % _towers_def.size()]
	var cost = int(def.get("buildCost", 80))
	if _coins < cost:
		_hud.flash_banner("金币不足")
		return
	_coins -= cost
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	var pos = Runtime3DEnv.px_to_world(_slots_px[slot_i], 0.35)
	# 深度版：建塔粒子爆散
	GameParticles.spawn(_world, pos, "burst_collect", GameSpecData.theme_color("playerColor", Color.GREEN), _particle_mult)
	GameJuice.flash_background(self, Color(0.7, 1, 0.75), 0.2)
	var vis = _make_tower_mesh(1)
	_towers_root.add_child(vis)
	vis.position = pos
	var t = {
		"slot": slot_i,
		"pos": _slots_px[slot_i],
		"world": pos,
		"def": def,
		"cd": 0.0,
		"level": 1,
		"node": vis,
	}
	_towers.append(t)
	_hud.show_banner("建造完成", str(def.get("name", "炮塔")), 1.2)


func _make_tower_mesh(level: int) -> MeshInstance3D:
	var vis = MeshInstance3D.new()
	var mesh = CylinderMesh.new()
	mesh.top_radius = 0.32 + level * 0.04
	mesh.bottom_radius = 0.38 + level * 0.04
	mesh.height = 0.55 + level * 0.12
	vis.mesh = mesh
	# 深度版：塔用 organic_pulse shader（自然脉动 emission）；assetStyle=cute-cartoon 等可被 shader_pack 覆盖
	var pack = GameSpecData.shader_pack()
	var use_pack = "organic_pulse" if pack == "flat" else pack
	vis.material_override = GameMaterials.make_from_pack(use_pack, GameSpecData.theme_color("playerColor", Color.GREEN))
	return vis


func _try_upgrade_slot(slot_i: int) -> void:
	var t = _tower_at_slot(slot_i)
	if t.is_empty():
		return
	var def: Dictionary = t.get("def", {})
	var lv = int(t.get("level", 1))
	var costs: Array = def.get("upgradeCosts", [])
	if lv - 1 >= costs.size():
		_hud.flash_banner("已满级")
		return
	var cost = int(costs[lv - 1])
	if _coins < cost:
		_hud.flash_banner("升级金币不足")
		return
	_coins -= cost
	t["level"] = lv + 1
	var old = t.get("node") as Node3D
	if old:
		old.queue_free()
	var vis = _make_tower_mesh(lv + 1)
	vis.position = t.get("world") as Vector3
	_towers_root.add_child(vis)
	t["node"] = vis
	_hud.flash_banner("%s 升至 Lv.%d" % [str(def.get("name", "")), lv + 1])


func _tower_at_slot(slot_i: int) -> Dictionary:
	for t in _towers:
		if t.get("slot") == slot_i:
			return t
	return {}


func _on_goal_shift_ended(_success: bool) -> void:
	if not _goal_shift_failed:
		_coins += int(40 + _director.active_strength * 30)
		_hud.show_banner("守点成功", "额外金币奖励", 1.8)
		GameJuice.flash_background(self, Color(0.6, 1, 0.7), 0.3)
	else:
		_hud.show_banner("守点承压", "下波更需谨慎", 1.6)


func _on_director_banner(title: String, message: String) -> void:
	GameJuice.flash_background(self, Color(1, 0.9, 0.5), 0.25)
	_hud.show_banner(title, message, 2.4)


func _spawn_mini_boss() -> void:
	var pick = "grunt"
	if _enemies_def.has("tank"):
		pick = "tank"
	elif _enemies_def.size() > 0:
		pick = str(_enemies_def.keys()[0])
	var def: Dictionary = _enemies_def.get(pick, {"hp": 60, "speed": 80, "reward": 10})
	var hp = float(def.get("hp", 60)) * 2.2
	_spawn_enemy_entity(pick, def, hp, float(def.get("speed", 80)) * 0.88, int(def.get("reward", 10)) * 2)


func _tick_waves(delta: float) -> void:
	if _wave_lead > 0.0:
		_wave_lead -= delta
		return
	if _spawn_queue.is_empty() and _wave_idx < _waves.size():
		_start_wave(_wave_idx)
		_wave_idx += 1
	if _spawn_cd > 0.0:
		_spawn_cd -= delta
		return
	if _spawn_queue.is_empty():
		if _wave_idx >= _waves.size() and _enemies.is_empty():
			_end_game(true)
		return
	var job: Dictionary = _spawn_queue.pop_front()
	_spawn_enemy(str(job.get("enemyId", "")), int(job.get("remaining", 1)))
	var interval = float(job.get("intervalMs", 600)) / 1000.0
	_spawn_cd = interval
	if int(job.get("remaining", 1)) > 1:
		job["remaining"] = int(job.get("remaining", 1)) - 1
		_spawn_queue.push_front(job)


func _start_wave(idx: int) -> void:
	if idx >= _waves.size():
		return
	var w: Dictionary = _waves[idx]
	_wave_lead = float(w.get("leadInMs", 800)) / 1000.0
	GameJuice.shake_node(self, 4.0, 0.12)
	_hud.show_banner("第 %d 波" % (idx + 1), "敌军来袭", 1.6)
	for sp in w.get("spawns", []):
		if sp is Dictionary:
			_spawn_queue.append({
				"enemyId": sp.get("enemyId", ""),
				"remaining": int(sp.get("count", 1)),
				"intervalMs": int(sp.get("intervalMs", 500)),
			})


func _spawn_enemy(enemy_id: String, _count: int) -> void:
	var def: Dictionary = _enemies_def.get(enemy_id, {"hp": 40, "speed": 90, "reward": 8})
	_spawn_enemy_entity(enemy_id, def, float(def.get("hp", 40)), float(def.get("speed", 90)), int(def.get("reward", 8)))


func _spawn_enemy_entity(enemy_id: String, def: Dictionary, hp: float, speed: float, reward: int) -> void:
	var vis = MeshInstance3D.new()
	var mesh = SphereMesh.new()
	mesh.radius = 0.32 if enemy_id != "tank" else 0.42
	mesh.height = mesh.radius * 2.0
	vis.mesh = mesh
	# 深度版：敌人用 dissolve shader（死亡时直接 tween dissolve_amount，无需替换 material）
	var is_tank = enemy_id == "tank"
	var mat = GameMaterials.make_from_pack("dissolve", GameSpecData.theme_color("hazardColor", Color(0.92, 0.22, 0.22)), 1.0)
	vis.material_override = mat
	vis.set_meta("is_tank", is_tank)
	vis.set_meta("dissolving", false)
	_enemies_root.add_child(vis)
	var start_px = PathMath.pos_at_dist(_path_metrics, 0.0)
	vis.position = Runtime3DEnv.px_to_world(start_px, 0.42)
	_enemies.append({
		"id": enemy_id,
		"hp": hp,
		"max_hp": hp,
		"dist": 0.0,
		"speed": speed,
		"reward": reward,
		"armor": float(def.get("armor", 0)),
		"slow_until": 0.0,
		"node": vis,
	})


func _tick_enemies(delta: float) -> void:
	var leak = int(GameSpecData.tower_defense().get("leakDamage", 8))
	var now = Time.get_ticks_msec() / 1000.0
	var i = 0
	while i < _enemies.size():
		var e: Dictionary = _enemies[i]
		var spd = float(e.get("speed", 80)) * Runtime3DEnv.SCALE
		if now < float(e.get("slow_until", 0)):
			spd *= 0.45
		e["dist"] = float(e.get("dist", 0)) + spd * delta
		var pos_px: Vector2 = PathMath.pos_at_dist(_path_metrics, float(e["dist"]))
		var node: MeshInstance3D = e.get("node") as MeshInstance3D
		if node:
			node.position = Runtime3DEnv.px_to_world(pos_px, 0.42)
			var ratio = float(e.get("hp", 1)) / float(e.get("max_hp", 1))
			var mat = node.material_override as StandardMaterial3D
			if mat:
				mat.albedo_color = Color(0.92, 0.22 * ratio + 0.1, 0.22 * ratio + 0.1)
		if float(e["dist"]) >= _path_metrics.total:
			_base_hp -= leak
			if _director.goal_shift_until > _game_time:
				_goal_shift_failed = true
			GameAudio.play_bleep(GameBleeps.Kind.HIT)
			GameJuice.shake_node(self, 6.0, 0.14)
			GameJuice.flash_background(self, Color(1, 0.4, 0.35), 0.3)
			if node:
				node.queue_free()
			_enemies.remove_at(i)
			if _base_hp <= 0:
				_end_game(false)
			continue
		i += 1


func _tick_towers(delta: float) -> void:
	for t in _towers:
		t["cd"] = maxf(0.0, float(t.get("cd", 0)) - delta)
		if float(t["cd"]) > 0.0:
			continue
		var def: Dictionary = t.get("def", {})
		var lv = int(t.get("level", 1))
		var rng = (float(def.get("range", 140)) + (lv - 1) * 14.0) * Runtime3DEnv.SCALE
		var target = _pick_target(t["world"] as Vector3, rng)
		if target.is_empty():
			continue
		t["cd"] = float(def.get("cooldownMs", 600)) / 1000.0
		_fire_projectile(t["world"] as Vector3, target, def)


func _pick_target(from: Vector3, range_w: float) -> Dictionary:
	var best: Dictionary = {}
	var best_d = range_w
	for e in _enemies:
		var node: Node3D = e.get("node") as Node3D
		if node == null:
			continue
		var flat = Vector2(from.x - node.position.x, from.z - node.position.z)
		var d = flat.length()
		if d <= best_d:
			best_d = d
			best = e
	return best


func _fire_projectile(from: Vector3, target: Dictionary, tower_def: Dictionary) -> void:
	var node: Node3D = target.get("node") as Node3D
	if node == null:
		return
	var to = node.position - from
	to.y = 0.0
	var vel = to.normalized() * 8.8
	var vis = MeshInstance3D.new()
	var mesh = BoxMesh.new()
	mesh.size = Vector3(0.1, 0.1, 0.22)
	vis.mesh = mesh
	var mat = StandardMaterial3D.new()
	mat.albedo_color = GameSpecData.theme_color("collectibleColor", Color.YELLOW)
	vis.material_override = mat
	vis.position = from + Vector3(0, 0.25, 0)
	_projectiles_root.add_child(vis)
	_projectiles.append({
		"node": vis,
		"vel": vel,
		"dmg": float(tower_def.get("damage", 12)),
		"splash": float(tower_def.get("splashRadius", 0)) * Runtime3DEnv.SCALE,
		"slow_pct": float(tower_def.get("slowPct", 0)),
		"slow_ms": float(tower_def.get("slowMs", 0)),
		"life": 1.5,
	})


func _tick_projectiles(delta: float) -> void:
	var now = Time.get_ticks_msec() / 1000.0
	var i = 0
	while i < _projectiles.size():
		var p: Dictionary = _projectiles[i]
		p["life"] = float(p.get("life", 0)) - delta
		var vis: Node3D = p.get("node") as Node3D
		if vis:
			vis.position += p.get("vel", Vector3.ZERO) as Vector3 * delta
			p["pos"] = vis.position
		if float(p["life"]) <= 0.0:
			if vis:
				vis.queue_free()
			_projectiles.remove_at(i)
			continue
		var hit = false
		for e in _enemies:
			var en: Node3D = e.get("node") as Node3D
			if en and (p.get("pos", Vector3.ZERO) as Vector3).distance_to(en.position) < 0.36:
				_damage_enemy(e, p, now)
				hit = true
				break
		if hit:
			if vis:
				vis.queue_free()
			_projectiles.remove_at(i)
			_prune_dead_enemies()
			continue
		i += 1


func _damage_enemy(e: Dictionary, proj: Dictionary, now: float) -> void:
	var dmg = float(proj.get("dmg", 5))
	var armor = float(e.get("armor", 0))
	dmg *= 1.0 - clampf(armor, 0.0, 0.85)
	e["hp"] = float(e.get("hp", 0)) - dmg
	var splash = float(proj.get("splash", 0))
	var at: Vector3 = proj.get("pos", Vector3.ZERO) as Vector3
	if splash > 0.0:
		for other in _enemies:
			if other == e:
				continue
			var n: Node3D = other.get("node") as Node3D
			if n and n.position.distance_to(at) <= splash:
				other["hp"] = float(other.get("hp", 0)) - dmg * 0.5
	var slow_pct = float(proj.get("slow_pct", 0))
	if slow_pct > 0.0:
		e["slow_until"] = now + float(proj.get("slow_ms", 800)) / 1000.0
	if float(e.get("hp", 0)) <= 0.0:
		var mult = _director.coin_reward_mult
		_coins += int(int(e.get("reward", 5)) * mult)
		var node: Node3D = e.get("node") as Node3D
		var eid = str(e.get("id", ""))
		var is_tank = eid == "tank"
		if node:
			GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
			# 深度版：dissolve shader 死亡动画 + GPUParticles3D 爆散
			var hazard_col = GameSpecData.theme_color("hazardColor", Color(0.92, 0.22, 0.22))
			GameParticles.spawn(_world, node.position, "burst_death" if is_tank else "burst_hit", hazard_col, _particle_mult * (2.0 if is_tank else 1.0))
			_play_dissolve(node)
			if is_tank:
				GameJuice.shake_node(self, 4.0, 0.1)


func _prune_dead_enemies() -> void:
	var i = _enemies.size() - 1
	while i >= 0:
		if float(_enemies[i].get("hp", 0)) <= 0.0:
			_enemies.remove_at(i)
		i -= 1


func _update_hud() -> void:
	_hud.set_score(
		"金币 %d · 基地 %d · 波 %d/%d · 敌 %d" % [
			_coins, _base_hp, mini(_wave_idx, _waves.size()), maxi(_waves.size(), 1), _enemies.size()
		]
	)


## 敌人死亡 dissolve 动画：tween dissolve_amount 0→1，结束 queue_free
func _play_dissolve(node: Node3D) -> void:
	if node == null:
		return
	var mat
	if node is MeshInstance3D:
		mat = (node as MeshInstance3D).material_override
	if mat == null:
		node.queue_free()
		return
	GameMaterials.set_dissolve(mat, 0.0)
	var tw = create_tween()
	tw.tween_method(
		func(v: float) -> void: GameMaterials.set_dissolve(mat, v),
		0.0,
		1.0,
		0.7,
	)
	tw.tween_callback(node.queue_free)


func _end_game(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.5, 1, 0.6), 0.35)
		_hud.show_banner("胜利！", "萝卜守住了", 2.6)
	else:
		_hud.show_banner("基地失守", "再布阵一次", 2.4)

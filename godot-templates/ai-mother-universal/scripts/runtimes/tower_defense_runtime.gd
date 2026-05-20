extends Node2D
## 专业塔防：程序化美术 + 导演事件 + 建塔/升级/弹道/减速/护甲

const MAP_W := 800.0
const MAP_H := 600.0

@onready var _map: Node2D = $Map
@onready var _entities: Node2D = $Entities
@onready var _range_layer: Node2D = $RangePreview

var _hud := GameHud.new()
var _director := GameDirector.new()
var _path_metrics: PathMath.PathMetrics
var _path_px: PackedVector2Array = PackedVector2Array()
var _slots_px: Array[Vector2] = []
var _slot_nodes: Array[Area2D] = []

var _towers_def: Array = []
var _enemies_def: Dictionary = {}
var _waves: Array = []

var _coins: int = 120
var _base_hp: int = 30
var _wave_idx: int = 0
var _spawn_queue: Array = []
var _spawn_cd: float = 0.0
var _wave_lead: float = 0.0
var _ended := false
var _selected_tower_idx := 0
var _hover_slot: int = -1
var _goal_shift_failed := false
var _game_time := 0.0

var _enemies: Array[Dictionary] = []
var _towers: Array[Dictionary] = []
var _projectiles: Array[Dictionary] = []

var _bg_color := Color("#1a2220")
var _path_color := Color("#c4a574")
var _grass_a := Color("#3d5c45")
var _grass_b := Color("#4a6b52")


func _ready() -> void:
	GameSpecData.ensure_loaded()
	RuntimeReferenceRegistry.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_director.load_from_spec()
	_director.banner.connect(_on_director_banner)
	_director.spawn_mini_boss.connect(_spawn_mini_boss)
	_director.goal_shift_ended.connect(_on_goal_shift_ended)
	_parse_blueprint()
	_draw_map()
	_build_slots()
	_coins = GameSpecData.gameplay_i("startingCoins", 120)
	_base_hp = GameSpecData.gameplay_i("baseHealth", 30)
	_wave_lead = 1.0
	_hud.set_extra("左键建塔 · 右键升级 · 数字键 1-3 选塔 · 移入塔位看射程")
	_goal_shift_failed = false
	set_process(true)
	set_process_input(true)


func _parse_blueprint() -> void:
	var td := GameSpecData.tower_defense()
	_bg_color = GameSpecData.theme_color("backgroundColor", _bg_color)
	_towers_def = td.get("towers", []) if td.has("towers") else []
	_waves = td.get("waves", []) if td.has("waves") else []
	for e in td.get("enemies", []):
		if e is Dictionary:
			_enemies_def[str(e.get("id", ""))] = e
	_path_px = PackedVector2Array()
	for p in td.get("path", []):
		if p is Dictionary:
			_path_px.append(Vector2(float(p.get("x", 0)) * MAP_W, float(p.get("y", 0)) * MAP_H))
	if _path_px.size() < 2:
		_path_px = PackedVector2Array([
			Vector2(56, 360), Vector2(200, 360), Vector2(200, 200),
			Vector2(420, 200), Vector2(420, 440), Vector2(620, 440), Vector2(744, 264),
		])
	_path_metrics = PathMath.build(_path_px)
	for s in td.get("slots", []):
		if s is Dictionary:
			_slots_px.append(Vector2(float(s.get("x", 0)) * MAP_W, float(s.get("y", 0)) * MAP_H))


func _draw_map() -> void:
	if _map.has_method("set_map_colors"):
		_map.set_map_colors(_bg_color, _grass_a, _grass_b, _path_color, _path_px)
	if _map.has_method("set_protagonist_texture"):
		_map.set_protagonist_texture(RuntimeReferenceRegistry.protagonist_texture)


func _build_slots() -> void:
	for i in range(_slots_px.size()):
		var area := Area2D.new()
		area.position = _slots_px[i]
		area.input_pickable = true
		area.set_meta("slot_index", i)
		var col := CollisionShape2D.new()
		var shape := CircleShape2D.new()
		shape.radius = 28.0
		col.shape = shape
		area.add_child(col)
		var vis := UnitVisual.new()
		vis.kind = UnitVisual.Kind.SLOT
		vis.slot_selected = false
		area.add_child(vis)
		area.mouse_entered.connect(_on_slot_hover.bind(i, true))
		area.mouse_exited.connect(_on_slot_hover.bind(i, false))
		area.input_event.connect(_on_slot_input.bind(i))
		_slot_nodes.append(area)
		_entities.add_child(area)


func _on_slot_hover(slot_i: int, inside: bool) -> void:
	if _tower_at_slot(slot_i).is_empty() and inside:
		_hover_slot = slot_i
	else:
		if _hover_slot == slot_i:
			_hover_slot = -1
	_refresh_slot_visuals()
	_range_layer.queue_redraw()


func _refresh_slot_visuals() -> void:
	for i in range(_slot_nodes.size()):
		var vis := _slot_nodes[i].get_child(1) as UnitVisual
		if vis:
			vis.slot_selected = i == _hover_slot and _tower_at_slot(i).is_empty()


func _on_slot_input(_viewport: Node, event: InputEvent, _shape_idx: int, slot_i: int) -> void:
	if _ended or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed:
		return
	if mb.button_index == MOUSE_BUTTON_LEFT:
		_try_build_at_slot(slot_i)
	elif mb.button_index == MOUSE_BUTTON_RIGHT:
		_try_upgrade_slot(slot_i)


func _try_build_at_slot(slot_i: int) -> void:
	if not _tower_at_slot(slot_i).is_empty():
		return
	if _towers_def.is_empty():
		return
	var def: Dictionary = _towers_def[_selected_tower_idx % _towers_def.size()]
	var cost := int(def.get("buildCost", 80))
	if _coins < cost:
		_hud.flash_banner("金币不足")
		return
	_coins -= cost
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameJuice.burst(self, _slots_px[slot_i], GameSpecData.theme_color("playerColor", Color.GREEN), 12)
	GameJuice.flash_background(self, Color(0.7, 1, 0.75), 0.2)
	var vis := UnitVisual.new()
	vis.kind = UnitVisual.Kind.TOWER
	vis.tower_style = ProceduralUnits.tower_style_from_def(def)
	vis.tower_level = 1
	var tt := RuntimeReferenceRegistry.tower_texture_for_index(_selected_tower_idx)
	if tt:
		vis.overlay_texture = tt
	var t := {
		"slot": slot_i,
		"pos": _slots_px[slot_i],
		"def": def,
		"cd": 0.0,
		"level": 1,
		"node": vis,
	}
	for c in _slot_nodes[slot_i].get_children():
		if c is UnitVisual:
			c.queue_free()
	_slot_nodes[slot_i].add_child(vis)
	_towers.append(t)
	_hud.show_banner("建造完成", str(def.get("name", "炮塔")), 1.2)


func _try_upgrade_slot(slot_i: int) -> void:
	var t := _tower_at_slot(slot_i)
	if t.is_empty():
		return
	var def: Dictionary = t.get("def", {})
	var lv := int(t.get("level", 1))
	var costs: Array = def.get("upgradeCosts", [])
	if lv - 1 >= costs.size():
		_hud.flash_banner("已满级")
		return
	var cost := int(costs[lv - 1])
	if _coins < cost:
		_hud.flash_banner("升级金币不足")
		return
	_coins -= cost
	t["level"] = lv + 1
	var vis := t.get("node") as UnitVisual
	if vis:
		vis.tower_level = lv + 1
	_hud.flash_banner("%s 升至 Lv.%d" % [str(def.get("name", "")), lv + 1])


func _tower_at_slot(slot_i: int) -> Dictionary:
	for t in _towers:
		if t.get("slot") == slot_i:
			return t
	return {}


func _unhandled_input(event: InputEvent) -> void:
	if _ended or not event is InputEventKey or not event.pressed:
		return
	var k := (event as InputEventKey).keycode
	if k >= KEY_1 and k <= KEY_3 and not _towers_def.is_empty():
		_selected_tower_idx = k - KEY_1
		var d: Dictionary = _towers_def[_selected_tower_idx % _towers_def.size()]
		_hud.flash_banner("选中：%s" % str(d.get("name", "")))


func _on_goal_shift_ended(_success: bool) -> void:
	if not _goal_shift_failed:
		_coins += int(40 + _director.active_strength * 30)
		_hud.show_banner("守点成功", "额外金币奖励", 1.8)
		GameJuice.flash_background(self, Color(0.6, 1, 0.7), 0.3)
	else:
		_hud.show_banner("守点承压", "下波更需谨慎", 1.6)


func _process(delta: float) -> void:
	if _ended:
		return
	_game_time += delta
	var progress := 0.0
	if _waves.size() > 0:
		progress = clampf(float(_wave_idx) / float(_waves.size()), 0.0, 1.0)
	var d_out := _director.tick(progress, delta)
	GameAudio.set_tension(progress)
	if d_out.get("coin_gain", 0) > 0:
		_coins += int(d_out.coin_gain)
	_tick_waves(delta)
	_tick_enemies(delta)
	_tick_towers(delta)
	_tick_projectiles(delta)
	_update_hud()
	_range_layer.queue_redraw()
	queue_redraw()


func _on_director_banner(title: String, message: String) -> void:
	GameJuice.flash_background(self, Color(1, 0.9, 0.5), 0.25)
	_hud.show_banner(title, message, 2.4)


func _spawn_mini_boss() -> void:
	var pick := "grunt"
	if _enemies_def.has("tank"):
		pick = "tank"
	elif _enemies_def.size() > 0:
		pick = str(_enemies_def.keys()[0])
	var def: Dictionary = _enemies_def.get(pick, {})
	if def.is_empty():
		return
	var hp := float(def.get("hp", 60)) * 2.2
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
	var interval := float(job.get("intervalMs", 600)) / 1000.0
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
	var def: Dictionary = _enemies_def.get(enemy_id, {})
	if def.is_empty():
		return
	_spawn_enemy_entity(enemy_id, def, float(def.get("hp", 40)), float(def.get("speed", 90)), int(def.get("reward", 8)))


func _spawn_enemy_entity(enemy_id: String, def: Dictionary, hp: float, speed: float, reward: int) -> void:
	var vis := UnitVisual.new()
	vis.kind = UnitVisual.Kind.ENEMY
	vis.unit_id = enemy_id
	vis.hp_ratio = 1.0
	var et := RuntimeReferenceRegistry.next_monster_texture()
	if et:
		vis.overlay_texture = et
	_entities.add_child(vis)
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
	var leak := int(GameSpecData.tower_defense().get("leakDamage", 8))
	var now := Time.get_ticks_msec() / 1000.0
	var i := 0
	while i < _enemies.size():
		var e: Dictionary = _enemies[i]
		var spd := float(e.get("speed", 80))
		if now < float(e.get("slow_until", 0)):
			spd *= 0.45
			var vis: UnitVisual = e.get("node") as UnitVisual
			if vis:
				vis.slowed = true
		else:
			var vis2: UnitVisual = e.get("node") as UnitVisual
			if vis2:
				vis2.slowed = false
		e["dist"] = float(e.get("dist", 0)) + spd * delta
		var pos: Vector2 = PathMath.pos_at_dist(_path_metrics, float(e["dist"]))
		var node: UnitVisual = e.get("node") as UnitVisual
		if node:
			node.position = pos
			node.hp_ratio = float(e.get("hp", 1)) / float(e.get("max_hp", 1))
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
		var lv := int(t.get("level", 1))
		var rng := float(def.get("range", 140)) + (lv - 1) * 14.0
		var target := _pick_target(t["pos"] as Vector2, rng)
		if target.is_empty():
			continue
		t["cd"] = float(def.get("cooldownMs", 600)) / 1000.0
		_fire_projectile(t["pos"] as Vector2, target, def)


func _pick_target(from: Vector2, range_px: float) -> Dictionary:
	var best: Dictionary = {}
	var best_d := range_px
	for e in _enemies:
		var node: Node2D = e.get("node") as Node2D
		if node == null:
			continue
		var d := from.distance_to(node.position)
		if d <= best_d:
			best_d = d
			best = e
	return best


func _fire_projectile(from: Vector2, target: Dictionary, tower_def: Dictionary) -> void:
	var node: Node2D = target.get("node") as Node2D
	if node == null:
		return
	_projectiles.append({
		"pos": from,
		"vel": (node.position - from).normalized() * 440.0,
		"dmg": float(tower_def.get("damage", 12)),
		"splash": float(tower_def.get("splashRadius", 0)),
		"slow_pct": float(tower_def.get("slowPct", 0)),
		"slow_ms": float(tower_def.get("slowMs", 0)),
		"life": 1.5,
		"col": GameSpecData.theme_color("collectibleColor", Color.YELLOW),
	})


func _tick_projectiles(delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	var i := 0
	while i < _projectiles.size():
		var p: Dictionary = _projectiles[i]
		p["life"] = float(p.get("life", 0)) - delta
		p["pos"] = (p.get("pos") as Vector2) + (p.get("vel") as Vector2) * delta
		if float(p["life"]) <= 0.0:
			_projectiles.remove_at(i)
			continue
		var hit := false
		for e in _enemies:
			var node: Node2D = e.get("node") as Node2D
			if node and (p["pos"] as Vector2).distance_to(node.position) < 18.0:
				_damage_enemy(e, p, now)
				hit = true
				break
		if hit:
			_projectiles.remove_at(i)
			_prune_dead_enemies()
			continue
		i += 1


func _damage_enemy(e: Dictionary, proj: Dictionary, now: float) -> void:
	var dmg := float(proj.get("dmg", 5))
	var armor := float(e.get("armor", 0))
	dmg *= 1.0 - clampf(armor, 0.0, 0.85)
	e["hp"] = float(e.get("hp", 0)) - dmg
	var splash := float(proj.get("splash", 0))
	var at: Vector2 = (proj.get("pos") as Vector2)
	if splash > 0.0:
		for other in _enemies:
			if other == e:
				continue
			var n: Node2D = other.get("node") as Node2D
			if n and n.position.distance_to(at) <= splash:
				other["hp"] = float(other.get("hp", 0)) - dmg * 0.5
	var slow_pct := float(proj.get("slow_pct", 0))
	if slow_pct > 0.0:
		e["slow_until"] = now + float(proj.get("slow_ms", 800)) / 1000.0
	if float(e.get("hp", 0)) <= 0.0:
		var mult := _director.coin_reward_mult
		_coins += int(int(e.get("reward", 5)) * mult)
		var node: Node2D = e.get("node") as Node2D
		var eid := str(e.get("id", ""))
		var is_tank := eid == "tank"
		if node:
			GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
			GameJuice.burst(
				self,
				node.global_position,
				GameSpecData.theme_color("collectibleColor", Color.GOLD),
				14 if is_tank else 8
			)
			if is_tank:
				GameJuice.shake_node(self, 4.0, 0.1)
			node.queue_free()


func _prune_dead_enemies() -> void:
	var i := _enemies.size() - 1
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


func _end_game(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.5, 1, 0.6), 0.35)
		_hud.show_banner("胜利！", "萝卜守住了", 2.6)
	else:
		_hud.show_banner("基地失守", "再布阵一次", 2.4)


func _draw() -> void:
	# 射程预览
	if _hover_slot >= 0 and _hover_slot < _slots_px.size():
		var def: Dictionary = _towers_def[_selected_tower_idx % maxi(_towers_def.size(), 1)]
		var rng := float(def.get("range", 140))
		var c := GameSpecData.theme_color("playerColor", Color.GREEN)
		draw_circle(_slots_px[_hover_slot], rng, Color(c.r, c.g, c.b, 0.08))
		draw_arc(_slots_px[_hover_slot], rng, 0, TAU, 48, Color(c.r, c.g, c.b, 0.45), 1.5)
	# 弹道
	for p in _projectiles:
		draw_circle(p.get("pos") as Vector2, 5.0, p.get("col", Color.WHITE))
		draw_circle((p.get("pos") as Vector2) + Vector2(0, 2), 3.0, Color(1, 1, 1, 0.5))

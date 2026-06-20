extends Node2D
## 卡牌战斗（简化炉石式）· 3D 视图
## - 玩家 / AI 各 HP，每回合 +1 法力（上限 maxMana）
## - 手牌 4-5 张（攻击 / 治疗 / 护盾），鼠标点击出牌
## - AI 每回合按难度随机出牌；HP 归零判定胜负

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud := GameHud.new()
var _camera: Camera3D
var _ended := false

var _player_hp := 30
var _ai_hp := 30
var _player_mana := 1
var _max_mana := 8
var _player_shield := 0
var _ai_shield := 0
var _turn := 1
var _is_player_turn := true
var _ai_difficulty := 0.5

var _deck: Array = []
var _hand: Array = []          # Array[Dictionary] {def, mesh, label, cost_label}
var _next_card_id := 1
var _ai_banner_timer := 0.0
var _ai_pending := false

const CARD_W := 1.4
const CARD_H := 2.0
const HAND_MAX := 7


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	# 直接读 GameSpecData.card() 访问器（autoload 已提供）
	var card := _card_blueprint()
	_player_hp = int(card.get("playerHp", 30))
	_ai_hp = _player_hp
	_max_mana = int(card.get("maxMana", 8))
	_ai_difficulty = float(card.get("aiDifficulty", 0.5))
	_player_mana = 1
	_build_scene()
	var starting := int(card.get("startingHand", 4))
	_deck = _build_deck(int(card.get("deckSize", 26)))
	_shuffle_deck()
	for i in range(starting):
		_draw_card_for_player()
	_layout_hand()
	_hud.set_extra("点击手牌出牌 · 攻击对手 / 治疗 / 护盾")
	_hud.show_banner("你的回合", "消耗法力打出卡牌", 1.6)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 兼容写法：若 GameSpecData 提供了 card() 则用之，否则直接读 raw["card"]
func _card_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	if GameSpecData.raw.has("card") and GameSpecData.raw["card"] is Dictionary:
		return GameSpecData.raw["card"]
	return {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 6.5, 9.5)
	_camera.look_at(Vector3(0, 0.5, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)
	# 对手区域标记
	var opp_marker := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(6.0, 2.0)
	opp_marker.mesh = pm
	opp_marker.position = Vector3(0, 0.02, -3.2)
	var om := StandardMaterial3D.new()
	om.albedo_color = Color(0.6, 0.2, 0.2, 0.35)
	om.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	opp_marker.material_override = om
	_world.add_child(opp_marker)
	var opp_label := Label3D.new()
	opp_label.text = "对手"
	opp_label.font_size = 56
	opp_label.position = Vector3(0, 0.6, -3.2)
	opp_label.modulate = Color(0.95, 0.5, 0.5)
	_world.add_child(opp_label)


func _build_deck(deck_size: int) -> Array:
	var out: Array = []
	var total := maxi(deck_size, 10)
	for i in range(total):
		var roll := i % 9
		var def: Dictionary
		if roll < 5:
			var dmg := 2 + int(i / 9) + (i % 3)
			def = {
				"id": _next_card_id, "name": "打击 %d" % dmg,
				"cost": clampi(ceili(float(dmg) / 2.0), 1, _max_mana),
				"kind": "attack", "value": dmg,
			}
		elif roll < 7:
			var h := 3 + (i % 4)
			def = {
				"id": _next_card_id, "name": "治疗 %d" % h,
				"cost": 2, "kind": "heal", "value": h,
			}
		else:
			var s := 2 + (i % 3)
			def = {
				"id": _next_card_id, "name": "护盾 %d" % s,
				"cost": 1, "kind": "shield", "value": s,
			}
		_next_card_id += 1
		out.append(def)
	return out


func _shuffle_deck() -> void:
	var n := _deck.size()
	for i in range(n - 1, 0, -1):
		var j := randi_range(0, i)
		var tmp = _deck[i]
		_deck[i] = _deck[j]
		_deck[j] = tmp


func _draw_card_for_player() -> Dictionary:
	if _hand.size() >= HAND_MAX or _deck.is_empty():
		return {}
	var def: Dictionary = _deck.pop_front()
	_create_card_view(def)
	return def


func _create_card_view(def: Dictionary) -> void:
	var mesh := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(CARD_W, CARD_H)
	mesh.mesh = pm
	mesh.position = Vector3(0, 0.6, 3.2)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = _card_color(def)
	mesh.material_override = mat
	# Area3D 用于 raycast 命中
	var area := Area3D.new()
	area.position = Vector3(0, 0.6, 3.2)
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(CARD_W, CARD_H, 0.2)
	col.shape = shape
	area.add_child(col)
	mesh.add_child(area)
	_world.add_child(mesh)
	var label := Label3D.new()
	label.text = str(def.get("name", ""))
	label.font_size = 40
	label.position = Vector3(0, 0.6, 3.4)
	label.modulate = Color(0.95, 0.95, 0.95)
	_world.add_child(label)
	var cost_label := Label3D.new()
	cost_label.text = "法力 %d" % int(def.get("cost", 0))
	cost_label.font_size = 32
	cost_label.position = Vector3(0, 0.1, 3.4)
	cost_label.modulate = Color(0.5, 0.7, 1.0)
	_world.add_child(cost_label)
	_hand.append({"def": def, "mesh": mesh, "area": area, "label": label, "cost_label": cost_label})


func _card_color(def: Dictionary) -> Color:
	var kind := str(def.get("kind", ""))
	match kind:
		"attack":
			return Color(0.45, 0.15, 0.15, 0.95)
		"heal":
			return Color(0.15, 0.4, 0.2, 0.95)
		_:
			return Color(0.15, 0.2, 0.4, 0.95)


func _layout_hand() -> void:
	var n := _hand.size()
	if n == 0:
		return
	var total_w := minf(8.0, n * (CARD_W + 0.2))
	var start_x := -total_w / 2.0 + CARD_W / 2.0
	var step: float = (total_w / maxf(1, n - 1)) if n > 1 else 0.0
	for i in range(n):
		var v: Dictionary = _hand[i]
		var x: float = (start_x + i * step) if n > 1 else 0.0
		var mesh: MeshInstance3D = v["mesh"]
		mesh.position = Vector3(x, 0.6, 3.2)
		var area: Area3D = v["area"]
		area.position = Vector3(0, 0, 0)  # area 是 mesh 子节点，本地坐标
		var label: Label3D = v["label"]
		label.position = Vector3(x, 1.1, 3.4)
		var cost_label: Label3D = v["cost_label"]
		cost_label.position = Vector3(x, 0.15, 3.4)
		var affordable := int(v["def"].get("cost", 0)) <= _player_mana
		var mat := mesh.material_override as StandardMaterial3D
		if mat:
			var c := _card_color(v["def"])
			mat.albedo_color = Color(c.r, c.g, c.b, 0.95 if affordable else 0.5)
		label.modulate.a = 1.0 if affordable else 0.5


func _process(_delta: float) -> void:
	if _ended:
		return
	if _ai_pending:
		_ai_banner_timer -= _delta
		if _ai_banner_timer <= 0.0:
			_ai_pending = false
			_ai_turn()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _ended or not _is_player_turn:
			return
		_try_play_card_at_mouse()
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()


func _try_play_card_at_mouse() -> void:
	var mp := _viewport.get_mouse_position()
	var from := _camera.project_ray_origin(mp)
	var dir := _camera.project_ray_normal(mp)
	var space := _viewport.world_3d.direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, from + dir * 80.0)
	var hit := space.intersect_ray(query)
	if hit.is_empty():
		return
	var collider = hit.get("collider", null)
	# Area3D 是 mesh 子节点；找到所属手牌
	for i in range(_hand.size()):
		var v: Dictionary = _hand[i]
		if v["area"] == collider:
			_play_player_card(i)
			return


func _play_player_card(idx: int) -> void:
	if idx < 0 or idx >= _hand.size():
		return
	var v: Dictionary = _hand[idx]
	var def: Dictionary = v["def"]
	var cost := int(def.get("cost", 0))
	if cost > _player_mana:
		_hud.show_banner("法力不足", "", 1.0)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
		return
	_player_mana -= cost
	_apply_card_effect(def, "player")
	_remove_card_from_hand(idx)
	_layout_hand()
	_refresh_hud()
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	GameJuice.flash_background(self, Color(0.5, 0.8, 1.0), 0.18)
	if _ai_hp <= 0:
		_end(true)


func _remove_card_from_hand(idx: int) -> void:
	if idx < 0 or idx >= _hand.size():
		return
	var v: Dictionary = _hand[idx]
	var mesh: MeshInstance3D = v["mesh"]
	var label: Label3D = v["label"]
	var cost_label: Label3D = v["cost_label"]
	mesh.queue_free()
	label.queue_free()
	cost_label.queue_free()
	_hand.remove_at(idx)


func _apply_card_effect(def: Dictionary, caster: String) -> void:
	var kind := str(def.get("kind", ""))
	var value := int(def.get("value", 0))
	if kind == "attack":
		var dmg := value
		if caster == "player":
			var absorbed := mini(_ai_shield, dmg)
			_ai_shield -= absorbed
			dmg -= absorbed
			_ai_hp = maxi(0, _ai_hp - dmg)
		else:
			var absorbed := mini(_player_shield, dmg)
			_player_shield -= absorbed
			dmg -= absorbed
			_player_hp = maxi(0, _player_hp - dmg)
		GameJuice.shake_node(self, 6.0, 0.14)
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.25)
	elif kind == "heal":
		if caster == "player":
			_player_hp = mini(_max_mana * 4 + 6, _player_hp + value)
		else:
			_ai_hp = mini(_max_mana * 4 + 6, _ai_hp + value)
		GameJuice.flash_background(self, Color(0.4, 1.0, 0.5), 0.2)
	else:
		# shield
		if caster == "player":
			_player_shield += value
		else:
			_ai_shield += value


func _end_player_turn() -> void:
	if _ended or not _is_player_turn:
		return
	_is_player_turn = false
	_hud.show_banner("对手回合", "AI 思考中…", 1.2)
	_ai_banner_timer = 0.8
	_ai_pending = true


func _ai_turn() -> void:
	if _ended:
		return
	var ai_mana := mini(_max_mana, _turn)
	var ai_hand: Array = []
	var hand_size := 4 + int(_turn / 3)
	for i in range(hand_size):
		ai_hand.append(_random_ai_card())
	var guard := 0
	while guard < 8 and ai_mana > 0:
		guard += 1
		var playable: Array = []
		for c in ai_hand:
			if int(c.get("cost", 0)) <= ai_mana:
				playable.append(c)
		if playable.is_empty():
			break
		var want_play := randf() < _ai_difficulty + 0.25
		if not want_play and ai_mana <= 2:
			break
		var pick: Dictionary
		if _ai_hp < 8:
			var heals := playable.filter(func(c): return str(c.get("kind","")) == "heal")
			if not heals.is_empty():
				pick = heals[0]
		if pick.is_empty():
			var attacks := playable.filter(func(c): return str(c.get("kind","")) == "attack")
			if not attacks.is_empty():
				pick = attacks[randi_range(0, attacks.size() - 1)]
			else:
				pick = playable[0]
		ai_mana -= int(pick.get("cost", 0))
		_apply_card_effect(pick, "ai")
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
		_refresh_hud()
		if _player_hp <= 0:
			_end(false)
			return
		if _ai_difficulty < 0.45 and randf() > 0.6:
			break
	# 进入下一回合
	_turn += 1
	_player_mana = mini(_max_mana, _turn)
	_is_player_turn = true
	_draw_card_for_player()
	_layout_hand()
	_refresh_hud()
	_hud.show_banner("你的回合", "法力 +%d" % 1, 1.2)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _random_ai_card() -> Dictionary:
	var roll := randf()
	var dmg := 2 + randi() % 4
	var id := _next_card_id
	_next_card_id += 1
	if roll < 0.55:
		return {"id": id, "name": "打击 %d" % dmg,
				"cost": maxi(1, ceili(float(dmg) / 2.0)),
				"kind": "attack", "value": dmg}
	elif roll < 0.78:
		var h := 3 + randi() % 3
		return {"id": id, "name": "治疗 %d" % h,
				"cost": 2, "kind": "heal", "value": h}
	var s := 2 + randi() % 2
	return {"id": id, "name": "护盾 %d" % s,
			"cost": 1, "kind": "shield", "value": s}


func _refresh_hud() -> void:
	var ps := " +%d" % _player_shield if _player_shield > 0 else ""
	var as_ := " +%d" % _ai_shield if _ai_shield > 0 else ""
	var turn_str := "你的回合" if _is_player_turn else "对手回合"
	_hud.set_score("HP %d%s · 法力 %d/%d · 对手 %d%s · 回合 %d · %s" %
		[_player_hp, ps, _player_mana, _max_mana, _ai_hp, as_, _turn, turn_str])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("胜利！", "击败对手", 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "再试一次", 2.0)

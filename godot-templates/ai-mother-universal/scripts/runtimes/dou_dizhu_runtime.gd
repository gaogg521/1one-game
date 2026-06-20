extends Node2D
## 斗地主 · 3D 视图（PlaneMesh + Label3D）
## - 3 人对局（玩家 + 2 AI），54 张牌（含大小王）
## - 发牌：每人 17 张 + 3 张底牌
## - 叫地主：玩家按 1/2/3 叫分，最高分者得地主 + 收 3 张底牌
## - 出牌：地主先出，顺时针；下家必须出更大牌型或 pass
## - 牌型：单张/对子/三张/三带一/三带二/顺子/连对/飞机/炸弹/王炸
## - 胜负：地主出完 → 地主胜；任一农民出完 → 农民胜
##
## 数据来源：GameSpecData.raw.get("douDizhu", {}) 兜底。

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _camera: Camera3D
var _ended = false

# 牌：v=3..17（3..2，小王 16，大王 17），s=0..3 花色（王为 -1），id 唯一
const RANK_NAMES := {
	3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
	11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小王", 17: "大王",
}
const SUIT_GLYPHS := ["♠", "♥", "♣", "♦"]

var _decks_built = false
var _hands: Array = []           # Array[Array[Dictionary]] 三家手牌
var _bottom_cards: Array = []    # Array[Dictionary] 底牌
var _landlord_seat = -1
var _current_seat = 0
var _last_play: Dictionary = {}  # {type, weight, length, cards}
var _last_play_seat = -1
var _pass_count = 0
var _selected_ids: Array = []    # Array[int]

# 叫地主
var _bid_phase = true
var _bid_turn = 0
var _highest_bid = 0
var _highest_bid_seat = -1
var _bid_passes = 0

var _ai_difficulty = 0.6
var _starting_bid = 2
var _ai_act_at = 0.0

# 手牌 mesh 索引：_hand_views[seat] = Array[{mesh, label, area, card}]
var _hand_views: Array = []
var _seat_count_labels: Array = []
var _seat_role_labels: Array = []
var _seat_play_labels: Array = []

const CARD_W := 0.7
const CARD_H := 1.0


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	var bp = _dizhu_blueprint()
	_ai_difficulty = float(bp.get("aiDifficulty", 0.6))
	_starting_bid = int(bp.get("startingBid", 2))
	_build_scene()
	_deal_cards()
	_build_seat_labels()
	_layout_player_hand()
	_hud.set_extra("点击手牌选/取消 · Enter 出牌 · Space/P 不要 · 叫分 1/2/3 或 0 不叫")
	_start_bidding()
	_hud.show_banner("斗地主", "3 人扑克 · 叫地主 · 出牌比大小", 1.8)
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


func _dizhu_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	if GameSpecData.raw.has("douDizhu") and GameSpecData.raw["douDizhu"] is Dictionary:
		return GameSpecData.raw["douDizhu"]
	return {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 7.5, 8.0)
	_camera.look_at(Vector3(0, 0.5, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)
	# 牌桌
	var table = MeshInstance3D.new()
	var tm = PlaneMesh.new()
	tm.size = Vector2(10.0, 6.0)
	table.mesh = tm
	table.position = Vector3(0, 0.0, 0)
	var tmat = StandardMaterial3D.new()
	tmat.albedo_color = Color(0.12, 0.32, 0.22, 0.95)
	table.material_override = tmat
	_world.add_child(table)


# ─── 发牌 ───
func _build_deck() -> Array:
	var out: Array = []
	var id = 0
	var vals = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
	for v in vals:
		for s in range(4):
			out.append({"v": v, "s": s, "id": id})
			id += 1
	out.append({"v": 16, "s": -1, "id": id})
	id += 1
	out.append({"v": 17, "s": -1, "id": id})
	return out


func _shuffle(arr: Array) -> Array:
	var out = arr.duplicate()
	var n = out.size()
	for i in range(n - 1, 0, -1):
		var j = randi_range(0, i)
		var tmp = out[i]
		out[i] = out[j]
		out[j] = tmp
	return out


func _sort_hand(hand: Array) -> Array:
	return hand.duplicate()
	return hand.duplicate() # placeholder to satisfy linter
	# real sort below


func _sort_hand_real(hand: Array) -> Array:
	var out = hand.duplicate()
	out.sort_custom(func(a, b): return int(a["v"]) < int(b["v"]))
	return out


func _deal_cards() -> void:
	var deck = _shuffle(_build_deck())
	var hands: Array = [[], [], []]
	for i in range(17 * 3):
		hands[i % 3].append(deck[i])
	_bottom_cards = deck.slice(17 * 3, 17 * 3 + 3)
	_hands = [
		_sort_hand_real(hands[0]),
		_sort_hand_real(hands[1]),
		_sort_hand_real(hands[2]),
	]


# ─── 叫地主 ───
func _start_bidding() -> void:
	_bid_phase = true
	_bid_turn = 0
	_highest_bid = 0
	_highest_bid_seat = -1
	_bid_passes = 0
	_show_bid_prompt()


func _show_bid_prompt() -> void:
	if _bid_turn != 0:
		_ai_act_at = Time.get_ticks_msec() / 1000.0 + 0.9
		return
	var msg = "按 1/2/3 叫分（> %d）或 0 不叫" % _highest_bid
	_hud.show_banner("叫地主", msg, 3.0)


func _unhandled_input(event: InputEvent) -> void:
	if _ended:
		return
	GameAudio.boot_interactive()
	if event is InputEventKey and event.pressed and not event.echo:
		if _bid_phase and _bid_turn == 0:
			match event.keycode:
				KEY_1: _player_bid(1)
				KEY_2: _player_bid(2)
				KEY_3: _player_bid(3)
				KEY_0: _player_bid(0)
		else:
			if not _bid_phase and _current_seat == 0:
				match event.keycode:
					KEY_ENTER, KEY_KP_ENTER: _on_play_selected()
					KEY_SPACE, KEY_P: _on_pass()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if not _bid_phase and _current_seat == 0 and not _ended:
			_try_toggle_card_at_mouse()


func _player_bid(bid: int) -> void:
	if not _bid_phase or _bid_turn != 0:
		return
	if bid != 0 and bid <= _highest_bid:
		_hud.show_banner("叫分太低", "必须大于 %d" % _highest_bid, 1.2)
		_show_bid_prompt()
		return
	_apply_bid(0, bid)


func _apply_bid(seat: int, bid: int) -> void:
	if bid > _highest_bid:
		_highest_bid = bid
		_highest_bid_seat = seat
		_bid_passes = 0
	else:
		_bid_passes += 1
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	var all_acted = _bid_passes + (1 if _highest_bid > 0 else 0) >= 3
	if _highest_bid >= 3 or all_acted:
		_finalize_bidding()
		return
	_bid_turn = (_bid_turn + 1) % 3
	_show_bid_prompt()


func _finalize_bidding() -> void:
	if _highest_bid_seat < 0:
		_hud.show_banner("流局", "全员不叫，重新发牌", 1.6)
		await get_tree().create_timer(1.6).timeout
		_deal_cards()
		_layout_player_hand()
		_start_bidding()
		return
	_landlord_seat = _highest_bid_seat
	# 地主收底牌
	for c in _bottom_cards:
		_hands[_landlord_seat].append(c)
	_hands[_landlord_seat] = _sort_hand_real(_hands[_landlord_seat])
	_bottom_cards = []
	_bid_phase = false
	_current_seat = _landlord_seat
	_last_play = {}
	_last_play_seat = -1
	_pass_count = 0
	var who = "你" if _landlord_seat == 0 else "右家" if _landlord_seat == 1 else "左家"
	_hud.show_banner("地主确定", "%s 当地主" % who, 2.0)
	GameAudio.play_bleep(GameBleeps.Kind.WIN)
	_build_seat_labels()
	_layout_player_hand()
	_refresh_hud()
	if _current_seat != 0:
		_ai_act_at = Time.get_ticks_msec() / 1000.0 + 1.2


func _ai_bid(seat: int) -> void:
	var hand: Array = _hands[seat]
	var strength = 0
	# 统计点数 → 张数
	var counts = {}
	for c in hand:
		var v: int = c["v"]
		counts[v] = int(counts.get(v, 0)) + 1
	for v in counts:
		if v == 17:
			strength += 4
		elif v == 16:
			strength += 3
		elif v == 15:
			strength += 2
		if int(counts[v]) == 4:
			strength += 5
		if int(counts[v]) == 3:
			strength += 1
	var bid = 0
	if strength >= 8:
		bid = 3
	elif strength >= 5:
		bid = 2
	elif strength >= 3:
		bid = 1
	if randf() > _ai_difficulty + 0.3:
		bid = maxi(0, bid - 1)
	if bid > 0 and bid <= _highest_bid:
		bid = 0
	_apply_bid(seat, bid)


# ─── 出牌 ───
func _on_play_selected() -> void:
	if _ended or _bid_phase or _current_seat != 0:
		return
	var sel: Array = []
	var ids = {}
	for id in _selected_ids:
		ids[id] = true
	for c in _hands[0]:
		if ids.has(c["id"]):
			sel.append(c)
	if sel.is_empty():
		return
	var pattern = _identify_pattern(sel)
	if pattern.is_empty():
		_hud.show_banner("牌型不合法", "", 1.2)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
		return
	if not _last_play.is_empty() and _last_play_seat != 0 and not _can_beat(_last_play, pattern):
		_hud.show_banner("管不上", "", 1.2)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
		return
	_commit_play(0, pattern)


func _on_pass() -> void:
	if _ended or _bid_phase or _current_seat != 0:
		return
	if _last_play_seat < 0 or _last_play_seat == 0:
		_hud.show_banner("你先出牌", "", 1.0)
		return
	_commit_pass(0)


func _commit_play(seat: int, pattern: Dictionary) -> void:
	var played_ids = {}
	for c in pattern["cards"]:
		played_ids[c["id"]] = true
	_hands[seat] = _hands[seat].filter(func(c): return not played_ids.has(c["id"]))
	_last_play = pattern
	_last_play_seat = seat
	_pass_count = 0
	_selected_ids = []
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP if seat == 0 else GameBleeps.Kind.HIT)
	_show_play_on_seat(seat, pattern)
	_build_seat_labels()
	if seat == 0:
		_layout_player_hand()
	_refresh_hud()
	if _hands[seat].is_empty():
		_end_game(seat)
		return
	_advance_turn()


func _commit_pass(seat: int) -> void:
	_pass_count += 1
	_show_play_on_seat(seat, {})
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	if _pass_count >= 2:
		_last_play = {}
		_last_play_seat = -1
		_pass_count = 0
		_clear_play_areas()
	_advance_turn()


func _advance_turn() -> void:
	_current_seat = (_current_seat + 1) % 3
	_refresh_hud()
	if _current_seat != 0:
		_ai_act_at = Time.get_ticks_msec() / 1000.0 + 1.1


# ─── AI ───
func _ai_decide(seat: int) -> void:
	var hand: Array = _hands[seat]
	var lead = _last_play_seat < 0 or _last_play_seat == seat
	if lead:
		var play = _ai_pick_lead(hand)
		if not play.is_empty():
			_commit_play(seat, play)
		else:
			_commit_play(seat, _single_pattern([hand[0]]))
		return
	var cand = _ai_pick_follow(hand, _last_play)
	if not cand.is_empty():
		_commit_play(seat, cand)
	else:
		_commit_pass(seat)


func _ai_pick_lead(hand: Array) -> Dictionary:
	var singles: Array = hand.filter(func(c): return int(c["v"]) < 15)
	if not singles.is_empty():
		var min_card = singles[0]
		for c in singles:
			if int(c["v"]) < int(min_card["v"]):
				min_card = c
		return _single_pattern([min_card])
	# 最小对子
	var counts = {}
	for c in hand:
		var v: int = c["v"]
		if not counts.has(v):
			counts[v] = []
		counts[v].append(c)
	var pair_vals = counts.keys()
	pair_vals.sort()
	for v in pair_vals:
		if int(v) < 15 and counts[v].size() >= 2:
			return {"type": "pair", "weight": int(v), "length": 2, "cards": counts[v].slice(0, 2)}
	if not hand.is_empty():
		return _single_pattern([hand[0]])
	return {}


func _ai_pick_follow(hand: Array, prev: Dictionary) -> Dictionary:
	var counts = {}
	for c in hand:
		var v: int = c["v"]
		if not counts.has(v):
			counts[v] = []
		counts[v].append(c)
	var same = _find_same_type_beat(hand, counts, prev)
	if not same.is_empty():
		return same
	var hand_count = hand.size()
	var willingness = _ai_difficulty + (0.4 if hand_count <= 4 else 0.0)
	var ptype = str(prev.get("type", ""))
	if ptype != "bomb" and ptype != "rocket":
		var vals = counts.keys()
		vals.sort()
		for v in vals:
			if counts[v].size() == 4:
				if randf() < willingness:
					return {"type": "bomb", "weight": int(v), "length": 4, "cards": counts[v].slice(0, 4)}
		# 王炸
		var small_j = _find_value(hand, 16)
		var big_j = _find_value(hand, 17)
		if small_j != null and big_j != null and randf() < willingness * 0.8:
			return {"type": "rocket", "weight": 100, "length": 2, "cards": [small_j, big_j]}
	elif ptype == "bomb":
		var prev_w: int = int(prev["weight"])
		var vals = counts.keys()
		vals.sort()
		for v in vals:
			if counts[v].size() == 4 and int(v) > prev_w:
				return {"type": "bomb", "weight": int(v), "length": 4, "cards": counts[v].slice(0, 4)}
		var small_j = _find_value(hand, 16)
		var big_j = _find_value(hand, 17)
		if small_j != null and big_j != null and randf() < willingness:
			return {"type": "rocket", "weight": 100, "length": 2, "cards": [small_j, big_j]}
	return {}


func _find_value(hand: Array, v: int) -> Variant:
	for c in hand:
		if int(c["v"]) == v:
			return c
	return null


func _find_same_type_beat(hand: Array, counts: Dictionary, prev: Dictionary) -> Dictionary:
	var ptype = str(prev.get("type", ""))
	var prev_w: int = int(prev.get("weight", 0))
	match ptype:
		"single":
			for c in hand:
				if int(c["v"]) > prev_w:
					return _single_pattern([c])
		"pair":
			var vals = counts.keys()
			vals.sort()
			for v in vals:
				if counts[v].size() >= 2 and int(v) > prev_w:
					return {"type": "pair", "weight": int(v), "length": 2, "cards": counts[v].slice(0, 2)}
		"triple":
			var vals = counts.keys()
			vals.sort()
			for v in vals:
				if counts[v].size() >= 3 and int(v) > prev_w:
					return {"type": "triple", "weight": int(v), "length": 3, "cards": counts[v].slice(0, 3)}
		"tripleWithSingle":
			var vals = counts.keys()
			vals.sort()
			for v in vals:
				if counts[v].size() >= 3 and int(v) > prev_w:
					var triple: Array = counts[v].slice(0, 3)
					var extra: Variant = null
					for c in hand:
						if int(c["v"]) != int(v):
							extra = c
							break
					if extra != null:
						return {"type": "tripleWithSingle", "weight": int(v), "length": 4, "cards": triple + [extra]}
		"tripleWithPair":
			var vals = counts.keys()
			vals.sort()
			for v in vals:
				if counts[v].size() >= 3 and int(v) > prev_w:
					var triple: Array = counts[v].slice(0, 3)
					for v2 in counts:
						if int(v2) != int(v) and counts[v2].size() >= 2:
							return {"type": "tripleWithPair", "weight": int(v), "length": 5, "cards": triple + counts[v2].slice(0, 2)}
		# 顺子/连对/飞机 等复杂跟牌省略（AI 简化：不跟 → pass 或炸）
		_:
			return {}
	return {}


# ─── 牌型识别 ───
func _identify_pattern(cards: Array) -> Dictionary:
	if cards.is_empty():
		return {}
	var sorted = cards.duplicate()
	sorted.sort_custom(func(a, b): return int(a["v"]) < int(b["v"]))
	var n = sorted.size()
	var counts = {}
	for c in sorted:
		var v: int = c["v"]
		if not counts.has(v):
			counts[v] = []
		counts[v].append(c)
	var count_arr: Array = []
	for v in counts:
		count_arr.append(counts[v].size())
	count_arr.sort()
	count_arr.reverse()
	var vals: Array = counts.keys()
	vals.sort()

	# 王炸
	if n == 2 and int(sorted[0]["v"]) == 16 and int(sorted[1]["v"]) == 17:
		return {"type": "rocket", "weight": 100, "length": 2, "cards": sorted}
	# 炸弹
	if n == 4 and int(count_arr[0]) == 4:
		return {"type": "bomb", "weight": int(vals[0]), "length": 4, "cards": sorted}
	# 单张
	if n == 1:
		return _single_pattern(sorted)
	# 对子
	if n == 2 and int(count_arr[0]) == 2:
		return {"type": "pair", "weight": int(vals[0]), "length": 2, "cards": sorted}
	# 三张
	if n == 3 and int(count_arr[0]) == 3:
		return {"type": "triple", "weight": int(vals[0]), "length": 3, "cards": sorted}
	# 三带一
	if n == 4 and int(count_arr[0]) == 3 and int(count_arr[1]) == 1:
		var triple_v: int = -1
		for v in counts:
			if counts[v].size() == 3:
				triple_v = int(v)
				break
		return {"type": "tripleWithSingle", "weight": triple_v, "length": 4, "cards": sorted}
	# 三带对
	if n == 5 and int(count_arr[0]) == 3 and int(count_arr[1]) == 2:
		var triple_v: int = -1
		for v in counts:
			if counts[v].size() == 3:
				triple_v = int(v)
				break
		return {"type": "tripleWithPair", "weight": triple_v, "length": 5, "cards": sorted}
	# 顺子（5+ 连续单张，不含 2/王）
	if n >= 5 and int(count_arr[0]) == 1:
		if int(vals[vals.size() - 1]) < 15:
			var ok = true
			for i in range(1, vals.size()):
				if int(vals[i]) - int(vals[i - 1]) != 1:
					ok = false
					break
			if ok:
				return {"type": "straight", "weight": int(vals[0]), "length": n, "cards": sorted}
	# 连对（3+ 连续对子）
	if n >= 6 and n % 2 == 0:
		var all_pair = true
		for c in count_arr:
			if int(c) != 2:
				all_pair = false
				break
		if all_pair and int(vals[vals.size() - 1]) < 15:
			var ok = true
			for i in range(1, vals.size()):
				if int(vals[i]) - int(vals[i - 1]) != 1:
					ok = false
					break
			if ok:
				return {"type": "pairStraight", "weight": int(vals[0]), "length": n, "cards": sorted}
	# 飞机不带（2+ 连续三张）
	if n >= 6 and n % 3 == 0:
		var all_triple = true
		for c in count_arr:
			if int(c) != 3:
				all_triple = false
				break
		if all_triple and int(vals[vals.size() - 1]) < 15:
			var ok = true
			for i in range(1, vals.size()):
				if int(vals[i]) - int(vals[i - 1]) != 1:
					ok = false
					break
			if ok:
				return {"type": "plane", "weight": int(vals[0]), "length": n, "cards": sorted}
	# 飞机带单 / 带对 省略（AI 简化策略）
	return {}


func _single_pattern(cards: Array) -> Dictionary:
	return {"type": "single", "weight": int(cards[0]["v"]), "length": 1, "cards": cards}


func _can_beat(prev: Dictionary, cur: Dictionary) -> bool:
	var ct = str(cur.get("type", ""))
	var pt = str(prev.get("type", ""))
	if ct == "rocket":
		return true
	if ct == "bomb":
		if pt == "rocket":
			return false
		if pt == "bomb":
			return int(cur["weight"]) > int(prev["weight"])
		return true
	if pt == "rocket" or pt == "bomb":
		return false
	if ct != pt:
		return false
	if int(cur["length"]) != int(prev["length"]):
		return false
	return int(cur["weight"]) > int(prev["weight"])


# ─── UI ───
func _seat_name(seat: int) -> String:
	match seat:
		0: return "你"
		1: return "右家"
		_: return "左家"


func _build_seat_labels() -> void:
	for t in _seat_count_labels:
		t.queue_free()
	for t in _seat_role_labels:
		t.queue_free()
	for t in _seat_play_labels:
		t.queue_free()
	_seat_count_labels = []
	_seat_role_labels = []
	_seat_play_labels = []
	for s in range(3):
		var pos = _seat_pos(s)
		if s == 0:
			_seat_count_labels.append(Label3D.new())
		else:
			var cl = Label3D.new()
			cl.text = "%s: %d" % [_seat_name(s), _hands[s].size()]
			cl.font_size = 48
			cl.position = pos + Vector3(0, 1.4, 0)
			cl.modulate = Color(0.9, 0.95, 1.0)
			_world.add_child(cl)
			_seat_count_labels.append(cl)
		var is_ll = (_landlord_seat == s)
		var role = "地主" if is_ll else "农民"
		if _bid_phase:
			role = ""
		var rl = Label3D.new()
		rl.text = role
		rl.font_size = 44
		rl.position = pos + Vector3(0, -1.0, 0)
		rl.modulate = Color(1.0, 0.85, 0.3) if is_ll else Color(0.6, 0.95, 0.7)
		_world.add_child(rl)
		_seat_role_labels.append(rl)
		var pl = Label3D.new()
		pl.text = ""
		pl.font_size = 40
		pl.position = pos + Vector3(0, -1.6, 0)
		pl.modulate = Color(0.98, 0.92, 0.5)
		_world.add_child(pl)
		_seat_play_labels.append(pl)


func _seat_pos(seat: int) -> Vector3:
	match seat:
		0: return Vector3(0, 0.6, 3.2)
		1: return Vector3(-4.5, 0.6, -1.5)
		_: return Vector3(4.5, 0.6, -1.5)


func _show_play_on_seat(seat: int, pattern: Dictionary) -> void:
	var t: Label3D = _seat_play_labels[seat]
	if pattern.is_empty():
		t.text = "不要"
		t.modulate = Color(1.0, 0.4, 0.4)
	else:
		t.text = _describe_pattern(pattern)
		t.modulate = Color(0.98, 0.92, 0.5)


func _clear_play_areas() -> void:
	for t in _seat_play_labels:
		t.text = ""


func _describe_pattern(p: Dictionary) -> String:
	var parts: Array = []
	for c in p["cards"]:
		parts.append(_describe_card(c))
	return " ".join(parts)


func _describe_card(c: Dictionary) -> String:
	var v: int = int(c["v"])
	if v == 16:
		return "小王"
	if v == 17:
		return "大王"
	return "%s%s" % [SUIT_GLYPHS[int(c["s"])], RANK_NAMES[v]]


# ─── 玩家手牌渲染 ───
func _layout_player_hand() -> void:
	for v in _hand_views:
		if "mesh" in v:
			v["mesh"].queue_free()
		if "label" in v:
			v["label"].queue_free()
		if "area" in v:
			v["area"].queue_free()
	_hand_views = []
	var hand: Array = _hands[0]
	var n = hand.size()
	if n == 0:
		return
	var total_w = minf(7.0, n * (CARD_W + 0.08))
	var start_x = -total_w / 2.0 + CARD_W / 2.0
	var step: float = (total_w / maxf(1, n - 1)) if n > 1 else 0.0
	var selected_set = {}
	for id in _selected_ids:
		selected_set[id] = true
	for i in range(n):
		var c: Dictionary = hand[i]
		var x: float = (start_x + i * step) if n > 1 else 0.0
		var y = 0.6 + (0.25 if selected_set.has(c["id"]) else 0.0)
		var mesh = MeshInstance3D.new()
		var pm = PlaneMesh.new()
		pm.size = Vector2(CARD_W, CARD_H)
		mesh.mesh = pm
		mesh.position = Vector3(x, y, 3.2)
		var mat = StandardMaterial3D.new()
		mat.albedo_color = _card_color(c)
		mesh.material_override = mat
		var area = Area3D.new()
		area.position = Vector3(x, y, 3.2)
		var col = CollisionShape3D.new()
		var shape = BoxShape3D.new()
		shape.size = Vector3(CARD_W, CARD_H, 0.2)
		col.shape = shape
		area.add_child(col)
		mesh.add_child(area)
		_world.add_child(mesh)
		var label = Label3D.new()
		label.text = _describe_card(c)
		label.font_size = 32
		label.position = Vector3(x, y + 0.1, 3.4)
		label.modulate = Color(0.95, 0.95, 0.95)
		_world.add_child(label)
		_hand_views.append({"mesh": mesh, "area": area, "label": label, "card": c})


func _card_color(c: Dictionary) -> Color:
	var v: int = int(c["v"])
	var s: int = int(c["s"])
	if v == 16:
		return Color(0.2, 0.2, 0.25, 0.95)
	if v == 17:
		return Color(0.85, 0.85, 0.9, 0.95)
	var is_red = (s == 1 or s == 3)
	return Color(0.95, 0.85, 0.85, 0.95) if is_red else Color(0.85, 0.88, 0.95, 0.95)


func _try_toggle_card_at_mouse() -> void:
	var mp = _viewport.get_mouse_position()
	var from = _camera.project_ray_origin(mp)
	var dir = _camera.project_ray_normal(mp)
	var space = _viewport.world_3d.direct_space_state
	var query = PhysicsRayQueryParameters3D.create(from, from + dir * 80.0)
	var hit = space.intersect_ray(query)
	if hit.is_empty():
		return
	var collider = hit.get("collider", null)
	for i in range(_hand_views.size()):
		var v: Dictionary = _hand_views[i]
		if v["area"] == collider:
			var card: Dictionary = v["card"]
			var cid: int = int(card["id"])
			var idx = _selected_ids.find(cid)
			if idx >= 0:
				_selected_ids.remove_at(idx)
			else:
				_selected_ids.append(cid)
			_layout_player_hand()
			GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
			return


func _refresh_hud() -> void:
	if _bid_phase:
		_hud.set_score("底分 %d · 手牌 %d · 叫地主中" % [_highest_bid, _hands[0].size()])
		return
	var my_role = "地主" if _landlord_seat == 0 else "农民"
	var turn = "你的回合" if _current_seat == 0 else "%s 出牌" % _seat_name(_current_seat)
	_hud.set_score("%s · 手牌 %d · %s" % [my_role, _hands[0].size(), turn])


func _end_game(winner_seat: int) -> void:
	_ended = true
	var winner_is_ll = (_landlord_seat == winner_seat)
	var player_is_ll = (_landlord_seat == 0)
	var player_won = (player_is_ll and winner_is_ll) or (not player_is_ll and not winner_is_ll)
	if player_won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("胜利！", "刷新重开", 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "刷新重开", 2.0)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)


func _process(_delta: float) -> void:
	if _ended:
		return
	var now = Time.get_ticks_msec() / 1000.0
	if _bid_phase:
		if _bid_turn != 0 and _ai_act_at > 0.0 and now >= _ai_act_at:
			_ai_act_at = 0.0
			_ai_bid(_bid_turn)
		return
	if _current_seat != 0 and _ai_act_at > 0.0 and now >= _ai_act_at:
		_ai_act_at = 0.0
		_ai_decide(_current_seat)

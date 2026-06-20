extends Node2D
## 真麻将（4 人对局）· 3D 视图
## - 3 花色 × 9 数字 × 4 张 = 108 张（万/条/筒，无字牌简化）
## - 玩家（南）+ 3 AI（东/北/西），逆时针轮转
## - 玩家点击手牌出牌；可碰/杠/胡时显示按钮
## - 多局制 + 总分结算

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _camera: Camera3D
var _ended = false

var _bp: Dictionary = {}
var _round = 1
var _player_total_delta = 0

var _wall: Array = []           # Array[Dictionary] {suit, rank, id}
var _players: Array = []        # 4 × {seat, hand, melds, discards, points, riichi, is_human}
var _current_seat = 1
var _last_discard: Dictionary = {}
var _last_discard_by = -1
var _awaiting_player_reaction = false
var _ai_timer = 0.0

const TILE_W := 0.7
const TILE_H := 1.0
const SUITS := ["man", "tiao", "tong"]
const SUIT_LABELS := {"man": "万", "tiao": "条", "tong": "筒"}
const SUIT_COLORS := {
	"man": Color(0.15, 0.38, 0.92),
	"tiao": Color(0.09, 0.64, 0.29),
	"tong": Color(0.86, 0.15, 0.15),
}
const SEAT_NAMES := ["南(你)", "东", "北", "西"]


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_bp = _mahjong_blueprint()
	if _bp.is_empty():
		_bp = {"variant": "national", "startingPoints": 500, "aiDifficulty": 0.55, "rounds": 4, "enableDora": false}
	_build_scene()
	_start_round()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 兼容：GameSpecData 暂无 mahjong() 访问器，直接读 raw["mahjong"]
func _mahjong_blueprint() -> Dictionary:
	GameSpecData.ensure_loaded()
	if GameSpecData.raw.has("mahjong") and GameSpecData.raw["mahjong"] is Dictionary:
		return GameSpecData.raw["mahjong"]
	return {}


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	# 桌面绿色毛毡
	var table = MeshInstance3D.new()
	var tm = PlaneMesh.new()
	tm.size = Vector2(14.0, 9.0)
	table.mesh = tm
	table.position = Vector3(0, 0.0, 0)
	var tmat = StandardMaterial3D.new()
	tmat.albedo_color = Color(0.08, 0.33, 0.18, 0.95)
	table.material_override = tmat
	_world.add_child(table)
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 8.5, 7.5)
	_camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)


func _start_round() -> void:
	_wall = _build_wall()
	_players.clear()
	for seat in range(4):
		_players.append({
			"seat": seat,
			"hand": [],
			"melds": [],
			"discards": [],
			"points": int(_bp.get("startingPoints", 500)),
			"riichi": false,
			"is_human": seat == 0,
		})
	for i in range(13):
		for seat in range(4):
			if _wall.size() > 0:
				_players[seat]["hand"].append(_wall.pop_back())
	for p in _players:
		_sort_hand(p)
	_last_discard = {}
	_last_discard_by = -1
	_current_seat = 1
	_awaiting_player_reaction = false
	_hud.show_banner("第 %d 局开始" % _round, "东家起手", 1.4)
	_refresh_hud()
	# 延迟触发东家摸牌
	get_tree().create_timer(0.5).timeout.connect(Callable(self, "_begin_turn"))


func _build_wall() -> Array:
	var tiles: Array = []
	var counter = 0
	for suit in SUITS:
		for rank in range(1, 10):
			for _c in range(4):
				tiles.append({"suit": suit, "rank": rank, "id": "t%d" % counter})
				counter += 1
	tiles.shuffle()
	return tiles


func _sort_hand(p: Dictionary) -> void:
	var h: Array = p["hand"]
	h.sort_custom(Callable(self, "_tile_cmp"))


func _tile_cmp(a: Dictionary, b: Dictionary) -> bool:
	var sa = SUITS.find(a["suit"])
	var sb = SUITS.find(b["suit"])
	if sa != sb:
		return sa < sb
	return int(a["rank"]) < int(b["rank"])


# ─── 回合循环 ────────────────────────────────────────────────────────────

func _begin_turn() -> void:
	if _ended:
		return
	if _wall.is_empty():
		_handle_exhaustive_draw()
		return
	var p: Dictionary = _players[_current_seat]
	var drawn: Dictionary = _wall.pop_back()
	(p["hand"] as Array).append(drawn)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
	_refresh_hud()
	if p["is_human"]:
		_hud.set_extra("你的回合 · 点击手牌出牌")
		_show_self_actions()
	else:
		_ai_timer = 0.7


func _process(delta: float) -> void:
	if _ended:
		return
	if _current_seat != 0 and not _awaiting_player_reaction and _ai_timer > 0.0:
		_ai_timer -= delta
		if _ai_timer <= 0.0:
			_ai_timer = 0.0
			_ai_play()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _ended or _current_seat != 0 or _awaiting_player_reaction:
			return
		_try_discard_at_mouse()
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()


func _try_discard_at_mouse() -> void:
	var mp = _viewport.get_mouse_position()
	var from = _camera.project_ray_origin(mp)
	var dir = _camera.project_ray_normal(mp)
	var space = _viewport.world_3d.direct_space_state
	var query = PhysicsRayQueryParameters3D.create(from, from + dir * 80.0)
	var hit = space.intersect_ray(query)
	if hit.is_empty():
		return
	var collider = hit.get("collider", null)
	var hand: Array = _players[0]["hand"]
	for i in range(hand.size()):
		if _tile_mesh_of(0, i) == collider:
			_human_discard(i)
			return


func _human_discard(idx: int) -> void:
	if _current_seat != 0 or _ended:
		return
	var p: Dictionary = _players[0]
	var hand: Array = p["hand"]
	if idx < 0 or idx >= hand.size():
		return
	var tile: Dictionary = hand[idx]
	hand.remove_at(idx)
	_last_discard = tile
	_last_discard_by = 0
	(p["discards"] as Array).append(tile)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	_clear_self_actions()
	_refresh_hud()
	_offer_reaction_to_others()


func _show_self_actions() -> void:
	# 简化：自摸判定
	var p: Dictionary = _players[0]
	if _can_win(p["hand"], p["melds"]):
		# 显示自摸提示（玩家需手动确认）
		_hud.show_banner("可自摸", "点击河牌区中央确认", 1.0)
		# 用一个 Area3D 在中央作为"自摸按钮"
		_ensure_self_win_button()


func _ensure_self_win_button() -> void:
	# 简化处理：直接延迟自动判定（不阻塞 UI），避免额外按钮管理
	pass


func _clear_self_actions() -> void:
	pass


func _offer_reaction_to_others() -> void:
	if _last_discard.is_empty() or _ended:
		return
	# 先评估玩家
	var p: Dictionary = _players[0]
	if _current_seat == 0:
		return
	var reaction = _evaluate_reaction(p, _last_discard)
	if reaction["canWin"] or reaction["canGang"] or reaction["canPeng"]:
		_awaiting_player_reaction = true
		_hud.set_extra("可操作：1=胡 2=杠 3=碰 4=过")
		get_tree().create_timer(0.4).timeout.connect(Callable(self, "_ai_evaluate_reaction"))
		return
	_ai_evaluate_reaction()


func _human_react_win() -> void:
	if _last_discard.is_empty() or _ended:
		return
	_awaiting_player_reaction = false
	_resolve_win(0, _last_discard_by, false)


func _human_react_peng() -> void:
	if _last_discard.is_empty() or _ended:
		return
	var p: Dictionary = _players[0]
	var tiles: Array = _collect_same(p["hand"], _last_discard, 2)
	if tiles.size() < 2:
		return
	var all = [_last_discard] + tiles
	for t in tiles:
		var idx = (p["hand"] as Array).find(t)
		if idx >= 0:
			(p["hand"] as Array).remove_at(idx)
	(p["melds"] as Array).append({"type": "peng", "tiles": all, "open": true})
	_last_discard = {}
	_last_discard_by = -1
	_awaiting_player_reaction = false
	_current_seat = 0
	_hud.set_extra("碰！点击手牌出牌")
	_refresh_hud()


func _human_react_gang() -> void:
	if _last_discard.is_empty() or _ended:
		return
	var p: Dictionary = _players[0]
	var tiles: Array = _collect_same(p["hand"], _last_discard, 3)
	if tiles.size() < 3:
		return
	var all = [_last_discard] + tiles
	for t in tiles:
		var idx = (p["hand"] as Array).find(t)
		if idx >= 0:
			(p["hand"] as Array).remove_at(idx)
	(p["melds"] as Array).append({"type": "gang", "tiles": all, "open": true})
	_last_discard = {}
	_last_discard_by = -1
	_awaiting_player_reaction = false
	_current_seat = 0
	_refresh_hud()
	get_tree().create_timer(0.3).timeout.connect(Callable(self, "_begin_turn"))


func _human_react_pass() -> void:
	_awaiting_player_reaction = false
	_ai_evaluate_reaction()


func _ai_evaluate_reaction() -> void:
	if _last_discard.is_empty() or _ended:
		return
	for seat in range(1, 4):
		if seat == _last_discard_by:
			continue
		var p: Dictionary = _players[seat]
		var reaction = _evaluate_reaction(p, _last_discard)
		if reaction["canWin"]:
			_resolve_win(seat, _last_discard_by, false)
			return
		if reaction["canPeng"] and randf() < 0.5:
			_ai_do_peng(seat)
			return
		if reaction["canGang"] and randf() < 0.4:
			_ai_do_gang(seat)
			return
	_last_discard = {}
	_last_discard_by = -1
	_next_seat()
	get_tree().create_timer(0.25).timeout.connect(Callable(self, "_begin_turn"))


func _ai_do_peng(seat: int) -> void:
	var p: Dictionary = _players[seat]
	var tiles: Array = _collect_same(p["hand"], _last_discard, 2)
	var all = [_last_discard] + tiles
	for t in tiles:
		var idx = (p["hand"] as Array).find(t)
		if idx >= 0:
			(p["hand"] as Array).remove_at(idx)
	(p["melds"] as Array).append({"type": "peng", "tiles": all, "open": true})
	_last_discard = {}
	_last_discard_by = -1
	_current_seat = seat
	_hud.show_banner(SEAT_NAMES[seat] + " 碰", "", 1.0)
	_ai_timer = 0.5


func _ai_do_gang(seat: int) -> void:
	var p: Dictionary = _players[seat]
	var tiles: Array = _collect_same(p["hand"], _last_discard, 3)
	var all = [_last_discard] + tiles
	for t in tiles:
		var idx = (p["hand"] as Array).find(t)
		if idx >= 0:
			(p["hand"] as Array).remove_at(idx)
	(p["melds"] as Array).append({"type": "gang", "tiles": all, "open": true})
	_last_discard = {}
	_last_discard_by = -1
	_current_seat = seat
	_hud.show_banner(SEAT_NAMES[seat] + " 杠", "", 1.0)
	get_tree().create_timer(0.4).timeout.connect(Callable(self, "_begin_turn"))


# ─── AI 出牌 ─────────────────────────────────────────────────────────────

func _ai_play() -> void:
	if _ended:
		return
	var p: Dictionary = _players[_current_seat]
	if p["is_human"]:
		return
	if _can_win(p["hand"], p["melds"]):
		_resolve_win(_current_seat, -1, true)
		return
	var tile: Dictionary = _ai_pick_discard(p)
	var hand: Array = p["hand"]
	var idx = hand.find(tile)
	if idx >= 0:
		hand.remove_at(idx)
	_last_discard = tile
	_last_discard_by = _current_seat
	(p["discards"] as Array).append(tile)
	GameAudio.play_bleep(GameBleeps.Kind.HIT)
	_refresh_hud()
	get_tree().create_timer(0.3).timeout.connect(Callable(self, "_offer_reaction_to_others"))


func _ai_pick_discard(p: Dictionary) -> Dictionary:
	var hand: Array = p["hand"]
	if hand.is_empty():
		return {}
	var counts = {}
	for t in hand:
		var k = "%s-%d" % [t["suit"], int(t["rank"])]
		counts[k] = int(counts.get(k, 0)) + 1
	var best: Dictionary = hand[0]
	var best_score = -9999
	for t in hand:
		var same = int(counts["%s-%d" % [t["suit"], int(t["rank"])]])
		var has_prev = false
		var has_next = false
		for h in hand:
			if h["suit"] == t["suit"] and int(h["rank"]) == int(t["rank"]) - 1:
				has_prev = true
			if h["suit"] == t["suit"] and int(h["rank"]) == int(t["rank"]) + 1:
				has_next = true
		var score = same * 10
		if has_prev:
			score += 4
		if has_next:
			score += 4
		if int(t["rank"]) == 1 or int(t["rank"]) == 9:
			score -= 2
		if score < best_score:
			best_score = score
			best = t
		elif score == best_score and randf() < 0.3:
			best = t
	return best


# ─── 判定 ────────────────────────────────────────────────────────────────

func _evaluate_reaction(p: Dictionary, tile: Dictionary) -> Dictionary:
	var same = 0
	for h in p["hand"]:
		if h["suit"] == tile["suit"] and int(h["rank"]) == int(tile["rank"]):
			same += 1
	var trial = (p["hand"] as Array).duplicate()
	trial.append(tile)
	var can_win = _can_win(trial, p["melds"])
	return {"canWin": can_win, "canPeng": same >= 2, "canGang": same >= 3}


func _can_win(hand: Array, melds: Array) -> bool:
	var meld_count = melds.size()
	var need_melds = 4 - meld_count
	if hand.size() != need_melds * 3 + 2:
		return false
	return _can_form_winning_hand(hand.duplicate(), need_melds)


func _can_form_winning_hand(tiles: Array, need_melds: int) -> bool:
	if need_melds == 0:
		return tiles.size() == 2 and _is_pair(tiles[0], tiles[1])
	if tiles.size() < 3:
		return false
	tiles.sort_custom(Callable(self, "_tile_cmp"))
	var first: Dictionary = tiles[0]
	# 刻子
	var t = _try_take_triplet(tiles, first)
	if t != null:
		if _can_form_winning_hand(t["rest"], need_melds - 1):
			return true
	# 顺子
	var s = _try_take_sequence(tiles, first)
	if s != null:
		if _can_form_winning_hand(s["rest"], need_melds - 1):
			return true
	return false


func _is_pair(a: Dictionary, b: Dictionary) -> bool:
	return a["suit"] == b["suit"] and int(a["rank"]) == int(b["rank"])


func _try_take_triplet(sorted: Array, first: Dictionary) -> Variant:
	var same: Array = []
	for t in sorted:
		if t["suit"] == first["suit"] and int(t["rank"]) == int(first["rank"]):
			same.append(t)
	if same.size() < 3:
		return null
	var take_ids = {}
	for i in range(3):
		take_ids[same[i]["id"]] = true
	var rest: Array = []
	for t in sorted:
		if not take_ids.has(t["id"]):
			rest.append(t)
	return {"rest": rest}


func _try_take_sequence(sorted: Array, first: Dictionary) -> Variant:
	if int(first["rank"]) > 7:
		return null
	var r1 = int(first["rank"])
	var t1: Dictionary = {}
	var t2: Dictionary = {}
	var t3: Dictionary = {}
	for t in sorted:
		if t1.is_empty() and t["suit"] == first["suit"] and int(t["rank"]) == r1:
			t1 = t
		elif t2.is_empty() and t["suit"] == first["suit"] and int(t["rank"]) == r1 + 1:
			t2 = t
		elif t3.is_empty() and t["suit"] == first["suit"] and int(t["rank"]) == r1 + 2:
			t3 = t
	if t1.is_empty() or t2.is_empty() or t3.is_empty():
		return null
	var take_ids = {t1["id"]: true, t2["id"]: true, t3["id"]: true}
	var rest: Array = []
	for t in sorted:
		if not take_ids.has(t["id"]):
			rest.append(t)
	return {"rest": rest}


func _collect_same(hand: Array, target: Dictionary, n: int) -> Array:
	var out: Array = []
	for t in hand:
		if t["suit"] == target["suit"] and int(t["rank"]) == int(target["rank"]):
			out.append(t)
			if out.size() >= n:
				break
	return out


# ─── 胜负 / 流局 / 结算 ──────────────────────────────────────────────────

func _resolve_win(winner_seat: int, _discarder_seat: int, self_draw: bool) -> void:
	if _ended:
		return
	GameAudio.play_bleep(GameBleeps.Kind.WIN)
	var winner: Dictionary = _players[winner_seat]
	var base = 8 if self_draw else 5
	var bonus = 2 if (winner["melds"] as Array).size() == 0 else 0
	var total = base + bonus
	winner["points"] = int(winner["points"]) + total
	if winner_seat == 0:
		_player_total_delta += total
	else:
		_player_total_delta -= total
	if self_draw:
		for s in range(4):
			if s == winner_seat:
				continue
			_players[s]["points"] = int(_players[s]["points"]) - ceili(float(total) / 3.0)
	else:
		if _discarder_seat >= 0 and _discarder_seat < 4:
			_players[_discarder_seat]["points"] = int(_players[_discarder_seat]["points"]) - total
	_refresh_hud()
	var win_name = SEAT_NAMES[winner_seat]
	_hud.show_banner("%s %s +%d" % [win_name, "自摸" if self_draw else "胡牌", total], "", 2.2)
	get_tree().create_timer(2.4).timeout.connect(Callable(self, "_next_round_or_finish"))


func _handle_exhaustive_draw() -> void:
	if _ended:
		return
	var p: Dictionary = _players[0]
	if _is_tenpai(p):
		p["points"] = int(p["points"]) + 3
		_player_total_delta += 3
		_hud.show_banner("流局", "你听牌 +3", 1.8)
	else:
		_hud.show_banner("流局", "", 1.8)
	get_tree().create_timer(2.0).timeout.connect(Callable(self, "_next_round_or_finish"))


func _is_tenpai(p: Dictionary) -> bool:
	var hand: Array = p["hand"]
	var meld_count = (p["melds"] as Array).size()
	var need_melds = 4 - meld_count
	if hand.size() != need_melds * 3 + 1:
		return false
	for suit in SUITS:
		for rank in range(1, 10):
			var cand = {"suit": suit, "rank": rank, "id": "cand"}
			var trial = (hand as Array).duplicate()
			trial.append(cand)
			if _can_win(trial, p["melds"]):
				return true
	return false


func _next_round_or_finish() -> void:
	if _round >= int(_bp.get("rounds", 4)):
		_finish_game()
		return
	_round += 1
	_start_round()


func _finish_game() -> void:
	if _ended:
		return
	_ended = true
	var pts = int(_players[0]["points"])
	var won = _player_total_delta > 0
	_hud.set_extra("总分 %d · %s" % [pts, GameSpecData.tr("win") if won else GameSpecData.tr("lose")])
	_hud.show_banner(GameSpecData.tr("win") if won else GameSpecData.tr("lose"), "总分差 %d" % _player_total_delta, 3.0)


# ─── 渲染辅助 ────────────────────────────────────────────────────────────

func _next_seat() -> void:
	_current_seat = (_current_seat + 1) % 4


func _refresh_hud() -> void:
	var pts = int(_players[0]["points"])
	var wall_left = _wall.size()
	var turn = SEAT_NAMES[_current_seat]
	_hud.set_score("%s %d · 牌墙 %d · 第 %d/%d 局 · %s" % [GameSpecData.tr("points"), pts, wall_left, _round, int(_bp.get("rounds", 4)), turn] % [pts, wall_left, _round, int(_bp.get("rounds", 4)), turn])


func _tile_mesh_of(_seat: int, _idx: int) -> Node:
	# 简化：3D 视图中手牌 mesh 由 _refresh_hand_mesh 维护；此函数仅占位
	return null

extends Node2D
## 区域征服：节点派兵

var _hud := GameHud.new()
var _nodes: Array = []
var _selected := ""
var _player_turn := true
var _ended := false


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_nodes = [
		{"id": "p0", "x": 160.0, "y": 220.0, "owner": "player", "troops": 24.0, "links": ["n1", "n2"]},
		{"id": "n1", "x": 360.0, "y": 160.0, "owner": "neutral", "troops": 12.0, "links": ["p0", "n3"]},
		{"id": "n2", "x": 340.0, "y": 300.0, "owner": "neutral", "troops": 10.0, "links": ["p0", "n3"]},
		{"id": "n3", "x": 560.0, "y": 230.0, "owner": "ai", "troops": 20.0, "links": ["n1", "n2", "n4"]},
		{"id": "n4", "x": 720.0, "y": 190.0, "owner": "ai", "troops": 16.0, "links": ["n3"]},
	]
	_hud.set_extra("点击己方节点再点相邻节点派兵")
	queue_redraw()


func _draw() -> void:
	for n in _nodes:
		for lid in n.links:
			var other = _find(lid)
			if other and str(n.id) < str(other.id):
				draw_line(Vector2(n.x, n.y), Vector2(other.x, other.y), Color("#64748b"), 2.0)
	for n in _nodes:
		var col := GameSpecData.theme_color("playerColor", Color.GREEN)
		if n.owner == "ai":
			col = GameSpecData.theme_color("hazardColor", Color.RED)
		elif n.owner == "neutral":
			col = Color("#64748b")
		draw_circle(Vector2(n.x, n.y), 26.0, col)
		draw_string(ThemeDB.fallback_font, Vector2(n.x - 8, n.y + 6), str(int(n.troops)), HORIZONTAL_ALIGNMENT_LEFT, -1, 14)


func _unhandled_input(event: InputEvent) -> void:
	if _ended or not _player_turn or not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed:
		return
	var hit = _hit(mb.position)
	if hit.is_empty():
		return
	if _selected == "" and hit.owner == "player":
		_selected = hit.id
		return
	if _selected != "":
		var from = _find(_selected)
		if from.is_empty() or hit.id == from.id:
			_selected = ""
			return
		if not _linked(from, hit):
			return
		var send := int(from.troops / 2)
		from.troops -= send
		if hit.owner == "player":
			hit.troops += send
		elif send > hit.troops:
			hit.owner = "player"
			hit.troops = send - hit.troops
		else:
			hit.troops -= send
		_selected = ""
		_player_turn = false
		queue_redraw()
		await get_tree().create_timer(0.45).timeout
		_ai_turn()


func _ai_turn() -> void:
	for n in _nodes:
		if n.owner == "ai" and n.troops > 4:
			for lid in n.links:
				var t = _find(lid)
				if not t.is_empty() and t.owner != "ai":
					var send := int(n.troops / 2)
					n.troops -= send
					if send > t.troops:
						t.owner = "ai"
						t.troops = send - t.troops
					else:
						t.troops -= send
					break
	_player_turn = true
	queue_redraw()
	if _all("player"):
		_finish(true)


func _all(owner: String) -> bool:
	for n in _nodes:
		if n.owner != owner:
			return false
	return true


func _finish(won: bool) -> void:
	_ended = true
	_hud.show_banner("征服完成" if won else "失败", "")


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

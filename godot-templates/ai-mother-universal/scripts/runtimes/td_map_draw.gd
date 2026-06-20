extends Node2D
## 塔防地图：棋盘草地 + 立体石板路 + 起点/萝卜基地

var _bg = Color("#1a2220")
var _grass_a = Color("#3d5c45")
var _grass_b = Color("#4a6b52")
var _path_col = Color("#c4a574")
var _path_pts: PackedVector2Array = PackedVector2Array()
var _pulse = 0.0
var _use_carrot = false
var _protagonist_tex: Texture2D = null


func set_protagonist_texture(tex: Texture2D) -> void:
	_protagonist_tex = tex
	queue_redraw()


func set_map_colors(bg: Color, ga: Color, gb: Color, path_c: Color, pts: PackedVector2Array) -> void:
	_bg = bg
	_grass_a = ga
	_grass_b = gb
	_path_col = path_c
	_path_pts = pts
	var coll = GameSpecData.labels("collectible", "").to_lower()
	var title = GameSpecData.title().to_lower()
	_use_carrot = "萝卜" in coll or "carrot" in coll or "萝卜" in title
	queue_redraw()


func _process(delta: float) -> void:
	_pulse += delta
	queue_redraw()


func _draw() -> void:
	draw_rect(Rect2(0, 0, 800, 600), _bg)
	# 草地棋盘 + 花草点缀
	for x in range(0, 800, 40):
		for y in range(0, 600, 40):
			var c = _grass_a if ((x + y) / 40) % 2 == 0 else _grass_b
			draw_rect(Rect2(x, y, 40, 40), c)
			if (x + y * 3) % 97 == 0:
				draw_circle(Vector2(x + 12, y + 10), 3.0, _grass_b.lightened(0.15))
				draw_circle(Vector2(x + 22, y + 18), 2.0, Color(0.9, 0.75, 0.4, 0.5))
	if _path_pts.size() >= 2:
		# 路缘阴影
		draw_polyline(_path_pts, _path_col.darkened(0.45), 24.0, true)
		# 石板路
		draw_polyline(_path_pts, _path_col, 15.0, true)
		draw_polyline(_path_pts, _path_col.lightened(0.12), 8.0, true)
		# 起点
		var start = _path_pts[0]
		draw_circle(start, 22.0, Color(1, 0.75, 0.2, 0.2))
		draw_arc(start, 20.0, 0, TAU, 28, Color(1, 0.85, 0.35, 0.75), 2.0)
		# 终点基地
		var end = _path_pts[_path_pts.size() - 1]
		draw_circle(end, 34.0 + sin(_pulse * 2.0) * 2.0, Color(1, 0.9, 0.5, 0.1))
		if _protagonist_tex:
			var sz = _protagonist_tex.get_size()
			var sc = 48.0 / maxf(sz.x, sz.y)
			draw_texture_rect(
				_protagonist_tex,
				Rect2(end.x - sz.x * sc / 2, end.y - sz.y * sc / 2, sz.x * sc, sz.y * sc),
				false,
			)
		elif _use_carrot:
			_draw_carrot_at(end)
		else:
			var pc = GameSpecData.theme_color("playerColor", Color.GREEN)
			var cc = GameSpecData.theme_color("collectibleColor", Color.GOLD)
			draw_circle(end, 22.0, cc)
			draw_rect(Rect2(end.x - 16, end.y - 20, 32, 34), pc, true)
			draw_circle(end, 8.0, cc)


func _draw_carrot_at(p: Vector2) -> void:
	draw_colored_polygon(
		PackedVector2Array([p + Vector2(0, -22), p + Vector2(-12, 10), p + Vector2(12, 10)]),
		Color("#ff8c42"),
	)
	draw_colored_polygon(
		PackedVector2Array([p + Vector2(-6, -26), p + Vector2(-2, -12), p + Vector2(-10, -14)]),
		Color("#5cb83a"),
	)
	draw_colored_polygon(
		PackedVector2Array([p + Vector2(6, -26), p + Vector2(2, -12), p + Vector2(10, -14)]),
		Color("#5cb83a"),
	)
	var lbl = GameSpecData.labels("collectible", "基地")
	if lbl.length() > 8:
		lbl = lbl.substr(0, 6)
	# 简易标签用 draw_string 需字体 — 略过，HUD 已有标题

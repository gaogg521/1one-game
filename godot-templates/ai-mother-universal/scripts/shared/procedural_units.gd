class_name ProceduralUnits
extends RefCounted
## 保卫萝卜风格程序化单位绘制（在 Node2D._draw 内调用）


static func _hex(c: Color, dr: int, dg: int, db: int) -> Color:
	return Color(
		clampf(c.r + dr / 255.0, 0, 1),
		clampf(c.g + dg / 255.0, 0, 1),
		clampf(c.b + db / 255.0, 0, 1),
		c.a,
	)


static func draw_build_slot(node: Node2D, selected: bool, pulse: float) -> void:
	var a := 0.28 + sin(pulse * 3.0) * 0.08
	var col := Color(0.35, 0.92, 0.48, a) if selected else Color(0.35, 0.75, 0.42, a * 0.75)
	node.draw_circle(Vector2.ZERO, 26.0, col.darkened(0.25))
	node.draw_arc(Vector2.ZERO, 24.0, 0, TAU, 32, col, 2.5)
	# 建造箭头
	node.draw_colored_polygon(
		PackedVector2Array([Vector2(0, -10), Vector2(-7, 4), Vector2(7, 4)]),
		Color(1, 1, 1, 0.85),
	)


static func draw_tower(node: Node2D, style: String, level: int) -> void:
	var base := GameSpecData.theme_color("playerColor", Color("#6db33f"))
	match style:
		"splash":
			_draw_tower_splash(node, base, level)
		"frost":
			_draw_tower_frost(node, base, level)
		_:
			_draw_tower_dart(node, base, level)


static func _draw_tower_dart(node: Node2D, base: Color, level: int) -> void:
	var dark := _hex(base, -50, -55, -45)
	var light := _hex(base, 40, 50, 35)
	node.draw_circle(Vector2(0, 6), 20.0, dark)
	node.draw_circle(Vector2(0, 4), 18.0, base)
	node.draw_circle(Vector2(-5, 0), 5.0, light)
	# 眼睛
	node.draw_circle(Vector2(-5, -2), 3.2, Color(0.1, 0.1, 0.15))
	node.draw_circle(Vector2(5, -2), 3.2, Color(0.1, 0.1, 0.15))
	node.draw_circle(Vector2(-4, -3), 1.2, Color.WHITE)
	node.draw_circle(Vector2(6, -3), 1.2, Color.WHITE)
	# 头顶芽
	node.draw_colored_polygon(
		PackedVector2Array([Vector2(0, -22), Vector2(-8, -10), Vector2(8, -10)]),
		_hex(base, 20, 40, 10),
	)
	if level >= 2:
		node.draw_circle(Vector2(12, -8), 4.0, Color.GOLD)


static func _draw_tower_splash(node: Node2D, base: Color, level: int) -> void:
	var fire := GameSpecData.theme_color("hazardColor", Color("#e85c40"))
	var dark := _hex(fire, -60, -50, -40)
	node.draw_circle(Vector2(0, 8), 22.0, dark)
	node.draw_circle(Vector2(0, 6), 20.0, fire)
	node.draw_circle(Vector2(0, -6), 10.0, Color(1.0, 0.9, 0.3, 0.9))
	node.draw_colored_polygon(
		PackedVector2Array([
			Vector2(-6, -14), Vector2(0, -22), Vector2(6, -14), Vector2(0, -8),
		]),
		Color(1.0, 0.55, 0.1),
	)
	node.draw_circle(Vector2(-6, 2), 3.0, Color(0.12, 0.12, 0.18))
	node.draw_circle(Vector2(6, 2), 3.0, Color(0.12, 0.12, 0.18))
	if level >= 2:
		node.draw_arc(Vector2.ZERO, 26.0, 0, TAU, 24, Color(1, 0.6, 0.2, 0.35), 2.0)


static func _draw_tower_frost(node: Node2D, base: Color, level: int) -> void:
	var ice := Color("#7ec8e8")
	var dark := _hex(ice, -50, -50, -30)
	node.draw_circle(Vector2(0, 8), 21.0, dark)
	node.draw_circle(Vector2(0, 6), 19.0, ice)
	# 冰晶顶
	for i in range(6):
		var a := float(i) / 6.0 * TAU - PI / 2.0
		node.draw_line(Vector2.ZERO, Vector2(cos(a) * 16, sin(a) * 16 - 8), Color.WHITE, 2.0)
	node.draw_circle(Vector2(-5, 0), 3.0, Color(0.1, 0.15, 0.25))
	node.draw_circle(Vector2(5, 0), 3.0, Color(0.1, 0.15, 0.25))
	if level >= 2:
		node.draw_circle(Vector2.ZERO, 24.0, Color(0.7, 0.9, 1.0, 0.15))


static func draw_enemy(node: Node2D, enemy_id: String, hp_ratio: float, slowed: bool) -> void:
	var body := GameSpecData.theme_color("hazardColor", Color("#c06040"))
	if slowed:
		body = body.lerp(Color("#7ec8e8"), 0.45)
	match enemy_id:
		"tank":
			_draw_enemy_tank(node, body)
		"runner":
			_draw_enemy_runner(node, body)
		_:
			_draw_enemy_grunt(node, body)
	# 血条
	var bw := 28.0
	node.draw_rect(Rect2(-bw / 2, -28, bw, 4), Color(0, 0, 0, 0.45))
	node.draw_rect(Rect2(-bw / 2, -28, bw * clampf(hp_ratio, 0, 1), 4), Color(0.3, 0.9, 0.35))


static func _draw_enemy_grunt(node: Node2D, body: Color) -> void:
	var dark := _hex(body, -55, -55, -55)
	var light := _hex(body, 50, 50, 50)
	node.draw_circle(Vector2(0, 4), 16.0, dark)
	node.draw_circle(Vector2(0, 2), 15.0, body)
	node.draw_circle(Vector2(-4, -2), 4.0, Color(0.12, 0.12, 0.2))
	node.draw_circle(Vector2(4, -2), 4.0, Color(0.12, 0.12, 0.2))
	node.draw_circle(Vector2(-3, -3), 1.5, Color.WHITE)
	node.draw_circle(Vector2(5, -3), 1.5, Color.WHITE)
	node.draw_circle(Vector2(-10, -6), 6.0, dark)
	node.draw_circle(Vector2(10, -6), 6.0, dark)
	node.draw_circle(Vector2(-10, -6), 3.5, light)
	node.draw_circle(Vector2(10, -6), 3.5, light)


static func _draw_enemy_tank(node: Node2D, body: Color) -> void:
	var plate := Color("#5a6a7a")
	node.draw_rounded_rect(Rect2(-20, -8, 40, 28), 6, 6, plate.darkened(0.3))
	node.draw_rounded_rect(Rect2(-18, -6, 36, 24), 5, 5, plate)
	node.draw_rect(Rect2(-22, 2, 10, 16), plate.darkened(0.2))
	node.draw_rect(Rect2(12, 2, 10, 16), plate.darkened(0.2))
	node.draw_circle(Vector2(0, -6), 5.0, Color(1, 0.3, 0.25))
	node.draw_rect(Rect2(-14, 14, 28, 6), plate.darkened(0.35))


static func _draw_enemy_runner(node: Node2D, body: Color) -> void:
	var dark := _hex(body, -40, -40, -40)
	node.draw_circle(Vector2(0, 6), 12.0, dark)
	node.draw_circle(Vector2(0, 4), 11.0, body)
	node.draw_circle(Vector2(-4, 0), 3.0, Color(0.1, 0.1, 0.15))
	node.draw_circle(Vector2(4, 0), 3.0, Color(0.1, 0.1, 0.15))
	node.draw_line(Vector2(-12, 12), Vector2(-18, 18), dark, 3.0)
	node.draw_line(Vector2(12, 12), Vector2(18, 18), dark, 3.0)


static func draw_starship(node: Node2D, body: Color) -> void:
	var dark := _hex(body, -45, -50, -55)
	var light := _hex(body, 55, 60, 70)
	var wing := _hex(body, -20, -25, -15)
	node.draw_colored_polygon(
		PackedVector2Array([Vector2(0, -20), Vector2(-22, 14), Vector2(-8, 10), Vector2(0, 4), Vector2(8, 10), Vector2(22, 14)]),
		body,
	)
	node.draw_colored_polygon(PackedVector2Array([Vector2(0, -16), Vector2(-6, 2), Vector2(6, 2)]), light)
	node.draw_rect(Rect2(-5, -6, 10, 14), dark)
	node.draw_colored_polygon(PackedVector2Array([Vector2(-18, 8), Vector2(-26, 16), Vector2(-10, 12)]), wing)
	node.draw_colored_polygon(PackedVector2Array([Vector2(18, 8), Vector2(26, 16), Vector2(10, 12)]), wing)
	node.draw_circle(Vector2(0, -10), 4.0, Color(0.75, 0.92, 1.0, 0.9))


static func draw_interceptor(node: Node2D, body: Color, elite: bool = false) -> void:
	var dark := _hex(body, -50, -45, -40)
	node.draw_colored_polygon(
		PackedVector2Array([Vector2(0, 16), Vector2(-14, -8), Vector2(-4, -2), Vector2(4, -2), Vector2(14, -8)]),
		body,
	)
	node.draw_colored_polygon(PackedVector2Array([Vector2(0, 10), Vector2(-3, -2), Vector2(3, -2)]), dark)
	if elite:
		node.draw_rect(Rect2(-16, -4, 32, 6), Color(1.0, 0.55, 0.2, 0.85))


static func draw_goal_carrot(node: Node2D) -> void:
	var goal := node.global_position if false else Vector2.ZERO
	node.draw_circle(goal, 36.0, Color(1, 0.85, 0.4, 0.12))
	node.draw_colored_polygon(
		PackedVector2Array([
			goal + Vector2(0, -24), goal + Vector2(-14, 12), goal + Vector2(14, 12),
		]),
		Color("#ff8c42"),
	)
	node.draw_colored_polygon(
		PackedVector2Array([
			goal + Vector2(-8, -28), goal + Vector2(-4, -14), goal + Vector2(-12, -16),
		]),
		Color("#5cb83a"),
	)
	node.draw_colored_polygon(
		PackedVector2Array([
			goal + Vector2(8, -28), goal + Vector2(4, -14), goal + Vector2(12, -16),
		]),
		Color("#5cb83a"),
	)


static func tower_style_from_def(def: Dictionary) -> String:
	if float(def.get("slowPct", 0)) > 0.05:
		return "frost"
	if float(def.get("splashRadius", 0)) > 1.0:
		return "splash"
	var id := str(def.get("id", "")).to_lower()
	if "frost" in id or "ice" in id or "冰" in id:
		return "frost"
	if "splash" in id or "bomb" in id or "炸" in id:
		return "splash"
	return "dart"

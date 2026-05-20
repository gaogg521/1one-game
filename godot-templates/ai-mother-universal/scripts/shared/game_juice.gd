class_name GameJuice
extends RefCounted
## 双轨「手感」：震屏、闪屏、粒子爆散（对标 Phaser shake/flash/burst）

static func find_main(root: Node) -> Node:
	var n: Node = root
	while n:
		if n.name == "Main":
			return n
		n = n.get_parent()
	if root.get_tree():
		return root.get_tree().root
	return null


static func shake_node(node: Node2D, amount: float = 5.0, duration: float = 0.14) -> void:
	if node == null or not is_instance_valid(node):
		return
	var orig := node.position
	var tw := node.create_tween()
	tw.set_trans(Tween.TRANS_SINE)
	var step := duration / 5.0
	for _i in range(4):
		tw.tween_property(
			node,
			"position",
			orig + Vector2(randf_range(-amount, amount), randf_range(-amount, amount)),
			step
		)
	tw.tween_property(node, "position", orig, step)


static func flash_background(root: Node, tint: Color = Color(1, 0.95, 0.75), strength: float = 0.28) -> void:
	var main := find_main(root)
	if main == null:
		return
	var bg := main.get_node_or_null("Background") as ColorRect
	if bg == null:
		return
	var base := bg.modulate
	var peak := Color(
		base.r + (tint.r - base.r) * strength,
		base.g + (tint.g - base.g) * strength,
		base.b + (tint.b - base.b) * strength,
		1.0
	)
	var tw := bg.create_tween()
	tw.tween_property(bg, "modulate", peak, 0.06)
	tw.tween_property(bg, "modulate", base, 0.14)


static func burst(parent: Node2D, at: Vector2, color: Color, count: int = 8) -> void:
	if parent == null or not is_instance_valid(parent):
		return
	var layer := Node2D.new()
	layer.position = at
	layer.z_index = 80
	parent.add_child(layer)
	for i in count:
		var dot := ColorRect.new()
		dot.size = Vector2(5, 5)
		dot.position = Vector2(-2.5, -2.5)
		dot.color = color
		layer.add_child(dot)
		var ang := randf() * TAU
		var dist := randf_range(18.0, 46.0)
		var tw := layer.create_tween().set_parallel(true)
		tw.tween_property(dot, "position", Vector2(-2.5, -2.5) + Vector2(cos(ang), sin(ang)) * dist, 0.32)
		tw.tween_property(dot, "modulate:a", 0.0, 0.32)
	var tree := layer.get_tree()
	if tree:
		tree.create_timer(0.38).timeout.connect(layer.queue_free, CONNECT_ONE_SHOT)

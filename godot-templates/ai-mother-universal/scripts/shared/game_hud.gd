class_name GameHud
extends RefCounted

var title: Label
var subtitle: Label
var score: Label
var extra: Label
var banner: Label
var _banner_title: Label
var _banner_msg: Label

var _banner_timer: SceneTreeTimer


func bind(root: Node) -> void:
	var hud := root.get_node_or_null("HUD")
	if hud == null:
		return
	title = hud.get_node_or_null("Title") as Label
	subtitle = hud.get_node_or_null("Subtitle") as Label
	score = hud.get_node_or_null("Score") as Label
	extra = hud.get_node_or_null("Extra") as Label
	banner = hud.get_node_or_null("Banner") as Label
	_banner_title = hud.get_node_or_null("BannerTitle") as Label
	_banner_msg = hud.get_node_or_null("BannerMessage") as Label
	if banner:
		banner.visible = false
	if _banner_title:
		_banner_title.visible = false
	if _banner_msg:
		_banner_msg.visible = false
	_apply_ui_fonts()


func _apply_ui_fonts() -> void:
	GameUiFont.apply_labels([title, subtitle, score, extra, banner, _banner_title, _banner_msg])


func apply_meta() -> void:
	if title:
		title.text = GameSpecData.title()
	if subtitle:
		subtitle.text = GameSpecData.subtitle()


func set_score(text: String) -> void:
	if score:
		score.text = text


func set_extra(text: String) -> void:
	if extra:
		extra.text = text


func show_banner(banner_title: String, message: String = "", seconds: float = 2.2) -> void:
	_hide_banner_nodes()
	if _banner_title:
		_banner_title.text = banner_title
		_banner_title.modulate.a = 0.0
		_banner_title.visible = true
		var tw := _banner_title.create_tween()
		tw.tween_property(_banner_title, "modulate:a", 1.0, 0.14)
	if _banner_msg:
		_banner_msg.text = message
		_banner_msg.modulate.a = 0.0
		_banner_msg.visible = message != ""
		if message != "":
			var tw2 := _banner_msg.create_tween()
			tw2.tween_property(_banner_msg, "modulate:a", 1.0, 0.18)
	elif banner:
		banner.text = "%s\n%s" % [banner_title, message] if message else banner_title
		banner.modulate.a = 0.0
		banner.visible = true
		var twb := banner.create_tween()
		twb.tween_property(banner, "modulate:a", 1.0, 0.14)
	_schedule_hide(seconds)


func flash_banner(text: String, seconds: float = 2.0) -> void:
	show_banner(text, "", seconds)


func _hide_banner_nodes() -> void:
	if banner:
		banner.visible = false
	if _banner_title:
		_banner_title.visible = false
	if _banner_msg:
		_banner_msg.visible = false


func _schedule_hide(seconds: float) -> void:
	var tree: SceneTree = null
	if _banner_title:
		tree = _banner_title.get_tree()
	elif banner:
		tree = banner.get_tree()
	if tree == null:
		return
	if _banner_timer and _banner_timer.time_left > 0.0:
		_banner_timer.timeout.disconnect(_fade_out_banner)
	_banner_timer = tree.create_timer(seconds)
	_banner_timer.timeout.connect(_fade_out_banner, CONNECT_ONE_SHOT)


func _fade_out_banner() -> void:
	var nodes: Array[CanvasItem] = []
	if _banner_title and _banner_title.visible:
		nodes.append(_banner_title)
	if _banner_msg and _banner_msg.visible:
		nodes.append(_banner_msg)
	if banner and banner.visible:
		nodes.append(banner)
	if nodes.is_empty():
		return
	var tree := nodes[0].get_tree()
	if tree == null:
		_hide_banner_nodes()
		return
	var tw := tree.create_tween().set_parallel(true)
	for n in nodes:
		tw.tween_property(n, "modulate:a", 0.0, 0.2)
	tw.finished.connect(_hide_banner_nodes, CONNECT_ONE_SHOT)

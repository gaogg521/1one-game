extends Node2D
## 物理发泄：点击 dummy 施加冲量

@onready var _dummy: RigidBody2D = $Dummy
@onready var _floor: StaticBody2D = $Floor

var _hud := GameHud.new()
var _score := 0
var _combo := 0
var _combo_until := 0.0
var _win := 500
var _ended := false


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_win = GameSpecData.gameplay_i("winScore", 500)
	var vis := _dummy.get_node_or_null("Visual") as ColorRect
	if vis:
		vis.color = GameSpecData.theme_color("playerColor", Color.ORANGE)
	var floor_shape := RectangleShape2D.new()
	floor_shape.size = Vector2(920, 48)
	var fc := _floor.get_node_or_null("CollisionShape2D") as CollisionShape2D
	if fc:
		fc.shape = floor_shape
	var body_shape := RectangleShape2D.new()
	body_shape.size = Vector2(72, 120)
	var dc := _dummy.get_node_or_null("CollisionShape2D") as CollisionShape2D
	if dc:
		dc.shape = body_shape
	_dummy.contact_monitor = true
	_dummy.max_contacts_reported = 4
	_hud.set_extra("点击假人猛击 · 连击加分 · 目标 %d" % _win)


func _unhandled_input(event: InputEvent) -> void:
	if _ended:
		return
	if not event is InputEventMouseButton:
		return
	var mb := event as InputEventMouseButton
	if not mb.pressed:
		return
	var local := _dummy.to_local(mb.position)
	if local.length() > 120.0:
		return
	var dir := local.normalized()
	var force := clampf(280.0 - local.length(), 120.0, 420.0)
	_dummy.apply_central_impulse(dir * force + Vector2(0, -80))
	var now := Time.get_ticks_msec() / 1000.0
	if now < _combo_until:
		_combo += 1
	else:
		_combo = 1
	_combo_until = now + 0.9
	_score += 20 + _combo * 8
	_hud.set_score("得分 %d · 连击 x%d" % [_score, _combo])
	GameJuice.shake_node(_dummy, 4.0 + _combo * 0.8, 0.12)
	if _score >= _win:
		_finish(true)


func _finish(won: bool) -> void:
	if _ended:
		return
	_ended = true
	_hud.show_banner("解压达成" if won else "结束", "得分 %d" % _score)

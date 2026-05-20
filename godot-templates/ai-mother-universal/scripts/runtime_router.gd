extends Node2D
## 按 GameSpec.templateId 挂载专业运行时场景

const RUNTIMES := {
	"platformer": preload("res://scenes/runtimes/platformer.tscn"),
	"avoider": preload("res://scenes/runtimes/arena.tscn"),
	"collector": preload("res://scenes/runtimes/arena.tscn"),
	"survivor": preload("res://scenes/runtimes/arena.tscn"),
	"shooter": preload("res://scenes/runtimes/shooter.tscn"),
	"towerDefense": preload("res://scenes/runtimes/tower_defense.tscn"),
}

@onready var _mount: Node2D = $RuntimeMount
@onready var _background: ColorRect = $Background
@onready var _ref_backdrop: Sprite2D = $ReferenceBackdrop


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_background.color = GameSpecData.theme_color("backgroundColor", Color("#1a2220"))
	RuntimeReferenceBackdrop.apply(_ref_backdrop, _background)
	var tid := GameSpecData.template_id()
	var packed: PackedScene = RUNTIMES.get(tid, RUNTIMES["avoider"])
	var inst := packed.instantiate()
	_mount.add_child(inst)
	_apply_hud()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()

func _apply_hud() -> void:
	var title := $HUD/Title as Label
	var sub := $HUD/Subtitle as Label
	var score := $HUD/Score as Label
	var extra := $HUD/Extra as Label
	var banner_title := $HUD/BannerTitle as Label
	var banner_msg := $HUD/BannerMessage as Label
	GameUiFont.apply_labels([title, sub, score, extra, banner_title, banner_msg])
	if title:
		title.text = GameSpecData.title()
	if sub:
		sub.text = GameSpecData.subtitle()

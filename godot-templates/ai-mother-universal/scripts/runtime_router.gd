extends Node2D
## 按 GameSpec.templateId 挂载专业运行时场景

const RUNTIMES := {
	"platformer": preload("res://scenes/runtimes/platformer.tscn"),
	"avoider": preload("res://scenes/runtimes/arena.tscn"),
	"collector": preload("res://scenes/runtimes/arena.tscn"),
	"survivor": preload("res://scenes/runtimes/arena.tscn"),
	"shooter": preload("res://scenes/runtimes/shooter.tscn"),
	"towerDefense": preload("res://scenes/runtimes/tower_defense.tscn"),
	"coaster": preload("res://scenes/runtimes/coaster.tscn"),
	"puzzle": preload("res://scenes/runtimes/puzzle.tscn"),
	"farming": preload("res://scenes/runtimes/farming.tscn"),
	"physics": preload("res://scenes/runtimes/physics.tscn"),
	"chess": preload("res://scenes/runtimes/chess.tscn"),
	"customization": preload("res://scenes/runtimes/customization.tscn"),
	"strategy": preload("res://scenes/runtimes/strategy.tscn"),
	"rhythm": preload("res://scenes/runtimes/rhythm.tscn"),
	"sports": preload("res://scenes/runtimes/sports.tscn"),
	"card": preload("res://scenes/runtimes/card.tscn"),
	"fighting": preload("res://scenes/runtimes/fighting.tscn"),
	"moba": preload("res://scenes/runtimes/moba.tscn"),
	"horror": preload("res://scenes/runtimes/horror.tscn"),
	"mahjong": preload("res://scenes/runtimes/mahjong.tscn"),
	"tetris": preload("res://scenes/runtimes/tetris.tscn"),
	"endlessRunner": preload("res://scenes/runtimes/endless_runner.tscn"),
	"fruitNinja": preload("res://scenes/runtimes/fruit_ninja.tscn"),
	"mahjongSolitaire": preload("res://scenes/runtimes/mahjong_solitaire.tscn"),
	"douDizhu": preload("res://scenes/runtimes/dou_dizhu.tscn"),
	"breakout": preload("res://scenes/runtimes/breakout.tscn"),
	"merge2048": preload("res://scenes/runtimes/merge_2048.tscn"),
}

@onready var _mount: Node2D = $RuntimeMount
@onready var _background: ColorRect = $Background
@onready var _ref_backdrop: Sprite2D = $ReferenceBackdrop


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_background.color = GameSpecData.theme_color("backgroundColor", Color("#1a2220"))
	RuntimeReferenceBackdrop.apply(_ref_backdrop, _background)
	var tid := GameSpecData.godot_runtime_key()
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

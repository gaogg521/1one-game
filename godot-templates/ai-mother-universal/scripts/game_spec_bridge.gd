class_name GameSpecBridge
extends Node
## 与平台 GameSpec JSON 对齐；codegen 会 patch 下列 @export。

@export_group("Meta")
@export var template_id: String = "platformer"
@export var game_title: String = "AI Mother Universal"
@export var subtitle: String = "GameSpec → Godot"

@export_group("Theme")
@export var background_color: Color = Color("#1a2220")
@export var player_color: Color = Color("#8faf8c")
@export var hazard_color: Color = Color("#a65f3f")
@export var collectible_color: Color = Color("#c9a66b")

@export_group("Gameplay")
@export var player_speed: float = 280.0
@export var hazard_speed: float = 200.0
@export var spawn_interval_ms: float = 800.0
@export var jump_strength: float = 420.0
@export var gravity_override: float = 980.0
@export var win_score: int = 10
@export var lives: int = 3

@export_group("Labels")
@export var label_player: String = "旅行者"
@export var label_hazard: String = "障碍"
@export var label_collectible: String = "收集物"


func apply_to_main(main: Node2D) -> void:
	if main == null:
		return
	var bg := main.get_node_or_null("Background") as ColorRect
	if bg:
		bg.color = background_color
	var hud := main.get_node_or_null("HUD/Title") as Label
	if hud:
		hud.text = game_title
	var sub := main.get_node_or_null("HUD/Subtitle") as Label
	if sub:
		sub.text = subtitle

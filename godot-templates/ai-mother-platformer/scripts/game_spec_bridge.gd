class_name GameSpecBridge
extends Node
## 与平台 GameSpec JSON 字段对齐的 @export 桥接层。
## Codegen 第一阶段只改本节点上的 export，避免动场景树结构。

@export_group("Meta")
@export var game_title: String = "AI Mother Platformer"
@export var subtitle: String = "GameSpec → Godot PoC"

@export_group("Theme")
@export var background_color: Color = Color("#1a2220")
@export var player_color: Color = Color("#8faf8c")
@export var hazard_color: Color = Color("#a65f3f")
@export var collectible_color: Color = Color("#c9a66b")

@export_group("Gameplay")
@export var player_speed: float = 280.0
@export var jump_strength: float = 420.0
@export var gravity_override: float = 980.0
@export var win_score: int = 10

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

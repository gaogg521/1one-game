extends CharacterBody2D
## 平台跳跃玩家；速度/跳跃由 GameSpecBridge 或检查器 @export 驱动。

@export var speed: float = 280.0
@export var jump_velocity: float = -420.0
@export var gravity_scale_multiplier: float = 1.0

@onready var visual: ColorRect = $Visual


func _ready() -> void:
	_sync_visual_from_bridge()


func apply_bridge(bridge: GameSpecBridge) -> void:
	if bridge == null:
		return
	speed = bridge.player_speed
	jump_velocity = -absf(bridge.jump_strength)
	gravity_scale_multiplier = bridge.gravity_override / 980.0
	if visual:
		visual.color = bridge.player_color


func _sync_visual_from_bridge() -> void:
	var main := get_tree().current_scene
	if main == null:
		return
	var bridge := main.get_node_or_null("GameSpecBridge") as GameSpecBridge
	if bridge:
		apply_bridge(bridge)


func _physics_process(_delta: float) -> void:
	var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity") * gravity_scale_multiplier
	if not is_on_floor():
		velocity.y += gravity * get_physics_process_delta_time()

	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity

	var direction := Input.get_axis("move_left", "move_right")
	velocity.x = direction * speed
	move_and_slide()

extends Node2D


func _ready() -> void:
	var bridge := $GameSpecBridge as GameSpecBridge
	if bridge:
		bridge.apply_to_main(self)
	var player := $Player
	if player and player.has_method("apply_bridge") and bridge:
		player.apply_bridge(bridge)

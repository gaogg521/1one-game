class_name UnitVisual
extends Node2D
## 单单位可视化（塔/敌人），带 _draw 与 HP

enum Kind { TOWER, ENEMY, SLOT, STARSHIP, INTERCEPTOR }

@export var kind: Kind = Kind.ENEMY
@export var unit_id: String = "grunt"
@export var tower_style: String = "dart"
@export var tower_level: int = 1
@export var hp_ratio: float = 1.0
@export var slowed: bool = false
@export var slot_selected: bool = false
@export var overlay_texture: Texture2D = null

var _pulse := 0.0


func _process(delta: float) -> void:
	_pulse += delta
	if kind == Kind.SLOT or kind == Kind.TOWER or kind == Kind.STARSHIP or kind == Kind.INTERCEPTOR:
		queue_redraw()


func _draw() -> void:
	if overlay_texture:
		var sz := overlay_texture.get_size()
		if sz.x > 0 and sz.y > 0:
			var scale := 44.0 / maxf(sz.x, sz.y)
			draw_set_transform(Vector2.ZERO, 0.0, Vector2(scale, scale))
			draw_texture(overlay_texture, Vector2(-sz.x / 2, -sz.y / 2))
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
			if kind == Kind.ENEMY and hp_ratio < 0.99:
				draw_rect(Rect2(-20, 18, 40 * hp_ratio, 4), Color(0.2, 0.85, 0.35))
			return
	match kind:
		Kind.TOWER:
			ProceduralUnits.draw_tower(self, tower_style, tower_level)
		Kind.ENEMY:
			ProceduralUnits.draw_enemy(self, unit_id, hp_ratio, slowed)
		Kind.STARSHIP:
			ProceduralUnits.draw_starship(self, GameSpecData.theme_color("playerColor", Color.CYAN))
		Kind.INTERCEPTOR:
			ProceduralUnits.draw_interceptor(
				self,
				GameSpecData.theme_color("hazardColor", Color.ORANGE),
				unit_id == "tank",
			)
		Kind.SLOT:
			ProceduralUnits.draw_build_slot(self, slot_selected, _pulse)

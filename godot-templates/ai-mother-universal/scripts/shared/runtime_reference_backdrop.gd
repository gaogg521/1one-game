class_name RuntimeReferenceBackdrop
extends RefCounted
## 将导出时写入的参考图贴到主场景背景层

static func apply(sprite: Sprite2D, background_rect: ColorRect) -> void:
	if sprite == null:
		return
	GameSpecData.ensure_references_loaded()
	var classified := GameSpecData.reference_classified()
	var bg_path := str(classified.get("background", ""))
	if bg_path == "":
		sprite.visible = false
		return
	var tex := GameSpecData.reference_texture(bg_path)
	if tex == null:
		sprite.visible = false
		return
	sprite.texture = tex
	sprite.visible = true
	sprite.centered = false
	var w := 800.0
	var h := 600.0
	if background_rect:
		w = background_rect.size.x
		h = background_rect.size.y
	var tw := tex.get_width()
	var th := tex.get_height()
	if tw > 0 and th > 0:
		sprite.scale = Vector2(w / float(tw), h / float(th))
	sprite.modulate = Color(1, 1, 1, 0.92)
	if background_rect:
		background_rect.color = Color(0.05, 0.06, 0.07, 0.35)

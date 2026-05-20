class_name RuntimeReferenceRegistry
extends RefCounted
## 导出时写入的参考图纹理（塔/怪/主角）

static var loaded := false
static var monster_textures: Array[Texture2D] = []
static var tower_textures: Array[Texture2D] = []
static var protagonist_texture: Texture2D = null
static var _monster_cycle := 0


static func ensure_loaded() -> void:
	if loaded:
		return
	loaded = true
	monster_textures.clear()
	tower_textures.clear()
	protagonist_texture = null
	GameSpecData.ensure_references_loaded()
	var c := GameSpecData.reference_classified()
	for p in c.get("monsters", []):
		var t := GameSpecData.reference_texture(str(p))
		if t:
			monster_textures.append(t)
	for p in c.get("towerSkins", []):
		var t2 := GameSpecData.reference_texture(str(p))
		if t2:
			tower_textures.append(t2)
	var pg := str(c.get("protagonist", ""))
	if pg != "":
		protagonist_texture = GameSpecData.reference_texture(pg)


static func next_monster_texture() -> Texture2D:
	if monster_textures.is_empty():
		return null
	var t := monster_textures[_monster_cycle % monster_textures.size()]
	_monster_cycle += 1
	return t


static func tower_texture_for_index(i: int) -> Texture2D:
	if tower_textures.is_empty():
		return null
	return tower_textures[i % tower_textures.size()]

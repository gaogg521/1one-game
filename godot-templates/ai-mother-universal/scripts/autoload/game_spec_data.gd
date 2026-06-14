extends Node
## 运行时 GameSpec 单一真相（导出时写入 res://spec/gamespec.json）

var raw: Dictionary = {}
var loaded := false
var references_manifest: Dictionary = {}
var _refs_loaded := false


func ensure_loaded() -> void:
	if loaded:
		return
	const path := "res://spec/gamespec.json"
	if not FileAccess.file_exists(path):
		loaded = true
		return
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		loaded = true
		return
	var parsed = JSON.parse_string(f.get_as_text())
	f.close()
	raw = parsed if typeof(parsed) == TYPE_DICTIONARY else {}
	loaded = true


func reload() -> void:
	loaded = false
	ensure_loaded()


func template_id() -> String:
	ensure_loaded()
	return str(raw.get("templateId", "platformer"))


func godot_runtime_key() -> String:
	ensure_loaded()
	var rt = raw.get("_runtime", {})
	if rt is Dictionary and rt.has("godotKey"):
		return str(rt.get("godotKey"))
	return template_id()


func arena_mode() -> String:
	ensure_loaded()
	var rt = raw.get("_runtime", {})
	if rt is Dictionary and rt.has("arenaMode"):
		return str(rt.get("arenaMode"))
	var tid := template_id()
	if tid in ["avoider", "collector", "survivor"]:
		return tid
	return "avoider"


func semantic_template_id() -> String:
	ensure_loaded()
	var rt = raw.get("_runtime", {})
	if rt is Dictionary and rt.has("semanticTemplateId"):
		return str(rt.get("semanticTemplateId"))
	return template_id()


func title() -> String:
	ensure_loaded()
	return str(raw.get("title", "Game"))


func subtitle() -> String:
	ensure_loaded()
	return labels("subtitle", "")


func theme_hex(key: String, fallback: String) -> String:
	ensure_loaded()
	var t = raw.get("theme", {})
	if t is Dictionary and t.has(key):
		return str(t[key])
	return fallback


func theme_color(key: String, fallback: Color) -> Color:
	return Color.from_string(theme_hex(key, "#888888"), fallback)


func gameplay_f(key: String, fallback: float) -> float:
	ensure_loaded()
	var g = raw.get("gameplay", {})
	if g is Dictionary and g.has(key):
		return float(g[key])
	return fallback


func gameplay_i(key: String, fallback: int) -> int:
	return int(gameplay_f(key, float(fallback)))


func labels(key: String, fallback: String) -> String:
	ensure_loaded()
	var L = raw.get("labels", {})
	if L is Dictionary and L.has(key):
		return str(L[key])
	return fallback


func tower_defense() -> Dictionary:
	ensure_loaded()
	var td = raw.get("towerDefense", {})
	return td if td is Dictionary else {}


func director() -> Dictionary:
	ensure_loaded()
	var d = raw.get("director", {})
	return d if d is Dictionary else {}


func systems() -> Dictionary:
	ensure_loaded()
	var s = raw.get("systems", {})
	return s if s is Dictionary else {}


func ensure_references_loaded() -> void:
	if _refs_loaded:
		return
	_refs_loaded = true
	const path := "res://spec/references.json"
	if not FileAccess.file_exists(path):
		return
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return
	var parsed = JSON.parse_string(f.get_as_text())
	f.close()
	references_manifest = parsed if typeof(parsed) == TYPE_DICTIONARY else {}


func reference_classified() -> Dictionary:
	ensure_references_loaded()
	var c = references_manifest.get("classified", {})
	return c if c is Dictionary else {}


func coaster() -> Dictionary:
	ensure_loaded()
	var c = raw.get("coaster", {})
	return c if c is Dictionary else {}


func puzzle() -> Dictionary:
	ensure_loaded()
	var p = raw.get("puzzle", {})
	return p if p is Dictionary else {}


func platformer() -> Dictionary:
	ensure_loaded()
	var p = raw.get("platformer", {})
	return p if p is Dictionary else {}


func sample_play_profile() -> Dictionary:
	ensure_loaded()
	var p = raw.get("samplePlayProfile", {})
	return p if p is Dictionary else {}


func profile_f(key: String, sub: String, fallback: float) -> float:
	var pf := sample_play_profile()
	var block = pf.get(key, {})
	if block is Dictionary and block.has(sub):
		return float(block[sub])
	return fallback


func profile_b(key: String, sub: String, fallback: bool) -> bool:
	var pf := sample_play_profile()
	var block = pf.get(key, {})
	if block is Dictionary and block.has(sub):
		return bool(block[sub])
	return fallback


func farming() -> Dictionary:
	ensure_loaded()
	var f = raw.get("farming", {})
	return f if f is Dictionary else {}


func strategy() -> Dictionary:
	ensure_loaded()
	var s = raw.get("strategy", {})
	return s if s is Dictionary else {}


func customization() -> Dictionary:
	ensure_loaded()
	var c = raw.get("customization", {})
	return c if c is Dictionary else {}


func reference_texture(res_path: String) -> Texture2D:
	if res_path == "" or not ResourceLoader.exists(res_path):
		return null
	var tex := load(res_path) as Texture2D
	return tex

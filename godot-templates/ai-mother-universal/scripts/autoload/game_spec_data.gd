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


# ── 深度 Godot 视觉层（阶段 2） ───────────────────────────────────

func visual() -> Dictionary:
	ensure_loaded()
	var v = raw.get("visual", {})
	return v if v is Dictionary else {}


func shader_pack() -> String:
	var p = visual().get("shaderPack", "")
	if typeof(p) == TYPE_STRING and p != "":
		return p
	return "flat"


func particle_intensity_mult() -> float:
	var pi = visual().get("particleIntensity", "standard")
	match str(pi):
		"minimal":
			return 0.3
		"showcase":
			return 2.0
		_:
			return 1.0


func animation_set() -> String:
	var a = visual().get("animationSet", "none")
	return str(a) if a != null else "none"


func visual_zones() -> Array:
	var z = visual().get("zones", [])
	return z if typeof(z) == TYPE_ARRAY else []


func zones_of_type(type_name: String) -> Array:
	var out: Array = []
	for z in visual_zones():
		if z is Dictionary and str(z.get("type", "")) == type_name:
			out.append(z)
	return out


# ── 6 个新模板蓝图访问器（rhythm/sports/card/fighting/moba/horror） ──

func rhythm() -> Dictionary:
	ensure_loaded()
	var r = raw.get("rhythm", {})
	return r if r is Dictionary else {}


func sports() -> Dictionary:
	ensure_loaded()
	var s = raw.get("sports", {})
	return s if s is Dictionary else {}


func card() -> Dictionary:
	ensure_loaded()
	var c = raw.get("card", {})
	return c if c is Dictionary else {}


func fighting() -> Dictionary:
	ensure_loaded()
	var f = raw.get("fighting", {})
	return f if f is Dictionary else {}


func moba() -> Dictionary:
	ensure_loaded()
	var m = raw.get("moba", {})
	return m if m is Dictionary else {}


func horror() -> Dictionary:
	ensure_loaded()
	var h = raw.get("horror", {})
	return h if h is Dictionary else {}


# ── 4 个真玩法模板蓝图访问器 ──

func mahjong() -> Dictionary:
	ensure_loaded()
	var m = raw.get("mahjong", {})
	return m if m is Dictionary else {}


func tetris() -> Dictionary:
	ensure_loaded()
	var t = raw.get("tetris", {})
	return t if t is Dictionary else {}


func endless_runner() -> Dictionary:
	ensure_loaded()
	var e = raw.get("endlessRunner", {})
	return e if e is Dictionary else {}


func fruit_ninja() -> Dictionary:
	ensure_loaded()
	var f = raw.get("fruitNinja", {})
	return f if f is Dictionary else {}


# ── Godot 端 i18n 翻译系统（简化版，5 语言） ───────────────────

const TRANSLATIONS := {
	"zh-Hans": {
		"score": "得分", "lives": "命", "combo": "连击", "time": "时间", "round": "回合",
		"win": "胜利", "lose": "失败", "ready": "就绪", "pause": "暂停", "restart": "重开",
		"miss": "Miss", "perfect": "Perfect", "good": "Good",
		"points": "点数", "lines": "消行", "speed": "速度", "distance": "距离",
		"mana": "法力", "hp": "HP", "tower": "塔", "power": "电力", "camera": "摄像头",
		"night": "夜晚", "tenpai": "听牌", "ron": "荣和", "riichi": "立直",
		"deal": "发牌", "discard": "出牌", "pass": "不要", "bomb": "炸弹",
		"target": "目标", "progress": "进度", "level": "关卡", "wave": "波次",
	},
	"zh-Hant": {
		"score": "得分", "lives": "命", "combo": "連擊", "time": "時間", "round": "回合",
		"win": "勝利", "lose": "失敗", "ready": "就緒", "pause": "暫停", "restart": "重開",
		"miss": "Miss", "perfect": "Perfect", "good": "Good",
		"points": "點數", "lines": "消行", "speed": "速度", "distance": "距離",
		"mana": "法力", "hp": "HP", "tower": "塔", "power": "電力", "camera": "攝像頭",
		"night": "夜晚", "tenpai": "聽牌", "ron": "榮和", "riichi": "立直",
		"deal": "發牌", "discard": "出牌", "pass": "不要", "bomb": "炸彈",
		"target": "目標", "progress": "進度", "level": "關卡", "wave": "波次",
	},
	"en": {
		"score": "Score", "lives": "Lives", "combo": "Combo", "time": "Time", "round": "Round",
		"win": "Win", "lose": "Lose", "ready": "Ready", "pause": "Pause", "restart": "Restart",
		"miss": "Miss", "perfect": "Perfect", "good": "Good",
		"points": "Points", "lines": "Lines", "speed": "Speed", "distance": "Distance",
		"mana": "Mana", "hp": "HP", "tower": "Tower", "power": "Power", "camera": "Camera",
		"night": "Night", "tenpai": "Tenpai", "ron": "Ron", "riichi": "Riichi",
		"deal": "Deal", "discard": "Discard", "pass": "Pass", "bomb": "Bomb",
		"target": "Target", "progress": "Progress", "level": "Level", "wave": "Wave",
	},
	"ms": {
		"score": "Skor", "lives": "Nyawa", "combo": "Combo", "time": "Masa", "round": "Pusingan",
		"win": "Menang", "lose": "Kalah", "ready": "Sedia", "pause": "Jeda", "restart": "Mula Semula",
		"miss": "Miss", "perfect": "Perfect", "good": "Good",
		"points": "Mata", "lines": "Baris", "speed": "Laju", "distance": "Jarak",
		"mana": "Mana", "hp": "HP", "tower": "Menara", "power": "Kuasa", "camera": "Kamera",
		"night": "Malam", "tenpai": "Tenpai", "ron": "Ron", "riichi": "Riichi",
		"deal": "Bahagi", "discard": "Buang", "pass": "Lulus", "bomb": "Bom",
		"target": "Sasaran", "progress": "Kemajuan", "level": "Tahap", "wave": "Pusingan",
	},
	"th": {
		"score": "คะแนน", "lives": "ชีวิต", "combo": "คอมโบ", "time": "เวลา", "round": "ตา",
		"win": "ชนะ", "lose": "แพ้", "ready": "พร้อม", "pause": "หยุด", "restart": "เริ่มใหม่",
		"miss": "Miss", "perfect": "Perfect", "good": "Good",
		"points": "แต้ม", "lines": "บรรทัด", "speed": "ความเร็ว", "distance": "ระยะ",
		"mana": "มานา", "hp": "HP", "tower": "ป้อม", "power": "พลัง", "camera": "กล้อง",
		"night": "คืน", "tenpai": "เท็นไพ", "ron": "รอง", "riichi": "ริอิจิ",
		"deal": "แจก", "discard": "ทิ้ง", "pass": "ผ่าน", "bomb": "ระเบิด",
		"target": "เป้า", "progress": "ความคืบหน้า", "level": "ด่าน", "wave": "รอบ",
	},
}

## 翻译函数：按 spec._runtime.locale 或默认 zh-Hans 返回本地化字符串
func tr(key: String) -> String:
	var loc = str(raw.get("_locale", "zh-Hans"))
	if not TRANSLATIONS.has(loc):
		loc = "zh-Hans"
	var dict = TRANSLATIONS.get(loc, TRANSLATIONS["zh-Hans"])
	if dict is Dictionary and dict.has(key):
		return str(dict[key])
	return key

## 设置 locale（由导出时写入）
func set_locale(loc: String) -> void:
	_locale = loc

var _locale := "zh-Hans"


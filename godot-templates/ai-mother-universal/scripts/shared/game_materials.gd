class_name GameMaterials
extends RefCounted
## 按 spec.visual.shaderPack 数据驱动实例化 ShaderMaterial。
##
## 用法：
##   mesh.material_override = GameMaterials.make_from_pack("neon-glow", Color(0,1,0.8))
##
## 加载失败（shader 文件缺失 / pack="flat"）→ fallback StandardMaterial3D。

const SHADER_PATH_FMT := "res://resources/shaders/%s.gdshader"

## 已加载 shader 缓存，避免每帧 load 开销
static var _shader_cache: Dictionary = {}


static func make_from_pack(pack: String, color: Color, intensity: float = 1.0) -> Material:
	# flat / 空 / 跳过：直接 StandardMaterial3D（兜底，等价 unlit + albedo）
	if pack == "" or pack == "flat":
		return _fallback_standard(color)
	var path := SHADER_PATH_FMT % pack
	var sh: Shader = _shader_cache.get(path)
	if sh == null:
		if not ResourceLoader.exists(path):
			return _fallback_standard(color)
		sh = load(path) as Shader
		if sh == null:
			return _fallback_standard(color)
		_shader_cache[path] = sh
	var sm := ShaderMaterial.new()
	sm.shader = sh
	sm.set_shader_parameter("albedo_color", color)
	sm.set_shader_parameter("intensity", intensity)
	return sm


## 闪白 shader：瞬间抬高 intensity，调用方负责 tween 回落（或调 drop_intensity）
static func flash(mat: Material, peak: float = 3.0) -> void:
	if mat is ShaderMaterial:
		(mat as ShaderMaterial).set_shader_parameter("intensity", peak)


## intensity tween 回落：返回 Tween（调用方不需持有，Tween 自动跑完）
static func drop_intensity(mat: Material, from: float, to: float, duration: float, host: Node) -> Tween:
	if not mat is ShaderMaterial or host == null:
		return null
	var sm := mat as ShaderMaterial
	var tw := host.create_tween()
	tw.tween_method(
		func(v: float) -> void: sm.set_shader_parameter("intensity", v),
		from,
		to,
		duration,
	)
	return tw


## 按 progress (0..1) 在 [low, high] 间插值 dissolve_amount（死亡动画用）
static func set_dissolve(mat: Material, amount: float) -> void:
	if mat is ShaderMaterial:
		(mat as ShaderMaterial).set_shader_parameter("dissolve_amount", clampf(amount, 0.0, 1.0))


static func _fallback_standard(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = color * 0.2
	return m

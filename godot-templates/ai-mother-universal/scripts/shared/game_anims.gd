class_name GameAnims
extends RefCounted
## 深度 Godot AnimationLibrary 工厂：7 个属性动画，无骨骼、无 .glb 依赖。
##
## track path 全部相对 AnimationPlayer.root_node（运行时指向玩家节点）：
##   :scale / :position:y / :rotation:y
##
## 用法：
##   var ap := AnimationPlayer.new()
##   ap.root_node = ap.get_path_to(player)
##   ap.add_animation_library("", GameAnims.make_library())
##   ap.play("run")
## material 相关动画（如 dissolve_amount / intensity）由 runtime 用 Tween 直接驱动
## shader_parameter，不进入 anim_lib——因为 material 路径依赖具体 mesh 结构。

const DURATIONS := {
	"run": 0.5,
	"jump": 0.4,
	"land": 0.25,
	"hit": 0.22,
	"death": 1.2,
	"boss_phase2": 0.6,
	"boss_phase3": 0.6,
}


static func make_library() -> AnimationLibrary:
	var lib := AnimationLibrary.new()
	lib.add_animation("run", _run())
	lib.add_animation("jump", _jump())
	lib.add_animation("land", _land())
	lib.add_animation("hit", _hit())
	lib.add_animation("death", _death())
	lib.add_animation("boss_phase2", _boss_phase(1.0, 1.3, 0.0, PI * 0.5))
	lib.add_animation("boss_phase3", _boss_phase(1.3, 1.6, PI * 0.5, PI))
	return lib


static func _add_value_track(anim: Animation, path: String, keys: Array) -> int:
	# keys: Array of [time: float, value: Variant]
	# 使用最基础的 add_track / track_set_path / track_insert_key API，
	# 避免不同 Godot 4.x 版本间 value_track_set_update_mode 等命名差异。
	# 默认 value track 插值 = LINEAR，足够流畅。
	var idx := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(idx, path)
	for k in keys:
		anim.track_insert_key(idx, float(k[0]), k[1])
	return idx


static func _run() -> Animation:
	var a := Animation.new()
	a.duration = DURATIONS["run"]
	a.loop_mode = Animation.LOOP_LINEAR
	# position:y sin 抖动（脚步感）
	_add_value_track(a, ":position:y", [
		[0.0, 0.0],
		[0.125, 0.08],
		[0.25, 0.0],
		[0.375, -0.05],
		[0.5, 0.0],
	])
	# scale 轻微呼吸
	_add_value_track(a, ":scale", [
		[0.0, Vector3(1, 1, 1)],
		[0.25, Vector3(1.02, 0.98, 1.02)],
		[0.5, Vector3(1, 1, 1)],
	])
	return a


static func _jump() -> Animation:
	var a := Animation.new()
	a.duration = DURATIONS["jump"]
	a.loop_mode = Animation.LOOP_NONE
	# 起跳 squash & stretch
	_add_value_track(a, ":scale", [
		[0.0, Vector3(1, 1, 1)],
		[0.1, Vector3(0.85, 1.18, 0.85)],
		[0.25, Vector3(1.1, 0.92, 1.1)],
		[0.4, Vector3(1, 1, 1)],
	])
	# position:y 弧线（抛物线感）
	_add_value_track(a, ":position:y", [
		[0.0, 0.0],
		[0.1, 0.1],
		[0.2, 0.5],
		[0.3, 0.8],
		[0.4, 0.0],
	])
	return a


static func _land() -> Animation:
	var a := Animation.new()
	a.duration = DURATIONS["land"]
	a.loop_mode = Animation.LOOP_NONE
	# 着陆 squash
	_add_value_track(a, ":scale", [
		[0.0, Vector3(1.2, 0.8, 1.2)],
		[0.1, Vector3(0.95, 1.05, 0.95)],
		[0.25, Vector3(1, 1, 1)],
	])
	return a


static func _hit() -> Animation:
	var a := Animation.new()
	a.duration = DURATIONS["hit"]
	a.loop_mode = Animation.LOOP_NONE
	# 受击闪缩
	_add_value_track(a, ":scale", [
		[0.0, Vector3(1, 1, 1)],
		[0.06, Vector3(1.15, 0.85, 1.15)],
		[0.15, Vector3(0.95, 1.05, 0.95)],
		[0.22, Vector3(1, 1, 1)],
	])
	# 短促旋转抖动
	_add_value_track(a, ":rotation:y", [
		[0.0, 0.0],
		[0.06, 0.18],
		[0.15, -0.1],
		[0.22, 0.0],
	])
	return a


static func _death() -> Animation:
	var a := Animation.new()
	a.duration = DURATIONS["death"]
	a.loop_mode = Animation.LOOP_NONE
	# 倒地旋转
	_add_value_track(a, ":rotation:y", [
		[0.0, 0.0],
		[1.2, PI],
	])
	# 缩小 + 上抬消失
	_add_value_track(a, ":scale", [
		[0.0, Vector3(1, 1, 1)],
		[0.3, Vector3(1.05, 0.95, 1.05)],
		[1.0, Vector3(0.3, 0.3, 0.3)],
		[1.2, Vector3(0.0, 0.0, 0.0)],
	])
	_add_value_track(a, ":position:y", [
		[0.0, 0.0],
		[0.4, 0.4],
		[1.2, 0.0],
	])
	return a


static func _boss_phase(scale_from: float, scale_to: float, rot_from: float, rot_to: float) -> Animation:
	var a := Animation.new()
	a.duration = DURATIONS["boss_phase2"]
	a.loop_mode = Animation.LOOP_NONE
	_add_value_track(a, ":scale", [
		[0.0, Vector3(scale_from, scale_from, scale_from)],
		[0.6, Vector3(scale_to, scale_to, scale_to)],
	])
	_add_value_track(a, ":rotation:y", [
		[0.0, rot_from],
		[0.6, rot_to],
	])
	return a


## 在 AnimationPlayer 上挂载 library 并设置 root_node 指向 target。
## 返回 AnimationPlayer；调用方决定是否 queue_free。
static func mount_on(player_node: AnimationPlayer, target: Node3D) -> void:
	player_node.root_node = player_node.get_path_to(target)
	if not player_node.has_animation_library(""):
		player_node.add_animation_library("", make_library())

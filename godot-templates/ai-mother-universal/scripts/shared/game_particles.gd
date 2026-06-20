class_name GameParticles
extends RefCounted
## 深度 Godot 粒子预设工厂：替代 game_juice.gd 的 2D ColorRect 手动爆散。
##
## 用法：
##   var p := GameParticles.spawn(world, pos, "burst_collect", Color.GOLD, intensity_mult)
##   # 自动 one-shot + 自动 queue_free
##
## 7 个预设对应不同事件类型：
##   burst_collect  收集闪光（无重力，星形爆散）
##   burst_hit      受击碎屑（重力下拉，短拖尾）
##   burst_death    死亡爆散（大范围，长拖尾；配合 dissolve shader）
##   trail_bullet   子弹拖尾（切向加速，长寿命）
##   dust_land      落地尘土（BOX emission，贴近地面，径向 outward）
##   tower_pulse    塔基座脉动（向上环绕，循环）
##   boss_phase     Boss 阶段过渡（环形扩散 + color shift）

const PRESETS := {
	"burst_collect": 12,
	"burst_hit": 16,
	"burst_death": 40,
	"trail_bullet": 8,
	"dust_land": 20,
	"tower_pulse": 24,
	"boss_phase": 32,
}

const LIFETIMES := {
	"burst_collect": 0.5,
	"burst_hit": 0.45,
	"burst_death": 1.2,
	"trail_bullet": 0.3,
	"dust_land": 0.6,
	"tower_pulse": 1.0,
	"boss_phase": 0.9,
}


static func make_preset(name: String) -> ParticleProcessMaterial:
	var m := ParticleProcessMaterial.new()
	# scale 走默认 1.0（Godot 4 中 scale_curve_min/max 接受 Curve 资源，设置成本高；
	# 用 color_ramp alpha fade 已经足够淡化效果）
	match name:
		"burst_collect":
			m.direction = Vector3(0, 1, 0)
			m.spread = 35.0
			m.gravity = Vector3.ZERO
			m.initial_velocity_min = 3.0
			m.initial_velocity_max = 5.5
			m.color = Color.GOLD
		"burst_hit":
			m.direction = Vector3(0, 1, 0)
			m.spread = 60.0
			m.gravity = Vector3(0, -9.8, 0)
			m.initial_velocity_min = 2.0
			m.initial_velocity_max = 4.0
			m.linear_accel_min = -1.0
			m.linear_accel_max = 1.0
			m.color = Color(1.0, 0.6, 0.3)
		"burst_death":
			m.direction = Vector3(0, 1, 0)
			m.spread = 80.0
			m.gravity = Vector3(0, -3.0, 0)
			m.initial_velocity_min = 4.0
			m.initial_velocity_max = 8.0
			m.tangential_accel_min = -3.0
			m.tangential_accel_max = 3.0
			m.color = Color(0.9, 0.3, 0.1)
		"trail_bullet":
			m.direction = Vector3(0, 0, -1)
			m.spread = 5.0
			m.gravity = Vector3.ZERO
			m.initial_velocity_min = 0.5
			m.initial_velocity_max = 1.5
			m.tangential_accel_min = 1.0
			m.tangential_accel_max = 2.0
			m.color = Color(0.5, 0.9, 1.0)
		"dust_land":
			m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
			m.emission_box_extents = Vector3(1.0, 0.05, 1.0)
			m.direction = Vector3(0, 1, 0)
			m.spread = 8.0
			m.gravity = Vector3(0, -4.0, 0)
			m.initial_velocity_min = 1.5
			m.initial_velocity_max = 3.0
			m.radial_accel_min = 2.0
			m.radial_accel_max = 4.0
			m.color = Color(0.7, 0.65, 0.5, 0.6)
		"tower_pulse":
			m.direction = Vector3(0, 1, 0)
			m.spread = 25.0
			m.gravity = Vector3(0, 0.5, 0)
			m.initial_velocity_min = 1.0
			m.initial_velocity_max = 2.0
			m.orbit_velocity_min = 1.5
			m.orbit_velocity_max = 2.5
			m.color = Color(0.4, 0.9, 0.6)
		"boss_phase":
			m.direction = Vector3(0, 1, 0)
			m.spread = 180.0
			m.gravity = Vector3.ZERO
			m.initial_velocity_min = 3.0
			m.initial_velocity_max = 6.0
			m.radial_accel_min = -2.0
			m.radial_accel_max = 2.0
			m.color = Color(0.9, 0.2, 0.5)
		_:
			m.color = Color.WHITE
	# 通用：alpha 淡出（color ramp）
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 1, 1, 1))
	ramp.set_color(1, Color(1, 1, 1, 0))
	ramp.set_offset(0, 0.0)
	ramp.set_offset(1, 1.0)
	var ramp_tex := GradientTexture1D.new()
	ramp_tex.gradient = ramp
	m.color_ramp = ramp_tex
	return m


## 一站式：创建 GPUParticles3D + 挂到 world + 自动 one-shot + 自动 queue_free。
## color 会覆盖 preset 默认色；mult 控制粒子数倍率（来自 GameSpecData.particle_intensity_mult）。
static func spawn(
	world: Node3D,
	pos: Vector3,
	preset_name: String,
	color: Color,
	mult: float = 1.0,
	one_shot: bool = true,
) -> GPUParticles3D:
	var pm := make_preset(preset_name)
	pm.color = color
	var node := GPUParticles3D.new()
	node.position = pos
	node.amount = int(maxi(2, float(PRESETS.get(preset_name, 12)) * clampf(mult, 0.2, 4.0)))
	node.lifetime = LIFETIMES.get(preset_name, 0.5)
	node.one_shot = one_shot
	node.explosiveness = 1.0 if preset_name != "tower_pulse" and preset_name != "trail_bullet" else 0.4
	node.process_material = pm
	node.emitting = true
	world.add_child(node)
	# 自动 queue_free（一次性）or 寿命结束后
	if one_shot:
		var ttl := node.lifetime + 0.3
		if node.get_tree():
			node.get_tree().create_timer(ttl).timeout.connect(node.queue_free, CONNECT_ONE_SHOT)
	return node


## 非一次性挂载（子弹拖尾 / 塔基座脉动）：调用方持有引用并自行清理。
static func attach(
	parent: Node3D,
	preset_name: String,
	color: Color,
	mult: float = 1.0,
	one_shot: bool = false,
) -> GPUParticles3D:
	var pm := make_preset(preset_name)
	pm.color = color
	var node := GPUParticles3D.new()
	node.amount = int(maxi(2, float(PRESETS.get(preset_name, 12)) * clampf(mult, 0.2, 4.0)))
	node.lifetime = LIFETIMES.get(preset_name, 0.5)
	node.one_shot = one_shot
	node.explosiveness = 0.4
	node.process_material = pm
	node.emitting = true
	parent.add_child(node)
	return node

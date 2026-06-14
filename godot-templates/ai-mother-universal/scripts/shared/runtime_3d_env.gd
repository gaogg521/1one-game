class_name Runtime3DEnv
extends RefCounted
## 共享：800×600 逻辑坐标 → 3D 世界（XZ 平面）

const MAP_W := 800.0
const MAP_H := 600.0
const SCALE := 0.02

static func px_to_world(p: Vector2, y: float = 0.5) -> Vector3:
	return Vector3(p.x * SCALE - MAP_W * SCALE * 0.5, y, p.y * SCALE - MAP_H * SCALE * 0.5)


static func world_to_px(w: Vector3) -> Vector2:
	return Vector2((w.x + MAP_W * SCALE * 0.5) / SCALE, (w.z + MAP_H * SCALE * 0.5) / SCALE)


static func add_environment(world: Node3D, bg: Color) -> void:
	var env_n := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = bg
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = bg.lightened(0.18)
	env_n.environment = env
	world.add_child(env_n)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, 28, 0)
	sun.light_energy = 1.12
	sun.shadow_enabled = true
	world.add_child(sun)


static func make_camera(world: Node3D, top_down: bool = true) -> Camera3D:
	var cam := Camera3D.new()
	cam.current = true
	if top_down:
		cam.position = Vector3(0, 13.5, 0.01)
		cam.rotation_degrees = Vector3(-90, 0, 0)
	else:
		cam.position = Vector3(0, 5.5, 10.5)
		cam.look_at(Vector3(0, 0.5, 0), Vector3.UP)
	world.add_child(cam)
	return cam


static func raycast_world(viewport: SubViewport, camera: Camera3D, screen_pos: Vector2) -> Vector3:
	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)
	var space := viewport.world_3d.direct_space_state
	var query := PhysicsRayQueryParameters3D.create(from, from + dir * 80.0)
	var hit := space.intersect_ray(query)
	if hit.is_empty():
		var t := -from.y / dir.y if absf(dir.y) > 0.001 else 999.0
		return from + dir * t
	return hit.get("position", from + dir * 20.0)

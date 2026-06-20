extends Node2D
## 打砖块（Breakout）· 3D 视图
## - 底部挡板（鼠标 X / ← → / A D 移动）
## - 弹球从挡板发射，反弹打砖块
## - 砖块网格（多行多列，不同行不同颜色与分值）
## - 球碰砖块 → 砖块消失 + 加分 + 球反弹
## - 球碰底部 → 失命，重置球到挡板上
## - 全部砖块消除 → 通关；命耗尽 → 失败

@onready var _world: Node3D = $ViewportContainer/SubViewport/World
@onready var _viewport: SubViewport = $ViewportContainer/SubViewport

var _hud = GameHud.new()
var _camera: Camera3D
var _ended = false

# 蓝图参数（从 GameSpecData.raw["breakout"] 读取，缺省合理默认）
var _brick_rows = 5
var _brick_cols = 9
var _ball_speed = 9.0           # 3D 单位/秒
var _paddle_width = 3.2         # 3D 单位
var _lives = 3

# 游戏状态
var _score = 0
var _remaining = 0
var _ball_launched = false

# 场景节点
var _paddle: MeshInstance3D
var _ball: MeshInstance3D
var _ball_vel = Vector3.ZERO
var _bricks: Array = []          # Array[Dictionary] {mesh, alive, value}

# 边界（3D XZ 平面，从相机俯视；y 固定为砖块/挡板/球的高度）
const WALL_LEFT := -6.0
const WALL_RIGHT := 6.0
const WALL_TOP_Z := -4.5
const PADDLE_Z := 3.4
const BRICK_TOP_Z := -3.4
const BRICK_H := 0.32
const BRICK_GAP := 0.05
const PADDLE_H := 0.28
const BALL_RADIUS := 0.22
const PLAY_Y := 0.3              # 砖块/挡板/球的统一 y

# 行颜色 + 分值（顶行分值高）
const ROW_COLORS := [
	Color("#ef4444"),  # red
	Color("#f97316"),  # orange
	Color("#facc15"),  # yellow
	Color("#4ade80"),  # green
	Color("#38bdf8"),  # sky
	Color("#818cf8"),  # indigo
	Color("#a78bfa"),  # violet
	Color("#f472b6"),  # pink
]


func _ready() -> void:
	GameSpecData.ensure_loaded()
	_hud.bind(get_parent().get_parent())
	_hud.apply_meta()
	_load_blueprint()
	_build_scene()
	_spawn_bricks()
	_reset_ball_on_paddle()
	_hud.set_extra("← → / 鼠标 移动挡板 · 空格 / 点击 发射")
	_hud.show_banner("打砖块", "击碎所有砖块", 1.8)
	_refresh_hud()
	if _viewport:
		_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS


## 从 GameSpecData.raw["breakout"] 读取蓝图；缺省回退默认值
func _load_blueprint() -> void:
	var bp: Dictionary = {}
	if GameSpecData.raw.has("breakout") and GameSpecData.raw["breakout"] is Dictionary:
		bp = GameSpecData.raw["breakout"]
	_brick_rows = clampi(int(bp.get("brickRows", _brick_rows)), 3, 8)
	_brick_cols = clampi(int(bp.get("brickCols", _brick_cols)), 6, 12)
	_ball_speed = clampf(float(bp.get("ballSpeed", _ball_speed * 50.0)) / 50.0, 4.0, 10.0)
	_paddle_width = clampf(float(bp.get("paddleWidth", _paddle_width * 40.0)) / 40.0, 1.2, 3.6)
	_lives = maxi(int(bp.get("lives", _lives)), 1)
	_remaining = _brick_rows * _brick_cols


func _build_scene() -> void:
	Runtime3DEnv.add_environment(_world, GameSpecData.theme_color("backgroundColor", Color("#0f172a")))
	_camera = Camera3D.new()
	_camera.position = Vector3(0, 9.5, 6.5)
	_camera.look_at(Vector3(0, 0, 0), Vector3.UP)
	_camera.current = true
	_world.add_child(_camera)
	# 挡板
	_paddle = _make_box(_paddle_width, PADDLE_H, 0.6, Color("#38bdf8"))
	_paddle.position = Vector3(0, PLAY_Y, PADDLE_Z)
	_world.add_child(_paddle)
	# 球
	_ball = _make_box(BALL_RADIUS * 2, BALL_RADIUS * 2, BALL_RADIUS * 2, Color("#ffffff"))
	_ball.position = Vector3(0, PLAY_Y, PADDLE_Z - 0.5)
	_world.add_child(_ball)


func _spawn_bricks() -> void:
	_bricks.clear()
	var grid_w = WALL_RIGHT - WALL_LEFT
	var bw = (grid_w - BRICK_GAP * (_brick_cols - 1)) / float(_brick_cols)
	for r in range(_brick_rows):
		var color: Color = ROW_COLORS[r % ROW_COLORS.size()]
		var value = maxi(1, _brick_rows - r)
		for c in range(_brick_cols):
			var bx = WALL_LEFT + c * (bw + BRICK_GAP) + bw / 2.0
			var bz = BRICK_TOP_Z + r * (BRICK_H + BRICK_GAP)
			var mesh = _make_box(bw, BRICK_H, 0.5, color)
			mesh.position = Vector3(bx, PLAY_Y, bz)
			_world.add_child(mesh)
			_bricks.append({"mesh": mesh, "alive": true, "value": value, "w": bw, "h": BRICK_H})


func _make_box(w: float, h: float, d: float, color: Color) -> MeshInstance3D:
	var mesh = MeshInstance3D.new()
	var bm = BoxMesh.new()
	bm.size = Vector3(w, h, d)
	mesh.mesh = bm
	var mat = StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.45
	mesh.material_override = mat
	return mesh


func _reset_ball_on_paddle() -> void:
	_ball_launched = false
	_ball_vel = Vector3.ZERO
	_ball.position = Vector3(_paddle.position.x, PLAY_Y, PADDLE_Z - 0.5)


func _process(delta: float) -> void:
	if _ended:
		return
	# 挡板键盘控制
	var dir = 0.0
	if Input.is_action_pressed("ui_left"):
		dir -= 1.0
	if Input.is_action_pressed("ui_right"):
		dir += 1.0
	if dir != 0.0:
		var speed = 8.0
		_paddle.position.x = clampf(_paddle.position.x + dir * speed * delta,
			WALL_LEFT + _paddle_width / 2.0, WALL_RIGHT - _paddle_width / 2.0)
	# 鼠标 X 控制挡板（SubViewport 内坐标 → 世界 X）
	if _viewport:
		var mp = _viewport.get_mouse_position()
		if mp.x > 0.5:
			var nx = (mp.x / float(_viewport.size.x)) * 2.0 - 1.0
			_paddle.position.x = clampf(nx * ((WALL_RIGHT - _paddle_width / 2.0 + WALL_LEFT + _paddle_width / 2.0) / 2.0),
				WALL_LEFT + _paddle_width / 2.0, WALL_RIGHT - _paddle_width / 2.0)
	# 空格 / 鼠标点击发射
	if Input.is_action_just_pressed("ui_accept") and not _ball_launched:
		_launch_ball()
	# 球未发射：贴在挡板上
	if not _ball_launched:
		_ball.position.x = _paddle.position.x
		_ball.position.z = PADDLE_Z - 0.5
		return
	# 球移动 + 反弹
	_ball.position += _ball_vel * delta
	# 左右墙
	if _ball.position.x - BALL_RADIUS < WALL_LEFT:
		_ball.position.x = WALL_LEFT + BALL_RADIUS
		_ball_vel.x = absf(_ball_vel.x)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
	elif _ball.position.x + BALL_RADIUS > WALL_RIGHT:
		_ball.position.x = WALL_RIGHT - BALL_RADIUS
		_ball_vel.x = -absf(_ball_vel.x)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
	# 顶墙
	if _ball.position.z - BALL_RADIUS < WALL_TOP_Z:
		_ball.position.z = WALL_TOP_Z + BALL_RADIUS
		_ball_vel.z = absf(_ball_vel.z)
		GameAudio.play_bleep(GameBleeps.Kind.HIT)
	# 挡板碰撞
	if _ball_vel.z > 0.0 \
			and _ball.position.z + BALL_RADIUS >= PADDLE_Z - 0.3 \
			and _ball.position.z - BALL_RADIUS <= PADDLE_Z + 0.3 \
			and absf(_ball.position.x - _paddle.position.x) <= _paddle_width / 2.0 + BALL_RADIUS:
		var rel: float = clampf((_ball.position.x - _paddle.position.x) / (_paddle_width / 2.0), -1.0, 1.0)
		var speed = _ball_vel.length()
		var angle = -PI / 2.0 + rel * (PI / 3.0)
		_ball_vel = Vector3(cos(angle) * speed, 0.0, sin(angle) * speed)
		_ball.position.z = PADDLE_Z - 0.5
		GameAudio.play_bleep(GameBleeps.Kind.PICKUP)
		GameJuice.shake_node(self, 3.0, 0.08)
	# 砖块碰撞（AABB，命中第一个即处理）
	for i in range(_bricks.size()):
		var b: Dictionary = _bricks[i]
		if not bool(b.get("alive", false)):
			continue
		var mesh: MeshInstance3D = b["mesh"]
		var bw: float = float(b.get("w", 1.0))
		var bh: float = float(b.get("h", BRICK_H))
		var bx0 = mesh.position.x - bw / 2.0
		var bx1 = mesh.position.x + bw / 2.0
		var bz0 = mesh.position.z - bh / 2.0
		var bz1 = mesh.position.z + bh / 2.0
		if _ball.position.x + BALL_RADIUS >= bx0 and _ball.position.x - BALL_RADIUS <= bx1 \
				and _ball.position.z + BALL_RADIUS >= bz0 and _ball.position.z - BALL_RADIUS <= bz1:
			var overlap_x = minf(_ball.position.x + BALL_RADIUS - bx0, bx1 - (_ball.position.x - BALL_RADIUS))
			var overlap_z = minf(_ball.position.z + BALL_RADIUS - bz0, bz1 - (_ball.position.z - BALL_RADIUS))
			if overlap_x < overlap_z:
				_ball_vel.x = -_ball_vel.x
				_ball.position.x += _ball_vel.x if _ball_vel.x > 0.0 else -overlap_x
			else:
				_ball_vel.z = -_ball_vel.z
				_ball.position.z += _ball_vel.z if _ball_vel.z > 0.0 else -overlap_z
			b["alive"] = false
			mesh.queue_free()
			var value = int(b.get("value", 1))
			_score += value
			_remaining -= 1
			GameAudio.play_bleep(GameBleeps.Kind.HIT)
			_refresh_hud()
			break
	# 球落底（超过挡板后方）→ 失命
	if _ball.position.z - BALL_RADIUS > PADDLE_Z + 1.2:
		_lives -= 1
		GameJuice.shake_node(self, 6.0, 0.14)
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.18)
		if _lives <= 0:
			_end(false)
			return
		_reset_ball_on_paddle()
		_refresh_hud()
	# 通关
	if _remaining <= 0:
		_end(true)


func _launch_ball() -> void:
	if _ball_launched:
		return
	_ball_launched = true
	var angle = -PI / 2.0 + (randf() - 0.5) * 0.6
	_ball_vel = Vector3(cos(angle) * _ball_speed, 0.0, sin(angle) * _ball_speed)
	GameAudio.play_bleep(GameBleeps.Kind.PICKUP)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _ended:
			return
		if not _ball_launched:
			_launch_ball()
		GameAudio.boot_interactive()
	elif event is InputEventKey and event.pressed:
		GameAudio.boot_interactive()


func _refresh_hud() -> void:
	_hud.set_score("分数 %d · 命 %d · 剩余砖块 %d" % [_score, _lives, _remaining])


func _end(won: bool) -> void:
	_ended = true
	if won:
		GameJuice.flash_background(self, Color(0.6, 1.0, 0.7), 0.35)
		_hud.show_banner("胜利！", "击碎全部砖块", 2.4)
		GameAudio.play_bleep(GameBleeps.Kind.WIN)
	else:
		GameJuice.flash_background(self, Color(1.0, 0.3, 0.3), 0.35)
		_hud.show_banner("失败", "再试一次", 2.0)

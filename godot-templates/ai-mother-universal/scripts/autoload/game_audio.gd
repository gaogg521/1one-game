extends Node
## 程序化铺底 + 蜂鸣（对标 Phaser GameSoundscape / webBleeps）

var _root_hz := 130.0
var _profile := "organic"
var _intensity := 0.55
var _ambient: AudioStreamPlayer
var _arp_timer: Timer
var _booted := false
var _muted := false
var _arp_idx := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_muted = DisplayServer.get_name() == "headless"
	if _muted:
		return
	_ambient = AudioStreamPlayer.new()
	_ambient.bus = &"Master"
	_ambient.volume_db = -14.0
	add_child(_ambient)


func configure_from_spec() -> void:
	GameSpecData.ensure_loaded()
	var pres = GameSpecData.raw.get("presentation", {})
	if pres is Dictionary:
		_profile = str(pres.get("musicProfile", "organic"))
	_intensity = float(GameSpecData.director().get("intensity", 0.55))
	_root_hz = _infer_root_hz()


func boot_interactive() -> void:
	if _booted or _muted:
		return
	_booted = true
	configure_from_spec()
	_start_ambient()


func play_bleep(kind: GameBleeps.Kind) -> void:
	if not _booted:
		boot_interactive()
	var t := 0.92 + _intensity * 0.12
	GameBleeps.play(self, kind, t)


func set_tension(t: float) -> void:
	if _ambient == null:
		return
	var vol := lerpf(-22.0, -14.0, clampf(t, 0.0, 1.0))
	_ambient.volume_db = vol


func _start_ambient() -> void:
	if _ambient == null:
		return
	var loop := _build_ambient_loop()
	if loop == null:
		return
	_ambient.stream = loop
	_ambient.volume_db = -14.0 if _profile == "neon" else -15.0
	_ambient.play()
	if _arp_timer == null:
		_arp_timer = Timer.new()
		_arp_timer.wait_time = 2.4
		_arp_timer.autostart = true
		_arp_timer.timeout.connect(_arp_ping)
		add_child(_arp_timer)


func _arp_ping() -> void:
	if not _booted:
		return
	var arp_scale := [1.0, 1.25, 1.5, 1.25][_arp_idx % 4]
	_arp_idx += 1
	GameBleeps.play(self, GameBleeps.Kind.PICKUP, 0.55 * arp_scale)


func _infer_root_hz() -> float:
	var c := GameSpecData.theme_color("playerColor", Color.GREEN)
	var h := c.get_hsv().x
	return 92.0 + h * 118.0


func _build_ambient_loop() -> AudioStreamWAV:
	var hz := 44100
	var dur := 4.0
	var n := int(hz * dur)
	var data := PackedByteArray()
	data.resize(n * 2)
	var base := _root_hz
	for i in n:
		var time := float(i) / float(hz)
		var lfo := sin(TAU * 0.11 * time) * 0.5 + 0.5
		var f1 := base * (1.0 + 0.02 * sin(TAU * 0.07 * time))
		var f2 := base * 1.5
		var s := (sin(TAU * f1 * time) * 0.12 + sin(TAU * f2 * time) * 0.06) * (0.35 + lfo * 0.25)
		if _profile == "neon":
			s += sin(TAU * (base * 2.0) * time) * 0.06
			s += sin(TAU * (base * 0.5) * time) * 0.05
		var v := int(clamp(s * 32767.0, -32768.0, 32767.0))
		data[i * 2] = v & 0xFF
		data[i * 2 + 1] = (v >> 8) & 0xFF
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = hz
	wav.stereo = false
	wav.loop_mode = AudioStreamWAV.LOOP_FORWARD
	wav.data = data
	return wav

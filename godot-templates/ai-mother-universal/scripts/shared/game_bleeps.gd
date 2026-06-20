class_name GameBleeps
extends RefCounted
## 轻量程序化蜂鸣（对标 Phaser webBleeps）

enum Kind { PICKUP, HIT, WIN, FIRE, EXPLODE }


static func play(parent: Node, kind: Kind, temperament: float = 1.0) -> void:
	# DisplayServer.is_headless() 在某些 Godot 4.4 构建不可用，用 OS.has_feature 替代
	if OS.has_feature("standalone") or OS.has_feature("editor"):
		pass  # 非纯 headless，继续播放
	if DisplayServer.get_name() == "" or DisplayServer.get_name() == "headless":
		return
	var t := clampf(temperament, 0.65, 1.45)
	var player := AudioStreamPlayer.new()
	player.bus = &"Master"
	parent.add_child(player)
	var stream := _make_stream(kind, t)
	if stream == null:
		player.queue_free()
		return
	player.stream = stream
	player.play()
	player.finished.connect(player.queue_free)


static func _make_stream(kind: Kind, t: float) -> AudioStreamWAV:
	var hz := 44100
	var dur := 0.14
	var freq := 740.0 * t
	match kind:
		Kind.FIRE:
			dur = 0.08
			freq = 920.0 * t
		Kind.EXPLODE:
			dur = 0.24
			freq = 110.0 * t
		Kind.HIT:
			dur = 0.22
			freq = 180.0 * t
		Kind.WIN:
			dur = 0.36
			freq = 523.0 * t
	var n := int(hz * dur)
	var data := PackedByteArray()
	data.resize(n * 2)
	for i in n:
		var time := float(i) / float(hz)
		var env := 1.0 - time / dur
		var f := freq
		var s := 0.0
		match kind:
			Kind.PICKUP:
				f = lerpf(740.0 * t, 1180.0 * t, time / 0.07)
				s = sin(TAU * f * time) * env * 0.35
			Kind.FIRE:
				f = lerpf(920.0 * t, 420.0 * t, time / dur)
				s = sin(TAU * f * time) * env * 0.22
			Kind.EXPLODE:
				s = (randf() * 2.0 - 1.0) * env * env * 0.42
				s += sin(TAU * f * time) * env * 0.28
			Kind.HIT:
				s = sign(sin(TAU * f * time)) * env * 0.32
				s += sin(TAU * (f * 1.75) * time) * env * 0.14
			Kind.WIN:
				if time > 0.16:
					f = 1046.0 * t
				elif time > 0.08:
					f = 784.0 * t
				s = sin(TAU * f * time) * env * 0.35
		var v := int(clamp(s * 32767.0, -32768.0, 32767.0))
		data[i * 2] = v & 0xFF
		data[i * 2 + 1] = (v >> 8) & 0xFF
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = hz
	wav.stereo = false
	return wav

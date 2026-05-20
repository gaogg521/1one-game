class_name GameDirector
extends RefCounted
## 导演事件：coinRain / miniBoss / goalShift / timeSlow / finalBarrage / goldenPickup / breathingRoom

var events: Array = []
var event_index: int = 0
var active_type: String = ""
var active_until: float = 0.0
var active_strength: float = 0.6
var coin_rain_until: float = 0.0
var coin_reward_mult: float = 1.0
var mini_boss_until: float = 0.0
var goal_shift_until: float = 0.0
var time_slow_until: float = 0.0
var spawn_pressure_mult: float = 1.0
var _coin_tick: float = 0.0
var _time: float = 0.0

signal banner(title: String, message: String)
signal spawn_mini_boss
signal goal_shift_ended(success: bool)
signal golden_pickup_window(started: bool)


func load_from_spec() -> void:
	var d := GameSpecData.director()
	events = d.get("events", []) if d is Dictionary else []
	event_index = 0
	active_type = ""
	coin_rain_until = 0.0
	coin_reward_mult = 1.0
	spawn_pressure_mult = 1.0


func tick(progress_0_1: float, delta: float) -> Dictionary:
	_time += delta
	var out := {
		"coin_gain": 0,
		"end_coin_rain": false,
		"time_slow": false,
		"spawn_boost": 1.0,
		"spawn_relief": 1.0,
		"golden_pickup": false,
	}
	if active_type != "" and _time >= active_until:
		if active_type == "coinRain":
			coin_reward_mult = 1.0
			out.end_coin_rain = true
		if active_type == "goalShift":
			goal_shift_ended.emit(true)
		if active_type == "goldenPickup":
			golden_pickup_window.emit(false)
		if active_type in ["timeSlow", "finalBarrage", "breathingRoom"]:
			time_slow_until = 0.0
			spawn_pressure_mult = 1.0
		active_type = ""
		active_until = 0.0
	if _time < coin_rain_until:
		_coin_tick -= delta
		if _coin_tick <= 0.0:
			_coin_tick = 0.9
			out.coin_gain = int(8 + active_strength * 14)
	if _time < time_slow_until:
		out.time_slow = true
		out.spawn_relief = 0.55
	if spawn_pressure_mult > 1.05:
		out.spawn_boost = spawn_pressure_mult
	if active_type == "" and event_index < events.size():
		var ev: Dictionary = events[event_index]
		if progress_0_1 >= float(ev.get("at", 1.0)):
			_start_event(ev)
			event_index += 1
	return out


func _start_event(ev: Dictionary) -> void:
	active_type = str(ev.get("type", ""))
	active_strength = float(ev.get("strength", 0.6))
	var dur := float(ev.get("durationMs", 4200)) / 1000.0
	active_until = _time + dur
	var title := str(ev.get("title", ""))
	if title == "":
		match active_type:
			"coinRain":
				title = "金币雨"
			"miniBoss":
				title = "精英波"
			"timeSlow":
				title = "慢动作"
			"finalBarrage":
				title = "终局弹幕"
			"goldenPickup":
				title = "黄金收集"
			"breathingRoom":
				title = "喘息窗口"
			_:
				title = "战场变奏"
	var msg := str(ev.get("message", ""))
	banner.emit(title, msg)
	match active_type:
		"coinRain":
			coin_rain_until = active_until
			coin_reward_mult = 2.0
			_coin_tick = 0.0
		"miniBoss":
			mini_boss_until = active_until
			spawn_mini_boss.emit()
		"goalShift":
			goal_shift_until = active_until
		"timeSlow":
			time_slow_until = active_until
		"finalBarrage":
			spawn_pressure_mult = 1.0 + active_strength * 0.85
			spawn_mini_boss.emit()
		"goldenPickup":
			golden_pickup_window.emit(true)
		"breathingRoom":
			time_slow_until = active_until
			spawn_pressure_mult = 0.45

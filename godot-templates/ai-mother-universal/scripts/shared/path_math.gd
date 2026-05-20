class_name PathMath
extends RefCounted
## 路径插值（塔防敌军行进，对齐 Phaser PathMetrics）

class PathMetrics:
	var points: PackedVector2Array = PackedVector2Array()
	var seg_len: Array[float] = []
	var total: float = 0.0


static func build(points: PackedVector2Array) -> PathMetrics:
	var m := PathMetrics.new()
	m.points = points
	var total := 0.0
	for i in range(points.size() - 1):
		var l := points[i].distance_to(points[i + 1])
		m.seg_len.append(l)
		total += l
	m.total = total
	return m


static func pos_at_dist(m: PathMetrics, dist: float) -> Vector2:
	if m.points.is_empty():
		return Vector2.ZERO
	var remaining := clampf(dist, 0.0, m.total)
	for i in range(m.seg_len.size()):
		if remaining <= m.seg_len[i]:
			var t := remaining / m.seg_len[i] if m.seg_len[i] > 0.0 else 0.0
			return m.points[i].lerp(m.points[i + 1], t)
		remaining -= m.seg_len[i]
	return m.points[m.points.size() - 1]

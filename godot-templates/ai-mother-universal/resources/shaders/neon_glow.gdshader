shader_type spatial;
render_mode cull_back;

// 赛博霓虹：强 emission + 边缘 rim fresnel 光晕（无 SSR/屏幕空间）。
// 适用：bullet-hell / neon-cyber assetStyle。

uniform vec4 albedo_color : source_color = vec4(0.0, 1.0, 0.8, 1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	vec3 base = albedo_color.rgb;
	float rim = 1.0 - max(dot(NORMAL, VIEW), 0.0);
	rim = pow(rim, 2.0);
	ALBEDO = base;
	EMISSION = base * (intensity * 0.6 + rim * 2.5);
	METALLIC = 0.0;
	ROUGHNESS = 0.4;
}

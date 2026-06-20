shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

// 科幻全息：扫描线 + 噪声扰动 + fresnel 透明度（仅 UV 域，无屏幕空间）。
// 适用：hard-sci-fi assetStyle。

uniform vec4 albedo_color : source_color = vec4(0.2, 0.8, 1.0, 0.6);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
	vec3 base = albedo_color.rgb;
	float scan = sin(FRAGCOORD.y * 0.6) * 0.15 + 0.85;
	float n = hash21(UV * 80.0 + vec2(TIME * 0.3, TIME * 0.15));
	float fres = 1.0 - max(dot(NORMAL, VIEW), 0.0);
	fres = pow(fres, 1.5);
	ALBEDO = base * scan;
	EMISSION = base * (intensity * 0.4 + fres * 1.8);
	ALPHA = (albedo_color.a + fres * 0.4) * (0.85 + n * 0.15);
}

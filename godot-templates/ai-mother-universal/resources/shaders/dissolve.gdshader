shader_type spatial;
render_mode cull_back, depth_draw_opaque;

// 溶解死亡：noise alpha clip + burn edge color。
// 受击/死亡时通过 dissolve_amount shader_parameter 控制进度（0=完全可见，1=完全溶解）。
// 适用：dark-fantasy assetStyle（受击/Boss 死亡动画）。

uniform vec4 albedo_color : source_color = vec4(0.9, 0.3, 0.1, 1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;
uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;

float hash21(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float value_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void fragment() {
	float n = value_noise(UV * 6.0 + vec2(TIME * 0.15));
	float threshold = dissolve_amount;
	if (n < threshold - 0.05) discard;
	vec3 base = albedo_color.rgb;
	float burn = smoothstep(threshold - 0.05, threshold + 0.1, n);
	vec3 burn_color = vec3(1.0, 0.5, 0.1);
	ALBEDO = mix(burn_color, base, burn) * intensity;
	EMISSION = burn_color * (1.0 - burn) * 2.5;
	ALPHA = albedo_color.a * smoothstep(threshold - 0.05, threshold + 0.02, n);
}

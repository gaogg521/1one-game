shader_type spatial;
render_mode cull_back;

// 水墨风：噪声扰动 + 边缘墨色加深。
// 适用：wuxia-flight assetStyle。

uniform vec4 albedo_color : source_color = vec4(0.1, 0.1, 0.15, 1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

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
	vec3 base = albedo_color.rgb;
	float n = value_noise(UV * 12.0);
	float fres = 1.0 - max(dot(NORMAL, VIEW), 0.0);
	fres = pow(fres, 1.5);
	vec3 ink = mix(base, vec3(0.02, 0.02, 0.04), fres * 0.85);
	ALBEDO = mix(ink, ink * (0.8 + n * 0.4), 0.5) * intensity;
	ROUGHNESS = 0.95;
	METALLIC = 0.0;
}

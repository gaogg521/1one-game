shader_type spatial;
render_mode unshaded, cull_back;

// 像素化：UV 量化 + 简单 banded LUT。
// 适用：blocky-pixel assetStyle。

uniform vec4 albedo_color : source_color = vec4(1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;
uniform float pixel_size : hint_range(4.0, 64.0) = 16.0;

void fragment() {
	vec2 quant_uv = floor(UV * pixel_size) / pixel_size;
	vec3 base = albedo_color.rgb;
	float lum = (base.r + base.g + base.b) / 3.0;
	float banded = floor(lum * 4.0) / 4.0;
	ALBEDO = mix(base, vec3(banded), 0.35) * intensity;
	ALPHA = albedo_color.a;
}

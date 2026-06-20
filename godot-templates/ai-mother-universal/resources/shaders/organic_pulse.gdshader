shader_type spatial;
render_mode cull_back;

// 自然脉动：sin 周期 emission + rim 轻发光。
// 适用：nature-organic assetStyle（塔基座 / 植物）。

uniform vec4 albedo_color : source_color = vec4(0.4, 0.8, 0.5, 1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	vec3 base = albedo_color.rgb;
	float pulse = sin(TIME * 2.5) * 0.5 + 0.5;
	float fres = 1.0 - max(dot(NORMAL, VIEW), 0.0);
	fres = pow(fres, 2.0);
	ALBEDO = base;
	EMISSION = base * (intensity * 0.3 + pulse * 0.4 * intensity + fres * 0.6);
	ROUGHNESS = 0.7;
	METALLIC = 0.0;
}

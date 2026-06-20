shader_type spatial;
render_mode cull_back;

// 卡通描边：stepped diffuse + rim outline。
// 适用：kawaii-mecha / cute-cartoon / 80s-cartoon assetStyle。

uniform vec4 albedo_color : source_color = vec4(1.0, 0.7, 0.4, 1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	vec3 base = albedo_color.rgb;
	vec3 light_dir = normalize(vec3(0.5, 0.8, 0.3));
	float ndotl = dot(NORMAL, light_dir);
	// 2 段阶梯
	float band = step(0.0, ndotl) * 0.5 + step(0.45, ndotl) * 0.5;
	float rim = 1.0 - max(dot(NORMAL, VIEW), 0.0);
	rim = pow(rim, 3.0);
	ALBEDO = base * (0.35 + band * 0.65) * intensity;
	EMISSION = base * rim * 0.6;
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
}

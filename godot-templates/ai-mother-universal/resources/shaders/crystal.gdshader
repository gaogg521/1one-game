shader_type spatial;
render_mode blend_mix, cull_back;

// 水晶：fresnel 内发光（无真折射，性能友好）。
// 适用：nature-organic（宝石 / 收集物变体）。

uniform vec4 albedo_color : source_color = vec4(0.6, 0.8, 1.0, 0.7);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	vec3 base = albedo_color.rgb;
	float fres = 1.0 - abs(dot(NORMAL, VIEW));
	fres = pow(fres, 2.0);
	ALBEDO = base * 0.4;
	EMISSION = base * (intensity * 0.5 + fres * 2.8);
	ALPHA = albedo_color.a * (0.5 + fres * 0.4);
	METALLIC = 0.1;
	ROUGHNESS = 0.1;
}

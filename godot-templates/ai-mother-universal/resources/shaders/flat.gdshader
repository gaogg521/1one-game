shader_type spatial;
render_mode unshaded, cull_back;

// 兜底着色器：纯 unlit + albedo，等价 StandardMaterial3D unlit。
// 所有 shader 都暴露 uniform vec4 albedo_color + uniform float intensity
// 以便 runtime 注入 theme 色。

uniform vec4 albedo_color : source_color = vec4(1.0);
uniform float intensity : hint_range(0.0, 4.0) = 1.0;

void fragment() {
	ALBEDO = albedo_color.rgb * intensity;
	ALPHA = albedo_color.a;
}

precision mediump float;

varying vec2 v_texCoord;

uniform float u_opacity;
uniform sampler2D u_texture;

void main(void) {
  vec4 texColor = texture2D(u_texture, v_texCoord);
  gl_FragColor.rgb = texColor.rgb;
  gl_FragColor.a = texColor.a * u_opacity;
}
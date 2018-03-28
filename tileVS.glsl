varying vec2 v_texCoord;

attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform vec4 u_tileOffset;

void main(void) {
  gl_Position = vec4(a_position * u_tileOffset.xy + u_tileOffset.zw, 0., 1.);
  v_texCoord = a_texCoord;
}

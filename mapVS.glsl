varying vec2 v_texCoord;

attribute vec2 a_position;
attribute vec2 a_texCoord;

uniform mat4 u_texCoordMatrix;
uniform mat4 u_projectionMatrix;

void main(void) {
  gl_Position = u_projectionMatrix * vec4(a_position, 0., 1.);
  v_texCoord = (u_texCoordMatrix * vec4(a_texCoord, 0., 1.)).st;
}

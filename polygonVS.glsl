varying vec2 vPosition;
varying vec4 vColor;

attribute vec4 color;

void main(void) {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vColor = color;
}

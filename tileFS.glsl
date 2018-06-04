precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;

void main(void) {
  vec4 texColor = texture2D(u_texture, v_texCoord);
  gl_FragColor.rgb = texColor.rgb;
  // gl_FragColor.rgb = vec3(1.0, 0.0, 0.0);
  gl_FragColor.a = 1.0;
}

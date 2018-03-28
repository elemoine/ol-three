import * as THREE from 'three/src/Three'

import mapVS from './mapVS.glsl'
import mapFS from './mapFS.glsl'

var mapEl = document.getElementById('map');
var mapWidth = mapEl.clientWidth;
var mapHeight = mapEl.clientHeight;

var renderer = new THREE.WebGLRenderer();
renderer.setSize(mapWidth, mapHeight);

mapEl.appendChild(renderer.domElement);

var array = new Float32Array([
  -1, -1, 0, 0,
  1, -1, 1, 0,
  -1, 1, 0, 1,
  1, 1, 1, 1
]);

var buffer = new THREE.InterleavedBuffer(array, 4);
var positionAttribute = new THREE.InterleavedBufferAttribute(buffer, 2, 0, false);
var texCoordAttribute = new THREE.InterleavedBufferAttribute(buffer, 2, 2, false);

var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
var scene = new THREE.Scene();

var u_texCoordMatrix = new THREE.Matrix4();
var u_projectionMatrix = new THREE.Matrix4();

(new THREE.TextureLoader()).load('patch.jpg',
  function(texture) {
    var material = new THREE.RawShaderMaterial({
      uniforms: {
        'u_texCoordMatrix': {value: u_texCoordMatrix},
        'u_projectionMatrix': {value: u_projectionMatrix},
        'u_opacity': {value: 1.0},
        'u_texture': {value: texture}
      },
      vertexShader: mapVS,
      fragmentShader: mapFS
    });

    var geometry = new THREE.BufferGeometry();
    geometry.setIndex([0, 1, 2, 1, 3, 2]);
    geometry.addAttribute('a_position', positionAttribute);
    geometry.addAttribute('a_texCoord', texCoordAttribute);

    var mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    //mesh.drawMode = THREE.TriangleStripDrawMode;
    scene.add(mesh);

    renderer.render(scene, camera);
  }
);


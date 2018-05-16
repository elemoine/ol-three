// OpenLayers imports
import OSM from 'ol/source/osm';

// Three.js imports
import {BufferGeometry} from 'three/src/core/BufferGeometry';
import {Color} from 'three/src/math/Color';
import {InterleavedBuffer} from 'three/src/core/InterleavedBuffer';
import {InterleavedBufferAttribute} from 'three/src/core/InterleavedBufferAttribute';
import {Matrix4} from 'three/src/math/Matrix4';
import {Mesh} from 'three/src/objects/Mesh';
import {OrthographicCamera} from 'three/src/cameras/OrthographicCamera';
import {RawShaderMaterial} from 'three/src/materials/RawShaderMaterial';
import {Scene} from 'three/src/scenes/Scene';
import {Texture} from 'three/src/textures/Texture';
import {Vector3} from 'three/src/math/Vector3';
import {WebGLRenderTarget} from 'three/src/renderers/WebGLRenderTarget';
import {WebGLRenderer} from 'three/src/renderers/WebGLRenderer';

// Local imports
import {TrackballControls} from './TrackballControls.js';
import RasterTileLayer from './rastertilelayer';


//
// main
//


var mapEl = document.getElementById('map');
var mapWidth = mapEl.clientWidth;
var mapHeight = mapEl.clientHeight;
var mapSize = [mapWidth, mapHeight];

var osmSource = new OSM();
var osmLayer = new RasterTileLayer(osmSource);

var renderer = new WebGLRenderer();
renderer.setSize(mapWidth, mapHeight);
renderer.setClearColor(new Color(0xffffff));
mapEl.appendChild(renderer.domElement);

var projectionExtent = osmSource.getProjection().getExtent();
var aspectRatio = mapWidth / mapHeight;

var initialResolution = 2445.98490512564;
var initialCenter = [351641.3047094788, 5826334.968589892];

var camera = new OrthographicCamera(
  projectionExtent[0], projectionExtent[2],
  projectionExtent[1] / aspectRatio, projectionExtent[3] / aspectRatio);
camera.position.z = initialResolution;
camera.position.x = initialCenter[0];
camera.position.y = initialCenter[1];

var controls = new TrackballControls(camera, mapEl);
controls.noRotate = true;
controls.panSpeedX = mapWidth;
controls.panSpeedY = mapHeight;
controls.zoomSpeed = 4.0;
controls.staticMoving = true;
controls.target.z = 0;
controls.target.x = camera.position.x;
controls.target.y = camera.position.y;
controls.addEventListener('change', render);

function render() {
  var center = [camera.position.x, camera.position.y];
  var resolution = camera.position.z;
  osmLayer.render(renderer, center, resolution, 0, mapSize);
  if (osmLayer.needsUpdate) {
    requestAnimationFrame(render);
  }
}

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
})();

render();

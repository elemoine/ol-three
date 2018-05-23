// OpenLayers imports
import OSM from 'ol/source/osm';
import Feature from 'ol/feature';
import KML from 'ol/format/kml'

// Three.js imports
import {BufferGeometry} from 'three/src/core/BufferGeometry';
import {Color} from 'three/src/math/Color';
import {InterleavedBuffer} from 'three/src/core/InterleavedBuffer';
import {InterleavedBufferAttribute} from 'three/src/core/InterleavedBufferAttribute';
import {Matrix4} from 'three/src/math/Matrix4';
import {PerspectiveCamera} from 'three/src/cameras/PerspectiveCamera';
import {RawShaderMaterial} from 'three/src/materials/RawShaderMaterial';
import {Scene} from 'three/src/scenes/Scene';
import {WebGLRenderer} from 'three/src/renderers/WebGLRenderer';


import {Shape} from 'three/src/extras/core/Shape';
import {ShapeBufferGeometry} from 'three/src/geometries/ShapeGeometry';
import {Mesh} from 'three/src/objects/Mesh'
import {MeshBasicMaterial} from 'three/src/materials/MeshBasicMaterial'
import {Vector3} from 'three/src/math/Vector3';

// Local imports
import {TrackballControls} from './TrackballControls.js';
import RasterTileLayer from './rastertilelayer';
import { renderFeature } from './vector';
import {GEOM_KML} from './test_geom'

//
// main
//


var mapEl = document.getElementById('map');
var mapWidth = mapEl.clientWidth;
var mapHeight = mapEl.clientHeight;
var mapSize = [mapWidth, mapHeight];

var osmSource = new OSM();
var osmLayer = new RasterTileLayer(osmSource);

// test vector stuff
var format = new KML();
var feature = format.readFeature(GEOM_KML, {
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857'
});


const scene = new Scene();
scene.add(osmLayer.rootMesh)

let featureMesh = renderFeature(feature)
featureMesh.renderOrder = 10
scene.add(featureMesh);




// renderer

var renderer = new WebGLRenderer();
renderer.setSize(mapWidth, mapHeight);
renderer.setClearColor(new Color(0x000000));
renderer.sortObjects = false;
mapEl.appendChild(renderer.domElement);

var projectionExtent = osmSource.getProjection().getExtent();
var aspectRatio = mapWidth / mapHeight;

var initialCenter = [595641.3047094788, 5626334.968589892];

var camera = new PerspectiveCamera(50, aspectRatio, 1, 10000000);
camera.position.z = 500000;
camera.position.x = initialCenter[0];
camera.position.y = initialCenter[1];

// tmp
// camera.position.z = 100;
// camera.position.x = 0;
// camera.position.y = 0;


var controls = new TrackballControls(camera, mapEl);
controls.noRotate = true;
controls.panSpeedX = 0.3;
controls.panSpeedY = 0.3;
controls.zoomSpeed = 4.0;
controls.staticMoving = false;
controls.target.z = 0;
controls.target.x = camera.position.x;
controls.target.y = camera.position.y;

(function animate() {
  requestAnimationFrame(animate);
  controls.update();

  renderer.clear();
  osmLayer.update(renderer, camera, mapSize);
  renderer.render(scene, camera, undefined);
})();

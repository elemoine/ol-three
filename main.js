// OpenLayers imports
import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import olsize from 'ol/size';
import OSM from 'ol/source/osm';
import TileState from 'ol/tilestate'

// Three.js imports
import {BufferGeometry} from 'three/src/core/BufferGeometry';
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
import tileVS from './tileVS.glsl'
import tileFS from './tileFS.glsl'
import mapVS from './mapVS.glsl'
import mapFS from './mapFS.glsl'
import {TrackballControls} from './TrackballControls.js';


var TileSource = function(olTileSource) {

  this.needsUpdate = false;

  this.source = olTileSource;
  this.renderTarget = new WebGLRenderTarget();
  this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var renderTileBuffer = new InterleavedBuffer(new Float32Array([
    0, 0, 0, 1,
    1, 0, 1, 1,
    0, 1, 0, 0,
    1, 1, 1, 0
  ]), 4);
  var tilePositionAttribute = new InterleavedBufferAttribute(renderTileBuffer, 2, 0, false);
  var tileTexCoordAttribute = new InterleavedBufferAttribute(renderTileBuffer, 2, 2, false);

  this.u_tileOffset = new Float32Array(4);
  this.tileMaterial = new RawShaderMaterial({
    uniforms: {
      'u_tileOffset': {value: null},
      'u_texture': {value: null}
    },
    vertexShader: tileVS,
    fragmentShader: tileFS
  });

  var tileBufferGeometry = new BufferGeometry();
  tileBufferGeometry.setIndex([0, 1, 2, 1, 3, 2]);
  tileBufferGeometry.addAttribute('a_position', tilePositionAttribute);
  tileBufferGeometry.addAttribute('a_texCoord', tileTexCoordAttribute);

  var tileMesh = new Mesh(tileBufferGeometry, this.tileMaterial);
  tileMesh.frustumCulled = false;

  this.tileScene = new Scene();
  this.tileScene.add(tileMesh);

  this.tileTextureCache = {};

  this.u_texCoordMatrix = new Matrix4();
  this.tmpMatrix = new Matrix4();

  var renderLayerBuffer = new InterleavedBuffer(new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    1, 1, 1, 1
  ]), 4);
  var layerPositionAttribute = new InterleavedBufferAttribute(renderLayerBuffer, 2, 0, false);
  var layerTexCoordAttribute = new InterleavedBufferAttribute(renderLayerBuffer, 2, 2, false);

  this.layerMaterial = new RawShaderMaterial({
    uniforms: {
      'u_texCoordMatrix': {value: this.u_texCoordMatrix},
      'u_projectionMatrix': {value: new Matrix4()},
      'u_opacity': {value: 1.0},
      'u_texture': {value: null}
    },
    vertexShader: mapVS,
    fragmentShader: mapFS
  });

  var layerBufferGeometry = new BufferGeometry();
  layerBufferGeometry.setIndex([0, 1, 2, 1, 3, 2]);
  layerBufferGeometry.addAttribute('a_position', layerPositionAttribute);
  layerBufferGeometry.addAttribute('a_texCoord', layerTexCoordAttribute);

  var layerMesh = new Mesh(layerBufferGeometry, this.layerMaterial);
  layerMesh.frustumCulled = false;

  this.layerScene = new Scene();
  this.layerScene.add(layerMesh);

  this.tmpSize = [0, 0];
  this.tmpExtent = olextent.createEmpty();
};

Object.assign(TileSource.prototype, {

  render: function(renderer, center, resolution, rotation, size) {

    var projection = this.source.getProjection();
    var extent = olextent.getForViewAndSize(center, resolution, rotation, size);
    var tileGrid = this.source.getTileGrid();
    var z = tileGrid.getZForResolution(resolution);
    var tileResolution = tileGrid.getResolution(z);
    var tilePixelSize = this.source.getTilePixelSize(z, window.devicePixelRatio, projection);
    var pixelRatio = tilePixelSize[0] / olsize.toSize(tileGrid.getTileSize(z), this.tmpSize)[0];
    var tilePixelResolution = tileResolution / pixelRatio;
    var tileGutter = this.source.getTilePixelRatio(pixelRatio) * this.source.getGutter(projection);
    var tileRange = tileGrid.getTileRangeForExtentAndZ(extent, z);
    var tileRangeSize = tileRange.getSize();
    var maxDimension = Math.max(
      tileRangeSize[0] * tilePixelSize[0],
      tileRangeSize[1] * tilePixelSize[1]);
    var framebufferDimension = olmath.roundUpToPowerOfTwo(maxDimension);
    var framebufferExtentDimension = tilePixelResolution * framebufferDimension;
    var origin = tileGrid.getOrigin(z);
    var minX = origin[0] + tileRange.minX * tilePixelSize[0] * tilePixelResolution;
    var minY = origin[1] + tileRange.minY * tilePixelSize[1] * tilePixelResolution;
    var framebufferExtent = [
      minX, minY,
      minX + framebufferExtentDimension, minY + framebufferExtentDimension
    ];
  
    if (this.renderTarget.width != framebufferDimension) {
        this.renderTarget.setSize(framebufferDimension, framebufferDimension);
    }

    var autoClear = renderer.autoClear;
    renderer.autoClear = false;

    this.needsUpdate = false;
  
    var x, y, tile, texture, tileState, tileExtent;
    var geometry, material, mesh, scene, orthographicCamera;
    for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
      for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
        tile = this.source.getTile(z, x, y, pixelRatio, projection);
        tileState = tile.getState();
        if (tileState != TileState.LOADED) {
            this.needsUpdate = true;
            tile.load();
        } else if (tileState == TileState.LOADED) {
            tileExtent = tileGrid.getTileCoordExtent(tile.tileCoord, this.tmpExtent);
            this.u_tileOffset[0] = 2 * (tileExtent[2] - tileExtent[0]) / framebufferExtentDimension;
            this.u_tileOffset[1] = 2 * (tileExtent[3] - tileExtent[1]) / framebufferExtentDimension;
            this.u_tileOffset[2] = 2 * (tileExtent[0] - framebufferExtent[0]) /
                framebufferExtentDimension - 1;
            this.u_tileOffset[3] = 2 * (tileExtent[1] - framebufferExtent[1]) /
                framebufferExtentDimension - 1;
            this.tileMaterial.uniforms['u_tileOffset'].value = this.u_tileOffset;
            this.tileMaterial.uniforms['u_texture'].value = this.getTextureForTile(tile);
            renderer.render(this.tileScene, this.camera, this.renderTarget);
        }
      }
    }

    renderer.autoClear = autoClear;
  
    this.u_texCoordMatrix.makeTranslation(
      (Math.round(center[0] / tileResolution) * tileResolution - framebufferExtent[0]) /
          (framebufferExtent[2] - framebufferExtent[0]),
      (Math.round(center[1] / tileResolution) * tileResolution - framebufferExtent[1]) /
          (framebufferExtent[3] - framebufferExtent[1]),
      0);
    this.tmpMatrix.makeScale(
      mapWidth * resolution / (framebufferExtent[2] - framebufferExtent[0]),
      mapHeight * resolution / (framebufferExtent[3] - framebufferExtent[1]),
      1.0);
    this.u_texCoordMatrix.multiply(this.tmpMatrix);
    this.tmpMatrix.makeTranslation(-0.5, -0.5, 0.0);
    this.u_texCoordMatrix.multiply(this.tmpMatrix);
  
    this.layerMaterial.uniforms['u_texture'].value = this.renderTarget.texture;

    renderer.render(this.layerScene, this.camera, undefined, true);
  },

  getTextureForTile: function(tile) {
    var tileKey = tile.getKey();
    var texture;
    if (tileKey in this.tileTextureCache) {
      texture = this.tileTextureCache[tileKey];
    } else {
      this.tileTextureCache[tileKey] = texture = new Texture(tile.getImage());
      texture.flipY = false;
    }
    texture.needsUpdate = true;
    return texture;
  }
});


//
// main
//


var mapEl = document.getElementById('map');
var mapWidth = mapEl.clientWidth;
var mapHeight = mapEl.clientHeight;
var mapSize = [mapWidth, mapHeight];

var osmSource = new OSM();
var tileSource = new TileSource(osmSource);

var renderer = new WebGLRenderer();
renderer.setSize(mapWidth, mapHeight);
mapEl.appendChild(renderer.domElement);

var projectionExtent = osmSource.getProjection().getExtent();
var aspectRatio = mapWidth / mapHeight;

var resolution = 2445.98490512564;
var rotation = 0;

var camera = new OrthographicCamera(
  projectionExtent[0], projectionExtent[2],
  projectionExtent[1] / aspectRatio, projectionExtent[3] / aspectRatio);
camera.position.z = 10;
camera.position.x = 351641.3047094788;
camera.position.y = 5826334.968589892;

var controls = new TrackballControls(camera);
controls.addEventListener('change', render);

function render() {
  var center = [camera.position.x, camera.position.y];
  tileSource.render(renderer, center, resolution, rotation, mapSize);
  if (tileSource.needsUpdate) {
      requestAnimationFrame(render);
  }
}

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
})();

render();

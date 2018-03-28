import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import olsize from 'ol/size';
import OSM from 'ol/source/osm';
import TileState from 'ol/tilestate'

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

import tileVS from './tileVS.glsl'
import tileFS from './tileFS.glsl'
import mapVS from './mapVS.glsl'
import mapFS from './mapFS.glsl'


var TileSource = function(olTileSource) {
  this.source = olTileSource;

  this.renderTarget = new WebGLRenderTarget();

  this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var renderTileBuffer = new InterleavedBuffer(new Float32Array([
    0, 0, 0, 1,
    1, 0, 1, 1,
    0, 1, 0, 0,
    1, 1, 1, 0
  ]), 4);
  this.tilePositionAttribute = new InterleavedBufferAttribute(renderTileBuffer, 2, 0, false);
  this.tileTexCoordAttribute = new InterleavedBufferAttribute(renderTileBuffer, 2, 2, false);

  this.u_texCoordMatrix = new Matrix4();
  this.u_projectionMatrix = new Matrix4();
  this.tmpMatrix = new Matrix4();

  var renderLayerBuffer = new InterleavedBuffer(new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    1, 1, 1, 1
  ]), 4);
  this.layerPositionAttribute = new InterleavedBufferAttribute(renderLayerBuffer, 2, 0, false);
  this.layerTexCoordAttribute = new InterleavedBufferAttribute(renderLayerBuffer, 2, 2, false);

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
  
    var x, y, tile, texture, tileState, tileExtent, u_tileOffset;
    var geometry, material, geomery, mesh, scene, orthographicCamera;
    for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
      for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
        tile = this.source.getTile(z, x, y, pixelRatio, projection);
        tileState = tile.getState();
        if (tileState != TileState.LOADED) {
            tile.load();
        } else if (tileState == TileState.LOADED) {
            u_tileOffset = new Float32Array(4);
            tileExtent = tileGrid.getTileCoordExtent(tile.tileCoord, this.tmpExtent);
            u_tileOffset[0] = 2 * (tileExtent[2] - tileExtent[0]) / framebufferExtentDimension;
            u_tileOffset[1] = 2 * (tileExtent[3] - tileExtent[1]) / framebufferExtentDimension;
            u_tileOffset[2] = 2 * (tileExtent[0] - framebufferExtent[0]) /
                framebufferExtentDimension - 1;
            u_tileOffset[3] = 2 * (tileExtent[1] - framebufferExtent[1]) /
                framebufferExtentDimension - 1;
            texture = new Texture(tile.getImage());
            texture.needsUpdate = true;
            texture.flipY = false;
            material = new RawShaderMaterial({
              uniforms: {
                'u_tileOffset': {value: u_tileOffset},
                'u_texture': {value: texture}
              },
              vertexShader: tileVS,
              fragmentShader: tileFS
            });
            geometry = new BufferGeometry();
            geometry.setIndex([0, 1, 2, 1, 3, 2]);
            geometry.addAttribute('a_position', this.tilePositionAttribute);
            geometry.addAttribute('a_texCoord', this.tileTexCoordAttribute);
            mesh = new Mesh(geometry, material);
            mesh.frustumCulled = false;
            scene = new Scene();
            scene.add(mesh);
            renderer.render(scene, this.camera, this.renderTarget);
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
  
    material = new RawShaderMaterial({
      uniforms: {
        'u_texCoordMatrix': {value: this.u_texCoordMatrix},
        'u_projectionMatrix': {value: this.u_projectionMatrix},
        'u_opacity': {value: 1.0},
        'u_texture': {value: this.renderTarget.texture}
      },
      vertexShader: mapVS,
      fragmentShader: mapFS
    });
    geometry = new BufferGeometry();
    geometry.setIndex([0, 1, 2, 1, 3, 2]);
    geometry.addAttribute('a_position', this.layerPositionAttribute);
    geometry.addAttribute('a_texCoord', this.layerTexCoordAttribute);
    mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene = new Scene();
    scene.add(mesh);
    renderer.render(scene, this.camera, undefined, true);
  }
});


//
// main
//


var mapEl = document.getElementById('map');
var mapWidth = mapEl.clientWidth;
var mapHeight = mapEl.clientHeight;
var mapSize = [mapWidth, mapHeight];

var tileSource = new TileSource(new OSM());

var renderer = new WebGLRenderer();
renderer.setSize(mapWidth, mapHeight);
mapEl.appendChild(renderer.domElement);

function render() {

  requestAnimationFrame(render);

  var center = [351641.3047094788, 5826334.968589892]
  var resolution = 2445.98490512564;
  var rotation = 0;

  tileSource.render(renderer, center, resolution, rotation, mapSize);
}
render();

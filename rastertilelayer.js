// OpenLayers imports
import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import olsize from 'ol/size';
import TileState from 'ol/tilestate'

// Three.js imports
import {BufferGeometry} from 'three/src/core/BufferGeometry';
import {PlaneGeometry} from 'three/src/geometries/PlaneGeometry';
import {InterleavedBuffer} from 'three/src/core/InterleavedBuffer';
import {InterleavedBufferAttribute} from 'three/src/core/InterleavedBufferAttribute';
import {Matrix4} from 'three/src/math/Matrix4';
import {Mesh} from 'three/src/objects/Mesh';
import {OrthographicCamera} from 'three/src/cameras/OrthographicCamera';
import {RawShaderMaterial} from 'three/src/materials/RawShaderMaterial';
import {MeshBasicMaterial} from 'three/src/materials/MeshBasicMaterial'
import {Scene} from 'three/src/scenes/Scene';
import {Texture} from 'three/src/textures/Texture';
import {WebGLRenderTarget} from 'three/src/renderers/WebGLRenderTarget';

// local imports
import tileVS from './tileVS.glsl'
import tileFS from './tileFS.glsl'
import mapVS from './mapVS.glsl'
import mapFS from './mapFS.glsl'

var RasterTileLayer = function(olTileSource) {

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

  this.layerMaterial = new MeshBasicMaterial( { color: 0xffffff })
  this.layerMaterial.map = this.renderTarget.texture;

  var layerBufferGeometry = new PlaneGeometry(2, 2, 1, 1);

  var layerMesh = new Mesh(layerBufferGeometry, this.layerMaterial);
  layerMesh.frustumCulled = false;

  this.layerMesh = layerMesh

  this.tmpSize = [0, 0];
  this.tmpExtent = olextent.createEmpty();

  this.renderedTileRange = null;
  this.renderedFramebufferExtent = null;
  this.renderedRevision = -1;
};

Object.assign(RasterTileLayer.prototype, {

  render: function(renderer, camera, size) {


    var center = [camera.position.x, camera.position.y];
    let ratio = size[1] / size[0]
    let rotation = 0

    // move & scale main mesh to keep facing the camera
    this.layerMesh.position.x = center[0]
    this.layerMesh.position.y = center[1]

    let scale = camera.position.z * Math.tan(camera.fov / 360 * Math.PI * 2)
    this.layerMesh.scale.x = scale * 0.5;
    this.layerMesh.scale.y = scale * 0.5;

    // draw frame buffer to be used as texture on the main mesh
    var resolution = scale / size[0];

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

    var framebufferExtent;
    if (this.renderedTileRange &&
        this.renderedTileRange.equals(tileRange) &&
        this.renderedRevision == this.source.getRevision()) {
        framebufferExtent = this.renderedFramebufferExtent;
    } else {
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
      renderer.clearTarget(this.renderTarget, true);

      var allTilesLoaded = true;

      var x, y, tile, texture, tileState, tileExtent;
      var geometry, material, mesh, scene, orthographicCamera;
      for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
        for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
          tile = this.source.getTile(z, x, y, pixelRatio, projection);
          tileState = tile.getState();
          if (tileState != TileState.LOADED) {
              allTilesLoaded = false;
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

      if (allTilesLoaded) {
        this.renderedTileRange = tileRange;
        this.renderedFramebufferExtent = framebufferExtent;
        this.renderedRevision = this.source.getRevision();
      } else {
        this.renderedTileRange = null;
        this.renderedFramebufferExtent = null;
        this.renderedRevision = -1;
      }

      this.needsUpdate = !allTilesLoaded;
    }

    renderer.autoClear = autoClear;

    // this.u_texCoordMatrix.makeTranslation(
    //   (Math.round(center[0] / tileResolution) * tileResolution - framebufferExtent[0]) /
    //       (framebufferExtent[2] - framebufferExtent[0]),
    //   (Math.round(center[1] / tileResolution) * tileResolution - framebufferExtent[1]) /
    //       (framebufferExtent[3] - framebufferExtent[1]),
    //   0);
    // this.tmpMatrix.makeScale(
    //   size[0] * resolution / (framebufferExtent[2] - framebufferExtent[0]),
    //   size[1] * resolution / (framebufferExtent[3] - framebufferExtent[1]),
    //   1.0);
    // this.u_texCoordMatrix.multiply(this.tmpMatrix);
    // this.tmpMatrix.makeTranslation(-0.5, -0.5, 0.0);
    // this.u_texCoordMatrix.multiply(this.tmpMatrix);

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

export default RasterTileLayer;
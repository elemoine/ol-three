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

// A tile layer simply generates meshes based on the current view
// Implementations will have to redefine the generateTileMesh method
// All tile meshes must have this.rootMesh as parent

var BaseTileLayer = function(olTileSource) {
  this.rootMesh = new Mesh();

  this.tileMeshes = {};   // will hold all tile meshes; key is tile.getKey()

  this.tmpSize = [0, 0];
  this.tmpExtent = olextent.createEmpty();

  this.renderedTileRange = null;
  this.renderedFramebufferExtent = null;
  this.renderedRevision = -1;

  this.source = olTileSource
};

Object.assign(BaseTileLayer.prototype, {

  generateTileMesh: function(tile) {
    return new Mesh();
  },

  disposeTileMesh: function(mesh) {
  },

  updateTileMesh: function(mesh) {
  },

  update: function(renderer, camera, size) {
    var center = [camera.position.x, camera.position.y];
    let ratio = size[1] / size[0]
    let rotation = 0

    // scale is computed based on camera position
    let scale = camera.position.z * Math.tan(camera.fov / 360 * Math.PI) * 2
    var resolution = scale / size[1];

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

    var allTilesLoaded = true
    var tileExtent
    var tileKey

    // loop on tile range to load missing tiles and generate new meshes
    if (this.renderedTileRange &&
        this.renderedTileRange.equals(tileRange) &&
        this.renderedRevision == this.source.getRevision()) {
        // nothing
    } else {
      // mark all existing tile meshes as unused (removed later)
      Object.keys(this.tileMeshes).forEach(key => {
        if (this.tileMeshes[key]) this.tileMeshes[key].toDelete = true
      })

      var tileRangeSize = tileRange.getSize();
      var origin = tileGrid.getOrigin(z);
      var minX = origin[0] + tileRange.minX * tilePixelSize[0] * tilePixelResolution;
      var minY = origin[1] + tileRange.minY * tilePixelSize[1] * tilePixelResolution;

      var x, y, tile, texture, tileState, tileExtent;
      var geometry, material, mesh, scene, orthographicCamera;
      for (x = tileRange.minX; x <= tileRange.maxX; ++x) {
        for (y = tileRange.minY; y <= tileRange.maxY; ++y) {
          tile = this.source.getTile(z, x, y, pixelRatio, projection);
          tileState = tile.getState();
          tileKey = tile.getKey()
          if (tileState != TileState.LOADED) {
            allTilesLoaded = false;
            tile.load();
          } else if (tileState == TileState.LOADED && !this.tileMeshes[tileKey]) {
            tileExtent = tileGrid.getTileCoordExtent(tile.tileCoord, this.tmpExtent);
            this.tileMeshes[tileKey] = this.generateTileMesh(tile);
            this.rootMesh.add(this.tileMeshes[tileKey]);
            this.tileMeshes[tileKey].position.x = tileExtent[0];
            this.tileMeshes[tileKey].position.y = tileExtent[1];
            this.tileMeshes[tileKey].scale.x = tileExtent[2] - tileExtent[0];
            this.tileMeshes[tileKey].scale.y = tileExtent[3] - tileExtent[1];
          }

          if (this.tileMeshes[tileKey]) {
            this.tileMeshes[tileKey].toDelete = false;
          }
        }
      }

      // loop on meshes
      Object.keys(this.tileMeshes).forEach(key => {
        if (!this.tileMeshes[key]) return;

        // remove unused meshes
        if (this.tileMeshes[key].toDelete) {
          this.disposeTileMesh(this.tileMeshes[key]);
          this.rootMesh.remove(this.tileMeshes[key]);
          this.tileMeshes[key] = undefined;
          return;
        }
      })

      if (allTilesLoaded) {
        this.renderedTileRange = tileRange;
        this.renderedRevision = this.source.getRevision();
      } else {
        this.renderedTileRange = null;
        this.renderedRevision = -1;
      }
    }

    Object.keys(this.tileMeshes).forEach(key => {
      if (!this.tileMeshes[key]) return;

      this.updateTileMesh(this.tileMeshes[key]);
    })
  },
});

export default BaseTileLayer;
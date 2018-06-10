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

import BaseTileLayer from './basetilelayer';

var RasterTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);

  this.geometry = new PlaneGeometry(1, 1, 4, 4);
  const matrix = new Matrix4().makeTranslation(0.5, 0.5, 0);
  this.geometry.applyMatrix(matrix);

  this.tileTextureCache = {};
};

RasterTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(RasterTileLayer.prototype, {

  generateTileMesh: function(tile, isCached, projection, tileExtent) {
    const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true })
    material.map = this.getTextureForTile(tile);
    material.opacity = isCached ? 1 : 0;

    const mesh = new Mesh(this.geometry, material);

    mesh.position.x = tileExtent[0];
    mesh.position.y = tileExtent[1];
    mesh.scale.x = tileExtent[2] - tileExtent[0];
    mesh.scale.y = tileExtent[3] - tileExtent[1];

    return mesh;
  },

  disposeTileMesh: function(mesh) {
    mesh.material.dispose();
  },

  updateTileMesh: function(mesh) {
    let opacity = mesh.material.opacity;
    mesh.material.opacity += (1 - opacity) * 0.2;
  },

  getTextureForTile: function(tile) {
    var tileKey = tile.getKey();
    var texture;
    if (tileKey in this.tileTextureCache) {
      texture = this.tileTextureCache[tileKey];
    } else {
      this.tileTextureCache[tileKey] = texture = new Texture(tile.getImage());
    }
    texture.needsUpdate = true;
    return texture;
  }
});

export default RasterTileLayer;
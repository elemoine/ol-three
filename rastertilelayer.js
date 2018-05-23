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

import BaseTileLayer from './basetilelayer';

var RasterTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);
};

RasterTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(RasterTileLayer.prototype, {

  generateTileMesh: function(tile) {

    this.tileTextureCache = {};

    const material = new MeshBasicMaterial({ color: 0xffffff })
    material.map = this.getTextureForTile(tile);

    const geom = new PlaneGeometry(1, 1, 4, 4);
    const matrix = new Matrix4().makeTranslation(0.5, 0.5, 0);
    geom.applyMatrix(matrix);

    const mesh = new Mesh(geom, material);

    return mesh;
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
// OpenLayers imports
import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import olsize from 'ol/size';
import TileState from 'ol/tilestate';

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

import {renderFeature} from './vector';


var VectorTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);

};

VectorTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(VectorTileLayer.prototype, {

  generateTileMesh: function(tile, isCached, sourceProj) {
    const mesh = new Mesh();

    tile.tileKeys.forEach(tileKey => {
      const features = tile.getTile(tileKey).getFeatures();
      features.forEach(feature => {
        let m = renderFeature(feature, tile.getTile(tileKey).getProjection(), sourceProj)
        m && m.length && mesh.add.apply(mesh, m);
      });
    });

    return mesh;
  },

  disposeTileMesh: function(mesh) {
  },

  updateTileMesh: function(mesh) {
  }
});

export default VectorTileLayer;
// OpenLayers imports
import olextent from 'ol/extent';
import olmath from 'ol/math';
import olproj from 'ol/proj';
import olsize from 'ol/size';
import TileState from 'ol/tilestate';

// Three.js imports
import {Mesh} from 'three/src/objects/Mesh';
import {BufferGeometry} from 'three/src/core/BufferGeometry';
import {Float32BufferAttribute} from 'three/src/core/BufferAttribute';
import {LineSegments} from 'three/src/objects/LineSegments';

import BaseTileLayer from './basetilelayer';

import {renderFeature, polygonMaterial, lineMaterial} from './vector';
import {getResolution} from './view';


var VectorTileLayer = function(olTileSource) {
  BaseTileLayer.call(this, olTileSource);

};

VectorTileLayer.prototype = Object.create(BaseTileLayer.prototype);

Object.assign(VectorTileLayer.prototype, {

  generateTileMesh: function(tile, isCached, sourceProj) {
    const mesh = new Mesh();

    // generate arrays for colors, positions
    const arrays = {
      positions: [],
      colors: [],
      indices: [],
      linePositions: [],
      lineColors: [],
      lineEnds: []
    };

    const styleFunction = this.getStyleFunction();

    tile.tileKeys.forEach(tileKey => {
      const features = tile.getTile(tileKey).getFeatures();
      features.forEach(feature => {
        const styles = styleFunction(feature, getResolution());
        styles && renderFeature(feature, styles, arrays,
          tile.getTile(tileKey).getProjection(), sourceProj);
      });
    });

    // use arrays to generate a geometry
    const geom = new BufferGeometry();
    geom.setIndex(arrays.indices);
    geom.addAttribute('position', new Float32BufferAttribute(arrays.positions, 3));
    geom.addAttribute('color', new Float32BufferAttribute(arrays.colors, 4));
    geom.addAttribute('uv', new Float32BufferAttribute(arrays.uvs, 2));

    const rootMesh = new Mesh(geom, polygonMaterial);

    // generate line mesh
    const lineGeom = new BufferGeometry();
    lineGeom.addAttribute('position', new Float32BufferAttribute(arrays.linePositions, 3));
    lineGeom.addAttribute('color', new Float32BufferAttribute(arrays.lineColors, 4));
    rootMesh.add(new LineSegments(lineGeom, lineMaterial));

    return rootMesh;
  },

  disposeTileMesh: function(mesh) {
  },

  updateTileMesh: function(mesh) {
  }
});

export default VectorTileLayer;
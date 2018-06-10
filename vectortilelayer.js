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
import {Line} from 'three/src/objects/Line';

import BaseTileLayer from './basetilelayer';

import {renderFeature, polygonMaterial, lineMaterial} from './vector';


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

    tile.tileKeys.forEach(tileKey => {
      const features = tile.getTile(tileKey).getFeatures();
      features.forEach(feature => {
        renderFeature(feature, arrays,
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

    let lineGeom, lineMesh, linePositions, lineColors;
    let lineArrays;
    let i, l;
    for (let i = 0, l = arrays.lineEnds.length; i < l; i++) {
      lineGeom = new BufferGeometry();
      linePositions = arrays.linePositions.slice(
        i === 0 ? 0 : arrays.lineEnds[i - 1] * 3,
        arrays.lineEnds[i] * 3);
      lineColors = arrays.lineColors.slice(
        i === 0 ? 0 : arrays.lineEnds[i - 1] * 3,
        arrays.lineEnds[i] * 3);
      lineGeom.addAttribute('position', new Float32BufferAttribute(linePositions, 3));
      lineGeom.addAttribute('color', new Float32BufferAttribute(lineColors, 4));
      lineMesh = new Line(lineGeom, lineMaterial);
      rootMesh.add(lineMesh);
    }

    return rootMesh;
  },

  disposeTileMesh: function(mesh) {
  },

  updateTileMesh: function(mesh) {
  }
});

export default VectorTileLayer;
import GeometryType from 'ol/geom/geometrytype';

import {Shape} from 'three/src/extras/core/Shape';
import {ShapeBufferGeometry} from 'three/src/geometries/ShapeGeometry';
import {Geometry} from 'three/src/core/Geometry';
import {Mesh} from 'three/src/objects/Mesh'
import {Line} from 'three/src/objects/Line'
import {MeshBasicMaterial} from 'three/src/materials/MeshBasicMaterial'
import {LineBasicMaterial} from 'three/src/materials/LineBasicMaterial'
import {Vector2} from 'three/src/math/Vector2';
import {Vector3} from 'three/src/math/Vector3';

import {DoubleSide} from 'three/src/Three'



const material = new MeshBasicMaterial( { color: 0x2222ff, opacity: 0.4, transparent: true, depthTest: false } );
const lineMaterial = new LineBasicMaterial( {
	color: 0x2222ff,
	linewidth: 4,
	linecap: 'round', //ignored by WebGLRenderer
	linejoin:  'round', //ignored by WebGLRenderer,
  transparent: true,
  depthTest: false
} );

export function renderFeature(olFeature) {
  const olGeom = olFeature.getGeometry();

  if (!olGeom) { return }

  // big switch to handle everything
  switch (olGeom.getType()) {
    case GeometryType.POLYGON:
      return renderPolygon(olGeom.getLinearRings());

  }
}

// rings is an array of array of coords
// TODO: reuse shape & geom objects
// TODO: handle holes
// TODO: normalize coord stride (ie add z if missing)
function renderPolygon(rings) {
  const shape = new Shape(rings[0].getCoordinates().map(coords => new Vector2( coords[0], coords[1] ) ));
  const geom = new ShapeBufferGeometry(shape);
  const mesh = new Mesh(geom, material)

  var lineGeom = new Geometry();
  lineGeom.vertices = rings[0].getCoordinates().map(coords => new Vector3( coords[0], coords[1], 0 ) )

  const lineMesh = new Line( lineGeom, lineMaterial );
  mesh.add(lineMesh)
  return mesh;
}
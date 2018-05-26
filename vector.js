import GeometryType from 'ol/geom/geometrytype';
import olproj from 'ol/proj';

import {Shape} from 'three/src/extras/core/Shape';
import {Path} from 'three/src/extras/core/Path';
import {ShapeGeometry, ShapeBufferGeometry} from 'three/src/geometries/ShapeGeometry';
import {Geometry} from 'three/src/core/Geometry';
import {BufferGeometry} from 'three/src/core/BufferGeometry';
import {Mesh} from 'three/src/objects/Mesh'
import {Line} from 'three/src/objects/Line'
import {MeshBasicMaterial} from 'three/src/materials/MeshBasicMaterial'
import {LineBasicMaterial} from 'three/src/materials/LineBasicMaterial'
import {Vector2} from 'three/src/math/Vector2';
import {Vector3} from 'three/src/math/Vector3';
import {ShapeUtils} from 'three/src/extras/ShapeUtils';

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

const holeMaterial = new MeshBasicMaterial( { color: 0xff2222, opacity: 0.4, transparent: true, depthTest: false } );

export function renderFeature(olFeature, proj1, proj2) {
  const olGeom = olFeature.getGeometry();

  if (!olGeom) { return }

  if (proj1 && proj2 && !olproj.equivalent(proj1, proj2)) {
    olGeom.transform(proj1, proj2);
  }

  // big switch to handle everything
  switch (olGeom.getType()) {
    case GeometryType.LINE_STRING:
      // console.log('line')
      break;
    case GeometryType.LINEAR_RING:
      // console.log('linear ring')
      break;
    case GeometryType.MULTI_POLYGON:
      // console.log('multi')
      break;
    case GeometryType.GEOMETRY_COLLECTION:
      // console.log('collection')
      break;
    case GeometryType.CIRCLE:
      // console.log('circle')
      break;
    case GeometryType.POINT:
      // console.log('point')
      break;
    case GeometryType.POLYGON:
      // console.log('poly')
      return renderPolygonGeometry(olGeom, proj1, proj2);
      break;

  }
}

// returns an array of meshes
// TODO: normalize coord stride (ie add z if missing)
function renderPolygonGeometry(olGeom, proj1, proj2) {

  const ends = olGeom.getEnds();
  const stride = olGeom.getStride();
  const coordReduce = (acc, curr, i, array) => {
    if ((i - 1) % stride === 0) {
      acc.push(new Vector3(array[i - stride + 1], array[i - stride + 2], stride > 2 ? array[i - stride + 3] : 0));
    }
    return acc;
  }

  // let reproject = false;
  // let transformMap
  // if (proj1 && proj2 && !olproj.equivalent(proj1, proj2)) {
  //   reproject = true
  //   transformMap = coords => olproj.transform([coords.x, coords.y], proj1, proj2);
  // }

  const flatCoordinates = olGeom.getFlatCoordinates();

  const meshes = [];

  if (ends.length === 0) {
    return null
  }

  let ring, outerRing, hole, holes, i;

  // generate a new mesh from an outer ring & holes
  const createMesh = () => {
    const shape = new Shape(outerRing);
    shape.holes = holes;
    const geom = new ShapeBufferGeometry(shape);
    const mesh = new Mesh(geom, material)

    // outer ring stroke
    var lineGeom = new BufferGeometry().setFromPoints(outerRing);
    const lineMesh = new Line(lineGeom, lineMaterial);
    mesh.add(lineMesh)

    // holes stroke
    holes.forEach(hole => {
      var holeGeom = new BufferGeometry().setFromPoints(hole.getPoints());
      mesh.add(new Line(holeGeom, lineMaterial))
      // const holeShape = new Shape(hole.getPoints());
      // const holeGeom = new ShapeBufferGeometry(holeShape);
      // const holeMesh = new Mesh(holeGeom, holeMaterial)
      // mesh.add(holeMesh)
    });

    meshes.push(mesh);
  }

  // loop on ends: create a new polygon with holes everytime
  // the ring is CW
  for (let i = 0; i < ends.length; i++) {
    if (ends[i] === ends[i - 1]) {
      continue;
    }

    ring = flatCoordinates.slice(i === 0 ? 0 : ends[i - 1], ends[i]).reduce(coordReduce, [])

    // if (reproject) ring = ring.map(transformMap)
    // const outerRing = flatCoordinates.reduce(coordReduce, []);

    // this is an outer ring: generate the previous polygon and initiate new one
    if (ShapeUtils.isClockWise(ring)) {
      if (outerRing) createMesh();
      outerRing = ring;
      holes = [];
    }

    // console.log('outerRing clockwise? ' + ShapeUtils.isClockWise(outerRing));

    // this is an inner ring (hole)
    else if (outerRing) {
  // console.log('hole ring clockwise? ' + ShapeUtils.isClockWise(holePoints));
      hole = new Path(ring);
      holes.push(hole);
    }
  }

  // generate the last pending polygon
  if (outerRing) createMesh();

  return meshes;
}
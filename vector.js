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
import {InterleavedBuffer} from 'three/src/core/InterleavedBuffer';
import {InterleavedBufferAttribute} from 'three/src/core/InterleavedBufferAttribute';
import {Matrix4} from 'three/src/math/Matrix4';
import {ShaderMaterial} from 'three/src/materials/ShaderMaterial';
import {Color} from 'three/src/math/Color';

import {DoubleSide} from 'three/src/Three'

import polygonVS from './polygonVS.glsl' 
import polygonFS from './polygonFS.glsl'



// const material = new MeshBasicMaterial( { color: 0x2222ff, opacity: 0.4, transparent: true, depthTest: false } );
export const polygonMaterial = new ShaderMaterial({ 
  uniforms: {
  },
  vertexShader: polygonVS, 
  fragmentShader: polygonFS,
  transparent: true,
  depthTest: false
});

export const lineMaterial = new LineBasicMaterial( {
	color: 0x2222ff,
	linewidth: 4,
  transparent: true,
  depthTest: false
});

const holeMaterial = new MeshBasicMaterial( { color: 0xff2222, opacity: 0.4, transparent: true, depthTest: false } );

export function renderFeature(olFeature, olStyles, arrays, proj1, proj2) {
  const olGeom = olFeature.getGeometry();

  if (!olGeom) { return }

  if (proj1 && proj2 && !olproj.equivalent(proj1, proj2)) {
    olGeom.transform(proj1, proj2);
  }

  // big switch to handle everything
  switch (olGeom.getType()) {
    case GeometryType.LINE_STRING:
    case GeometryType.MULTI_LINE_STRING:
      return renderLinestringGeometry(olGeom, null, arrays);
      break;
    case GeometryType.LINEAR_RING:
      break;
    case GeometryType.MULTI_POLYGON:
      break;
    case GeometryType.GEOMETRY_COLLECTION:
      break;
    case GeometryType.CIRCLE:
      break;
    case GeometryType.POINT:
      break;
    case GeometryType.POLYGON:
      return renderPolygonGeometry(olGeom, null, arrays);
      break;
  }
}

// returns an array of meshes
// arrays can hold: indices, positions, colors, uvs,
// linePositions, lineColors, lineEnds
function renderPolygonGeometry(olGeom, olStyle, arrays) {
  const ends = olGeom.getEnds();
  const stride = olGeom.getStride();
  const coordReduce = (acc, curr, i, array) => {
    if ((i + 1) % stride === 0) {
      acc.push(new Vector3(array[i - stride + 1], array[i - stride + 2], stride > 2 ? array[i - stride + 3] : 0));
    }
    return acc;
  }

  const flatCoordinates = olGeom.getFlatCoordinates();

  if (ends.length === 0) {
    return null
  }

  let ring, outerRing, hole, holeRings, i;

  // appends given arrays by triangulating outer & inner rings
  const appendArrays = () => {
    const indexOffset = arrays.positions ? arrays.positions.length / 3 : 0;

    // add vertices & colors to arrays (outer ring and holes)
    let i, l;
    let j, hole;
    for (i = 0, l = outerRing.length - 1; i < l; i++) {
      arrays.positions && arrays.positions.push(outerRing[i].x, outerRing[i].y, 0);
      arrays.colors && arrays.colors.push(0.2, 0.2, 1, 0.5);
      arrays.uvs && arrays.uvs.push(outerRing[i].x, outerRing[i].y); // world uvs
      arrays.linePositions && arrays.linePositions.push(
        outerRing[i].x, outerRing[i].y, 0,
        outerRing[i+1].x, outerRing[i+1].y, 0);
      arrays.lineColors && arrays.lineColors.push(
        0.2, 0.2, 1, 0.5,
        0.2, 0.2, 1, 0.5);
    }
    for (j = 0; j < holeRings.length; j++) {
      hole = holeRings[j];
      for (i = 0, l = hole.length - 1; i < l; i++) {
        arrays.positions && arrays.positions.push(hole[i].x, hole[i].y, 0);
        arrays.colors && arrays.colors.push(0.2, 0.2, 1, 0.5);
        arrays.uvs && arrays.uvs.push(hole[i].x, hole[i].y); // world uvs
        arrays.linePositions && arrays.linePositions.push(
          hole[i].x, hole[i].y, 0,
          hole[i+1].x, hole[i+1].y, 0);
        arrays.lineColors && arrays.lineColors.push(
          0.2, 0.2, 1, 0.5,
          0.2, 0.2, 1, 0.5);
      }
    }

    // triangulate shape to add indices
    const faces = ShapeUtils.triangulateShape(outerRing, holeRings);
    for (i = 0, l = faces.length; i < l; i++) {
      arrays.indices && arrays.indices.push(
        faces[i][0] + indexOffset,
        faces[i][1] + indexOffset,
        faces[i][2] + indexOffset
      );
    }
  }

  // loop on ends: create a new polygon with holes everytime
  // the ring is CW
  for (let i = 0; i < ends.length; i++) {
    if (ends[i] === ends[i - 1]) {
      continue;
    }

    ring = flatCoordinates.slice(i === 0 ? 0 : ends[i - 1], ends[i]).reduce(coordReduce, [])

    // this is an outer ring: generate the previous polygon and initiate new one
    if (ShapeUtils.isClockWise(ring)) {
      if (outerRing) appendArrays();
      outerRing = ring;
      holeRings = [];
    }

    // this is an inner ring (hole)
    else if (outerRing) {
      holeRings.push(ring);
    }
  }

  // generate the last pending polygon
  if (outerRing) appendArrays();
}

// returns an array of meshes
// arrays can hold: positions, colors
function renderLinestringGeometry(olGeom, olStyle, arrays) {
  const ends = olGeom.getEnds();
  const stride = olGeom.getStride();
  const coordReduce = (acc, curr, i, array) => {
    if ((i - 1) % stride === 0) {
      acc.push(new Vector3(array[i - stride + 1], array[i - stride + 2], stride > 2 ? array[i - stride + 3] : 0));
    }
    return acc;
  }

  const flatCoordinates = olGeom.getFlatCoordinates();

  if (ends.length === 0) {
    return null
  }

  let line, hole, holes, i;

  // generate a new mesh from an outer ring & holes
  const appendArrays = () => {
    // add vertices & colors to arrays (outer ring and holes)
    let i, l;
    for (i = 0, l = line.length - 1; i < l; i++) {
      arrays.linePositions && arrays.linePositions.push(
        line[i].x, line[i].y, 0,
        line[i+1].x, line[i+1].y, 0);
      arrays.lineColors && arrays.lineColors.push(
        0.2, 0.2, 1, 0.5,
        0.2, 0.2, 1, 0.5);
    }
  }

  // loop on ends: create a new polygon with holes everytime
  // the ring is CW
  for (let i = 0; i < ends.length; i++) {
    if (ends[i] === ends[i - 1]) {
      continue;
    }

    line = flatCoordinates.slice(i === 0 ? 0 : ends[i - 1], ends[i]).reduce(coordReduce, [])
    appendArrays();
  }

  appendArrays();
}
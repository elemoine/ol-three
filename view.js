import {getMapSize} from './common';

let activeCamera;
export function setActiveCamera(camera) {
	activeCamera = camera;
}
export function getActiveCamera() {
	return activeCamera;
}

let cameraTarget;
export function setCameraTarget(target) {
	cameraTarget = target;
}
export function getCameraTarget() {
	return cameraTarget;
}

export function getResolution() {
    // scale is computed based on camera position
    let dist = cameraTarget.distanceTo(activeCamera.position);
    let scale = dist * Math.tan(activeCamera.fov / 360 * Math.PI) * 2
    return scale / getMapSize()[1];
}

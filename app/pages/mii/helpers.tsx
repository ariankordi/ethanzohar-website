// https://jsfiddle.net/arian_/egmvt5o9/4/
import * as THREE from "three";

const workingSpace = THREE.ColorManagement ? THREE.ColorManagement.workingColorSpace : '';
export const colorFromHex = (hex: number) => new THREE.Color().setHex(hex, workingSpace);

export const pantsColorGrayNormal = 0x40474E;

export const favoriteColorTable = [
	0xd21e14, 0xff6e19, 0xffd820, 0x78d220, 0x007830,
	0x0a48b4, 0x3caade, 0xf55a7d, 0x7328ad, 0x483818,
	0xe0e0e0, 0x181814
];

export const headToBodyScale = 10.0 / 7.0;

export function degToRad(degrees: number) {
	return degrees * (Math.PI / 180);
}
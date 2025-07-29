import * as THREE from 'three';
import { distance } from './utils.js';

export function revealRectangles(rectangles, carPosition, nextCarPosition, scene, freescene, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, parkingStatusMap, occupancyRateElement, updateOccupancyRateCallback) {
    if (!Array.isArray(rectangles)) return;
    const currentTime = performance.now();
    const revealRadius = 40;
    let emptySpotRemoved = false;
    let emptySpotAdded = false;
    const lotUIDs = new Set();
    const detectedUIDs = new Set();
    
    freescene.children.forEach(mesh => {
        if (mesh.userData.uid) {
            lotUIDs.add(mesh.userData.uid);
        }
    });

    revealedGroup.children.forEach(object => {
        const uid = object.userData.uid;
        if (distance(nextCarPosition, object.position) < revealRadius) {
            if (!processedUIDs.has(uid)) {
                object.material.color.setHex(0x00ff00);
                processedUIDs.add(uid);
            }
            detectedUIDs.add(uid);
        }
    });

    scene.traverse(function (object) {
        if (object.isMesh && (object.geometry.type === 'BoxGeometry' || object.geometry.type === 'PlaneGeometry')) {
            const rectPosition = object.position;
            
            if (distance(carPosition, rectPosition) < revealRadius && distance(nextCarPosition, rectPosition) >= 40) {
                if (!object.material.visible) {
                    object.material.visible = true;
                    const clonedGeometry = object.geometry.clone();
                    const clonedMaterial = object.material.clone();
                    const clonedMesh = new THREE.Mesh(clonedGeometry, clonedMaterial);
                    clonedMesh.position.copy(object.position);
                    clonedMesh.position.z = 0;
                    clonedMesh.rotation.copy(object.rotation);
                    clonedMesh.scale.copy(object.scale);
                    clonedMesh.userData.revealTime = performance.now();
                    clonedMesh.userData.originalColor = new THREE.Color(object.material.color.getHex()); 
                    revealedGroup.add(clonedMesh);
                    object.material.visible = false;
                    if (object.geometry.type === 'PlaneGeometry' && !processedUIDs.has(object.userData.uid) && lotUIDs.has(object.userData.uid)) {
                        emptySpotAdded = true;
                        const lotnumber = object.geometry.parameters.width / 4;
                        processedUIDs.add(object.userData.uid);
                        objectCooldowns.set(object.userData.uid, currentTime);
                    }
                }
            }
        }
    });

    if (emptySpotRemoved || emptySpotAdded) {
        updateOccupancyRateCallback(parkingStatusMap, occupancyRateElement);
    }

    detectedUIDs.forEach(uid => {
        allDetectedUIDs.add(uid);
    });

    for (let i = revealedGroup.children.length - 1; i >= 0; i--) {
        const object = revealedGroup.children[i];
        const uid = object.userData.uid;

        if (distance(carPosition, object.position) < revealRadius && !detectedUIDs.has(uid) && allDetectedUIDs.has(uid)) {
            revealedGroup.remove(object);
            object.geometry.dispose();
            object.material.dispose();
            allDetectedUIDs.delete(uid);
        }
    }
}

export function updateRevealedObjects(revealedGroup) {
    const currentTimeMillis = performance.now();
    revealedGroup.children.forEach(object => {
        const elapsedTime = (currentTimeMillis - object.userData.revealTime) / 1000;
        const lerpFactor = Math.min(1, elapsedTime / 15);
        object.material.color.lerpColors(object.userData.originalColor, new THREE.Color(0xffffff), lerpFactor);

        const { r, g, b } = object.material.color;
        const colorThreshold = 0.9;

        if (r > colorThreshold && g > colorThreshold && b > colorThreshold) {
            revealedGroup.remove(object);
            object.geometry.dispose();
            object.material.dispose();
        }
    });
}
 
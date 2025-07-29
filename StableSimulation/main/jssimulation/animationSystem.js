import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { revealRectangles } from './revealSystem.js';

// Global speed multiplier that can be controlled from UI
let globalSpeedMultiplier = 2.0;

export function setVehicleSpeed(speed) {
    globalSpeedMultiplier = speed;
}

export function updateVehicleAnimation(vehicles, currentTime, simulationStartTime, scene, revealRectangles, sceneParams) {
    const { freescene, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, parkingStatusMap, occupancyRateElement, updateOccupancyRate } = sceneParams;
    
    Object.values(vehicles).forEach(vehicle => {
        // --- HARD STOP FOR PARKED SUMO CAR ---
        if (vehicle.id === 'veh0' && vehicle.completed) {
            // Do not update progress, do not move, do not reset progress
            return;
        }
        
        if (currentTime >= vehicle.departTime && !vehicle.completed) {
            if (!vehicle.addedToScene) {
                scene.add(vehicle.model);
                vehicle.addedToScene = true;
            }

            if (vehicle.path) {
                const pathLength = vehicle.path.getLength();
                const segmentIndex = Math.floor(vehicle.progress * vehicle.speeds.length);
                const segmentSpeed = vehicle.speeds[segmentIndex] || vehicle.speed;
                const progressIncrement = (segmentSpeed / pathLength * 0.05) * globalSpeedMultiplier;
                
                // Don't update progress if vehicle is completed
                if (!vehicle.completed) {
                    vehicle.progress += progressIncrement;
                }

                // Reset progress when reaching end of route, but keep vehicle visible
                if (vehicle.progress >= 1) {
                    vehicle.progress = 0;
                    // Ensure vehicle stays in scene after reset
                    if (!vehicle.addedToScene) {
                        scene.add(vehicle.model);
                        vehicle.addedToScene = true;
                    }
                }

                const point = vehicle.path.getPointAt(vehicle.progress);
                if (point) {
                    vehicle.model.position.copy(point);
                    const nextPoint = vehicle.path.getPointAt((vehicle.progress + 0.06) % 1);
                    if (nextPoint) {
                        vehicle.model.lookAt(nextPoint);
                        vehicle.model.position.z = 2.5;
                        vehicle.model.up.set(0, 0, 1);
                        vehicle.model.rotateY(3 * Math.PI / 2);
                        revealRectangles(point, nextPoint, scene, freescene, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, parkingStatusMap, occupancyRateElement, updateOccupancyRate);
                    }
                }

                // --- PARKING LOGIC ---
                // Only for SUMO car (veh0) and if a target spot is selected
                if (vehicle.id === 'veh0' && window.selectedParkingSpot) {
                    const parkingSystem = window.parkingSystem;
                    
                    const spotUid = window.selectedParkingSpot.toString();
                    if (parkingSystem && parkingSystem.parkingSpots && parkingSystem.parkingSpots.has(spotUid)) {
                        const spot = parkingSystem.parkingSpots.get(spotUid);
                        if (spot && spot.center) {
                            const dx = vehicle.model.position.x - spot.center.x;
                            const dy = vehicle.model.position.y - spot.center.y;
                            const dz = (vehicle.model.position.z || 0) - (spot.center.z || 0);
                            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                            
                            // Check if vehicle has reached the parking spot (distance close to zero)
                            if (dist < 10.0 && !vehicle._justParked && !vehicle.completed && !vehicle._hasParkedAtSpot) {
                                // Query real-time parking table status
                                const currentStatus = spot.status;
                                
                                if (currentStatus === 'occupied') {
                                    // Parking spot is occupied - show message and continue route
                                    const navStatus = document.getElementById('navStatus');
                                    if (navStatus) {
                                        navStatus.textContent = 'PARKING SPOT OCCUPIED';
                                        navStatus.style.color = '#d32f2f';
                                        navStatus.style.fontWeight = 'bold';
                                    }
                                    
                                    // Reset status after 3 seconds and clear target
                                    setTimeout(() => {
                                        if (navStatus) {
                                            navStatus.textContent = 'en Route';
                                            navStatus.style.color = '#555';
                                            navStatus.style.fontWeight = 'normal';
                                        }
                                        window.selectedParkingSpot = null;
                                        // Reset target status
                                        if (spot.status === 'target') {
                                            spot.setManualStatus('occupied');
                                        }
                                    }, 3000);
                                    
                                } else if (currentStatus === 'target') {
                                    // Parking spot is target - park the vehicle
                                    vehicle._justParked = true; // Set flag immediately to prevent multiple activations
                                    vehicle._hasParkedAtSpot = true; // Permanent flag to prevent re-parking
                                    vehicle.completed = true; // Stop the car
                                    
                                    // Backup original speeds
                                    if (!vehicle._originalSpeeds) vehicle._originalSpeeds = vehicle.speeds.slice();
                                    vehicle.speeds = [0];
                                    vehicle.speed = 0;
                                    
                                    console.log('[DEBUG] About to set parking spot to occupied:', {
                                        uid: spotUid,
                                        currentStatus: currentStatus,
                                        spotStatus: spot.status
                                    });
                                    
                                    // Update parking spot status to occupied
                                    spot.setManualStatus('occupied');
                                    
                                    console.log('[DEBUG] After setting to occupied:', {
                                        uid: spotUid,
                                        status: spot.status,
                                        locked: spot.locked
                                    });
                                    
                                    // Update parking table immediately
                                    if (typeof parkingSystem.updateParkingTable === 'function') {
                                        parkingSystem.updateParkingTable();
                                    }
                                    
                                    // Update parking spot visuals immediately
                                    if (typeof parkingSystem.updateParkingSpotVisuals === 'function') {
                                        parkingSystem.updateParkingSpotVisuals();
                                    }
                                    
                                    // Show success message
                                    const navStatus = document.getElementById('navStatus');
                                    if (navStatus) {
                                        navStatus.textContent = 'SUCCESSFULLY PARKED';
                                        navStatus.style.color = '#4caf50';
                                        navStatus.style.fontWeight = 'bold';
                                    }
                                    
                                    // After 5 seconds, resume the car's route but keep parking spot occupied
                                    setTimeout(() => {
                                        if (vehicle._originalSpeeds) vehicle.speeds = vehicle._originalSpeeds.slice();
                                        vehicle.speed = vehicle.speeds[0] || 5.0;
                                        vehicle.completed = false;
                                        vehicle._justParked = false;
                                        vehicle.progress = 0; // Reset to beginning of route
                                        vehicle._hasParkedAtSpot = false; // Reset permanent flag
                                        window.selectedParkingSpot = null;
                                        
                                        console.log('[DEBUG] After 3 seconds - clearing selectedParkingSpot, spot status:', {
                                            uid: spotUid,
                                            status: spot.status,
                                            locked: spot.locked
                                        });
                                        
                                        // Keep the parking spot occupied - don't reset it
                                        // spot.setManualStatus('occupied'); // This is already set above
                                        
                                        // Update parking table to reflect the occupied status
                                        if (typeof parkingSystem.updateParkingTable === 'function') {
                                            parkingSystem.updateParkingTable();
                                        }
                                        
                                        // Also update parking spot visuals to ensure the red color is maintained
                                        if (typeof parkingSystem.updateParkingSpotVisuals === 'function') {
                                            parkingSystem.updateParkingSpotVisuals();
                                        }
                                        
                                        // Reset status message
                                        if (navStatus) {
                                            navStatus.textContent = 'en Route';
                                            navStatus.style.color = '#555';
                                            navStatus.style.fontWeight = 'normal';
                                        }
                                    }, 5000);
                                }
                                // If status is 'free', do nothing - let it remain free
                            }
                        }
                    }
                }
                // --- END PARKING LOGIC ---
            }
        }
    });
}

export function updateCameraTracking(trackingMode, currentVehicleId, vehicles, camera, controls) {
    if (trackingMode === 'vehicle' && currentVehicleId) {
        // Handle MLS_i pointcloud tracking
        if (currentVehicleId.startsWith('mls_')) {
            const idx = parseInt(currentVehicleId.split('_')[1], 10);
            if (window.pcdExistArray && window.pcdExistArray[idx]) {
                const pcd = window.pcdExistArray[idx];
                if (pcd && pcd.geometry) {
                    // Izračunaj centar pointcloud-a iz bounding box-a
                    pcd.geometry.computeBoundingBox();
                    const center = new THREE.Vector3();
                    pcd.geometry.boundingBox.getCenter(center);
                    
                    // Transformiši centar u svetske koordinate
                    center.applyMatrix4(pcd.matrixWorld);
                    
                    // Pozicioniši kameru direktno na centar pointcloud-a sa visinom 22m
                    const targetPosition = center.clone();
                    targetPosition.z = 22; // Postavi visinu na 22m
                    const targetLookAt = center.clone();
                    
                    // Glatka interpolacija kamere
                    camera.position.lerp(targetPosition, 0.05);
                    camera.lookAt(targetLookAt);
                    
                    // Ažuriraj controls target
                    controls.target.copy(targetLookAt);
                    controls.update();
                }
            }
            return;
        }
        
        // Handle vehicle tracking (Car, veh0, etc.) - NEW LOGIC
        const vehicle = vehicles[currentVehicleId];
        if (vehicle && vehicle.addedToScene && !vehicle.completed) {
            let targetPosition, targetLookAt;

            if (vehicle.type === 'simulation') {
                // Pozicioniši kameru direktno iznad vozila sa fiksnom visinom 23m
                targetPosition = vehicle.model.position.clone();
                targetPosition.z = 23; // Fiksna visina 23m iznad auta
                targetLookAt = vehicle.model.position.clone();
            } else if (vehicle.type === 'pointcloud') {
                targetPosition = vehicle.position.clone();
                targetPosition.z = 23; // Fiksna visina 23m iznad auta
                targetLookAt = vehicle.position.clone();
            }

            // Glatka interpolacija kamere (isti faktor kao za MLS)
            camera.position.lerp(targetPosition, 0.05);
            camera.lookAt(targetLookAt);
            
            // Ažuriraj controls target
            controls.target.copy(targetLookAt);
            controls.update();
        }
    }
}

export function updateLabels(camera, labelRenderer) {
    if (!camera || !camera.position) {
        console.warn('[LABELS] Camera or camera.position is undefined!');
        return;
    }
    const showLabels = camera.position.z < 21; // Show labels only when camera is below 10m
    
    let labelsFound = 0;
    let labelsUpdated = 0;
    
    // Method 1: Direct DOM query for all parking labels
    const allLabels = document.querySelectorAll('.parking-label');
    
    allLabels.forEach((labelElement, index) => {
        labelsFound++;
        const wasVisible = labelElement.style.opacity !== '0';
        labelElement.style.opacity = showLabels ? '1' : '0';
        const isVisible = labelElement.style.opacity !== '0';
        if (wasVisible !== isVisible) {
            labelsUpdated++;
        }
    });
    
    // Method 2: Check parking system labels
    if (window.parkingSystem && window.parkingSystem.parkingSpots) {
        window.parkingSystem.parkingSpots.forEach(spot => {
            if (spot.uidLabel && spot.uidLabel.element) {
                labelsFound++;
                const wasVisible = spot.uidLabel.element.style.opacity !== '0';
                spot.uidLabel.element.style.opacity = showLabels ? '1' : '0';
                const isVisible = spot.uidLabel.element.style.opacity !== '0';
                if (wasVisible !== isVisible) {
                    labelsUpdated++;
                }
            }
        });
    }
    
    // Method 3: Check freescene labels
    if (window.freescene && window.freescene.children) {
        window.freescene.children.forEach(obj => {
            if (obj.element && obj.element.classList && obj.element.classList.contains('parking-label')) {
                labelsFound++;
                const wasVisible = obj.element.style.opacity !== '0';
                obj.element.style.opacity = showLabels ? '1' : '0';
                const isVisible = obj.element.style.opacity !== '0';
                if (wasVisible !== isVisible) {
                    labelsUpdated++;
                }
            }
        });
    }
}

export function processPointClouds(pointCloudPaths, pcdload, scene, TM, simulateTraffic, revealRectangles, vehicles, parkingAreas, kfframe, kfframescale, carlength, freescene, parkingStatusMap, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, occupancyRateElement, updateOccupancyRate, pointSize) {
    let processedGroupsThisCycle = 0;
    
    pointCloudPaths.forEach((group, groupIndex) => {
        const { path, count } = group;

        if (!group.currentFrame) {
            group.currentFrame = 1;
        }

        if (group.currentFrame <= count) {
            pcdload(group.currentFrame, path, groupIndex, scene, TM, simulateTraffic, revealRectangles, vehicles, parkingAreas, kfframe, kfframescale, carlength, freescene, parkingStatusMap, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, occupancyRateElement, updateOccupancyRate, pointSize);
            group.currentFrame += 5;
            processedGroupsThisCycle++;

            if (group.currentFrame > count) {
                group.currentFrame = 1;
            }
        }
    });
    
    // Pozovi detect svaki put kada se obrade sve grupe
    if (processedGroupsThisCycle === pointCloudPaths.length) {
        const allVehicles = kfframe.flat();
        const allScales = kfframescale.flat();
    }
}

export function processBoundingBoxes(boundingBoxPaths, boundingBoxType, processedSingleFrameRef, frameRef, processCsvData, processJsonData, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene) {
    boundingBoxPaths.forEach(({ path, count }) => {
        if (count === 1) {
            if (!processedSingleFrameRef.current) {
                frameRef.current = 1;
                if (boundingBoxType === 'csv') {
                    processCsvData(frameRef.current, path, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap);
                } else if (boundingBoxType === 'json') {
                    processJsonData(frameRef.current, path, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene);
                }
                processedSingleFrameRef.current = true;
            }
        } else {
            if (boundingBoxType === 'csv') {
                processCsvData(frameRef.current, path, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap);
            } else if (boundingBoxType === 'json') {
                processJsonData(frameRef.current, path, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene);
            }

            frameRef.current += 1;
            if (frameRef.current > count) {
                frameRef.current = 1;
            }
        }
    });
} 
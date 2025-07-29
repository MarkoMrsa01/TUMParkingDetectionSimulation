import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js';
import * as THREE from 'three';
import { detect } from './detect.js';
import { inside } from './utils.js';

const vehTransforms = {
    0: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    1: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    2: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    // Dodaj još po potrebi
};

export function createPCDLoader(boundingBoxType) {
    const loader = new PCDLoader();
    const pcdExistArray = [];
    let previousLidarPosition = new THREE.Vector3();
    let currentLidarPosition = new THREE.Vector3();
    let currentPointSize = 1.2; // Globalna varijabla za trenutnu veličinu tačaka

    // Nova funkcija za učitavanje statičnog PCD fajla
    function loadStaticPCD(filePath, scene, TM, pointSize = 1.2) {
        console.log(`[STATIC_PCD] Učitavanje statičnog PCD fajla: ${filePath}`);
        
        loader.load(filePath, function (pcd) {
            const material = new THREE.PointsMaterial({
                size: pointSize,
                vertexColors: true,
                sizeAttenuation: true
            });

            pcd.material = material;
            pcd.applyMatrix4(TM);

            // Pomeri sve tačke tako da najniža bude na Z=0
            if (pcd.geometry && pcd.geometry.attributes && pcd.geometry.attributes.position) {
                const positions = pcd.geometry.attributes.position;
                let minZ = Infinity;
                for (let i = 0; i < positions.count; i++) {
                    const z = positions.getZ(i);
                    if (z < minZ) minZ = z;
                }
                if (minZ !== 0 && minZ !== Infinity) {
                    for (let i = 0; i < positions.count; i++) {
                        positions.setZ(i, positions.getZ(i) - minZ);
                    }
                    positions.needsUpdate = true;
                    if (pcd.geometry.boundingBox) {
                        pcd.geometry.boundingBox.min.z -= minZ;
                        pcd.geometry.boundingBox.max.z -= minZ;
                    }
                }
            }

            scene.add(pcd);
            pcd.position.z = 0;
            
            console.log(`[STATIC_PCD] Uspešno učitano: ${filePath}`);
            console.log(`[STATIC_PCD] Broj tačaka: ${pcd.geometry.attributes.position.count}`);
            
            // Prikaži informacije o rasponu koordinata
            pcd.geometry.computeBoundingBox();
            const bbox = pcd.geometry.boundingBox;
            console.log(`[STATIC_PCD] X raspon: ${bbox.min.x.toFixed(2)} do ${bbox.max.x.toFixed(2)}`);
            console.log(`[STATIC_PCD] Y raspon: ${bbox.min.y.toFixed(2)} do ${bbox.max.y.toFixed(2)}`);
            console.log(`[STATIC_PCD] Z raspon: ${bbox.min.z.toFixed(2)} do ${bbox.max.z.toFixed(2)}`);
            
        }, undefined, function(error) {
            console.error(`[STATIC_PCD] Greška pri učitavanju PCD fajla ${filePath}:`, error);
        });
    }

    function pcdload(frame, path, groupIndex, scene, TM, simulateTraffic, revealRectangles, vehicles, parkingAreas, kfframe, kfframescale, carlength, freescene, parkingStatusMap, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, occupancyRateElement, updateOccupancyRate, pointSize = 1.2) {
        let index = String(frame).padStart(6, '0');
        let filePath = `${path}${index}.pcd`;
        
        // Initialize kfframe for this group as empty array
        if (!kfframe[groupIndex]) {
            kfframe[groupIndex] = [];
        }
        if (!kfframescale[groupIndex]) {
            kfframescale[groupIndex] = [];
        }

        loader.load(filePath, function (pcd) {
            const material = new THREE.PointsMaterial({
                size: currentPointSize, // Koristi trenutnu veličinu umesto pointSize parametra
                vertexColors: true,
                sizeAttenuation: true // Omogućava dinamičko skaliranje na osnovu distance
            });

            if (pcdExistArray[groupIndex]) {
                scene.remove(pcdExistArray[groupIndex]);
                pcdExistArray[groupIndex].geometry.dispose();
                pcdExistArray[groupIndex].material.dispose();
                pcdExistArray[groupIndex] = null;
            }

            pcd.material = material;
            pcd.applyMatrix4(TM);

            // Pomeri sve tačke tako da najniža bude na Z=0
            if (pcd.geometry && pcd.geometry.attributes && pcd.geometry.attributes.position) {
                const positions = pcd.geometry.attributes.position;
                let minZ = Infinity;
                for (let i = 0; i < positions.count; i++) {
                    const z = positions.getZ(i);
                    if (z < minZ) minZ = z;
                }
                if (minZ !== 0 && minZ !== Infinity) {
                    for (let i = 0; i < positions.count; i++) {
                        positions.setZ(i, positions.getZ(i) - minZ);
                    }
                    positions.needsUpdate = true;
                    if (pcd.geometry.boundingBox) {
                        pcd.geometry.boundingBox.min.z -= minZ;
                        pcd.geometry.boundingBox.max.z -= minZ;
                    }
                }
            }

            scene.add(pcd);
            pcd.position.z = 0;
            pcdExistArray[groupIndex] = pcd;

            // Računaj centar za parking logiku (originalno)
            pcd.geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            pcd.geometry.boundingBox.getCenter(center);
            // pcd.position.copy(center); // Removed to ensure pointclouds are visible

            if (simulateTraffic === false) {
                currentLidarPosition.copy(center);
                revealRectangles(previousLidarPosition, currentLidarPosition, scene, freescene, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, parkingStatusMap, occupancyRateElement, updateOccupancyRate);
                previousLidarPosition.copy(currentLidarPosition);

                const vehicleId = `pcd_${groupIndex}`;
                
                // Update existing vehicle or create new one
                if (vehicles[vehicleId]) {
                    // Update existing vehicle position for tracking
                    vehicles[vehicleId].position = center.clone();
                    // Do not update model.position!
                } else {
                    // Create new vehicle
                    vehicles[vehicleId] = {
                        model: pcd,
                        position: center.clone(),
                        completed: false,
                        addedToScene: true,
                        type: 'pointcloud'
                    };
                }
            }

            // DETEKCIJA PARKINGA: koristi PointCloud tačke
            if (typeof parkingAreas !== 'undefined' && parkingAreas.length > 0) {
                // Inicijalizuj brojače za svaku parking zonu
                const parkingPointCounts = new Array(parkingAreas.length).fill(0);
                
                // Uzmi pozicije tačaka iz PointCloud-a
                const positions = pcd.geometry.attributes.position;
                const pointCount = positions.count;
                
                // Optimizacija: prvo izračunaj bounding box PointCloud-a
                pcd.geometry.computeBoundingBox();
                const pcdBoundingBox = pcd.geometry.boundingBox;
                
                // Proveri da li je boundingBox pravilno inicijalizovan
                // if (!pcdBoundingBox || typeof pcdBoundingBox.getMin !== 'function') {
                //     console.log(`[PCD_DEBUG] Koristi se METODA 1 (ručno izračunavanje bounding box-a)`);
                //     // Ručno izračunaj bounding box
                //     let minX = Infinity, minY = Infinity, minZ = Infinity;
                //     let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                //     
                //     for (let i = 0; i < pointCount; i++) {
                //         const x = positions.getX(i);
                //         const y = positions.getY(i);
                //         const z = positions.getZ(i);
                //         
                //         minX = Math.min(minX, x);
                //         minY = Math.min(minY, y);
                //         minZ = Math.min(minZ, z);
                //         maxX = Math.max(maxX, x);
                //         maxY = Math.max(maxY, y);
                //         maxZ = Math.max(maxZ, z);
                //     }
                //     
                //     const pcdMin = new THREE.Vector3(minX, minY, minZ);
                //     const pcdMax = new THREE.Vector3(maxX, maxY, maxZ);
                //     
                //     // Transformiši bounding box
                //     pcdMin.applyMatrix4(TM);
                //     pcdMax.applyMatrix4(TM);
                //     
                //     // Optimizacija: prvo proveri da li PointCloud uopšte preklapa sa parking zonama
                //     const overlappingParkingAreas = [];
                //     for (let j = 0; j < parkingAreas.length; j++) {
                //         const area = parkingAreas[j];
                //         // Proveri da li se parking zona preklapa sa PointCloud bounding box-om
                //         const areaMinX = Math.min(area.x1, area.x2, area.x3, area.x4);
                //         const areaMaxX = Math.max(area.x1, area.x2, area.x3, area.x4);
                //         const areaMinY = Math.min(area.y1, area.y2, area.y3, area.y4);
                //         const areaMaxY = Math.max(area.y1, area.y2, area.y3, area.y4);
                //         
                //         if (pcdMax.x >= areaMinX && pcdMin.x <= areaMaxX && 
                //             pcdMax.y >= areaMinY && pcdMin.y <= areaMaxY) {
                //             overlappingParkingAreas.push(j);
                //         }
                //     }
                //     
                //     // Optimizacija: koristi sampling za bolje performanse
                //     const sampleRate = Math.max(1, Math.floor(pointCount / 10000)); // Proveri svaku N-tu tačku
                //     
                //     // Proveri svaku tačku samo u preklapajućim parking zonama
                //     let totalPointsInParkingAreas = 0;
                //     for (let i = 0; i < pointCount; i += sampleRate) {
                //         const x = positions.getX(i);
                //         const y = positions.getY(i);
                //         const z = positions.getZ(i);
                //         
                //         // Transformiši tačku koristeći TM matricu
                //         const point = new THREE.Vector3(x, y, z);
                //         point.applyMatrix4(TM);
                //         
                //         // Proveri da li tačka upada u preklapajuće parking zone
                //         for (const j of overlappingParkingAreas) {
                //             const area = parkingAreas[j];
                //             if (inside({ x: point.x, y: point.y }, area)) {
                //                 parkingPointCounts[j]++;
                //                 totalPointsInParkingAreas++;
                //             }
                //         }
                //     }
                //     
                //     // Prilagodi prag na osnovu sampling rate-a - UJEDNAČENO NA 30
                //     const baseThreshold = 30; // Ujednačeno za obe metode
                //     const adjustedThreshold = Math.floor(baseThreshold / sampleRate);
                //     
                //     console.log(`[PCD_DEBUG] Metoda 1 (ručna): baseThreshold=${baseThreshold}, sampleRate=${sampleRate}, adjustedThreshold=${adjustedThreshold}`);
                //     console.log(`[PCD_DEBUG] Parking point counts:`, parkingPointCounts);
                //     
                //     // Ažuriraj parking sistem umesto kreiranja kutija
                //     if (window.parkingSystem) {
                //         for (let j = 0; j < parkingAreas.length; j++) {
                //             const uid = (j + 1).toString();
                //             const spot = window.parkingSystem.parkingSpots.get(uid);
                //             if (spot && !spot.locked) {
                //                 spot.status = 'free'; // resetuj status
                //             }
                //         }
                //         for (let j = 0; j < parkingAreas.length; j++) {
                //             const uid = (j + 1).toString();
                //             const spot = window.parkingSystem.parkingSpots.get(uid);
                //             if (spot) {
                //                 // Samo postavi na 'occupied' ako je detektovano vozilo, ne vraćaj na 'free'!
                //                 if (parkingPointCounts[j] >= adjustedThreshold && spot.status !== 'occupied') {
                //                     console.log(`[PCD_DEBUG] Parking spot ${uid} postaje occupied (${parkingPointCounts[j]} >= ${adjustedThreshold})`);
                //                     spot.setManualStatus('occupied');
                //                 }
                //                 // Ako nije detektovano vozilo, ne menjaj status (ostaje kakav jeste)
                //             }
                //         }
                //         // Ažuriraj tabelu i vizuelizaciju
                //         window.parkingSystem.updateParkingTable();
                //         window.parkingSystem.updateParkingSpotVisuals();
                //     }
                //     
                //     // Kreiraj kfframe podatke na osnovu PointCloud detekcije
                //     const detectedVehicles = [];
                //     const detectedScales = [];
                //     const detectedRotations = [];
                //     
                //     for (let j = 0; j < parkingAreas.length; j++) {
                //         if (parkingPointCounts[j] >= adjustedThreshold) {
                //             // Izračunaj centar parking zone kao poziciju vozila
                //             const centerX = (parkingAreas[j].x1 + parkingAreas[j].x2 + parkingAreas[j].x3 + parkingAreas[j].x4) / 4;
                //             const centerY = (parkingAreas[j].y1 + parkingAreas[j].y2 + parkingAreas[j].y3 + parkingAreas[j].y4) / 4;
                //             detectedVehicles.push({ x: centerX, y: centerY });
                //         }
                //     }
                //     
                //     kfframe[groupIndex] = detectedVehicles;
                //     kfframescale[groupIndex] = detectedScales;
                // Standardna metoda sa pravilno inicijalizovanim boundingBox-om
                const pcdMin = pcdBoundingBox.min.clone().applyMatrix4(TM);
                const pcdMax = pcdBoundingBox.max.clone().applyMatrix4(TM);
                
                // Optimizacija: prvo proveri da li PointCloud uopšte preklapa sa parking zonama
                    const overlappingParkingAreas = [];
                    for (let j = 0; j < parkingAreas.length; j++) {
                        const area = parkingAreas[j];
                        // Proveri da li se parking zona preklapa sa PointCloud bounding box-om
                        const areaMinX = Math.min(area.x1, area.x2, area.x3, area.x4);
                        const areaMaxX = Math.max(area.x1, area.x2, area.x3, area.x4);
                        const areaMinY = Math.min(area.y1, area.y2, area.y3, area.y4);
                        const areaMaxY = Math.max(area.y1, area.y2, area.y3, area.y4);
                        
                        if (pcdMax.x >= areaMinX && pcdMin.x <= areaMaxX && 
                            pcdMax.y >= areaMinY && pcdMin.y <= areaMaxY) {
                            overlappingParkingAreas.push(j);
                        }
                    }
                    
                    // Optimizacija: koristi sampling za bolje performanse
                    const sampleRate = Math.max(1, Math.floor(pointCount / 10000)); // Proveri svaku N-tu tačku
                    
                    // Proveri svaku tačku samo u preklapajućim parking zonama
                    let totalPointsInParkingAreas = 0;
                    for (let i = 0; i < pointCount; i += sampleRate) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        
                        // Transformiši tačku koristeći TM matricu
                        const point = new THREE.Vector3(x, y, z);
                        point.applyMatrix4(TM);
                        
                        for (const j of overlappingParkingAreas) {
                            const area = parkingAreas[j];
                            // 1. Provera XY (kao do sada)
                            if (inside({ x: point.x, y: point.y }, area)) {
                                // 2. Provera Z (3D box parking mesha)
                                const spot = window.parkingSystem?.parkingSpots?.get((j + 1).toString());
                                if (spot && spot.visualBox && spot.visualBox.geometry && spot.visualBox.geometry.parameters) {
                                    const mesh = spot.visualBox;
                                    // U THREE.js BoxGeometry: width, height, depth (depth je po Z)
                                    const boxHeight = mesh.geometry.parameters.depth || 1.5; // fallback ako nije definisano
                                    const zCenter = mesh.position.z;
                                    const zMin = zCenter - boxHeight / 2;
                                    const zMax = zCenter + boxHeight / 2;
                                    if (point.z >= zMin && point.z <= zMax) {
                                        parkingPointCounts[j]++;
                                        totalPointsInParkingAreas++;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Prilagodi prag na osnovu sampling rate-a - UJEDNAČENO NA 50
                    const baseThreshold = 10; // Ujednačeno za obe metode
                    const adjustedThreshold = Math.floor(baseThreshold / sampleRate);
                    
                    // Ažuriraj parking sistem umesto kreiranja kutija
                    if (window.parkingSystem) {
                        // Don't reset locked parking spots (occupied spots are locked) or target spots
                        for (let j = 0; j < parkingAreas.length; j++) {
                            const uid = (j + 1).toString();
                            const spot = window.parkingSystem.parkingSpots.get(uid);
                            if (spot && !spot.locked && spot.status !== 'target') {
                                // Only reset to free if not currently occupied by pointcloud
                                if (parkingPointCounts[j] < adjustedThreshold) {
                                    spot.setManualStatus('free');
                                }
                            }
                        }
                        for (let j = 0; j < parkingAreas.length; j++) {
                            const uid = (j + 1).toString();
                            const spot = window.parkingSystem.parkingSpots.get(uid);
                            if (spot && !spot.locked) {
                                // Samo postavi na 'occupied' ako je detektovano vozilo, ne vraćaj na 'free'!
                                if (parkingPointCounts[j] >= adjustedThreshold && spot.status !== 'occupied') {
                                    spot.setManualStatus('occupied');
                                }
                                // Ako nije detektovano vozilo, ne menjaj status (ostaje kakav jeste)
                            }
                        }
                        

                        
                        // Ažuriraj tabelu i vizuelizaciju
                        window.parkingSystem.updateParkingTable();
                        window.parkingSystem.updateParkingSpotVisuals();
                    }
                    
                    // Kreiraj kfframe podatke na osnovu PointCloud detekcije
                    const detectedVehicles = [];
                    const detectedScales = [];
                    const detectedRotations = [];
                    
                    for (let j = 0; j < parkingAreas.length; j++) {
                        if (parkingPointCounts[j] >= adjustedThreshold) {
                            // Izračunaj centar parking zone kao poziciju vozila
                            const centerX = (parkingAreas[j].x1 + parkingAreas[j].x2 + parkingAreas[j].x3 + parkingAreas[j].x4) / 4;
                            const centerY = (parkingAreas[j].y1 + parkingAreas[j].y2 + parkingAreas[j].y3 + parkingAreas[j].y4) / 4;
                            detectedVehicles.push({ x: centerX, y: centerY });
                        }
                    }
                    
                    kfframe[groupIndex] = detectedVehicles;
                    kfframescale[groupIndex] = detectedScales;
                // }
            }
        }, undefined, function(error) {
            console.error(`[PCD_LOAD] Error loading PCD file ${filePath}:`, error);
        });
    }

    // Funkcija za ažuriranje veličine tačaka
    function updatePointSize(newSize) {
        currentPointSize = newSize;
        // Ažuriraj sve postojeće point cloud-ove
        pcdExistArray.forEach(pcd => {
            if (pcd && pcd.material) {
                pcd.material.size = newSize;
            }
        });
    }

    return {
        pcdload,
        loadStaticPCD, // Nova funkcija
        pcdExistArray,
        previousLidarPosition,
        currentLidarPosition,
        updatePointSize
    };
}

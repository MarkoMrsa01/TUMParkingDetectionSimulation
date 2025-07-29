import { isShortEdge, distance } from './utils.js';
import * as THREE from 'three';
import { angles } from './angles.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function loadCSV(filepath, scene, TM = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(filepath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.text();
            
            const lines = data.split('\n');
            const XArray = [];
            const YArray = [];
            for (var i = 0; i < lines.length; i++) {
                const rowData = lines[i].split(',');
                if (rowData.length >= 2) {
                    // Clean up carriage return characters and trim whitespace
                    const y = rowData[0].trim().replace(/\r/g, '');
                    const x = rowData[1].trim().replace(/\r/g, '');
                    if (y && x) {
                        XArray.push(x);
                        YArray.push(y);
                    }
                }
            }

            // Ensure we have exactly 4 points for a rectangle
            if (XArray.length < 4 || YArray.length < 4) {
                throw new Error(`Invalid parking area: need 4 points, got ${XArray.length}`);
            }

            // Apply transformation to parking area coordinates if TM is provided
            let transformedX = [...XArray];
            let transformedY = [...YArray];
            
            // Parking areas are already in the correct coordinate system, no transformation needed

            // Debug: Check parsed coordinates
            for (let i = 0; i < 4; i++) {
                const x = parseFloat(XArray[i].trim());
                const y = parseFloat(YArray[i].trim());
            }

            const vertices = new Float32Array([
                parseFloat(XArray[0].trim()), parseFloat(YArray[0].trim()), 0.0,
                parseFloat(XArray[1].trim()), parseFloat(YArray[1].trim()), 0.0,
                parseFloat(XArray[2].trim()), parseFloat(YArray[2].trim()), 0.0,
                parseFloat(XArray[3].trim()), parseFloat(YArray[3].trim()), 0.0
            ]);
            const height = 0;
            const topVertices = new Float32Array([
                parseFloat(XArray[0].trim()), parseFloat(YArray[0].trim()), 0.0 + height,
                parseFloat(XArray[1].trim()), parseFloat(YArray[1].trim()), 0.0 + height,
                parseFloat(XArray[2].trim()), parseFloat(YArray[2].trim()), 0.0 + height,
                parseFloat(XArray[3].trim()), parseFloat(YArray[3].trim()), 0.0 + height
            ]);
            const allVertices = new Float32Array([...vertices, ...topVertices]);
            const indices = [
                0, 1, 2,
                2, 3, 0,

                4, 5, 6,
                6, 7, 4,

                0, 3, 7,
                7, 4, 0,

                1, 2, 6,
                6, 5, 1,

                0, 1, 5,
                5, 4, 0,

                2, 3, 7,
                7, 6, 2,
            ];

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(allVertices, 3)
            );
            geometry.setIndex(indices);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00, // Zelena boja za slobodna parking mesta
                wireframe: true,
                opacity: 0.3,
                transparent: true,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.z = 2.0;
            scene.add(mesh);

            // Create proper rectangular area using all 4 transformed points
            const area = {
                x1: parseFloat(transformedX[0]), y1: parseFloat(transformedY[0]),
                x2: parseFloat(transformedX[1]), y2: parseFloat(transformedY[1]),
                x3: parseFloat(transformedX[2]), y3: parseFloat(transformedY[2]),
                x4: parseFloat(transformedX[3]), y4: parseFloat(transformedY[3])
            };
            
            // Debug: Validate area coordinates
            const areaValid = !isNaN(area.x1) && !isNaN(area.y1) && 
                             !isNaN(area.x2) && !isNaN(area.y2) && 
                             !isNaN(area.x3) && !isNaN(area.y3) && 
                             !isNaN(area.x4) && !isNaN(area.y4);
            
            resolve({ area, mesh });
        } catch (error) {
            reject(error);
        }
    });
}

export async function loadParkingAreas(scene, parkingAreas, parkinglots, parkingUIDMap, parkingStatusMap) {
    const parkingFileCount = 236;
    const batchSize = 20; // Učitavaj 20 fajlova odjednom
    
    for (let batch = 0; batch < Math.ceil(parkingFileCount / batchSize); batch++) {
        const promises = [];
        const startIndex = batch * batchSize + 1;
        const endIndex = Math.min((batch + 1) * batchSize, parkingFileCount);
        
        for (let j = startIndex; j <= endIndex; j++) {
            const filepath2 = `./parkingspaces/tumparking${j}.csv`;
            promises.push(loadCSV(filepath2, scene));
        }

        try {
            const results = await Promise.all(promises);
            results.forEach((result, index) => {
                const globalIndex = startIndex - 1 + index;
                parkingAreas.push(result.area);
                parkinglots.push(result.mesh);

                // UID = redni broj (1, 2, 3, ...)
                const uid = (globalIndex + 1).toString();
                const area = result.area;
                const centerX = (area.x1 + area.x3) / 2;
                const centerY = (area.y1 + area.y3) / 2;

                parkingUIDMap[uid] = { x: centerX, y: centerY };
                parkingStatusMap[uid] = {
                    status: "unknown",
                    lastChange: Date.now(),
                    updated: false
                };
            });
            
            // Yield control to browser every batch
            await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
            console.error(`Error loading parking areas batch ${batch + 1}:`, error);
        }
    }
    
    // Initialize parking status map
    parkingAreas.forEach((area, index) => {
        const uid = (index + 1).toString();
        const centerX = (area.x1 + area.x3) / 2;
        const centerY = (area.y1 + area.y3) / 2;
        parkingStatusMap[uid] = {
            status: "unknown",
            lastChange: Date.now(),
            updated: false
        };
    });
}

// Funkcija za računanje uglova parking mesta
function parkangle(parkingAreas) {
    angles.length = 0; // Clear existing angles
    
    for (let j = 0; j < parkingAreas.length; j++) {
        const parkingVertices = [
            { x: parkingAreas[j].x1, y: parkingAreas[j].y1 },
            { x: parkingAreas[j].x2, y: parkingAreas[j].y2 },
            { x: parkingAreas[j].x3, y: parkingAreas[j].y3 },
            { x: parkingAreas[j].x4, y: parkingAreas[j].y4 }
        ];
        
        const shortedges = [];
        for (let a = 0; a < parkingVertices.length; a++) {
            const edgePoint1 = parkingVertices[a];
            const edgePoint2 = parkingVertices[(a + 1) % parkingVertices.length];
            if (isShortEdge(edgePoint1, edgePoint2, parkingVertices)) {
                const midpoint = {
                    x: (edgePoint1.x + edgePoint2.x) / 2,
                    y: (edgePoint1.y + edgePoint2.y) / 2
                };
                shortedges.push(midpoint);
            }
            if (shortedges.length === 2) break;
        }
        
        if (shortedges.length === 2) {
            const vector = {
                x: shortedges[1].x - shortedges[0].x,
                y: shortedges[1].y - shortedges[0].y
            };
            let angle = Math.atan2(vector.y, vector.x);
            if (angle < 0) {
                angle = 2 * Math.PI + angle;
            }
            angles.push(angle);
        } else {
            // Fallback: use diagonal angle
            const vector = {
                x: parkingAreas[j].x3 - parkingAreas[j].x1,
                y: parkingAreas[j].y3 - parkingAreas[j].y1
            };
            let angle = Math.atan2(vector.y, vector.x);
            if (angle < 0) {
                angle = 2 * Math.PI + angle;
            }
            angles.push(angle);
        }
    }
}

export async function initializepark(scene, parkingAreas, parkinglots, parkingUIDMap, parkingStatusMap, TM = null, freescene = null) {
    const parkingFileCount = 236; // vraćeno na 236
    const promises = [];

    for (let j = 1; j <= parkingFileCount; j++) {
        const filepath2 = `./parkingspaces/tumparking${j}.csv`;
        promises.push(loadCSV(filepath2, scene, TM));
    }

    try {
        const results = await Promise.all(promises);
        
        results.forEach((result, index) => {
            parkingAreas.push(result.area);
            parkinglots.push(result.mesh);

            // UID = redni broj (1, 2, 3, ...)
            const uid = (index + 1).toString();
            const area = result.area;
            const centerX = (area.x1 + area.x3) / 2;
            const centerY = (area.y1 + area.y3) / 2;

            // Debug: Check for problematic parking areas
            if (isNaN(centerX) || isNaN(centerY)) {
                console.warn(`[PARKING] Invalid center coordinates for parking area ${uid}: center=(${centerX}, ${centerY})`);
                console.warn(`[PARKING] Area coordinates: (${area.x1},${area.y1}) -> (${area.x2},${area.y2}) -> (${area.x3},${area.y3}) -> (${area.x4},${area.y4})`);
            }

            parkingUIDMap[uid] = { x: centerX, y: centerY };
            parkingStatusMap[uid] = {
                status: "free", // Inicijalno slobodno
                lastChange: Date.now(),
                updated: false
            };
        });
        
        // Calculate angles for all parking areas
        parkangle(parkingAreas);
        
    } catch (error) {
        console.error('[PARKING] Error loading parking files:', error);
    }
}

// Funkcija za promenu boje parking mesta
export function updateParkingSpotColor(mesh, status) {
    if (!mesh || !mesh.material) return;
    
    switch (status) {
        case 'free':
            mesh.material.color.setHex(0x00ff00); // Zelena
            break;
        case 'occupied':
            mesh.material.color.setHex(0xff0000); // Crvena
            break;
        case 'reserved':
            mesh.material.color.setHex(0x0000ff); // Plava
            break;
        default:
            mesh.material.color.setHex(0x00ff00); // Zelena kao default
    }
} 
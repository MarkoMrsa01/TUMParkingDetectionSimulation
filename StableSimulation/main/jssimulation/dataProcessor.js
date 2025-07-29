import * as THREE from 'three';
import * as math from 'mathjs';
import { inside, distance, findClosestUID, findClosestParkingUID, generateUID, removeBoundingBox, clearGroup } from './utils.js';
import { angles } from './angles.js';
import { KalmanFilter } from './kalman.js';

export async function loadCsvData(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();
        return data;
    } catch (error) {
        throw error;
    }
}

export async function processCsvData(frame, path, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap) {
    // console.log(`[PROCESS_CSV] Starting processCsvData for frame ${frame}, path: ${path}`);
    
    const filePath = `${path}${frame.toString().padStart(6, '0')}.csv`;
    // console.log(`[PROCESS_CSV] Trying to load file: ${filePath}`);
    
    try {
        const response = await fetch(filePath);
        const csvText = await response.text();
        const csvData = csvText.split('\n').filter(line => line.trim());
        // console.log(`[PROCESS_CSV] Loaded CSV data for frame ${frame}, rows: ${csvData.length}`);
        await process(csvData, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap);
    } catch (error) {
        console.error(`[processCsvData] Error loading CSV from ${filePath}:`, error);
    }
}

export async function process(csvData, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap) {
    const lines = csvData.split('\n');
    const filteredData = [];
    const carposARR = [];
    const carrotARR = [];
    const carscaleARR = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            const values = line.split(',');
            if (values.length >= 7) {
                const position = {
                    x: parseFloat(values[0]),
                    y: parseFloat(values[1]),
                    z: parseFloat(values[2])
                };
                const rotation = parseFloat(values[3]);
                const scale = {
                    x: parseFloat(values[4]),
                    y: parseFloat(values[5]),
                    z: parseFloat(values[6])
                };

                const { x, y, z } = position;
                const vector = new THREE.Vector3(x, y, z);
                vector.applyMatrix4(TM);
                position.x = vector.x;
                position.y = vector.y;
                position.z = vector.z;
                const rotationQuaternion = new THREE.Quaternion();
                const nullVector = new THREE.Vector3();
                TM.decompose(nullVector, rotationQuaternion, nullVector);
                const euler = new THREE.Euler().setFromQuaternion(rotationQuaternion);
                const adjustedRotation = rotation + euler.z;

                filteredData.push({ position, rotation: adjustedRotation, scale });
            }
        }
    }

    carposARR.push(filteredData.map(item => item.position));
    carrotARR.push(filteredData.map(item => item.rotation));
    carscaleARR.push(filteredData.map(item => item.scale));

    filteredData.length = 0;
    csvData.length = 0;

    for (let b = 0; b < carposARR.length; b++) {
        const kfarea = [];
        const kfrot = [];
        const kfscale = [];
        const updatedUIDs = new Set();

        for (let c = 0; c < carposARR[b].length; c++) {
            const pos = carposARR[b][c];
            const uid = findClosestParkingUID(pos, parkingUIDMap);
            
            // console.log(`[PROCESS_CSV] Vehicle at (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}) -> closest parking UID: ${uid}`);

            if (uid && carFilters[uid]) {
                carFilters[uid].update({x: pos.x, y: pos.y, rotation: carrotARR[b][c]});
                carFilters[uid].setScale(carscaleARR[b][c]);
                const posXVariance = carFilters[uid].P.get([0, 0]);
                const posYVariance = carFilters[uid].P.get([1, 1]);
                const covarianceThreshold = 50;
                const covariancemaxThreshold = 200;

                if (posXVariance < covarianceThreshold && posYVariance < covarianceThreshold) {
                    const filteredPos = carFilters[uid].getPosition();
                    kfarea.push(filteredPos);
                    kfrot.push(carFilters[uid].rotation);
                    kfscale.push(carFilters[uid].scale);
                    updatedUIDs.add(uid);
                } else if (posXVariance > covariancemaxThreshold || posYVariance > covariancemaxThreshold) {
                    delete carFilters[uid];
                    removeBoundingBox(uid, scene);
                }
            } else {
                if (uid) {
                    // console.log(`[PROCESS_CSV] Creating new Kalman filter for parking UID: ${uid}`);
                    carFilters[uid] = new KalmanFilter([pos.x, pos.y], carrotARR[b][c], carscaleARR[b][c]);
                    kfarea.push(pos);
                    kfrot.push(carrotARR[b][c]);
                    kfscale.push(carscaleARR[b][c]);
                    updatedUIDs.add(uid);
                }
            }
        }

        const areas = kfarea.map(pos => {
            let count = 0;
            for (let j = 0; j < parkingAreas.length; j++) {
                if (inside(pos, parkingAreas[j])) {
                    count++;
                }
            }
            return count;
        });

        const sortedIndices = areas.map((_, index) => index).sort((a, b) => areas[b] - areas[a]);
        const sortedkfarea = sortedIndices.map(index => kfarea[index]);
        const sortedkfscale = sortedIndices.map(index => kfscale[index]);
        const sortedkfrot = sortedIndices.map(index => kfrot[index]);

        kfframe.push(sortedkfarea);
        kfframerot.push(sortedkfrot);
        kfframescale.push(sortedkfscale);
    }

    // Render bounding box
    for (let i = 0; i < kfframe.length; i++) {
        for (let j = 0; j < kfframe[i].length; j++) {
            const pos = kfframe[i][j];
            const scale = kfframescale[i][j];
            const rotation = kfframerot[i][j];

            const geometry = new THREE.BoxGeometry(scale.x * carlength, scale.y * carlength, scale.z * carlength);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });

            const box = new THREE.Mesh(geometry, material);
            box.position.set(pos.x, pos.y, pos.z);
            box.rotation.z = rotation;
            scene.add(box);
        }
    }
}

export async function processJsonData(frame, path, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene) {
    let index = String(frame).padStart(6, '0');
    let filePath = `${path}${index}.json`;
    
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        
        await processJson(jsonData, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene);
    } catch (error) {
        console.error(`[processJsonData] Error loading JSON from ${filePath}:`, error);
    }
}

async function processJson(jsonData, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene) {
    let tumcarposARR = Array.from({ length: parkingAreas.length }, () => []);
    let tumcarscaleARR = Array.from({ length: parkingAreas.length }, () => []);
    let tumcarrotARR = Array.from({ length: parkingAreas.length }, () => []);
    
    const filteredData = Array.isArray(jsonData) ? jsonData.filter(data => data.obj_type !== "Pedestrian") : [];

    filteredData.forEach(data => {
        if (!data.psr || !data.psr.position) return;
        const { position, scale, rotation } = data.psr;
        const { x, y, z } = data.psr.position;
        const vector = new THREE.Vector3(x, y, z);
        vector.applyMatrix4(TM);
        position.x = vector.x;
        position.y = vector.y;
        position.z = vector.z;
        const rotationQuaternion = new THREE.Quaternion();
        const nullVector = new THREE.Vector3();
        TM.decompose(nullVector, rotationQuaternion, nullVector);
        const realrotation = new THREE.Euler().setFromQuaternion(rotationQuaternion, 'XYZ').z;
        data.psr.rotation = {
            x: 0,
            y: 0,
            z: realrotation
        };
        const point = { x: position.x, y: position.y };
        
        let foundInAnyArea = false;
        parkingAreas.forEach((area, index) => {
            if (inside(point, area)) {
                tumcarposARR[index].push(point);
                tumcarscaleARR[index].push(scale);
                tumcarrotARR[index].push(rotation.z + data.psr.rotation.z);
                foundInAnyArea = true;
            }
        });
    });

    kfframe.length = 0;
    kfframerot.length = 0;
    kfframescale.length = 0;
    const covarianceThreshold = 50;
    const covariancemaxThreshold = 200;
    Object.keys(carFilters).forEach(uid => {
        carFilters[uid].predict();
    });
    const allCarUIDs = new Set(Object.keys(carFilters));
    
    for (let b = 0; b < parkingAreas.length; b++) {
        const kfarea = [];
        const kfrot = [];
        const kfscale = [];
        const updatedUIDs = new Set();
        for (let c = 0; c < tumcarposARR[b].length; c++) {
            const pos = tumcarposARR[b][c];
            const uid = findClosestParkingUID(pos, parkingUIDMap);
            if (uid && carFilters[uid]) {
                carFilters[uid].update({ x: pos.x, y: pos.y, rotation: tumcarrotARR[b][c] });
                carFilters[uid].setScale(tumcarscaleARR[b][c]);
                const posXVariance = carFilters[uid].P.get([0, 0]);
                const posYVariance = carFilters[uid].P.get([1, 1]);
                if (posXVariance < covarianceThreshold && posYVariance < covarianceThreshold) {
                    kfarea.push(pos);
                    kfrot.push(carFilters[uid].rotation);
                    kfscale.push(carFilters[uid].scale);
                    updatedUIDs.add(uid);
                } else if (posXVariance > covariancemaxThreshold || posYVariance > covariancemaxThreshold) {
                    delete carFilters[uid];
                    removeBoundingBox(uid, scene);
                }
            } else {
                if (uid) {
                    carFilters[uid] = new KalmanFilter([pos.x, pos.y], tumcarrotARR[b][c], tumcarscaleARR[b][c]);
                    kfarea.push(pos);
                    kfrot.push(tumcarrotARR[b][c]);
                    kfscale.push(tumcarscaleARR[b][c]);
                    updatedUIDs.add(uid);
                }
            }
        }

        kfframe.push(kfarea);
        kfframerot.push(kfrot);
        kfframescale.push(kfscale);
    }

    // Render bounding boxes
    for (let i = 0; i < kfframe.length; i++) {
        for (let j = 0; j < kfframe[i].length; j++) {
            const pos = kfframe[i][j];
            const scale = kfframescale[i][j];
            const rotation = kfframerot[i][j];

            const geometry = new THREE.BoxGeometry(scale.x * carlength, scale.y * carlength, scale.z * carlength);
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });

            const box = new THREE.Mesh(geometry, material);
            box.position.set(pos.x, pos.y, pos.z);
            box.rotation.z = rotation;
            jsonscene.add(box);
        }
    }
} 
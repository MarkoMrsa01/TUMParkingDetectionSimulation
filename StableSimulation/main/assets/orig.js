import * as THREE from 'three'
import * as math from 'mathjs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { FileLoader } from 'three/src/loaders/FileLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TextureLoader } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
let parkingStatusMap = {};  
const parkingUIDMap = {}; // uid => koordinata centra
let zoomAnimationId = null;
let zoomStartTime = null;
// SCENE
const scene = new THREE.Scene();
// CAMERA   
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(500, 500, 500);
const textureLoader = new TextureLoader();
const asphaltTexture = textureLoader.load('./assets/Metal032_1K-JPG_Displacement.jpg');
asphaltTexture.wrapS = THREE.RepeatWrapping;
asphaltTexture.wrapT = THREE.RepeatWrapping;
asphaltTexture.repeat.set(50, 50); 
const groundGeo = new THREE.PlaneGeometry(10000, 10000);
const groundMat = new THREE.MeshStandardMaterial({
map: asphaltTexture,
roughness: 1,
metalness: 0,
side: THREE.DoubleSide
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI;
ground.position.set(690930, 5335930, -30); // Ispod modela
scene.add(ground);
// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(new THREE.Color(0xccddee));
document.getElementById('container').appendChild(renderer.domElement);
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById('container').appendChild(labelRenderer.domElement);
// CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.mouseButtons = {
LEFT: THREE.MOUSE.PAN,        
MIDDLE: THREE.MOUSE.ROTATE,    
RIGHT: THREE.MOUSE.ROTATE};
let isRightMouseDown = false;
renderer.domElement.addEventListener('pointerdown', (event) => {if (event.button === 2) { isRightMouseDown = true;}});
renderer.domElement.addEventListener('pointerup', () => {isRightMouseDown = false;});
renderer.domElement.addEventListener('pointermove', (event) => {
                    if (isRightMouseDown) {
                        const delta = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                        const zAxis = new THREE.Vector3(0, 0, 1); 
                        camera.rotateOnWorldAxis(zAxis, -delta * 0.005);}});
let orbitMode = false;
window.addEventListener('dblclick', () => {
orbitMode = !orbitMode;
controls.mouseButtons.LEFT = orbitMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
});
controls.update();
// LIGHT
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const spotlight = new THREE.DirectionalLight(0xffffff, 1);
scene.add(ambient);
spotlight.position.set(0, 0, 5);
 scene.add(spotlight);
// GLTF LOADER
const gltfLoader = new GLTFLoader();
gltfLoader.load('./assets/GornjiDeo.glb', function (gltf) {
            const model2 = gltf.scene;
            model2.scale.set(1, 1, 1);
            model2.rotation.x = Math.PI / 2;
            model2.position.set(690947 , 5336192, -10
            );  
            scene.add(model2);
});
gltfLoader.load('./assets/DonjiDeo.glb', function (gltf) {
            const model = gltf.scene;
            model.scale.set(1, 1, 1);
            model.position.set(690885, 5335887, -10); 
            model.rotation.x = Math.PI / 2; 
            scene.add(model); // 👉 dodato u SCENE, ne scene
            model.updateMatrixWorld(true);

            const modelPos = new THREE.Vector3();
            model.getWorldPosition(modelPos);
            console.log("Model world position now:",modelPos);

            camera.position.set(690950, 5336000, 400);  // iznad simulacije
            controls.target.set(690950, 5336000, 0);
            controls.update();
        }, undefined, function (error) {
            console.error('Greška pri učitavanju NewFeatureType.glb:', error);
});
// Resize i reset view
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
let occupancyRateElement = document.getElementById('occupancyRate');
let toggleTrackingButton = document.getElementById('toggleTracking');
let vehicleButtonsContainer = document.getElementById('vehicleButtons');
let trackingMode = 'global';
let currentVehicleId = null;
const parkingAreas = [];
const parkinglots = [];
function loadCSV(filepath) {
    return new Promise((resolve, reject) => {
        const csvloader = new FileLoader();
        csvloader.load(filepath, function(data) {
            const lines = data.split('\n');
            const XArray = [];
            const YArray = [];
            for (var i = 0; i < lines.length; i++) {
                const rowData = lines[i].split(',');
                XArray.push(rowData[1]);
                YArray.push(rowData[0]);
            }

            const vertices = new Float32Array([
                XArray[0], YArray[0], -26.0,
                XArray[1], YArray[1], -26.0,
                XArray[2], YArray[2], -26.0,
                XArray[3], YArray[3], -26.0
            ]);
            const height = 2;
            const topVertices = new Float32Array([
                XArray[0], YArray[0], -26.0 + height,
                XArray[1], YArray[1], -26.0 + height,
                XArray[2], YArray[2], -26.0 + height,
                XArray[3], YArray[3], -26.0 + height
            ]);
            const allVertices = new Float32Array([...vertices, ...topVertices]);
            const indices = [
                // 底面
                0, 1, 2,
                2, 3, 0,

                // 顶面
                4, 5, 6,
                6, 7, 4,

                // 前面
                0, 3, 7,
                7, 4, 0,

                // 后面
                1, 2, 6,
                6, 5, 1,

                // 左面
                0, 1, 5,
                5, 4, 0,

                // 右面
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
                color: 0x00ff00,
                wireframe: true,
                opacity: 0.3,
                transparent: true,
            });
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);

            const area = {
                x1: parseFloat(XArray[0].trim()), y1: parseFloat(YArray[0].trim()),
                x2: parseFloat(XArray[1].trim()), y2: parseFloat(YArray[1].trim()),
                x3: parseFloat(XArray[2].trim()), y3: parseFloat(YArray[2].trim()),
                x4: parseFloat(XArray[3].trim()), y4: parseFloat(YArray[3].trim())
            };
            resolve({ area, mesh });
        }, undefined, function(error) {
            reject(error);
        });
    });
}
async function loadParkingAreas() {
    const promises = [];
    const parkingFileCount = 236;  // svi CSV fajlovi

    for (let j = 1; j <= parkingFileCount; j++) {
        const filepath2 = `./parkingspaces/tumparking${j}.csv`;
        promises.push(loadCSV(filepath2));
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

            parkingUIDMap[uid] = { x: centerX, y: centerY }; // za kasnije
            parkingStatusMap[uid] = {
                status: "unknown",
                lastChange: Date.now(),
                updated: false
            };
        });
    } catch (error) {
        console.error('Error loading parking areas:', error);
    }
}
async function initializepark() {
    await loadParkingAreas();
    console.log("Loaded", parkingAreas.length, "parking areas.");
    parkangle(parkingAreas);
}
let angles = [];
function parkangle(parkingAreas){
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
        const vector = {
            x: shortedges[1].x - shortedges[0].x,
            y: shortedges[1].y - shortedges[0].y
        };
        let angle = Math.atan2(vector.y, vector.x);
        if (angle < 0){
            angle = 2 * Math.PI + angle;
        }
        angles.push(angle)
    }
}
//PCD
const loader = new PCDLoader();
const configpath = `./Config.txt`;
const TM = new THREE.Matrix4();
let pointCloudPaths = [];
let boundingBoxPaths = [];
let boundingBoxType = '';
let simulateTraffic = false;
await loadConfig();
initializepark();
async function loadConfig() {
    const response = await fetch(configpath);
    const data = await response.text();
    parseConfigFile(data);
}
// Parsing configuration file contents
function parseConfigFile(data) {
    const lines = data.split('\n');
    let section = ''; 
    let matrixArray = [];

    lines.forEach(line => {
        line = line.trim();

        if (line.startsWith('#') || line === '') {
            return;  // 忽略注释和空行
        }

        if (line.startsWith('matrix:')) {
            section = 'matrix';
            return;
        }

        if (line.startsWith('pointclouds:')) {
            section = 'pointclouds';
            return;
        }

        if (line.startsWith('boundingbox_type:')) {
            section = 'boundingbox_type';
            return;
        }

        if (line.startsWith('boundingboxes:')) {
            section = 'boundingboxes';
            return;
        }

        if (line.startsWith('simulate_traffic:')) {
            section = 'simulate_traffic';
            return;
        }

        if (section === 'matrix') {
            const values = line.split(',').map(Number);
            matrixArray = matrixArray.concat(values);  // 累积矩阵的16个元素
            if (matrixArray.length === 16) {
                TM.set(
                    matrixArray[0], matrixArray[1], matrixArray[2], matrixArray[3],
                    matrixArray[4], matrixArray[5], matrixArray[6], matrixArray[7],
                    matrixArray[8], matrixArray[9], matrixArray[10], matrixArray[11],
                    matrixArray[12], matrixArray[13], matrixArray[14], matrixArray[15]
                );
            }
        } else if (section === 'pointclouds') {
            const [path, count] = line.split(',').map(item => item.trim());
            pointCloudPaths.push({ path, count: parseInt(count) });
        } 
        else if (section === 'boundingbox_type') {
            boundingBoxType = line;  // 直接保存识别框文件类型
        } 
        else if (section === 'boundingboxes') {
            const [path, count] = line.split(',').map(item => item.trim());
            boundingBoxPaths.push({ path, count: parseInt(count) });
        } 
        else if (section === 'simulate_traffic') {
            simulateTraffic = (line.toLowerCase().trim() === 'yes');
        }
    });
}
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);  
scene.add(ambientLight);
let previousLidarPosition = new THREE.Vector3();
let currentLidarPosition = new THREE.Vector3();
let pcdExistArray = [];
function pcdload(frame, path, groupIndex) {
    let index = String(frame).padStart(6, '0');
    let filePath = `${path}${index}.pcd`;

    loader.load(filePath, function (pcd) {
        const material = new THREE.PointsMaterial({
            size: 0.4,
            vertexColors: true
        });

        if (pcdExistArray[groupIndex]) {
            scene.remove(pcdExistArray[groupIndex]);
            pcdExistArray[groupIndex].geometry.dispose();
            pcdExistArray[groupIndex].material.dispose();
            pcdExistArray[groupIndex] = null;
        }

        pcd.material = material;
        pcd.applyMatrix4(TM);
        scene.add(pcd);
        pcdExistArray[groupIndex] = pcd;

        // Računaj centar
        pcd.geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        pcd.geometry.boundingBox.getCenter(center);
        center.applyMatrix4(TM);

        if (simulateTraffic === false) {
            currentLidarPosition.copy(center);

            revealRectangles(previousLidarPosition, currentLidarPosition);
            previousLidarPosition.copy(currentLidarPosition);

            const vehicleId = `pcd_${groupIndex}`;
            vehicles[vehicleId] = {
                model: pcd,
                position: currentLidarPosition.clone(),
                completed: false,
                addedToScene: true,
                type: 'pointcloud'
            };
        }

        // DETEKCIJA PARKINGA: kad se pointcloud učita
        if (typeof parkingAreas !== 'undefined' && Array.isArray(kfframe[groupIndex])) {
            detect(parkingAreas, kfframe[groupIndex], kfframescale, carlength, freescene);
        }

    });
}
//json
const jsonscene = new THREE.Group();
const freescene = new THREE.Group();
scene.add(jsonscene);
scene.add(freescene);
let initialPositions = {};
const carlength = 3;
const covarianceThreshold = 0.1;
const covariancemaxThreshold = 0.9;
const dataCache = new Map();
async function loadCsvData(filePath) {
                const data = await d3.csv(filePath);
                dataCache.set(filePath, data);
                return data;
}
async function processCsvData(frame, path){
                const index1 = String(frame).padStart(6, '0');
                if (dataCache.has(index1)) {
                    return dataCache.get(index1);
                }
                const filePath1 = `${path}${index1}.csv`;
                const csvData = await loadCsvData(filePath1);
                process(csvData);
}
async function process(csvData) {
    let carposARR = Array.from({ length: parkingAreas.length }, () => []);
    let carscaleARR = Array.from({ length: parkingAreas.length }, () => []);
    let carrotARR = Array.from({ length: parkingAreas.length }, () => []);
    const filteredData = csvData.filter(data => data.obj_mode !== "Pedestrian");

    filteredData.forEach(data => {
        const position = {
            x: parseFloat(data['position.x']),
            y: parseFloat(data['position.y']),
            z: parseFloat(data['position.z'])
        };
        const scale = {
            x: parseFloat(data['scale.x']),
            y: parseFloat(data['scale.y']),
            z: parseFloat(data['scale.z'])
        };
        const rotation = {
            x: parseFloat(data['rotation.x']),
            y: parseFloat(data['rotation.y']),
            z: parseFloat(data['rotation.z'])
        };
        const { x, y, z } = position;
        const vector = new THREE.Vector3(x, y, z);
        vector.applyMatrix4(TM); //位置坐标转换
        position.x = vector.x;
        position.y = vector.y;
        position.z = vector.z;
        const rotationQuaternion = new THREE.Quaternion(); //旋转转换
        const nullVector = new THREE.Vector3();
        TM.decompose(nullVector, rotationQuaternion, nullVector);
        const realrotation = new THREE.Euler().setFromQuaternion(rotationQuaternion, 'XYZ').z;
        const point = { x: position.x, y: position.y };
        parkingAreas.forEach((area, index) => {
            if (inside(point, area)) {
                carposARR[index].push(point);
                carscaleARR[index].push(scale);
                carrotARR[index].push(rotation.z - realrotation + Math.PI / 2);
            }
        });
    });
    filteredData.length = 0; 
    csvData.length = 0; 
    // console.log('position',carposARR);
    // console.log('rotation',carrotARR);
    // console.log('scale',carscaleARR);
    //klman filter
    const kfframe = [];
    const kfframerot = [];
    const kfframescale = [];

    Object.keys(carFilters).forEach(uid => {
        carFilters[uid].predict();
    });
    const allCarUIDs = new Set(Object.keys(carFilters)); 
    for ( let b = 0; b < parkingAreas.length; b++){            
                const kfarea = [];
                const kfrot = [];
                const kfscale = [];
                const updatedUIDs = new Set();
                for( let c = 0; c < carposARR[b].length; c++) {//该帧内的车位内部车辆编号
                    const pos = carposARR[b][c];
                    const uid = findClosestUID(b, pos);
                    // console.log('closestuid',uid);
                if (uid && carFilters[uid]) { 
                    carFilters[uid].update({x: pos.x, y: pos.y, rotation: carrotARR[b][c]});
                    carFilters[uid].setScale(carscaleARR[b][c]); // 更新缩放
                    // console.log('P matrix before accessing:', carFilters[uid].P);
                    const posXVariance = carFilters[uid].P.get([0, 0]);
                    const posYVariance = carFilters[uid].P.get([1, 1]);
                    const filteredRotation = carFilters[uid].rotation;
                    // console.log('cov',posXVariance);
                    // console.log('cov',posYVariance);
                    if (posXVariance < covarianceThreshold && posYVariance < covarianceThreshold) {
                        kfarea.push(pos);
                        kfrot.push(filteredRotation);
                        kfscale.push(carscaleARR[b][c]);
                        updatedUIDs.add(uid);
                    } 
                    else if  (posXVariance > covariancemaxThreshold || posYVariance > covariancemaxThreshold) {
                                delete carFilters[uid];
                                removeBoundingBox(uid);  // 定义一个函数用于从场景中移除
                    }
                } else {
                    const {x: normX, y: normY} = normalizeposition(pos.x, pos.y);
                    const newUID = generateUID(b, normX, normY);
                    const newFilter = new KalmanFilter([pos.x, pos.y], carrotARR[b][c], carscaleARR[b][c]);
                    carFilters[newUID] = newFilter;
                    initialPositions[newUID] = pos;
                    kfarea.push(pos);
                    kfrot.push(carrotARR[b][c]);
                    kfscale.push(carscaleARR[b][c]);
                    updatedUIDs.add(newUID);
                    }
                }; 
                allCarUIDs.forEach(uid => {
                    if (!updatedUIDs.has(uid) && uid.startsWith(`Lot${b}_`)) {
                        const filter = carFilters[uid];
                        // console.log(filter.x.size());
                        const predictedPos = {
                            x: filter.x.get([0, 0]),
                            y: filter.x.get([1, 0])
                        };
                        kfarea.push(predictedPos);
                        kfrot.push(filter.rotation);
                        kfscale.push(filter.scale);
                    }
                });
                const sortedIndices = kfarea.map((coord, index) => ({coord, index}))
                                .sort((a, b) => a.coord.x - b.coord.x)
                                .map(item => item.index);


                const sortedkfarea = sortedIndices.map(index => kfarea[index]);
                const sortedkfscale = sortedIndices.map(index => kfscale[index]);
                const sortedkfrot = sortedIndices.map(index => kfrot[index]);
                // console.log('skfarea',sortedkfarea);
                // console.log('skfscale',sortedkfscale);
                // console.log('skfrot',sortedkfrot);
                kfframe.push(sortedkfarea);
                kfframerot.push(sortedkfrot);
                kfframescale.push(sortedkfscale);
                // console.log('klfilter',carFilters);
                // console.log('kfpos',kfframe);
    }
            // render bounding box
            clearGroup(jsonscene);
            for ( let k = 0; k < parkingAreas.length; k++){
                    for ( let l = 0; l < kfframe[k].length; l++){
                        const boxGeometry = new THREE.BoxGeometry(kfframescale[k][l].x, kfframescale[k][l].y, kfframescale[k][l].z);
                        const boxMaterial = new THREE.MeshBasicMaterial({
                            color: 0xbb33FA,
                            wireframe: true,
                            visible: false
                        });
                        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
                        boxMesh.position.set(kfframe[k][l].x, kfframe[k][l].y, -26);
                        boxMesh.rotation.set(0, 0, kfframerot[k][l]);
                        const uid = generateUID(Math.round(kfframe[k][l].x), Math.round(kfframe[k][l].y));
                        boxMesh.userData.uid = uid;
                        // console.log(boxMesh);
                        jsonscene.add(boxMesh);
                    }
                }
                detect(parkingAreas, kfframe, kfframescale, carlength, freescene);
}
async function processJsonData(frame, path){
    const index2 = String(frame).padStart(6, '0');
    const filePath1 = `${path}${index2}.json`;
   let jsonDatatum;
try {
    const response = await fetch(filePath1);
    if (!response.ok) {
        console.warn(`Ne mogu da učitam fajl: ${filePath1}`);
        return; // prekini dalje procesiranje
    }
    jsonDatatum = await response.json();
} catch (err) {
    console.error(`Greška prilikom fetch-a: ${filePath1}`, err);
    return;
}

    dataCache.set(jsonDatatum);

    let tumcarposARR = Array.from({ length: parkingAreas.length }, () => []);
    let tumcarscaleARR = Array.from({ length: parkingAreas.length }, () => []);
    let tumcarrotARR = Array.from({ length: parkingAreas.length }, () => []);
    const filteredData = jsonDatatum.filter(data => data.obj_type !== "Pedestrian");



    filteredData.forEach(data => {
        const { position, scale, rotation } = data.psr;
        const { x, y, z } = data.psr.position;
        const vector = new THREE.Vector3(x, y, z);
        vector.applyMatrix4(TM); //位置坐标转换
        position.x = vector.x;
        position.y = vector.y;
        position.z = vector.z;
        const rotationQuaternion = new THREE.Quaternion(); //旋转转换
        const nullVector = new THREE.Vector3();
        TM.decompose(nullVector, rotationQuaternion, nullVector);
        const realrotation = new THREE.Euler().setFromQuaternion(rotationQuaternion, 'XYZ').z;
        data.psr.rotation = {
            x: 0,
            y: 0,
            z: realrotation
        };
        const point = { x: position.x, y: position.y };
        parkingAreas.forEach((area, index) => {
            if (inside(point, area)) {
                tumcarposARR[index].push(point);
                tumcarscaleARR[index].push(scale);
                tumcarrotARR[index].push(rotation.z + data.psr.rotation.z);
            }
        });
    });

    filteredData.length = 0; 
    jsonDatatum.length = 0; 
    // console.log('position',carposARR);
    // console.log('rotation',carrotARR);
    // console.log('scale',carscaleARR);
    //klman filter
    const kfframe = [];
    const kfframerot = [];
    const kfframescale = [];

    Object.keys(carFilters).forEach(uid => {
        carFilters[uid].predict();
    });
    const allCarUIDs = new Set(Object.keys(carFilters)); 
    for ( let b = 0; b < parkingAreas.length; b++){            
                const kfarea = [];
                const kfrot = [];
                const kfscale = [];
                const updatedUIDs = new Set();
                for( let c = 0; c < tumcarposARR[b].length; c++) {//该帧内的车位内部车辆编号
                    const pos = tumcarposARR[b][c];
                    const uid = findClosestUID(b, pos);
                    // console.log('closestuid',uid);
                if (uid && carFilters[uid]) { 
                    carFilters[uid].update({x: pos.x, y: pos.y, rotation: tumcarrotARR[b][c]});
                    carFilters[uid].setScale(tumcarscaleARR[b][c]); // 更新缩放
                    const posXVariance = carFilters[uid].P.get([0, 0]);
                    const posYVariance = carFilters[uid].P.get([1, 1]);
                    const filteredRotation = carFilters[uid].rotation;
                    // console.log('cov',posXVariance);
                    // console.log('cov',posYVariance);
                    if (posXVariance < covarianceThreshold && posYVariance < covarianceThreshold) {
                        kfarea.push(pos);
                        kfrot.push(filteredRotation);
                        kfscale.push(tumcarscaleARR[b][c]);
                        updatedUIDs.add(uid);
                    } 
                    else if  (posXVariance > covariancemaxThreshold || posYVariance > covariancemaxThreshold) {
                                delete carFilters[uid];
                                removeBoundingBox(uid);  // 定义一个函数用于从场景中移除
                    }
                } else {
                    const {x: normX, y: normY} = normalizeposition(pos.x, pos.y);
                    const newUID = generateUID(b, normX, normY);
                    const newFilter = new KalmanFilter([pos.x, pos.y], tumcarrotARR[b][c], tumcarscaleARR[b][c]);
                    carFilters[newUID] = newFilter;
                    initialPositions[newUID] = pos;
                    kfarea.push(pos);
                    kfrot.push(tumcarrotARR[b][c]);
                    kfscale.push(tumcarscaleARR[b][c]);
                    updatedUIDs.add(newUID);
                    }
                }; 
                allCarUIDs.forEach(uid => {
                    if (!updatedUIDs.has(uid) && uid.startsWith(`Lot${b}_`)) {
                        const filter = carFilters[uid];
                        const predictedPos = {
                            x: filter.x.get([0, 0]),
                            y: filter.x.get([0, 1])
                        };
                        kfarea.push(predictedPos);
                        kfrot.push(filter.rotation);
                        kfscale.push(filter.scale);
                    }
                });
                const sortedIndices = kfarea.map((coord, index) => ({coord, index}))
                                .sort((a, b) => a.coord.x - b.coord.x)
                                .map(item => item.index);


                const sortedkfarea = sortedIndices.map(index => kfarea[index]);
                const sortedkfscale = sortedIndices.map(index => kfscale[index]);
                const sortedkfrot = sortedIndices.map(index => kfrot[index]);
                // console.log('skfarea',sortedkfarea);
                // console.log('skfscale',sortedkfscale);
                // console.log('skfrot',sortedkfrot);
                kfframe.push(sortedkfarea);
                kfframerot.push(sortedkfrot);
                kfframescale.push(sortedkfscale);
                // console.log('klfilter',carFilters);
                // console.log('kfpos',kfframe);
    }
    // console.log('carpos',tumcarposARR);



    clearGroup(jsonscene);

    for ( let k = 0; k < parkingAreas.length; k++){
        for ( let l = 0; l < kfframe[k].length; l++){
            const boxGeometry = new THREE.BoxGeometry(kfframescale[k][l].x, kfframescale[k][l].y, kfframescale[k][l].z);
            const boxMaterial = new THREE.MeshBasicMaterial({
                color: 0xbb33FA,
                wireframe: true,
                visible: false
            });
            const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
            boxMesh.position.set(kfframe[k][l].x, kfframe[k][l].y, -26);
            boxMesh.rotation.set(0, 0, kfframerot[k][l]);
            // UID za svako vozilo
                    const uid = generateUID(Math.round(kfframe[k][l].x), Math.round(kfframe[k][l].y));
                    boxMesh.userData.uid = uid;

                    jsonscene.add(boxMesh);
                    }
                }
                console.log("🧠 Pozivam detect() iz processJsonData, frame:", frame);
                detect(parkingAreas, kfframe, kfframescale, carlength, freescene);
}
function updateParkingTable() {
    const tableContainer = document.getElementById("parkingTable");
    if (!tableContainer) return;

    let tableHTML = `
        <div style="font-weight:bold; margin-bottom:5px;">Real-time Parking Status</div>`;

    const entries = Object.entries(parkingStatusMap);
    const total = entries.length;
    const free = entries.filter(([_, v]) => v.status === "free").length;

    tableHTML += `<div style="margin-bottom:5px;">${free} / ${total} free</div>`;
    tableHTML += `
        <table style="width:100%; font-size:12px; border-collapse:collapse;">
            <thead>
                <tr style="background:#f0f0f0;"><th>ID</th><th>Status</th><th>Timer</th></tr>
            </thead>
            <tbody>
    `;

    const now = Date.now();

    entries.forEach(([uid, info]) => {
        const duration = Math.floor((now - info.lastChange) / 1000);
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const statusClass = info.status === "free" ? "free"
                            : info.status === "occupied" ? "occupied"
                            : "unknown";

        tableHTML += `
        <tr data-uid="${uid}" style="cursor:pointer;" onmouseover="this.style.background='#eee'" onmouseout="this.style.background='white'">
            <td>${uid}</td>
            <td class="${statusClass}">${info.status}</td>
            <td>${mins}m ${secs < 10 ? '0' + secs : secs}s</td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;

    // Aktiviraj klik za svaki red
    tableContainer.querySelectorAll("tr[data-uid]").forEach(row => {
        const uid = row.getAttribute("data-uid");
        row.addEventListener("click", () => zoomToParkingSpot(uid));
    });
}
function zoomToParkingSpot(uid) {
    const allMeshes = [...jsonscene.children, ...freescene.children];
    const targetMesh = allMeshes.find(obj => obj.userData?.uid === uid);

    if (!targetMesh) {
        console.warn(`Parking spot with UID ${uid} not found in scene.`);
        return;
    }

    const targetPosition = targetMesh.position.clone();
    const offset = new THREE.Vector3(0, -20, 40);
    const destination = targetPosition.clone().add(offset);

    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();

    const endPos = destination;
    const endTarget = targetPosition;

    if (zoomAnimationId) {
        cancelAnimationFrame(zoomAnimationId);
    }

    zoomStartTime = performance.now();
    const duration = 1000; // ms

    function animateZoom(now) {
        const t = Math.min((now - zoomStartTime) / duration, 1);
        const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // lagani easing

        camera.position.lerpVectors(startPos, endPos, easedT);
        controls.target.lerpVectors(startTarget, endTarget, easedT);
        controls.update();

        if (t < 1) {
            zoomAnimationId = requestAnimationFrame(animateZoom);
        } else {
            zoomAnimationId = null;
        }
    }

    zoomAnimationId = requestAnimationFrame(animateZoom);
}
window.zoomToParkingSpot = zoomToParkingSpot;
function removeBoundingBox(uid) {
    const object = scene.getObjectByName(uid);
    if (object) {
        scene.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
    }
}
function inside(point, area) {
    const x = point.x;
    const y = point.y;
    const vertices = [
        { x: area.x1, y: area.y1 },
        { x: area.x2, y: area.y2 },
        { x: area.x3, y: area.y3 },
        { x: area.x4, y: area.y4 }
    ];
    let intersections = 0;
    for (let i = 0; i < 4; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % 4];
        if (y === p1.y && y === p2.y) {
            if (x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x)) {
                return true;
            }
        } else if (y >= Math.min(p1.y, p2.y) && y <= Math.max(p1.y, p2.y)) {
            const xIntersection = ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y) + p1.x;
            if (xIntersection === x) {
                return true;
            }
            if (xIntersection > x) {
                intersections++;
            }
        }
    }
    return intersections % 2 === 1;
}
function clearGroup(group) {
    while (group.children.length > 0) {
        const object = group.children[0];
        group.remove(object);

        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            object.material.dispose();
        }
    }
}
function distance(point1, point2) {
    return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
}
function isShortEdge(edgePoint1, edgePoint2, parkingVertices) {
	const edgeLength = distance(edgePoint1, edgePoint2);
	const edgeLengths = parkingVertices.map((v, i) => distance(v, parkingVertices[(i + 1) % parkingVertices.length]));
	edgeLengths.sort((a, b) => a - b);
	const shortestEdges = [edgeLengths[0], edgeLengths[1]];
	return edgeLength === shortestEdges[0] || edgeLength === shortestEdges[1];
}
function detect(parkingAreas, kfframe, kfframescale, carlength, freescene) {
clearGroup(freescene);
console.log("Detect called, parkingAreas.length =", parkingAreas.length);

for (const uid in parkingStatusMap) {
    parkingStatusMap[uid].updated = false;
}

for (let j = 0; j < parkingAreas.length; j++) {
    const parkingVertices = [
        { x: parkingAreas[j].x1, y: parkingAreas[j].y1 },
        { x: parkingAreas[j].x2, y: parkingAreas[j].y2 },
        { x: parkingAreas[j].x3, y: parkingAreas[j].y3 },
        { x: parkingAreas[j].x4, y: parkingAreas[j].y4 }
    ];
    const shortedges = [];
    for (let a = 0; a < parkingVertices.length; a++) {
        const p1 = parkingVertices[a];
        const p2 = parkingVertices[(a + 1) % parkingVertices.length];
        if (isShortEdge(p1, p2, parkingVertices)) {
            shortedges.push({
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2
            });
        }
        if (shortedges.length === 2) break;
    }

    const center = {
        x: (shortedges[0].x + shortedges[1].x) / 2,
        y: (shortedges[0].y + shortedges[1].y) / 2
    };

    const uid = (j + 1).toString();
    const isOccupied = Array.isArray(kfframe[j]) && kfframe[j].length > 0;
    const newStatus = isOccupied ? "occupied" : "free";
    const now = Date.now();

    if (!parkingStatusMap[uid]) {
        parkingStatusMap[uid] = {
            status: newStatus,
            lastChange: now,
            updated: true
        };
    } else {
        if (parkingStatusMap[uid].status !== newStatus) {
            parkingStatusMap[uid].status = newStatus;
            parkingStatusMap[uid].lastChange = now;
        }
        parkingStatusMap[uid].updated = true;
    }

    // Dodavanje CSS2D labela iznad svakog parking mesta
    const width = 1.5;
    const length = distance(shortedges[0], shortedges[1]);

    const geometry = new THREE.PlaneGeometry(length, width);
    const material = new THREE.MeshBasicMaterial({
        color: newStatus === 'occupied' ? 0xff0000 : 0x00ff00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
    });

    const plane = new THREE.Mesh(geometry, material);
    plane.position.set(center.x, center.y, -25);
    plane.rotation.z = angles[j];
    plane.userData.uid = uid;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    labelDiv.textContent = uid;
    labelDiv.style.color = 'black';
    labelDiv.style.fontSize = '10px';
    labelDiv.style.backgroundColor = 'white';
    labelDiv.style.padding = '2px';
    labelDiv.style.borderRadius = '4px';

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, 0, 3);
    plane.add(label);

    freescene.add(plane);
}

// Postavi status na "unknown" za UID-eve koje ovaj frejm nije detektovao
for (const uid in parkingStatusMap) {
    if (!parkingStatusMap[uid].updated) {
        parkingStatusMap[uid].status = "unknown";
    }
}

let freeCount = 0;
let occupiedCount = 0;

for (const uid in parkingStatusMap) {
    if (parkingStatusMap[uid].status === "free") {
        freeCount++;
    } else if (parkingStatusMap[uid].status === "occupied") {
        occupiedCount++;
    }
}

const occupancyRateDiv = document.getElementById("occupancyRate");
if (occupancyRateDiv) {
    occupancyRateDiv.innerText = `Free lot number: ${freeCount}`;
}

// console.log(`[DETECT] Free: ${freeCount}, Occupied: ${occupiedCount}`);
}
//kalman
let carFilters = {};
function normalizeposition(x, y) {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    return {x: roundedX, y: roundedY};
}
function findClosestUID(parkingLotId, pos) {
    let minDistance = 3;
    let closestUID = null;
    Object.keys(initialPositions).forEach(uid => {
        if (uid.startsWith(`Lot${parkingLotId}`)) {
            const initialPos = initialPositions[uid];
            const dist = distance(pos, initialPos);
            if (dist < minDistance) {
                minDistance = dist;
                closestUID = uid;
            }
        }
    });
    return closestUID;
}
function generateUID(vehicleId) {
    const baseId = 684000;
    return vehicleId - baseId + 1;
}
class KalmanFilter {
    constructor(initialPos = [0, 0], initialRotation = 0, initialScale = { x: 1, y: 1, z: 1 }) {
        this.dt = 1; // 时间步长

        // 状态转移矩阵（考虑位置）
        this.F = math.matrix([
            [1, 0], 
            [0, 1]
        ]);

        this.H = math.matrix([
            [1, 0], // 观测x
            [0, 1]  // 观测y
        ]);

        this.Q = math.multiply(math.identity(2), 0.1);

        this.R = math.matrix([
            [0.01, 0],
            [0, 0.01]
        ]);

        this.x = math.matrix([[initialPos[0]], [initialPos[1]]]);
        this.rotation = initialRotation;
        this.scale = initialScale;
        // 初始协方差矩阵
        this.P = math.multiply(math.identity(2), 100);

        // 添加旋转的卡尔曼滤波器
        this.rotationFilter = {
            F: math.matrix([[1]]),
            H: math.matrix([[1]]),
            Q: math.matrix([[0.01]]),
            R: math.matrix([[0.1]]),
            x: math.matrix([[initialRotation]]),
            P: math.matrix([[100]])
        };
    }

    predict() {
        // 位置预测
        this.x = math.multiply(this.F, this.x);
        this.P = math.add(math.multiply(math.multiply(this.F, this.P), math.transpose(this.F)), this.Q);

        // 旋转预测
        this.rotationFilter.x = math.multiply(this.rotationFilter.F, this.rotationFilter.x);
        this.rotationFilter.P = math.add(
            math.multiply(math.multiply(this.rotationFilter.F, this.rotationFilter.P), math.transpose(this.rotationFilter.F)),
            this.rotationFilter.Q
        );
    }

    update(measurement) {
        const z = math.matrix([measurement.x, measurement.y]);
        const y = math.subtract(z, math.multiply(this.H, this.x)); // 残差
        const S = math.add(math.multiply(math.multiply(this.H, this.P), math.transpose(this.H)), this.R); // 残差协方差
        const K = math.multiply(math.multiply(this.P, math.transpose(this.H)), math.inv(S)); // 卡尔曼增益
        this.x = math.add(this.x, math.multiply(K, y)); // 更新状态
        const I = math.identity(math.size(this.F)._data[0]);
        this.P = math.multiply(math.subtract(I, math.multiply(K, this.H)), this.P); // 更新协方差

        // 旋转更新
        const zRotation = math.matrix([[measurement.rotation]]);
        const yRotation = math.subtract(zRotation, math.multiply(this.rotationFilter.H, this.rotationFilter.x));
        const SRotation = math.add(
            math.multiply(math.multiply(this.rotationFilter.H, this.rotationFilter.P), math.transpose(this.rotationFilter.H)),
            this.rotationFilter.R
        );
        const KRotation = math.multiply(math.multiply(this.rotationFilter.P, math.transpose(this.rotationFilter.H)), math.inv(SRotation));
        this.rotationFilter.x = math.add(this.rotationFilter.x, math.multiply(KRotation, yRotation));
        this.rotationFilter.P = math.multiply(math.subtract(math.identity(1), math.multiply(KRotation, this.rotationFilter.H)), this.rotationFilter.P);
        this.rotation = this.rotationFilter.x.get([0, 0]);
    }

    setRotation(rotation) {
        this.rotation = rotation;
    }

    setScale(scale) {
        this.scale = scale;
    }
}
//simulated vehicles
let edgeCoordinates = {};
let vehicleRoutes = {};
let vehicleDepartTimes = {};
let vehicleSpeeds = {};
const tumURL = '1080/osm.passenger.rou.xml';
const osmURL = '1080/osm.net.xml';   
// console.log('st',simulateTraffic);
if (simulateTraffic === true) { 
    vehicleRoutes = await fetchvehXMLFile(tumURL);
    edgeCoordinates = await fetchrouXMLFile(osmURL);
}
async function fetchvehXMLFile(url) {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");
    xmlDoc.querySelectorAll('vehicle').forEach(vehicle => {
        const vehicleId = vehicle.getAttribute('id');
        const departTime = parseFloat(vehicle.getAttribute('depart'));
        let departSpeed = vehicle.getAttribute('departSpeed');
        if (departSpeed === "max") {
            departSpeed = "max"; // 标记为max，以便稍后处理
        } else {
            departSpeed = parseFloat(departSpeed) || 0;
        }
        vehicleDepartTimes[vehicleId] = departTime;
        vehicleSpeeds[vehicleId] = departSpeed;
        const routeElement = vehicle.querySelector('route');
        if (routeElement) {
            const edges = routeElement.getAttribute('edges').split(' ');
            vehicleRoutes[vehicleId] = edges;
        }
    });
    return vehicleRoutes;
}
async function fetchrouXMLFile(url) {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");
    const TFM = [
        [1, 0, 690747.906509577],
        [0, 1, 5335846.90492905],
        [0, 0, 1]
    ];
    xmlDoc.querySelectorAll('edge').forEach(edge => {
        const edgeId = edge.getAttribute('id');
        const lanes = edge.querySelectorAll('lane');
        lanes.forEach(lane => {
            const laneId = lane.getAttribute('id');
            const speedLimit = parseFloat(lane.getAttribute('speed'));
            const shape = lane.getAttribute('shape');
            if (shape) {
                const coordinates = shape.split(' ').map(coord => {
                    const [x, y] = coord.split(',').map(Number);
                    return applyTransformation(TFM, [x, y]);
                });
                if (!isNaN(speedLimit)) {
                    if (!edgeCoordinates[edgeId]) {
                        edgeCoordinates[edgeId] = [];
                    }
                    edgeCoordinates[edgeId].push({ coordinates, speedLimit });
                } else {
                    console.warn(`Speed limit is NaN for lane ${laneId} of edge ${edgeId}`);
                    edgeCoordinates[edgeId].push({ coordinates, speedLimit: 10 }); // 使用默认速度限制
                }
            }
        });
    });
    return edgeCoordinates;
}
function renderRoutes(vehicleRoutes, edgeCoordinates) {
    const paths = {};
    const pathsSpeeds = {};
    Object.entries(vehicleRoutes).forEach(([vehicleId, edges]) => {
        const points = [];
        const speeds = [];  // 用于存储每段路径的速度限制
        edges.forEach(edgeId => {
            if (edgeCoordinates[edgeId]) {
                const lane = edgeCoordinates[edgeId][0]; 
                lane.coordinates.forEach(coord => {
                    if (coord && coord.length === 2) {
                        points.push(new THREE.Vector3(coord[0], coord[1], -24));
                    } else {
                        console.warn(`Invalid coordinate for edge ${edgeId}`, coord);
                    }
                });
                speeds.push(lane.speedLimit);  // 添加速度限制
            } else {
                console.warn(`Edge ${edgeId} not found in edgeCoordinates`);
            }
        });
        if (points.length > 0) {
            const path = new THREE.CatmullRomCurve3(points);
            paths[vehicleId] = path;
            pathsSpeeds[vehicleId] = speeds;  // 存储路径段的速度限制
        } else {
            console.warn(`No valid points found for vehicle ${vehicleId}`);
        }
    });
    return { paths, pathsSpeeds };
}
function applyTransformation(matrix, point) {
    const [x, y] = point;
    const homogeneousPoint = [x, y, 1];

    const transformedX = matrix[0][0] * homogeneousPoint[0] + matrix[0][1] * homogeneousPoint[1] + matrix[0][2] * homogeneousPoint[2];
    const transformedY = matrix[1][0] * homogeneousPoint[0] + matrix[1][1] * homogeneousPoint[1] + matrix[1][2] * homogeneousPoint[2];

    return [transformedX, transformedY];
}
// VEHICLE renderer
const vehicles = {};
const { paths, pathsSpeeds } = renderRoutes(vehicleRoutes, edgeCoordinates);
Object.keys(vehicleRoutes).forEach(vehicleId => {
    if (paths[vehicleId]) {
        const geometry = new THREE.BoxGeometry(3, 1.5, 2);  
        const material = new THREE.MeshBasicMaterial({ color: 0x00008e });
        const cube = new THREE.Mesh(geometry, material);

        vehicles[vehicleId] = {
            model: cube,
            path: paths[vehicleId],
            speeds: pathsSpeeds[vehicleId],  
            departTime: vehicleDepartTimes[vehicleId],
            speed: vehicleSpeeds[vehicleId],
            progress: 0,
            addedToScene: false,  
            completed: false,  
            type: 'simulation'
        };

    } else {
        console.warn(`Path not found for vehicle ${vehicleId}`);
    }
});
//Visualise
const revealedGroup = new THREE.Group();
scene.add(revealedGroup);
let processedSingleFrame = false;
let simulationStartTime = performance.now();
let frame = 1;
let lastFrameTime = 0;
let frameInterval = 150;
let kfframe = []
let kfframescale = 1; 
function animate(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;

    if (elapsed >= frameInterval) {
        pointCloudPaths.forEach((group, groupIndex) => {
            const { path, count } = group;

            if (!group.currentFrame) {
                group.currentFrame = 1;
            }

            if (group.currentFrame <= count) {
                pcdload(group.currentFrame, path, groupIndex);
                group.currentFrame += 5;

                if (group.currentFrame > count) {
                    group.currentFrame = 1;
                }
            }
        });

        boundingBoxPaths.forEach(({ path, count }) => {
            if (count === 1) {
                if (!processedSingleFrame) {
                    frame = 1;
                    if (boundingBoxType === 'csv') {
                        processCsvData(frame, path);
                    } else if (boundingBoxType === 'json') {
                        processJsonData(frame, path);
                    }
                    processedSingleFrame = true;
                }
            } else {
                if (boundingBoxType === 'csv') {
                    processCsvData(frame, path);
                } else if (boundingBoxType === 'json') {
                    processJsonData(frame, path);
                }

                frame += 1;
                if (frame > count) {
                    frame = 1;
                }
            }
        });

        lastFrameTime = timestamp;
    }

    const currentTime = (performance.now() - simulationStartTime) / 1000;

    Object.values(vehicles).forEach(vehicle => {
        if (currentTime >= vehicle.departTime && !vehicle.completed) {
            if (!vehicle.addedToScene) {
                scene.add(vehicle.model);
                vehicle.addedToScene = true;
            }

            if (vehicle.path) {
                const pathLength = vehicle.path.getLength();
                const segmentIndex = Math.floor(vehicle.progress * vehicle.speeds.length);
                const segmentSpeed = vehicle.speeds[segmentIndex] || vehicle.speed;
                const progressIncrement = segmentSpeed / pathLength * 0.05;
                vehicle.progress += progressIncrement;

                if (vehicle.progress >= 1) {
                    vehicle.progress = 1;
                    vehicle.completed = true;
                    scene.remove(vehicle.model);
                }

                const point = vehicle.path.getPointAt(vehicle.progress);
                if (point) {
                    vehicle.model.position.copy(point);
                    const nextPoint = vehicle.path.getPointAt((vehicle.progress + 0.06) % 1);
                    if (nextPoint) {
                        vehicle.model.lookAt(nextPoint);
                        vehicle.model.up.set(0, 0, 1);
                        vehicle.model.rotateY(3 * Math.PI / 2);
                        revealRectangles(point, nextPoint);
                    }
                }
            }
        }
    });

    if (trackingMode === 'vehicle' && currentVehicleId) {
        const vehicle = vehicles[currentVehicleId];
        if (vehicle && vehicle.addedToScene && !vehicle.completed) {
            let targetPosition, targetLookAt;

            if (vehicle.type === 'simulation') {
                targetPosition = vehicle.model.position.clone().add(new THREE.Vector3(-20, -60, 100));
                targetLookAt = vehicle.model.position.clone();
            } else if (vehicle.type === 'pointcloud') {
                targetPosition = vehicle.position.clone().add(new THREE.Vector3(-20, -60, 100));
                targetLookAt = vehicle.position.clone();
            }

            camera.position.lerp(targetPosition, 0.1);
            camera.lookAt(targetLookAt);
        }
    }

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

    updateParkingTable();
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
    const zoomThreshold = 0; // 👈 podešavanje visine kamere
    const showLabels = camera.position.z < zoomThreshold;

    freescene.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.children.length > 0) {
            obj.children.forEach(child => {
                if (child instanceof CSS2DObject) { 
                    child.element.style.display = showLabels ? 'block' : 'none';
                }
            });
        }
    });


    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
const processedUIDs = new Set();
const objectCooldowns = new Map();
const allDetectedUIDs = new Set();
function revealRectangles(carPosition, nextCarPosition) {
    const currentTime = performance.now();
    const revealRadius = 40;
    let emptySpotRemoved = false;
    let emptySpotAdded = false;
    const lotUIDs = new Set(); // 用来跟踪已经处理过的uid
    const detectedUIDs = new Set();
    
freescene.children.forEach(mesh => {
    if (mesh.userData.uid) {
        lotUIDs.add(mesh.userData.uid);
    }
})
revealedGroup.children.forEach(object => {
    const uid = object.userData.uid;
    if (distance(nextCarPosition, object.position) < revealRadius) {
        if (!processedUIDs.has(uid)) {
            object.material.color.setHex(0x00ff00);  // 更新颜色
            processedUIDs.add(uid);
        }
        detectedUIDs.add(uid);  // 标记为已检测到
    }
});
    
    // 添加车后方20米范围内的对象
    scene.traverse(function (object) {

    

        if (object.isMesh && (object.geometry.type === 'BoxGeometry' || object.geometry.type === 'PlaneGeometry')) {
            const rectPosition = object.position;
            
            if (distance(carPosition, rectPosition) < revealRadius && distance(nextCarPosition, rectPosition) >= 40) {
                if (!object.material.visible) {
                    object.material.visible = true;
                    // console.log('cool',visualCooldown);
                    const clonedGeometry = object.geometry.clone();
                    const clonedMaterial = object.material.clone();
                    const clonedMesh = new THREE.Mesh(clonedGeometry, clonedMaterial);
                    clonedMesh.position.copy(object.position);
                    clonedMesh.rotation.copy(object.rotation);
                    clonedMesh.scale.copy(object.scale);
                    clonedMesh.userData.revealTime = performance.now(); // 记录揭露时间
                    clonedMesh.userData.originalColor = new THREE.Color(object.material.color.getHex()); 
                    revealedGroup.add(clonedMesh);
                    object.material.visible = false;
                    if (object.geometry.type === 'PlaneGeometry' && !processedUIDs.has(object.userData.uid) && lotUIDs.has(object.userData.uid)) {
                        // console.log(object.geometry.parameters.width);
                        emptySpotAdded = true;
                        const lotnumber = object.geometry.parameters.width / 4;
                        // totalEmptySpotLength += lotnumber;
                        processedUIDs.add(object.userData.uid); // 添加到已处理集合中
                        objectCooldowns.set(object.userData.uid, currentTime); // 记录处理时间
                    }
                }
            }
        }
    });
  if (emptySpotRemoved || emptySpotAdded) {
        
    // console.log('total',totalParkingLength);
    // console.log('emp',totalEmptySpotLength);
        updateOccupancyRate();
    }

    detectedUIDs.forEach(uid => {
        allDetectedUIDs.add(uid);
    });

    // 移除当前检测范围内未被检测到的物体
    for (let i = revealedGroup.children.length - 1; i >= 0; i--) {
        const object = revealedGroup.children[i];
        const uid = object.userData.uid;

        // 如果该物体的uid曾被检测到，但现在在检测范围内却没有被检测到，则移除它
        if (distance(carPosition, object.position) < revealRadius && !detectedUIDs.has(uid) && allDetectedUIDs.has(uid)) {
            revealedGroup.remove(object);
            object.geometry.dispose();
            object.material.dispose();
            allDetectedUIDs.delete(uid);  // 从全局集合中移除
        }
    }
}
function updateOccupancyRate() {
    const entries = Object.entries(parkingStatusMap);
    const total = entries.length;
    const free = entries.filter(([_, v]) => v.status === "free").length;

    occupancyRateElement.textContent = `Free lot number: ${free} / ${total}`;
}
let toggleLegendButton = document.getElementById('toggleLegend');
let legendContainer = document.getElementById('legend');
let toggleInfoButton = document.getElementById('toggleInfo');
let infoBox = document.getElementById('infoBox');
toggleLegendButton.addEventListener('click', () => {
    const isLegendVisible = legendContainer.style.display === 'block';
    legendContainer.style.display = isLegendVisible ? 'none' : 'block';
});
toggleInfoButton.addEventListener('click', () => {
    const isInfoBoxVisible = infoBox.style.display === 'block';
    infoBox.style.display = isInfoBoxVisible ? 'none' : 'block';
});
function toggleVehicleButtons(show) {
    vehicleButtonsContainer.style.display = show ? 'block' : 'none';
}
toggleTrackingButton.addEventListener('click', () => {
    trackingMode = trackingMode === 'global' ? 'vehicle' : 'global';
    toggleVehicleButtons(trackingMode === 'vehicle');
    if (trackingMode === 'vehicle') {
        detectCurrentVehicles();
    } else {
        currentVehicleId = null;
        controls.target.set(690850.534588, 5336083.112424, 0);
        camera.position.set(690900.534588, 5336163.112424, 350);
        controls.update();
    }
});
function detectCurrentVehicles() {
    while (vehicleButtonsContainer.firstChild) {
        vehicleButtonsContainer.removeChild(vehicleButtonsContainer.firstChild);
    }

    Object.keys(vehicles).forEach(vehicleId => {
        if (vehicles[vehicleId].addedToScene && !vehicles[vehicleId].completed) {
            const button = document.createElement('div');
            button.className = 'vehicleButton';
            button.textContent = `Vehicle ${vehicleId}`;
            button.addEventListener('click', () => {
                currentVehicleId = vehicleId;
                trackingMode = 'vehicle';
            });
            vehicleButtonsContainer.appendChild(button);
        }
    });
}
function renderLegendModel() {
    const legendCanvas = document.getElementById('vehicleModelCanvas');
    const legendRenderer = new THREE.WebGLRenderer({ canvas: legendCanvas, alpha: true });
    legendRenderer.setSize(50, 50);

    const legendScene = new THREE.Scene();
    const legendCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    legendCamera.position.set(0, 1.5, 3);      // podignuta kamera
    legendCamera.lookAt(0, 0, 0);              // gleda u centar

    const geometry = new THREE.BoxGeometry(1, 0.5, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00008e });
    const model = new THREE.Mesh(geometry, material);

    model.scale.set(1, 1, 1);
    model.position.y = -0.3;                  // blago spušten model
    legendScene.add(model);

    function animateLegend() {
        requestAnimationFrame(animateLegend);
        model.rotation.y += 0.05;
        legendRenderer.render(legendScene, legendCamera);
    }
    animateLegend();
}
renderLegendModel()

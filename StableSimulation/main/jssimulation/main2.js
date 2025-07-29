// Performance optimization: Defer heavy imports and operations
// console.time('main2.js-loading');

import * as THREE from 'three'
import * as math from 'mathjs'
import { loadFacultyModels } from './gltfLoader.js';
import { initializepark } from './parkingLoader.js';
import { angles } from './angles.js';
import { loadConfig } from './configLoader.js';
import { createPCDLoader } from './pointcloudLoader.js';
import { processCsvData, processJsonData } from './dataProcessor.js';
import { removeBoundingBox, inside, clearGroup, distance, normalizeposition, findClosestUID, generateUID } from './utils.js';
import { KalmanFilter } from './kalman.js';
import { updateOccupancyRate, toggleVehicleButtons, detectCurrentVehicles, setupUIEventListeners, setupSpeedControl, setupPointSizeControl, setupLegendToggle } from './uiControls.js';
import { renderLegendModel } from './legendRenderer.js';
import { fetchvehXMLFile, fetchrouXMLFile, renderRoutes, applyTransformation, createRouteFromCSV } from './trafficSimulation.js';
import { revealRectangles, updateRevealedObjects } from './revealSystem.js';
import { updateVehicleAnimation, updateCameraTracking, updateLabels, processPointClouds, processBoundingBoxes } from './animationSystem.js';
import { parkingSystem } from './parkingSystem.js';
import { performanceMonitor } from './performanceMonitor.js';

// import { PCDLoader } from 'three/examples/jsm/loaders/PCDLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TextureLoader } from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// console.timeEnd('main2.js-loading');

let zoomAnimationId = null;
let zoomStartTime = 0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(690975, 5336106, 250);
camera.lookAt(690975, 5336106, 0);
window.camera = camera;

// Global variables for renderers
let renderer = null;
let labelRenderer = null;

// WebGL context loss handling
function handleWebGLContextLoss() {
    console.warn('[MAIN] WebGL context lost, attempting to recover...');
    setTimeout(() => {
        // console.log('[MAIN] Reloading page to recover WebGL context...');
        location.reload();
    }, 1000);
}

// WebGL context creation with fallback
function createWebGLRenderer() {
    // console.log('[MAIN] Attempting to create WebGL renderer...');
    
    // Check if WebGL is supported at all
    if (!window.WebGLRenderingContext) {
        console.error('[MAIN] WebGLRenderingContext not available');
        throw new Error('WebGL not supported in this browser');
    }
    
    // Try to get a WebGL context to test if it's available
    const canvas = document.createElement('canvas');
    let gl = null;
    
    try {
        gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            console.warn('[MAIN] WebGL context not available, trying alternative methods...');
            // Try with different context attributes
            gl = canvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'default',
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                stencil: false
            });
        }
        
        if (!gl) {
            console.warn('[MAIN] WebGL context still not available, trying software rendering...');
            // Try software rendering
            gl = canvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: false,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'default',
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                stencil: false
            });
        }
        
        if (!gl) {
            throw new Error('WebGL context not available even with fallback options');
        }
        
        // console.log('[MAIN] WebGL context created successfully');
        
    } catch (contextError) {
        console.error('[MAIN] Failed to create WebGL context:', contextError);
        throw new Error('WebGL context not available');
    }
    
    // Now try to create THREE.js renderer
    try {
        // console.log('[MAIN] Creating THREE.js WebGL renderer...');
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            stencil: false,
            depth: true
        });
        // console.log('[MAIN] High-performance WebGL renderer created successfully');
        return renderer;
    } catch (error) {
        console.warn('[MAIN] High-performance WebGL failed, trying basic mode...', error);
        try {
            const renderer = new THREE.WebGLRenderer({ 
                antialias: false, 
                preserveDrawingBuffer: false,
                powerPreference: "default",
                failIfMajorPerformanceCaveat: false,
                stencil: false,
                depth: true
            });
            // console.log('[MAIN] Basic WebGL renderer created successfully');
            return renderer;
        } catch (fallbackError) {
            console.error('[MAIN] Basic WebGL failed, trying minimal mode...', fallbackError);
            try {
                const renderer = new THREE.WebGLRenderer({ 
                    antialias: false, 
                    preserveDrawingBuffer: false,
                    powerPreference: "default",
                    failIfMajorPerformanceCaveat: false,
                    stencil: false,
                    depth: false,
                    alpha: false
                });
                console.log('[MAIN] Minimal WebGL renderer created successfully');
                return renderer;
            } catch (minimalError) {
                console.error('[MAIN] Even minimal WebGL failed:', minimalError);
                throw new Error('WebGL not supported in this browser');
            }
        }
    }
}

// Funkcija za učitavanje teksture
function loadTextures() {
    const textureLoader = new TextureLoader();
    // Učitaj novu teksturu newpic.jpg bez ponavljanja
    const groundTexture = textureLoader.load('assets/opBayernDOP20rgb.jpg');
    groundTexture.wrapS = THREE.ClampToEdgeWrapping;
    groundTexture.wrapT = THREE.ClampToEdgeWrapping;
    groundTexture.repeat.set(1, 1); // Bez ponavljanja

    // Koordinate iz QGIS metapodataka
    const minX = 690000.0000;
    const maxX = 692000.0000;
    const minY = 5335000.0000;
    const maxY = 5337000.0000;
    // Dimenzije podloge prema extent-u
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const groundGeo = new THREE.PlaneGeometry(width, height);
    const groundMat = new THREE.MeshBasicMaterial({
        map: groundTexture,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);

    // Centar podloge
    ground.position.set(centerX, centerY, 1.5);

    // Bez rotacije oko x ose

    scene.add(ground);
}

// Dodaj sferu neba (sky sphere)
function addSkySphere() {
    // Dimenzije podloge (newpic.jpg): width=1360, height=1204.4
    // Dijagonala = sqrt(1360^2 + 1204.4^2) ≈ 1817m
    const skyRadius = 2000; // dovoljno da obuhvati celu podlogu, ali ne manje od nje
    const skyGeo = new THREE.SphereGeometry(skyRadius, 64, 64);
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x87cefa, // svetlo plava (sky blue)
        side: THREE.BackSide // renderuj unutrašnjost
    });
    const skySphere = new THREE.Mesh(skyGeo, skyMat);
    // Centriraj na podlogu
    skySphere.position.set(691073.8, 5336119.4, 0);
    scene.add(skySphere);
}

// Helper function to get display name for vehicles
function getVehicleDisplayName(vehicleId) {
    if (vehicleId === 'veh0') return 'Car';
    return vehicleId;
}

// Loading progress tracking
let loadingProgress = 0;
const totalLoadingSteps = 8; // Adjust based on actual steps

function updateLoadingProgress(step, message = '') {
    loadingProgress = (step / totalLoadingSteps) * 100;
    const progressBar = document.getElementById('loadingProgressBar');
    const loadingText = document.querySelector('.loading-text');
    
    if (progressBar) {
        progressBar.style.width = loadingProgress + '%';
    }
    
    if (loadingText && message) {
        loadingText.textContent = message;
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

function showWebGLError(message) {
    console.error('[MAIN] WebGL Error:', message);
    const container = document.getElementById('container');
    if (container) {
        container.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 30px; border: 2px solid #333; border-radius: 8px; 
                        text-align: center; z-index: 9999; max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                <h3 style="color: #dc3545; margin-bottom: 15px;">WebGL Error</h3>
                <p style="margin-bottom: 20px; line-height: 1.5;">${message}</p>
                <div style="margin-bottom: 15px;">
                    <p style="font-size: 14px; color: #666;">Try these solutions:</p>
                    <ul style="text-align: left; font-size: 14px; color: #666;">
                        <li>Try a different browser (Chrome, Firefox, Edge)</li>
                        <li>Enable hardware acceleration in browser settings</li>
                        <li>Update your graphics drivers</li>
                        <li>Try running browser as administrator</li>
                        <li>Disable antivirus temporarily</li>
                        <li>Check if WebGL is enabled in browser</li>
                    </ul>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="location.reload()" style="padding: 12px 24px; margin: 5px; 
                                 background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Refresh Page
                    </button>
                    <button onclick="window.close()" style="padding: 12px 24px; margin: 5px; 
                                 background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                        Close Tab
                    </button>
                </div>
            </div>
        `;
    }
    
    // Hide loading screen
    hideLoadingScreen();
}

// Inicijalizacija aplikacije
async function init() {
    updateLoadingProgress(1, 'Initializing renderer...');
    
    // Check WebGL support first
    // console.log('[MAIN] Checking WebGL support...');
    if (!window.WebGLRenderingContext) {
        console.error('[MAIN] WebGLRenderingContext not available');
        showWebGLError('WebGL not supported in this browser');
        return;
    }
    
    // Test WebGL context creation
    const testCanvas = document.createElement('canvas');
    let testGL = null;
    try {
        testGL = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        if (!testGL) {
            // Try with different context attributes
            testGL = testCanvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: 'default',
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                stencil: false
            });
        }
    } catch (e) {
        console.error('[MAIN] WebGL context test failed:', e);
    }
    
    if (!testGL) {
        console.error('[MAIN] WebGL context not available');
        showWebGLError('WebGL context not available');
        return;
    }
    
    // console.log('[MAIN] WebGL support confirmed, creating renderer...');
    
    // Create WebGL renderer with error handling
    // Add longer delay to allow browser to recover from context loss
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        renderer = createWebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(new THREE.Color(0xccddee));
        document.getElementById('container').appendChild(renderer.domElement);
        
        // Add context loss handling
        renderer.domElement.addEventListener('webglcontextlost', handleWebGLContextLoss, false);
        
        labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.domElement.className = 'label-renderer';
        document.getElementById('container').appendChild(labelRenderer.domElement);
        
    } catch (error) {
        console.error('[MAIN] Failed to create WebGL renderer:', error);
        const errorMessage = 'Failed to initialize 3D graphics. This might be due to browser restrictions or hardware limitations. Please try refreshing the page or using a different browser.';
        console.error('[MAIN]', errorMessage);
        
        // Show user-friendly error message with more options
        const container = document.getElementById('container');
        if (container) {
            container.innerHTML = `
                <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            background: white; padding: 30px; border: 2px solid #333; border-radius: 8px; 
                            text-align: center; z-index: 9999; max-width: 500px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                    <h3 style="color: #dc3545; margin-bottom: 15px;">Graphics Error</h3>
                    <p style="margin-bottom: 20px; line-height: 1.5;">${errorMessage}</p>
                    <div style="margin-bottom: 15px;">
                        <p style="font-size: 14px; color: #666;">Try these solutions:</p>
                        <ul style="text-align: left; font-size: 14px; color: #666;">
                            <li>Refresh the page (F5)</li>
                            <li>Try a different browser (Chrome, Firefox, Edge)</li>
                            <li>Check if hardware acceleration is enabled</li>
                            <li>Update your graphics drivers</li>
                            <li>Try running as administrator</li>
                            <li>Disable antivirus temporarily</li>
                        </ul>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <p style="font-size: 14px; color: #666;">Technical details:</p>
                        <p style="font-size: 12px; color: #999; font-family: monospace;">${error.message}</p>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="location.reload()" style="padding: 12px 24px; margin: 5px; 
                                     background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            Refresh Page
                        </button>
                        <button onclick="location.reload(true)" style="padding: 12px 24px; margin: 5px; 
                                     background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            Hard Refresh
                        </button>
                        <button onclick="window.close()" style="padding: 12px 24px; margin: 5px; 
                                     background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                            Close Tab
                        </button>
                    </div>
                </div>
            `;
        }
        return;
    }
    
    // Dodaj sferu neba
    addSkySphere();

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    window.controls = controls;
    // Reset mouse buttons to default OrbitControls behavior
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,        // Levi klik: pan
        MIDDLE: THREE.MOUSE.DOLLY,    // Srednji klik: zoom
        RIGHT: THREE.MOUSE.ROTATE     // Desni klik: rotacija (orbit)
    };
    controls.enableRotate = true;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    // Ukloni/ignoriši dupli klik za promenu moda
    // window.addEventListener('dblclick', ...); // možeš obrisati ili zakomentarisati
    let isRightMouseDown = false;
    renderer.domElement.addEventListener('pointerdown', (event) => {if (event.button === 2) { isRightMouseDown = true;}});
    renderer.domElement.addEventListener('pointerup', () => {isRightMouseDown = false;});
    // Ukloni custom rotaciju kamere na pointermove
    // renderer.domElement.addEventListener('pointermove', (event) => {
    //     if (isRightMouseDown) {
    //         const delta = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    //         const zAxis = new THREE.Vector3(0, 0, 1); 
    //         camera.rotateOnWorldAxis(zAxis, -delta * 0.005);
    //     }
    // });
    let orbitMode = false;
    // window.addEventListener('dblclick', () => { // možeš obrisati ili zakomentarisati
    // orbitMode = !orbitMode;
    // controls.mouseButtons.LEFT = orbitMode ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    // });
    
    updateLoadingProgress(2, 'Loading textures...');
    // Učitaj teksture
    loadTextures();

    // Postavi controls.target na centar podloge
    const centerX = 691000; // prilagodi prema tvojoj podlozi
    const centerY = 5336000;
    controls.target.set(centerX, centerY, 0);
    controls.update();

    // LIGHT
    const ambient = new THREE.AmbientLight(0xffffff, 1.0); // pojačano
    const spotlight = new THREE.DirectionalLight(0xffffff, 1);
    const skyLight = new THREE.DirectionalLight(0xbfdfff, 0.7); // svetlo plavo svetlo
    skyLight.position.set(0, 0, 1000);

    scene.add(ambient);
    scene.add(skyLight);
    spotlight.position.set(0, 0, 5);
    scene.add(spotlight);

    updateLoadingProgress(3, 'Loading 3D models...');
    // Ponovo omogućavam učitavanje GLTF modela
    // console.log('[MAIN] About to call loadFacultyModels...');
    await loadFacultyModels(scene, camera, controls, renderer);
    // console.log('[MAIN] loadFacultyModels completed');

    let occupancyRateElement = document.getElementById('occupancyRate');
    let toggleTrackingButton = document.getElementById('toggleTracking');
    let vehicleButtonsContainer = document.getElementById('vehicleButtons');
    let currentVehicleId = null;
    const parkingAreas = [];
    const parkinglots = [];

    //PCD
    const TM = new THREE.Matrix4();
    let pointCloudPaths = [];
    let boundingBoxPaths = [];
    let boundingBoxType = '';
    let simulateTraffic = false;

    updateLoadingProgress(4, 'Loading configuration...');
    // Učitavanje konfiguracije iz modula
    const config = await loadConfig();
    TM.copy(config.TM);
    pointCloudPaths = config.pointCloudPaths;
    boundingBoxPaths = config.boundingBoxPaths;
    boundingBoxType = config.boundingBoxType;
    simulateTraffic = config.simulateTraffic;
    
    // Kreiram PCD loader instancu nakon što su sve varijable definisane
    const { pcdload, loadStaticPCD, pcdExistArray, previousLidarPosition, currentLidarPosition, updatePointSize } = createPCDLoader(boundingBoxType);

    // Učitaj statični PCD fajl (allpointsinutm.pcd) - ZAKOMENTARISANO
    // const staticPCDPath = './PointCloudDatasets/allpointsinutm.pcd';
    // loadStaticPCD(staticPCDPath, scene, TM, config.pointSize);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);  
    scene.add(ambientLight);

    //json
    const jsonscene = new THREE.Group();
    const freescene = new THREE.Group();
    scene.add(jsonscene);
    scene.add(freescene);
    window.freescene = freescene;

    updateLoadingProgress(5, 'Loading parking data...');
    // Initialize parking after config is loaded so we can pass the transformation matrix
    const parkingUIDMap = {};
    const parkingStatusMap = {};
    await initializepark(scene, parkingAreas, parkinglots, parkingUIDMap, parkingStatusMap, TM, freescene);

    // Initialize parking system after scene is globally accessible
    parkingSystem.initializeParkingSpots(parkingAreas, parkinglots, freescene);
    
    // Dodaj zoom-in na klik na bounding box
    setTimeout(() => {
        if (window.parkingSystem && window.parkingSystem.parkingSpots) {
            window.parkingSystem.parkingSpots.forEach(spot => {
                if (spot.visualBox) {
                    spot.visualBox.cursor = 'pointer';
                    spot.visualBox.userData.isParkingBox = true;
                    spot.visualBox.callback = function () {
                        // Smooth zoom-in to Z=20 above center
                        const target = { x: spot.visualBox.position.x, y: spot.visualBox.position.y, z: 20 };
                        if (window.camera) {
                            // Simple smooth animation
                            const duration = 600;
                            const start = { x: window.camera.position.x, y: window.camera.position.y, z: window.camera.position.z };
                            const startTime = performance.now();
                            function animateZoom(now) {
                                const t = Math.min(1, (now - startTime) / duration);
                                window.camera.position.x = start.x + (target.x - start.x) * t;
                                window.camera.position.y = start.y + (target.y - start.y) * t;
                                window.camera.position.z = Math.max(0.5, start.z + (target.z - start.z) * t);
                                window.camera.lookAt(target.x, target.y, 0);
                                if (window.controls) {
                                    window.controls.target.set(target.x, target.y, 0);
                                    window.controls.update();
                                }
                                if (t < 1) requestAnimationFrame(animateZoom);
                            }
                            animateZoom(performance.now());
                        }
                    };
                }
            });
        }
    }, 1000);

    // Raycaster za klikove na bounding boxeve
    if (!window.boundingBoxRaycastSetup) {
        window.boundingBoxRaycastSetup = true;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        renderer.domElement.addEventListener('click', function(event) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            let intersects = raycaster.intersectObjects(freescene.children, true);
            for (let i = 0; i < intersects.length; i++) {
                const obj = intersects[i].object;
                if (obj.userData.isParkingBox && typeof obj.callback === 'function') {
                    obj.callback();
                    break;
                }
            }
        }, false);
    }
    
    // Initial occupancy rate update after parking system is initialized
    const initialStatusMap = parkingSystem.getParkingStatusMap();
    const initialFreeCount = Object.values(initialStatusMap).filter(s => s.status === 'free').length;
    const initialTotalCount = Object.keys(initialStatusMap).length;
    if (occupancyRateElement) {
        occupancyRateElement.innerText = `${initialFreeCount}/${initialTotalCount}`;
    }

    let initialPositions = {};
    const carlength = 3;
    const covarianceThreshold = 0.1;
    const covariancemaxThreshold = 0.9;
    const dataCache = new Map();

    // VEHICLE renderer
    const vehicles = {};
    let paths = {};
    let pathsSpeeds = {};

    const tumURL = '1080/custom_loop.rou.xml';
    const osmURL = '1080/osm.net.xml';

    // Funkcije za simulaciju saobraćaja
    let carFilters = {};
    let edgeCoordinates = {};
    let vehicleRoutes = {};
    let vehicleDepartTimes = {};
    let vehicleSpeeds = {};

    // Additional variables needed for processing
    let updateOccupancyRate = null;
    let kfframerot = [];

    if (simulateTraffic === true) { 
        updateLoadingProgress(6, 'Loading traffic data...');
        
        // Load custom route from ruta0.csv for veh0
        const customRoute = await createRouteFromCSV('./assets/ruta0.csv');
        
        if (customRoute) {
            // Create veh0 with custom route
            const geometry = new THREE.BoxGeometry(3, 1.5, 2);  
            const material = new THREE.MeshBasicMaterial({ color: 0x00008e });
            const cube = new THREE.Mesh(geometry, material);

            vehicles['veh0'] = {
                id: 'veh0',
                model: cube,
                path: customRoute.path,
                speeds: customRoute.speeds,
                departTime: 0, // Start immediately
                speed: 10, // Default speed
                progress: 0,
                addedToScene: false,  
                completed: false,  
                type: 'simulation'
            };
            
            // console.log('[MAIN] Created veh0 with custom route from ruta0.csv');
        } else {
            console.warn('[MAIN] Failed to load custom route from ruta0.csv');
        }
        
        // Load other vehicles from XML if needed
        const trafficData = await fetchvehXMLFile(tumURL);
        vehicleRoutes = trafficData.vehicleRoutes;
        vehicleDepartTimes = trafficData.vehicleDepartTimes;
        vehicleSpeeds = trafficData.vehicleSpeeds;
        edgeCoordinates = await fetchrouXMLFile(osmURL);
    }

    if (simulateTraffic === true && Object.keys(vehicleRoutes).length > 0) {
        const routeResult = renderRoutes(vehicleRoutes, edgeCoordinates);
        paths = routeResult.paths;
        pathsSpeeds = routeResult.pathsSpeeds;
        
        // Create other vehicles (skip veh0 as it's already created with custom route)
        Object.keys(vehicleRoutes).forEach(vehicleId => {
            if (vehicleId !== 'veh0' && paths[vehicleId]) { // Skip veh0 as it uses custom route
                const geometry = new THREE.BoxGeometry(3, 1.5, 2);  
                const material = new THREE.MeshBasicMaterial({ color: 0x00008e });
                const cube = new THREE.Mesh(geometry, material);

                vehicles[vehicleId] = {
                    id: vehicleId,
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
            } else if (vehicleId !== 'veh0') {
                console.warn(`Path not found for vehicle ${vehicleId}`);
            }
        });
    }

    //Visualise
    const revealedGroup = new THREE.Group();
    scene.add(revealedGroup);
    let processedSingleFrame = false;
    let simulationStartTime = performance.now();
    let frame = 1;
    let lastFrameTime = 0;
    let frameInterval = 150;
    let kfframe = []
    let kfframescale = []

    // Kreiraj globalne reference objekte
    const processedSingleFrameRef = { current: false };
    const frameRef = { current: 1 };

    // Kreiraj reference objekte za zoom
    const zoomAnimationIdRef = { current: zoomAnimationId };
    const zoomStartTimeRef = { current: zoomStartTime };

    // Kreiraj reference objekte za UI
    const currentVehicleIdRef = { current: currentVehicleId };
    let trackingMode = 'global';
    
    // Make trackingMode globally accessible for UI controls
    window.trackingMode = trackingMode;
    window.setTrackingMode = (mode) => { trackingMode = mode; };

    // Definiši varijable pre animate funkcije
    const processedUIDs = new Set();
    const objectCooldowns = new Map();
    const allDetectedUIDs = new Set();

    // --- Pointcloud UI State ---
    let pointcloudStates = pointCloudPaths.map((group, i) => ({
        visible: true,
        paused: true,
        label: `MLS_${i}`
    }));
    let globalPointcloudPaused = false;
    window.pointcloudStates = pointcloudStates;

    // --- Pointcloud UI Setup ---
    function setupPointcloudControls() {
        const btnContainer = document.getElementById('pointcloudButtons');
        const pauseBtn = document.getElementById('pausePointclouds');
        if (!btnContainer || !pauseBtn) return;
        btnContainer.innerHTML = '';
        // Arrange buttons in rows of 2
        for (let row = 0; row < pointCloudPaths.length; row += 2) {
            const rowDiv = document.createElement('div');
            rowDiv.style.display = 'flex';
            rowDiv.style.gap = '4px';
            rowDiv.style.marginBottom = '2px';
            for (let i = row; i < row + 2 && i < pointCloudPaths.length; i++) {
                const btn = document.createElement('button');
                btn.className = 'pointcloud-toggle' + (pointcloudStates[i].visible ? ' active' : '');
                btn.textContent = pointcloudStates[i].label;
                btn.onclick = () => {
                    pointcloudStates[i].visible = !pointcloudStates[i].visible;
                    btn.classList.toggle('active', pointcloudStates[i].visible);
                };
                rowDiv.appendChild(btn);

                // Add pause/resume button for each pointcloud
                const pauseBtnSingle = document.createElement('button');
                pauseBtnSingle.className = 'pointcloud-pause-toggle';
                pauseBtnSingle.textContent = pointcloudStates[i].paused ? 'Resume' : 'Pause';
                pauseBtnSingle.onclick = () => {
                    pointcloudStates[i].paused = !pointcloudStates[i].paused;
                    pauseBtnSingle.textContent = pointcloudStates[i].paused ? 'Resume' : 'Pause';
                    // If any pointcloud is unpaused, globalPointcloudPaused should be false
                    if (!pointcloudStates[i].paused) {
                        globalPointcloudPaused = false;
                        updatePauseBtn();
                    } else if (pointcloudStates.every(state => state.paused)) {
                        // If all are paused, set globalPointcloudPaused true
                        globalPointcloudPaused = true;
                        updatePauseBtn();
                    }
                };
                rowDiv.appendChild(pauseBtnSingle);
            }
            btnContainer.appendChild(rowDiv);
        }
        function updatePauseBtn() {
            // Initial state: all paused, so show Resume
            pauseBtn.textContent = globalPointcloudPaused ? 'Resume Pointclouds' : 'Pause Pointclouds';
            pauseBtn.classList.toggle('active', globalPointcloudPaused);
        }
        // Set initial state to paused (so button shows Resume)
        globalPointcloudPaused = true;
        updatePauseBtn();
        pauseBtn.onclick = () => {
            globalPointcloudPaused = !globalPointcloudPaused;
            // Set all pointclouds to paused/resumed
            pointcloudStates.forEach(state => {
                state.paused = globalPointcloudPaused;
            });
            updatePauseBtn();
        };
    }

    function animate(timestamp) {
        // Check if renderer is available
        if (!renderer || !labelRenderer) {
            console.warn('[ANIMATE] Renderer not available, skipping frame');
            requestAnimationFrame(animate);
            return;
        }
        
        // Start performance monitoring
        performanceMonitor.startRender();
        
        if (!lastFrameTime) lastFrameTime = timestamp;
        const elapsed = timestamp - lastFrameTime;

        if (elapsed >= frameInterval) {
            // Update window.vehicles reference
            updateWindowVehicles();
            
            // Update global tracking mode
            window.trackingMode = trackingMode;
            
            // Update performance metrics
            performanceMonitor.setPointcloudCount(
                (window.pcdExistArray || []).filter((pcd, i) =>
                    pcd !== null && pcd !== undefined && window.pointcloudStates && window.pointcloudStates[i] && window.pointcloudStates[i].visible
                ).length
            );
            
            // Check if parking system is initialized
            if (parkingSystem && parkingSystem.parkingSpots && parkingSystem.parkingSpots.size > 0) {
                // Update parking system with current vehicles
                parkingSystem.updateVehicles(vehicles);
                
                // Update parking system
                parkingSystem.update();
                
                // Update occupancy rate display
                const statusMap = parkingSystem.getParkingStatusMap();
                const freeCount = Object.values(statusMap).filter(s => s.status === 'free').length;
                const totalCount = Object.keys(statusMap).length;
                
                if (occupancyRateElement) {
                    occupancyRateElement.innerText = `${freeCount}/${totalCount}`;
                }
                
                // Update status description
                if (parkingSystem && typeof parkingSystem.updateStatusDescription === 'function') {
                    parkingSystem.updateStatusDescription();
                }
            }

            // Debug: log vehicle positions before processing
            if (Object.keys(vehicles).length > 0) {
                // Vehicle positions logged for debugging
            }

            // Only process pointclouds that are visible and not paused
            const filteredPointCloudPaths = pointCloudPaths.map((group, i) =>
                (pointcloudStates[i].visible && !pointcloudStates[i].paused && !globalPointcloudPaused) ? group : null
            ).filter(Boolean);
            processPointClouds(filteredPointCloudPaths, pcdload, scene, TM, simulateTraffic, revealRectangles, vehicles, parkingAreas, kfframe, kfframescale, carlength, freescene, parkingStatusMap, revealedGroup, processedUIDs, objectCooldowns, allDetectedUIDs, occupancyRateElement, updateOccupancyRate, config.pointSize);
            processBoundingBoxes(boundingBoxPaths, boundingBoxType, processedSingleFrameRef, frameRef, processCsvData, processJsonData, TM, scene, vehicles, carFilters, revealRectangles, parkingAreas, kfframe, kfframerot, kfframescale, carlength, freescene, parkingStatusMap, initialPositions, parkingUIDMap, jsonscene);

            // Debug: log number of vehicles after point cloud processing
            // console.log(`[MAIN] After processPointClouds: vehicles = ${Object.keys(vehicles).length}`);
            
            // Debug: log vehicle positions after processing
            if (Object.keys(vehicles).length > 0) {
                // Vehicle positions after processing
            }

            // Update vehicle animations
            const currentTime = (performance.now() - simulationStartTime) / 1000;
            const sceneParams = {
                freescene,
                revealedGroup,
                processedUIDs,
                objectCooldowns,
                allDetectedUIDs,
                parkingStatusMap,
                occupancyRateElement,
                updateOccupancyRate
            };
            updateVehicleAnimation(vehicles, currentTime, simulationStartTime, scene, revealRectangles, sceneParams);

            // Update camera tracking
            updateCameraTracking(window.trackingMode || 'global', currentVehicleIdRef.current, vehicles, camera, controls);

            // Update labels visibility based on camera height
            if (typeof updateLabels === 'function') {
                updateLabels(camera, labelRenderer);
            } else {
                console.warn('[MAIN] updateLabels function not available');
            }
            
            // Update revealed objects
            updateRevealedObjects(revealedGroup, camera, TM);
            
            // Update parking system
            if (parkingSystem) {
                parkingSystem.update();
            }

            // Sync pointcloud visibility with UI state
            pointcloudStates.forEach((state, i) => {
                if (pcdExistArray[i]) {
                    pcdExistArray[i].visible = state.visible;
                }
            });

            lastFrameTime = timestamp;
            frameRef.current++;
        }

        // Render the scene
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
        
        // End performance monitoring and update
        performanceMonitor.endRender();
        performanceMonitor.update(renderer);

        // Update bottom status bar
        // document.getElementById('fpsValue').textContent = performanceMonitor.getFPS ? performanceMonitor.getFPS() : '60';
        // document.getElementById('renderTimeValue').textContent = performanceMonitor.getRenderTime ? performanceMonitor.getRenderTime() + 'ms' : '16ms';
        // document.getElementById('pointcloudCountValue').textContent = performanceMonitor.getPointcloudCount ? performanceMonitor.getPointcloudCount() : '0';
        // Uklonjeno ažuriranje za geometryCountValue, textureCountValue i triangleCountValue
        if (camera && camera.position) {
            document.getElementById('cameraCoordinates').textContent = `X: ${camera.position.x.toFixed(1)}, Y: ${camera.position.y.toFixed(1)}, Z: ${camera.position.z.toFixed(1)}`;
        }

        // Prikaz visine kamere na ekranu
        const cameraHeightDisplay = document.getElementById('cameraHeightDisplay');
        if (cameraHeightDisplay && camera && camera.position) {
            cameraHeightDisplay.textContent = `Viewer Height ${camera.position.z.toFixed(1)} m`;
        }

        requestAnimationFrame(animate);
    }

    // Start animation loop
    animate();

    // Setup UI event listeners
    // console.log('[MAIN] Setting up UI event listeners...');
    
    // Ensure DOM is loaded before setting up UI
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupUIAfterDOMLoad();
            // Parking table toggle
            const toggleBtn = document.getElementById('toggleParkingTable');
            const tableContent = document.getElementById('parkingTableContent');
            if (toggleBtn && tableContent) {
                toggleBtn.addEventListener('click', () => {
                    tableContent.style.display = (tableContent.style.display === 'none' || tableContent.style.display === '') ? 'block' : 'none';
                });
            }
            // Simulation controls toggle
            const simToggleBtn = document.getElementById('toggleSimulationControls');
            const simContent = document.getElementById('simulationControlsContent');
            if (simToggleBtn && simContent) {
                simToggleBtn.addEventListener('click', () => {
                    simContent.style.display = (simContent.style.display === 'none' || simContent.style.display === '') ? 'block' : 'none';
                });
            }
                    setupPointcloudControls();
        setupNavigationPanel();
        });
    } else {
        setupUIAfterDOMLoad();
        // Parking table toggle
        const toggleBtn = document.getElementById('toggleParkingTable');
        const tableContent = document.getElementById('parkingTableContent');
        if (toggleBtn && tableContent) {
            toggleBtn.addEventListener('click', () => {
                tableContent.style.display = (tableContent.style.display === 'none' || tableContent.style.display === '') ? 'block' : 'none';
            });
        }
        // Simulation controls toggle
        const simToggleBtn = document.getElementById('toggleSimulationControls');
        const simContent = document.getElementById('simulationControlsContent');
        if (simToggleBtn && simContent) {
            simToggleBtn.addEventListener('click', () => {
                simContent.style.display = (simContent.style.display === 'none' || simContent.style.display === '') ? 'block' : 'none';
            });
        }
        setupPointcloudControls();
        setupNavigationPanel();
    }
    
    function setupUIAfterDOMLoad() {
        const toggleTrackingButton = document.getElementById('toggleTracking');
        // console.log('[MAIN] Toggle tracking button element:', !!toggleTrackingButton);
        // console.log('[MAIN] Vehicle buttons container:', !!vehicleButtonsContainer);
        // console.log('[MAIN] Occupancy rate element:', !!occupancyRateElement);
        
        if (toggleTrackingButton) {
           // console.log('[MAIN] Setting up UI event listeners...');
            setupUIEventListeners(occupancyRateElement, toggleTrackingButton, vehicleButtonsContainer, currentVehicleIdRef, vehicles, parkingSystem);
        } else {
            console.error('[MAIN] Toggle tracking button not found in DOM!');
        }
        
        // Setup speed control
        setupSpeedControl();
        
        // Setup point size control
        setupPointSizeControl();
        
        // Toggle legend button - show/hide legend content
        const toggleLegendBtn = document.getElementById('toggleLegend');
        const legendContent = document.getElementById('legendContent');
        if (toggleLegendBtn && legendContent) {
            toggleLegendBtn.addEventListener('click', () => {
                legendContent.style.display = (legendContent.style.display === 'none' || legendContent.style.display === '') ? 'block' : 'none';
            });
        }
    }

    // Make vehicles globally accessible
    window.vehicles = vehicles;
    window.parkingSystem = parkingSystem;
    window.scene = scene;
    window.freescene = freescene;
    window.pcdExistArray = pcdExistArray;
    window.updatePointSize = updatePointSize;
    
    // Final loading step and hide loading screen
    updateLoadingProgress(7, 'Starting simulation...');
    setTimeout(() => {
        updateLoadingProgress(8, 'Done!');
        setTimeout(hideLoadingScreen, 500);
    }, 1000);
    
    // Update window.vehicles reference in animate function
    function updateWindowVehicles() {
        window.vehicles = vehicles;
    }

    // Funkcija za učitavanje svih fasada PCD fajlova
    // function loadFasadaPCDs() {
    //     const fasadaDir = 'PointCloudDatasets/fasadapcd';
    //     const pcdFiles = [
    //         'Station-002-SW-002.pcd', 'Station-003-SW-003.pcd', 'Station-004-SW-004.pcd',
    //         'Station-005-SW-005.pcd', 'Station-006-SW-006.pcd', 'Station-007-SW-007.pcd',
    //         'Station-008-SW-008.pcd', 'Station-009-SW-009.pcd', 'Station-010-SW-010.pcd',
    //         'Station-011-SW-011.pcd', 'Station-012-SW-012.pcd', 'Station-013-SW-013.pcd',
    //         'Station-014-SW-014.pcd', 'Station-015-SW-015.pcd', 'Station-016-SW-016.pcd',
    //         'Station-017-SW-017.pcd', 'Station-018-SW-018.pcd', 'Station-019-SW-019.pcd',
    //         'Station-020-SW-020.pcd', 'Station-021-SW-021.pcd', 'Station-022-SW-022.pcd',
    //         'Station-023-SW-023.pcd', 'Station-024-SW-024.pcd', 'Station-025-SW-025.pcd',
    //         'Station-026-SW-026.pcd', 'Station-027-SW-027.pcd', 'Station-028-SW-028.pcd',
    //         'Station-029-SW-029.pcd'
    //     ];
    //     const loader = new PCDLoader();
    //     pcdFiles.forEach(filename => {
    //         const path = `${fasadaDir}/${filename}`;
    //         loader.load(path, function(points) {
    //             points.name = filename;
    //             points.position.z = -30; // Postavi sve fasade na visinu -30m
    //             scene.add(points);
    //         }, undefined, function(err) {
    //         });
    //     });
    // }

    // Pozovi učitavanje fasada odmah nakon inicijalizacije scene
    // loadFasadaPCDs();
}

// Handle window resize
window.addEventListener('resize', () => {
    if (camera && renderer && labelRenderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Navigation panel logic
function setupNavigationPanel() {
  const openBtn = document.getElementById('openNavigationPanel');
  const panel = document.getElementById('navigationPanel');
  const carSpeedSpan = document.getElementById('navCarSpeed');
  const parkingInput = document.getElementById('navParkingInput');
  const calcRow = document.getElementById('navCalcRow');
  const statusSpan = document.getElementById('navStatus');

  if (!openBtn || !panel) return;

  // Global variable to store route points
  let routePoints = [];

  // Load route points from ruta0.csv
  async function loadRoutePoints() {
    try {
      const response = await fetch('./assets/ruta0.csv');
      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());
      
      routePoints = [];
      
      // Skip header line and process coordinates
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = line.split(',');
          if (values.length >= 3) {
            // Remove quotes and parse coordinates
            const x = parseFloat(values[1].replace(/"/g, ''));
            const y = parseFloat(values[2].replace(/"/g, ''));
            
            if (!isNaN(x) && !isNaN(y)) {
              routePoints.push({ x, y });
            }
          }
        }
      }
      
              // console.log(`[NAVIGATION] Loaded ${routePoints.length} route points`);
    } catch (error) {
      console.error('[NAVIGATION] Error loading route points:', error);
    }
  }

  // Calculate distance along route from current position to target
  function calculateRouteDistance(currentPos, targetPos) {
    if (routePoints.length === 0) {
      // Fallback to straight-line distance if route not loaded
      const dx = currentPos.x - targetPos.x;
      const dy = currentPos.y - targetPos.y;
      return Math.sqrt(dx*dx + dy*dy);
    }

    let totalDistance = 0;
    let foundCurrentSegment = false;
    let currentSegmentDistance = 0;

    // Find current position in route and calculate remaining distance
    for (let i = 0; i < routePoints.length - 1; i++) {
      const start = routePoints[i];
      const end = routePoints[i + 1];
      
      // Calculate distance to start and end of this segment
      const distToStart = Math.sqrt(
        Math.pow(currentPos.x - start.x, 2) + 
        Math.pow(currentPos.y - start.y, 2)
      );
      const distToEnd = Math.sqrt(
        Math.pow(currentPos.x - end.x, 2) + 
        Math.pow(currentPos.y - end.y, 2)
      );
      
      // Check if current position is closest to this segment
      const segmentLength = Math.sqrt(
        Math.pow(end.x - start.x, 2) + 
        Math.pow(end.y - start.y, 2)
      );
      
      // If current position is within this segment or closest to it
      if (distToStart <= segmentLength && distToEnd <= segmentLength) {
        foundCurrentSegment = true;
        // Calculate distance from current position to end of this segment
        currentSegmentDistance = distToEnd;
        totalDistance += currentSegmentDistance;
        
        // Add remaining segments
        for (let j = i + 1; j < routePoints.length - 1; j++) {
          const nextStart = routePoints[j];
          const nextEnd = routePoints[j + 1];
          const segmentDist = Math.sqrt(
            Math.pow(nextEnd.x - nextStart.x, 2) + 
            Math.pow(nextEnd.y - nextStart.y, 2)
          );
          totalDistance += segmentDist;
        }
        break;
      }
    }
    
    // If not found in route, use straight-line distance
    if (!foundCurrentSegment) {
      const dx = currentPos.x - targetPos.x;
      const dy = currentPos.y - targetPos.y;
      return Math.sqrt(dx*dx + dy*dy);
    }
    
    return totalDistance;
  }

  function getCarSpeedKmh() {
    // Assume 'veh0' is the SUMO car
    const car = vehicles['veh0'];
    if (!car) return 0;
    // Use the same speed as in the UI (current multiplier * base speed)
    const baseSpeedMs = 5.0;
    const slider = document.getElementById('vehicleSpeed');
    const multiplier = slider ? parseFloat(slider.value) : 2.0;
    return (baseSpeedMs * multiplier * 3.6).toFixed(1);
  }

  function getCarSpeedMs() {
    // Get actual car speed in m/s
    const car = vehicles['veh0'];
    if (!car) return 0;
    const baseSpeedMs = 5.0;
    const slider = document.getElementById('vehicleSpeed');
    const multiplier = slider ? parseFloat(slider.value) : 2.0;
    return baseSpeedMs * multiplier;
  }

  function getCarPosition() {
    const car = vehicles['veh0'];
    if (car && car.model && car.model.position) {
      return car.model.position;
    }
    return null;
  }

  function getParkingSpotCenter(uid) {
    if (window.parkingSystem && window.parkingSystem.parkingSpots) {
      const spot = window.parkingSystem.parkingSpots.get(uid.toString());
      if (spot && spot.center) {
        return spot.center;
      }
    }
    return null;
  }

  // Calculate distance from current position to end of route
  function calculateDistanceToRouteEnd(currentPos) {
    if (routePoints.length === 0) {
      console.log('[DEBUG] No route points loaded');
      return 0;
    }

    console.log('[DEBUG] Current car position:', currentPos.x, currentPos.y);
    console.log('[DEBUG] Route points:', routePoints.length);

    let totalDistance = 0;
    let foundCurrentSegment = false;
    let currentSegmentIndex = -1;

    // Find which segment the car is currently in
    for (let i = 0; i < routePoints.length - 1; i++) {
      const start = routePoints[i];
      const end = routePoints[i + 1];
      
      // Calculate distance to start and end of this segment
      const distToStart = Math.sqrt(
        Math.pow(currentPos.x - start.x, 2) + 
        Math.pow(currentPos.y - start.y, 2)
      );
      const distToEnd = Math.sqrt(
        Math.pow(currentPos.x - end.x, 2) + 
        Math.pow(currentPos.y - end.y, 2)
      );
      
      // Check if current position is closest to this segment
      const segmentLength = Math.sqrt(
        Math.pow(end.x - start.x, 2) + 
        Math.pow(end.y - start.y, 2)
      );
      
      console.log(`[DEBUG] Segment ${i}: start(${start.x}, ${start.y}) -> end(${end.x}, ${end.y})`);
      console.log(`[DEBUG] Distance to start: ${distToStart.toFixed(2)}, to end: ${distToEnd.toFixed(2)}, segment length: ${segmentLength.toFixed(2)}`);
      
      // If current position is within this segment or closest to it
      if (distToStart <= segmentLength && distToEnd <= segmentLength) {
        foundCurrentSegment = true;
        currentSegmentIndex = i;
        console.log(`[DEBUG] Car is in segment ${i}`);
        
        // Calculate distance from current position to end of this segment
        totalDistance += distToEnd;
        console.log(`[DEBUG] Distance to end of current segment: ${distToEnd.toFixed(2)}`);
        
        // Add remaining segments
        for (let j = i + 1; j < routePoints.length - 1; j++) {
          const nextStart = routePoints[j];
          const nextEnd = routePoints[j + 1];
          const segmentDist = Math.sqrt(
            Math.pow(nextEnd.x - nextStart.x, 2) + 
            Math.pow(nextEnd.y - nextStart.y, 2)
          );
          totalDistance += segmentDist;
          console.log(`[DEBUG] Added segment ${j} distance: ${segmentDist.toFixed(2)}`);
        }
        break;
      }
    }
    
    if (!foundCurrentSegment) {
      console.log('[DEBUG] Car not found in any segment, using distance to last point');
      const lastPoint = routePoints[routePoints.length - 1];
      totalDistance = Math.sqrt(
        Math.pow(currentPos.x - lastPoint.x, 2) + 
        Math.pow(currentPos.y - lastPoint.y, 2)
      );
    }
    
    console.log(`[DEBUG] Total remaining distance: ${totalDistance.toFixed(2)} m`);
    return totalDistance;
  }

  // Check if car is at the end of route (parked)
  function isCarParked(currentPos) {
    if (routePoints.length === 0) return false;
    
    const lastPoint = routePoints[routePoints.length - 1];
    const distanceToEnd = Math.sqrt(
      Math.pow(currentPos.x - lastPoint.x, 2) + 
      Math.pow(currentPos.y - lastPoint.y, 2)
    );
    
    // Consider car parked if within 5 meters of the last route point
    return distanceToEnd < 5.0;
  }

  // Check if SUMO car is parked (completed route)
  function isSUMOCarParked() {
    const car = vehicles['veh0'];
    if (!car) return false;
    
    // Check if car has completed its route
    return car.completed === true;
  }

  // Calculate distance from current position to specific parking spot
  function calculateDistanceToParkingSpot(currentPos, parkingSpotNum) {
    if (routePoints.length === 0) {
      console.log('[DEBUG] No route points loaded');
      return 0;
    }

    // Get parking spot center
    const parkingSystem = window.parkingSystem;
    if (!parkingSystem || !parkingSystem.parkingSpots) {
      console.log('[DEBUG] Parking system not available');
      return 0;
    }

    const spot = parkingSystem.parkingSpots.get(parkingSpotNum.toString());
    if (!spot || !spot.center) {
      console.log('[DEBUG] Parking spot not found:', parkingSpotNum);
      return 0;
    }

    const targetPos = spot.center;
    console.log('[DEBUG] Current car position:', currentPos.x, currentPos.y);
    console.log('[DEBUG] Target parking spot:', parkingSpotNum, 'at position:', targetPos.x, targetPos.y);

    // Calculate straight-line distance to parking spot
    const dx = currentPos.x - targetPos.x;
    const dy = currentPos.y - targetPos.y;
    const distance = Math.sqrt(dx*dx + dy*dy);

    console.log(`[DEBUG] Distance to parking spot ${parkingSpotNum}: ${distance.toFixed(2)} m`);
    return distance;
  }

  function updateNavigationInfo() {
    // Update car speed
    const speedKmh = getCarSpeedKmh();
    const speedMs = getCarSpeedMs();
    carSpeedSpan.textContent = speedKmh + ' km/h';
    
    console.log(`[DEBUG] Car speed: ${speedKmh} km/h (${speedMs} m/s)`);
    
    // Get parking spot
    const spotNum = parseInt(parkingInput.value);
    console.log('[DEBUG] updateNavigationInfo called with spotNum:', spotNum, 'input value:', parkingInput.value);
    
    if (!spotNum || spotNum < 1 || spotNum > 236) {
      // Ako je unos prazan ili nevalidan, očisti target status SVIM mestima
      console.log('[DEBUG] Invalid input, clearing all target statuses');
      if (window.parkingSystem && window.parkingSystem.parkingSpots) {
        let clearedCount = 0;
        window.parkingSystem.parkingSpots.forEach((spot, uid) => {
          if (spot.status === 'target') {
            console.log('[DEBUG] Clearing target status for UID:', uid);
            spot.setManualStatus('free');
            clearedCount++;
          }
        });
        console.log('[DEBUG] Cleared target status from', clearedCount, 'spots');
        window.parkingSystem.updateParkingTable();
      }
      calcRow.textContent = 'Enter a valid parking spot (1-236)';
      statusSpan.textContent = '';
      window.selectedParkingSpot = null;
      return;
    }
    window.selectedParkingSpot = spotNum;
    
    // Set parking spot as target status
    const parkingSystem = window.parkingSystem;
    if (parkingSystem && parkingSystem.parkingSpots) {
      console.log('[DEBUG] Setting target for spotNum:', spotNum, 'UID:', spotNum.toString());
      
      // Prvo očisti target status SVIM mestima
      let clearedCount = 0;
      parkingSystem.parkingSpots.forEach((spot, uid) => {
        if (spot.status === 'target') {
          console.log('[DEBUG] Clearing target status for UID:', uid);
          spot.setManualStatus('free');
          clearedCount++;
        }
      });
      console.log('[DEBUG] Cleared target status from', clearedCount, 'spots');
      
      // Zatim postavi target samo na tačno izabrani UID
      const targetUid = spotNum.toString();
      const spot = parkingSystem.parkingSpots.get(targetUid);
      console.log('[DEBUG] Found spot:', !!spot, 'UID:', targetUid, 'Current status:', spot?.status);
      
      if (spot && spot.status === 'free') {
        spot.setManualStatus('target');
        console.log('[DEBUG] Set target status for UID:', targetUid);
      } else {
        console.log('[DEBUG] Could not set target status - spot not found or not free');
      }
      
      // Debug: Check all parking spots with target status after setting
      console.log('[DEBUG] All parking spots with target status after setting:');
      let targetCount = 0;
      parkingSystem.parkingSpots.forEach((spot, uid) => {
        if (spot.status === 'target') {
          console.log('[DEBUG] - UID:', uid, 'Status:', spot.status);
          targetCount++;
        }
      });
      console.log('[DEBUG] Total spots with target status:', targetCount);
      
      parkingSystem.updateParkingTable();
    }
    
    // Get car position
    const carPos = getCarPosition();
    if (!carPos) {
      calcRow.textContent = 'Calculating...';
      statusSpan.textContent = '';
      return;
    }
    
    // Check if SUMO car is parked (completed route)
    if (isSUMOCarParked()) {
      console.log('[DEBUG] SUMO car is parked (completed route)');
      calcRow.textContent = 'Vehicle parked at destination';
      statusSpan.textContent = 'Parked';
      return;
    }
    
    // Check if car is parked (at end of route)
    if (isCarParked(carPos)) {
      console.log('[DEBUG] Car is parked at destination');
      calcRow.textContent = 'Vehicle parked at destination';
      statusSpan.textContent = 'Parked';
      return;
    }
    
    // Calculate distance to specific parking spot (not to end of route)
    const dist = calculateDistanceToParkingSpot(carPos, spotNum);
    
    // Use actual car speed in m/s for time calculation
    const estTime = speedMs > 0 ? (dist / speedMs) : 0;
    
    console.log(`[DEBUG] Distance to parking spot ${spotNum}: ${dist.toFixed(2)} m, Speed: ${speedMs} m/s, Time: ${estTime.toFixed(2)} s`);
    console.log(`[DEBUG] Formula: ${dist.toFixed(2)} / ${speedMs} = ${estTime.toFixed(2)} s`);
    
    // Show info
    calcRow.textContent = `Distance to parking ${spotNum}: ${dist.toFixed(1)} m, time: ${estTime.toFixed(1)} s`;
    // Status
    if (dist < 2.0) {
      statusSpan.textContent = 'At parking spot';
    } else {
      statusSpan.textContent = 'en Route';
    }
  }

  // Load route points when navigation panel is initialized
  loadRoutePoints();

  openBtn.onclick = () => {
    if (panel.classList.contains('hidden')) {
      panel.classList.remove('hidden');
      updateNavigationInfo();
    } else {
      panel.classList.add('hidden');
    }
  };
  parkingInput.oninput = updateNavigationInfo;
  // Update info if speed slider changes
  const slider = document.getElementById('vehicleSpeed');
  if (slider) slider.addEventListener('input', updateNavigationInfo);
  // Optionally, update every second for live tracking
  setInterval(() => {
    if (!panel.classList.contains('hidden')) updateNavigationInfo();
  }, 1000);
}

// Legend panel show/hide logic (like navigation)
const openLegendBtn = document.getElementById('openLegendPanel');
const legendPanel = document.getElementById('legendPanel');
if (openLegendBtn && legendPanel) {
  openLegendBtn.onclick = () => {
    legendPanel.classList.toggle('hidden');
    
    // Dinamički pozicioniraj panel ispod dugmeta
    if (!legendPanel.classList.contains('hidden')) {
      const btnRect = openLegendBtn.getBoundingClientRect();
      legendPanel.style.top = (btnRect.bottom + 10) + 'px';
      legendPanel.style.left =( btnRect.left - 10) + 'px';
    }
  };
}

// Simulation panel show/hide logic (like navigation)
const openSimulationBtn = document.getElementById('openSimulationPanel');
const simulationPanel = document.getElementById('simulationPanel');
if (openSimulationBtn && simulationPanel) {
  openSimulationBtn.onclick = () => {
    simulationPanel.classList.toggle('hidden');
    
    // Dinamički pozicioniraj panel iznad dugmeta
    if (!simulationPanel.classList.contains('hidden')) {
      const btnRect = openSimulationBtn.getBoundingClientRect();
      simulationPanel.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
      simulationPanel.style.left = (btnRect.left-60) + 'px'; // Pomeri još više ulevo
    }
  };
}

// Initialize the application
init();
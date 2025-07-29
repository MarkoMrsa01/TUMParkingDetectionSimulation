import * as THREE from 'three';

export async function loadRouteFromCSV(csvPath) {
    try {
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());
        
        const routePoints = [];
        
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
                        routePoints.push(new THREE.Vector3(x, y, -24)); // Z = -24 for ground level
                    }
                }
            }
        }
        
        // console.log(`[ROUTE] Loaded ${routePoints.length} route points from ${csvPath}`);
        return routePoints;
    } catch (error) {
        console.error(`[ROUTE] Error loading route from ${csvPath}:`, error);
        return [];
    }
}

export async function createRouteFromCSV(csvPath) {
    const routePoints = await loadRouteFromCSV(csvPath);
    
    if (routePoints.length > 0) {
        // Create line segments between consecutive points for straight-line movement
        const lineSegments = [];
        const speeds = [];
        
        for (let i = 0; i < routePoints.length - 1; i++) {
            const startPoint = routePoints[i];
            const endPoint = routePoints[i + 1];
            
            // Create a line curve between two points
            const lineCurve = new THREE.LineCurve3(startPoint, endPoint);
            lineSegments.push(lineCurve);
            speeds.push(10); // 10 m/s default speed for each segment
        }
        
        // Create a compound curve from all line segments
        const compoundCurve = new THREE.CurvePath();
        lineSegments.forEach(segment => {
            compoundCurve.add(segment);
        });
        
        // console.log(`[ROUTE] Created ${lineSegments.length} straight line segments`);
        
        return {
            path: compoundCurve,
            speeds: speeds
        };
    }
    
    return null;
}

export async function fetchvehXMLFile(url) {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");
    
    const vehicleRoutes = {};
    const vehicleDepartTimes = {};
    const vehicleSpeeds = {};
    
    xmlDoc.querySelectorAll('vehicle').forEach(vehicle => {
        const vehicleId = vehicle.getAttribute('id');
        const departTime = parseFloat(vehicle.getAttribute('depart'));
        let departSpeed = vehicle.getAttribute('departSpeed');
        if (departSpeed === "max") {
            departSpeed = "max"; 
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
    return { vehicleRoutes, vehicleDepartTimes, vehicleSpeeds };
}

export async function fetchrouXMLFile(url) {
    const response = await fetch(url);
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "application/xml");
    const TFM = [
        [1, 0, 690747.906509577],
        [0, 1, 5335846.90492905],
        [0, 0, 1]
    ];
    
    const edgeCoordinates = {};
    
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

export function renderRoutes(vehicleRoutes, edgeCoordinates) {
    const paths = {};
    const pathsSpeeds = {};
    Object.entries(vehicleRoutes).forEach(([vehicleId, edges]) => {
        const points = [];
        const speeds = [];
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
                speeds.push(lane.speedLimit);
            } else {
                console.warn(`Edge ${edgeId} not found in edgeCoordinates`);
            }
        });
        if (points.length > 0) {
            const path = new THREE.CatmullRomCurve3(points);
            paths[vehicleId] = path;
            pathsSpeeds[vehicleId] = speeds;
        } else {
            console.warn(`No valid points found for vehicle ${vehicleId}`);
        }
    });
    return { paths, pathsSpeeds };
}

export function applyTransformation(matrix, point) {
    const [x, y] = point;
    const homogeneousPoint = [x, y, 1];

    const transformedX = matrix[0][0] * homogeneousPoint[0] + matrix[0][1] * homogeneousPoint[1] + matrix[0][2] * homogeneousPoint[2];
    const transformedY = matrix[1][0] * homogeneousPoint[0] + matrix[1][1] * homogeneousPoint[1] + matrix[1][2] * homogeneousPoint[2];

    return [transformedX, transformedY];
} 
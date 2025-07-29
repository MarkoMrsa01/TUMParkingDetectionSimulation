function rayIntersectsSegment(point, p1, p2, area) {
    const x = point.x;
    const y = point.y;
    
    // Check if point is on horizontal edge
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
            return true;
        }
    }
    return false;
}

export function inside(point, area) {
    let intersections = 0;
    
    // Check each edge of the area
    const edges = [
        [area.x1, area.y1, area.x2, area.y2],
        [area.x2, area.y2, area.x3, area.y3],
        [area.x3, area.y3, area.x4, area.y4],
        [area.x4, area.y4, area.x1, area.y1]
    ];
    
    for (const [x1, y1, x2, y2] of edges) {
        if (rayIntersectsSegment(point, { x: x1, y: y1 }, { x: x2, y: y2 }, area)) {
            intersections++;
        }
    }
    
    return intersections % 2 === 1;
}

export function clearGroup(group) {
    if (!group || !group.children) return;
    
    while (group.children.length > 0) {
        const object = group.children[0];
        group.remove(object);

        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            object.material.dispose();
        }
    }
}

export function distance(point1, point2) {
    return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
}

export function isShortEdge(edgePoint1, edgePoint2, parkingVertices) {
    const edgeLength = distance(edgePoint1, edgePoint2);
    const edgeLengths = parkingVertices.map((v, i) => distance(v, parkingVertices[(i + 1) % parkingVertices.length]));
    edgeLengths.sort((a, b) => a - b);
    const shortestEdges = [edgeLengths[0], edgeLengths[1]];
    return edgeLength === shortestEdges[0] || edgeLength === shortestEdges[1];
}

export function normalizeposition(x, y) {
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    return {x: roundedX, y: roundedY};
}

export function findClosestUID(parkingLotId, pos) {
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

// New function to find closest parking area by position
export function findClosestParkingUID(pos, parkingUIDMap) {
    let minDistance = 20; // Increased threshold for better detection
    let closestUID = null;
    
    for (const uid in parkingUIDMap) {
        const parkingPos = parkingUIDMap[uid];
        const dist = distance(pos, parkingPos);
        if (dist < minDistance) {
            minDistance = dist;
            closestUID = uid;
        }
    }
    
    return closestUID;
}

export function generateUID(vehicleId, normX, normY) {
    const baseId = 684000;
    return vehicleId - baseId + 1;
}

export function removeBoundingBox(uid, scene) {
    const object = scene.getObjectByName(uid);
    if (object) {
        scene.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
    }
}
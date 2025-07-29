import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { isShortEdge, distance, clearGroup } from './utils.js';
import { angles } from './angles.js';

export function detect(parkingAreas, allVehicles, kfframescale, carlength, freescene, parkingStatusMap) {
    if (!Array.isArray(allVehicles) || allVehicles.length === 0) {
        return;
    }
    
    // Only track status, no visual objects
    
    // Reset updated flag for all parking spots
    for (const uid in parkingStatusMap) {
        parkingStatusMap[uid].updated = false;
    }
    
    // Create a map of parking areas to detected vehicles
    const parkingAreaVehicles = new Array(parkingAreas.length).fill(0);
    
    // Count vehicles per parking area
    allVehicles.forEach(vehicle => {
        for (let j = 0; j < parkingAreas.length; j++) {
            const area = parkingAreas[j];
            const centerX = (area.x1 + area.x2 + area.x3 + area.x4) / 4;
            const centerY = (area.y1 + area.y2 + area.y3 + area.y4) / 4;
            
            // Check if vehicle is in this parking area (within 5 meters)
            const dist = Math.sqrt(
                Math.pow(vehicle.x - centerX, 2) + 
                Math.pow(vehicle.y - centerY, 2)
            );
            
            if (dist < 5) {
                parkingAreaVehicles[j]++;
                break;
            }
        }
    });
    
    // Process each parking area - ONLY STATUS TRACKING, NO VISUAL OBJECTS
    for (let j = 0; j < parkingAreas.length; j++) {
        const uid = (j + 1).toString();
        const now = Date.now();
        
        // Check if parking spot is currently occupied by PointCloud data
        const isCurrentlyOccupied = parkingAreaVehicles[j] > 0;
        
        // Get current status from parking system if available
        let currentStatus = parkingStatusMap[uid] ? parkingStatusMap[uid].status : "unknown";
        
        // Check if this parking spot is locked (occupied spots are locked)
        const isLocked = window.parkingSystem && 
                        window.parkingSystem.parkingSpots && 
                        window.parkingSystem.parkingSpots.get(uid) && 
                        window.parkingSystem.parkingSpots.get(uid).locked;
        
        // Update status logic:
        // - If currently occupied, mark as occupied
        // - If not currently occupied but was occupied recently (within 5 seconds), keep as occupied
        // - If locked (manually set to occupied), keep as occupied
        // - Otherwise, mark as free
        let newStatus = currentStatus;
        
        if (isCurrentlyOccupied) {
            newStatus = "occupied";
        } else if (currentStatus === "occupied") {
            // If locked, keep as occupied
            if (isLocked) {
                newStatus = "occupied";
            } else {
                // Check if it was recently occupied (within 5 seconds)
                const timeSinceLastChange = now - (parkingStatusMap[uid]?.lastChange || now);
                if (timeSinceLastChange < 5000) { // 5 seconds
                    newStatus = "occupied"; // Keep as occupied
                } else {
                    newStatus = "free"; // Mark as free after 5 seconds
                }
            }
        } else {
            newStatus = "free";
        }
        
        // Only update if status actually changed
        if (!parkingStatusMap[uid] || parkingStatusMap[uid].status !== newStatus) {
            if (!parkingStatusMap[uid]) {
                parkingStatusMap[uid] = {
                    status: newStatus,
                    lastChange: now,
                    updated: true
                };
            } else {
                parkingStatusMap[uid].status = newStatus;
                parkingStatusMap[uid].lastChange = now;
            }
        } else {
            parkingStatusMap[uid].updated = true;
        }
        
        // Debug: Check if parking spot 83 is being reset
        if (uid === '83') {
            console.log('[DEBUG] Detect.js update - spot 83:', {
                currentStatus: currentStatus,
                newStatus: newStatus,
                isLocked: isLocked,
                isCurrentlyOccupied: isCurrentlyOccupied
            });
        }
    }
    
    // Set status to "unknown" for UIDs that weren't processed this frame
    for (const uid in parkingStatusMap) {
        if (!parkingStatusMap[uid].updated) {
            parkingStatusMap[uid].status = "unknown";
        }
    }
    
    // Count statistics
    let freeCount = 0;
    let occupiedCount = 0;
    let unknownCount = 0;
    
    for (const uid in parkingStatusMap) {
        if (parkingStatusMap[uid].status === "free") {
            freeCount++;
        } else if (parkingStatusMap[uid].status === "occupied") {
            occupiedCount++;
        } else if (parkingStatusMap[uid].status === "unknown") {
            unknownCount++;
        }
    }
    
    const occupancyRateDiv = document.getElementById("occupancyRate");
    if (occupancyRateDiv) {
        occupancyRateDiv.innerText = `Free lot number: ${freeCount}`;
    }
}
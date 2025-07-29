import * as THREE from 'three';
import { updateParkingSpotColor } from './parkingLoader.js';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// Parking spot class
class ParkingSpot {
    constructor(uid, x1, y1, x2, y2, x3, y3, x4, y4, angle, mesh = null) {
        this.uid = uid;
        this.coordinates = { x1, y1, x2, y2, x3, y3, x4, y4 };
        this.center = {
            x: (x1 + x2 + x3 + x4) / 4,
            y: (y1 + y2 + y3 + y4) / 4
        };
        this.angle = angle;
        this.status = 'free'; // Default status - slobodno
        this.mesh = mesh; // Reference to the 3D mesh
        this.lastStatusChange = Date.now();
        this.manualChangeTime = null;
        this.assignedVehicle = null;
        this.routeToSpot = null;
        this.estimatedArrivalTime = null;
        this.locked = false; // inicijalno otključano
    }

    // Manual status change
    setManualStatus(newStatus) {
        if (this.status !== newStatus) {
            this.status = newStatus;
            this.lastStatusChange = Date.now();
            this.manualChangeTime = newStatus === 'free' ? Date.now() : null;
            this.assignedVehicle = null;
            this.routeToSpot = null;
            this.estimatedArrivalTime = null;
            this.locked = true; // Zaključaj pri ručnoj promeni
            
            // Update color
            if (this.mesh) {
                updateParkingSpotColor(this.mesh, this.status);
            }

            if (this.visualBox) {
                let color = 0xaaaaaa;
                if (this.status === 'free') color = 0x00ff00;
                else if (this.status === 'occupied') color = 0xff0000;
                else if (this.status === 'target') color = 0xffff00; // Yellow for target
                else if (this.status === 'unknown') color = 0xffff00;
                this.visualBox.material.color.setHex(color);
            }
        }
    }

    // Assign vehicle to this spot
    assignVehicle(vehicleId, route, estimatedTime) {
        this.assignedVehicle = vehicleId;
        this.routeToSpot = route;
        this.estimatedArrivalTime = estimatedTime;
    }

    // Check if vehicle has arrived
    checkVehicleArrival(currentTime) {
        if (this.assignedVehicle && this.estimatedArrivalTime && currentTime >= this.estimatedArrivalTime) {
            this.status = 'occupied';
            this.lastStatusChange = currentTime;
            this.assignedVehicle = null;
            this.routeToSpot = null;
            this.estimatedArrivalTime = null;
            
            // Update color
            if (this.mesh) {
                updateParkingSpotColor(this.mesh, this.status);
            }
            
            return true;
        }
        return false;
    }

    // Get free time duration
    getFreeTimeDuration() {
        if (this.manualChangeTime && this.status === 'free') {
            return Date.now() - this.manualChangeTime;
        }
        return 0;
    }

    unlock() {
        this.locked = false;
    }
}

// Main parking system class
export class ParkingSystem {
    constructor() {
        this.parkingSpots = new Map();
        this.vehicles = new Map();
        this.reports = [];
        this.uiElements = {};
    }

    // Initialize parking spots from data
    initializeParkingSpots(parkingAreas, parkinglots, freescene = null) {
        this.parkingSpots.clear();
        
        parkingAreas.forEach((area, index) => {
            const uid = (index + 1).toString();
            const centerX = (area.x1 + area.x2 + area.x3 + area.x4) / 4;
            const centerY = (area.y1 + area.y2 + area.y3 + area.y4) / 4;
            
            const parkingSpot = new ParkingSpot(uid, area.x1, area.y1, area.x2, area.y2, area.x3, area.y3, area.x4, area.y4, 0, parkinglots[index]);
            
            // Create visual box for parking spot
            const areaWidth = Math.sqrt(Math.pow(area.x2 - area.x1, 2) + Math.pow(area.y2 - area.y1, 2));
            const areaLength = Math.sqrt(Math.pow(area.x3 - area.x2, 2) + Math.pow(area.y3 - area.y2, 2));
            const angle = Math.atan2(area.y2 - area.y1, area.x2 - area.x1);
            
            const boxGeometry = new THREE.BoxGeometry(areaWidth, areaLength, 1.5);
            const boxMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x00ff00, // Start with green (free)
                transparent: true,
                opacity: 0.7
            });
            const visualBox = new THREE.Mesh(boxGeometry, boxMaterial);
            visualBox.position.set(centerX, centerY, 3);
            visualBox.rotation.z = angle;
            visualBox.userData = { parkingArea: index, uid: uid };
            
            // Add visual box to scene
            if (freescene) {
                freescene.add(visualBox);
            } else if (window.scene) {
                window.scene.add(visualBox);
            }
            
            parkingSpot.visualBox = visualBox;
            
            // Create UID label for this parking spot
            const labelDiv = document.createElement('div');
            labelDiv.className = 'parking-label';
            labelDiv.textContent = uid;
            labelDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            labelDiv.style.color = 'black';
            labelDiv.style.padding = '1px 2px';
            labelDiv.style.borderRadius = '1px';
            labelDiv.style.fontSize = '8px';
            labelDiv.style.fontWeight = 'normal';
            labelDiv.style.border = '1px solid rgba(0, 0, 0, 0.3)';
            labelDiv.style.pointerEvents = 'none';
            labelDiv.style.fontFamily = 'Arial, sans-serif';
            labelDiv.style.lineHeight = '1';
            labelDiv.style.minWidth = '12px';
            labelDiv.style.textAlign = 'center';
            labelDiv.style.opacity = '0'; // Start hidden
            
            const label = new CSS2DObject(labelDiv);
            label.position.set(centerX, centerY, 2);
            
            // Add label to freescene if available, otherwise to main scene
            if (freescene) {
                freescene.add(label);
            } else if (window.scene) {
                window.scene.add(label);
            } else {
                console.warn(`[PARKING] No scene available for UID label ${uid}`);
            }
            
            parkingSpot.uidLabel = label;
            this.parkingSpots.set(uid, parkingSpot);
        });
        
        // Debug: Check initial status
        const statusMap = this.getParkingStatusMap();
        const freeCount = Object.values(statusMap).filter(s => s.status === 'free').length;
        const occupiedCount = Object.values(statusMap).filter(s => s.status === 'occupied').length;
        
        this.updateParkingTable(); // Update table immediately after initialization
    }

    // Manual status change
    setParkingSpotStatus(uid, newStatus) {
        const spot = this.parkingSpots.get(uid);
        if (!spot) {
            console.warn(`[PARKING] Parking spot ${uid} not found`);
            return false;
        }

        // Don't allow setting target status through UI
        if (newStatus === 'target') {
            console.warn(`[PARKING] Target status cannot be set through UI`);
            return false;
        }

        if (newStatus === 'free') {
            // Start vehicle routing simulation
            this.startVehicleRouting(spot);
        }

        spot.setManualStatus(newStatus);
        this.updateParkingTable(); // Update table when status changes
        return true;
    }

    // Start vehicle routing to parking spot
    startVehicleRouting(parkingSpot) {
        // Find available vehicle (simplified - just pick first available)
        const availableVehicle = this.findAvailableVehicle();
        if (!availableVehicle) {
            console.warn('[PARKING] No available vehicles for routing');
            return;
        }

        // Calculate route and estimated time
        const route = this.calculateRoute(availableVehicle.position, parkingSpot.center);
        const estimatedTime = this.calculateTravelTime(route, availableVehicle.speed);
        const arrivalTime = Date.now() + estimatedTime;

        // Assign vehicle to parking spot
        parkingSpot.assignVehicle(availableVehicle.id, route, arrivalTime);
        availableVehicle.isAssigned = true;
        availableVehicle.targetSpot = parkingSpot.uid;
    }

    // Find available vehicle
    findAvailableVehicle() {
        for (const [id, vehicle] of this.vehicles) {
            if (!vehicle.isAssigned) {
                return vehicle;
            }
        }
        return null;
    }

    // Calculate route (simplified - direct path)
    calculateRoute(from, to) {
        return {
            start: from,
            end: to,
            distance: Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2))
        };
    }

    // Calculate travel time
    calculateTravelTime(route, speed) {
        return (route.distance / speed) * 1000; // Convert to milliseconds
    }

    // Update vehicle positions
    updateVehicles(vehicles) {
        this.vehicles.clear();
        
        Object.entries(vehicles).forEach(([id, vehicle]) => {
            if (vehicle.model && vehicle.model.position) {
                this.vehicles.set(id, {
                    id: id,
                    position: {
                        x: vehicle.model.position.x,
                        y: vehicle.model.position.y
                    },
                    speed: vehicle.speed || 10, // Default speed in m/s
                    isAssigned: false,
                    targetSpot: null
                });
            }
        });
    }

    // Detect vehicles in parking spots
    detectVehiclesInParkingSpots(vehicles) {
        const detectionRadius = 50;
        let statusChanged = false;
        
        for (const [uid, spot] of this.parkingSpots) {
            if (spot.locked) continue; // Preskoči zaključana mesta
            
            let vehicleDetected = false;
            Object.entries(vehicles).forEach(([vehicleId, vehicle]) => {
                let vpos = vehicle.model && vehicle.model.position ? vehicle.model.position : vehicle.position;
                if (vpos) {
                    const distance = Math.sqrt(
                        Math.pow(vpos.x - spot.center.x, 2) +
                        Math.pow(vpos.y - spot.center.y, 2)
                    );
                    if (distance < detectionRadius) {
                        vehicleDetected = true;
                        if (spot.status !== 'occupied') {
                            spot.setManualStatus('occupied');
                            statusChanged = true;
                        }
                    }
                }
            });
            
            // Ako nijedno vozilo nije detektovano u blizini, vrati mesto na 'free' (ali ne target)
            if (!vehicleDetected && spot.status === 'occupied') {
                spot.setManualStatus('free');
                statusChanged = true;
            }
            // Don't reset target status - let it remain target until manually changed
        }
        
        if (statusChanged) {
            this.updateParkingTable();
            this.updateParkingSpotVisuals();
        }
    }

    // Update system (called every frame)
    update() {
        const currentTime = Date.now();
        let statusChanged = false;

        // Check if any vehicles have arrived at their assigned spots
        for (const [uid, spot] of this.parkingSpots) {
            if (spot.checkVehicleArrival(currentTime)) {
                statusChanged = true;
                this.createReport(spot);
            }
        }

        if (statusChanged) {
            this.updateParkingTable();
        }
    }

    // Create report when vehicle arrives
    createReport(parkingSpot) {
        if (!parkingSpot.manualChangeTime) return;

        const report = {
            parkingSpotUid: parkingSpot.uid,
            freeTime: parkingSpot.getFreeTimeDuration(),
            distance: parkingSpot.routeToSpot ? parkingSpot.routeToSpot.distance : 0,
            travelTime: parkingSpot.estimatedArrivalTime ? 
                parkingSpot.estimatedArrivalTime - parkingSpot.manualChangeTime : 0,
            timestamp: Date.now()
        };

        this.reports.push(report);
        this.updateReportDisplay();
    }

    // Update parking table display
    updateParkingTable() {
        const tableBody = document.getElementById('parkingTableBody');
        if (!tableBody) return;
        let tableHTML = '';
        for (const [uid, spot] of this.parkingSpots) {
            // Don't show target status in the table - treat it as free for display
            const displayStatus = spot.status === 'target' ? 'free' : spot.status;
            const statusClass = displayStatus === 'occupied' ? 'occupied' : 'free';
            const assignedInfo = spot.assignedVehicle ? `<br><small>Vehicle: ${spot.assignedVehicle}</small>` : '';
            const lockIcon = spot.locked ? 'LOCKED' : '';
            const unlockButton = spot.locked ? `<button onclick="parkingSystem.unlockParkingSpot('${uid}')">Unlock</button>` : '';
            tableHTML += `
                <tr class="${statusClass}" data-uid="${uid}">
                    <td>${uid}</td>
                    <td class="${statusClass}">${displayStatus} ${lockIcon}${assignedInfo}</td>
                    <td>
                        <button onclick="parkingSystem.setParkingSpotStatus('${uid}', 'free')" 
                                ${displayStatus === 'free' ? 'disabled' : ''}>
                            Free
                        </button>
                        <button onclick="parkingSystem.setParkingSpotStatus('${uid}', 'occupied')" 
                                ${displayStatus === 'occupied' ? 'disabled' : ''}>
                            Occupied
                        </button>
                        ${unlockButton}
                    </td>
                </tr>
            `;
        }
        tableBody.innerHTML = tableHTML;
        this.updateStatusDescription();
        // Dodaj click event na UID ćelije za zoom-in
        Array.from(tableBody.querySelectorAll('tr')).forEach(tr => {
            const uid = tr.getAttribute('data-uid');
            const uidCell = tr.querySelector('td');
            if (uidCell && window.parkingSystem && window.parkingSystem.parkingSpots && window.parkingSystem.parkingSpots.has(uid)) {
                uidCell.style.cursor = 'pointer';
                uidCell.onclick = function() {
                    const spot = window.parkingSystem.parkingSpots.get(uid);
                    if (spot && spot.visualBox) {
                        const target = { x: spot.visualBox.position.x, y: spot.visualBox.position.y, z: 20 };
                        if (window.camera) {
                            const duration = 600;
                            const start = { x: window.camera.position.x, y: window.camera.position.y, z: window.camera.position.z };
                            const startTime = performance.now();
                            function animateZoom(now) {
                                const t = Math.min(1, (now - startTime) / duration);
                                window.camera.position.x = start.x + (target.x - start.x) * t;
                                window.camera.position.y = start.y + (target.y - start.y) * t;
                                window.camera.position.z = start.z + (target.z - start.z) * t;
                                window.camera.lookAt(target.x, target.y, 0);
                                if (window.controls) {
                                    window.controls.target.set(target.x, target.y, 0);
                                    window.controls.update();
                                }
                                if (t < 1) requestAnimationFrame(animateZoom);
                            }
                            animateZoom(performance.now());
                        }
                    }
                };
            }
        });
    }
    
    // Update status description
    updateStatusDescription() {
        const statusDescription = document.getElementById('statusDescription');
        if (!statusDescription) return;
        
        const statusMap = this.getParkingStatusMap();
        // Count target status as free for display purposes
        const freeCount = Object.values(statusMap).filter(s => s.status === 'free' || s.status === 'target').length;
        const occupiedCount = Object.values(statusMap).filter(s => s.status === 'occupied').length;
        const totalCount = Object.keys(statusMap).length;
        
        if (occupiedCount > 0) {
            statusDescription.textContent = `Free: ${freeCount}, Occupied: ${occupiedCount}`;
        } else {
            statusDescription.textContent = 'All parking spots are free';
        }
    }

    // Update report display
    updateReportDisplay() {
        const reportContainer = document.getElementById('reportContainer');
        if (!reportContainer) return;

        if (this.reports.length === 0) {
            reportContainer.innerHTML = '<p>No reports yet</p>';
            return;
        }

        let reportHTML = '<h3>Parking Reports</h3><table class="report-table">';
        reportHTML += '<thead><tr><th>Spot</th><th>Free Time (s)</th><th>Distance (m)</th><th>Travel Time (s)</th></tr></thead><tbody>';
        
        this.reports.forEach(report => {
            reportHTML += `
                <tr>
                    <td>${report.parkingSpotUid}</td>
                    <td>${(report.freeTime / 1000).toFixed(1)}</td>
                    <td>${report.distance.toFixed(1)}</td>
                    <td>${(report.travelTime / 1000).toFixed(1)}</td>
                </tr>
            `;
        });
        
        reportHTML += '</tbody></table>';
        reportContainer.innerHTML = reportHTML;
    }

    // Get parking status map for UI
    getParkingStatusMap() {
        const statusMap = {};
        for (const [uid, spot] of this.parkingSpots) {
            // Don't expose target status in the status map - treat it as free
            const displayStatus = spot.status === 'target' ? 'free' : spot.status;
            statusMap[uid] = {
                status: displayStatus,
                lastChange: spot.lastStatusChange,
                updated: true
            };
        }
        
        return statusMap;
    }

    // Get parking areas (for compatibility)
    getParkingAreas() {
        const areas = [];
        for (const [uid, spot] of this.parkingSpots) {
            areas.push({
                uid: spot.uid,
                x1: spot.coordinates.x1,
                y1: spot.coordinates.y1,
                x2: spot.coordinates.x2,
                y2: spot.coordinates.y2,
                x3: spot.coordinates.x3,
                y3: spot.coordinates.y3,
                x4: spot.coordinates.x4,
                y4: spot.coordinates.y4,
                angle: spot.angle
            });
        }
        return areas;
    }

    updateParkingSpotVisuals() {
        // Update the color of each parking spot box based on its status
        this.parkingSpots.forEach((spot, uid) => {
            if (spot.visualBox) {
                let color = 0xaaaaaa; // default gray
                if (spot.status === 'free') color = 0x00ff00;
                else if (spot.status === 'occupied') color = 0xff0000;
                else if (spot.status === 'target') color = 0x00ff00; // Treat target as free (green)
                else if (spot.status === 'unknown') color = 0xffff00;
                
                spot.visualBox.material.color.setHex(color);
            }
        });
    }

    // Dodaj metodu za otključavanje parking mesta
    unlockParkingSpot(uid) {
        const spot = this.parkingSpots.get(uid);
        if (spot) {
            spot.unlock();
            // Ako je status bio 'occupied' i locked, ostavi ga kao 'occupied' i samo otključaj
            // (nema potrebe za dodatnim kodom jer unlock ne menja status)
            this.updateParkingTable();
        }
    }
}

// Global parking system instance
export const parkingSystem = new ParkingSystem();

// Make it available globally for button clicks
window.parkingSystem = parkingSystem; 
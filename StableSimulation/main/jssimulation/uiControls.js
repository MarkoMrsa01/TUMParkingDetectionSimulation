import { setVehicleSpeed } from './animationSystem.js';

export function updateOccupancyRate(parkingStatusMap, occupancyRateElement) {
    const entries = Object.entries(parkingStatusMap);
    const total = entries.length;
    // Count target status as free for display purposes
    const free = entries.filter(([_, v]) => v.status === "free" || v.status === "target").length;

    occupancyRateElement.textContent = `Free lot number: ${free} / ${total}`;
}

export function toggleVehicleButtons(show, vehicleButtonsContainer) {
    console.log('[UI] toggleVehicleButtons called with show:', show);
    console.log('[UI] Vehicle buttons container:', !!vehicleButtonsContainer);
    
    if (vehicleButtonsContainer) {
        const wasHidden = vehicleButtonsContainer.classList.contains('hidden');
        vehicleButtonsContainer.classList.toggle('hidden', !show);
        const isHidden = vehicleButtonsContainer.classList.contains('hidden');
        console.log('[UI] Container visibility changed from', wasHidden, 'to', isHidden);
    } else {
        console.error('[UI] Vehicle buttons container not provided to toggleVehicleButtons');
    }
}

export function detectCurrentVehicles(vehicles, vehicleButtonsContainer, currentVehicleIdRef) {
    console.log('[UI] detectCurrentVehicles called');
    console.log('[UI] Vehicles object:', vehicles);
    console.log('[UI] Number of vehicles:', Object.keys(vehicles).length);
    
    if (!vehicleButtonsContainer) {
        console.error('[UI] Vehicle buttons container not found!');
        return;
    }
    
    const vehicleIds = Object.keys(vehicles);
    console.log('[UI] Vehicle IDs:', vehicleIds);
    
    vehicleButtonsContainer.innerHTML = '';
    
    vehicleIds.forEach(id => {
        console.log('[UI] Creating button for vehicle:', id);
        const button = document.createElement('button');
        button.textContent = (id === 'veh0') ? 'Car' : `Vehicle ${id}`;
        button.onclick = () => {
            console.log('[UI] Vehicle button clicked:', id);
            if (currentVehicleIdRef) {
                currentVehicleIdRef.current = currentVehicleIdRef.current === id ? null : id;
                toggleVehicleButtons(currentVehicleIdRef.current !== null, vehicleButtonsContainer);
            }
        };
        vehicleButtonsContainer.appendChild(button);
    });

    // Add buttons for each MLS_i pointcloud
    if (window.pointcloudStates && Array.isArray(window.pointcloudStates)) {
        window.pointcloudStates.forEach((state, i) => {
            const btn = document.createElement('button');
            btn.textContent = `MLS_${i}`;
            btn.onclick = () => {
                const mlsId = `mls_${i}`;
                currentVehicleIdRef.current = currentVehicleIdRef.current === mlsId ? null : mlsId;
                toggleVehicleButtons(currentVehicleIdRef.current !== null, vehicleButtonsContainer);
            };
            vehicleButtonsContainer.appendChild(btn);
        });
    }
    
    console.log('[UI] Vehicle buttons created');
}

export function setupUIEventListeners(occupancyRateElement, toggleTrackingButton, vehicleButtonsContainer, currentVehicleIdRef, vehicles, parkingSystem) {
    // console.log('[UI] Setting up event listeners...');
    // console.log('[UI] Toggle tracking button found:', !!toggleTrackingButton);
    // console.log('[UI] Vehicle buttons container found:', !!vehicleButtonsContainer);
    
    if (toggleTrackingButton) {
        // console.log('[UI] Adding click listener to tracking button');
        toggleTrackingButton.addEventListener('click', () => {
            console.log('[UI] Tracking button clicked!');
            const currentMode = window.trackingMode || 'global';
            const newMode = currentMode === 'global' ? 'vehicle' : 'global';
            
            // Update global tracking mode
            window.trackingMode = newMode;
            if (window.setTrackingMode) {
                window.setTrackingMode(newMode);
            }
            
            toggleVehicleButtons(newMode === 'vehicle', vehicleButtonsContainer);
            
            if (newMode === 'vehicle') {
                // Do NOT set currentVehicleIdRef.current automatically
                detectCurrentVehicles(vehicles, vehicleButtonsContainer, currentVehicleIdRef);
                toggleTrackingButton.textContent = 'Disable Tracking';
                toggleTrackingButton.style.backgroundColor = '#dc3545';
                console.log('[UI] Vehicle tracking ENABLED');
            } else {
                currentVehicleIdRef.current = null;
                toggleTrackingButton.textContent = 'Enable Tracking';
                toggleTrackingButton.style.backgroundColor = '#007bff';
                console.log('[UI] Vehicle tracking DISABLED');
            }
        });
        // console.log('[UI] Click listener added successfully');
    } else {
        console.error('[UI] Toggle tracking button not found!');
    }
}

export function setupSpeedControl() {
    const speedSlider = document.getElementById('vehicleSpeed');
    const speedValue = document.getElementById('speedValue');
    
    if (speedSlider && speedValue) {
        // Base speed from XML file (5.0 m/s)
        const baseSpeedMs = 5.0;
        
        // Update speed value display when slider changes
        speedSlider.addEventListener('input', (e) => {
            const multiplier = parseFloat(e.target.value);
            const actualSpeedKmh = (baseSpeedMs * multiplier * 3.6).toFixed(1); // Convert m/s to km/h
            speedValue.textContent = `${actualSpeedKmh} km/h`;
            setVehicleSpeed(multiplier);
        });
        
        // Initialize with default value
        const initialMultiplier = parseFloat(speedSlider.value);
        const initialSpeedKmh = (baseSpeedMs * initialMultiplier * 3.6).toFixed(1);
        speedValue.textContent = `${initialSpeedKmh} km/h`;
        setVehicleSpeed(initialMultiplier);
    }
}

export function setupPointSizeControl() {
    const pointSizeSlider = document.getElementById('pointSize');
    const pointSizeValue = document.getElementById('pointSizeValue');
    
    if (pointSizeSlider && pointSizeValue) {
        // Update point size value display when slider changes
        pointSizeSlider.addEventListener('input', (e) => {
            const newSize = parseFloat(e.target.value);
            pointSizeValue.textContent = newSize.toFixed(1);
            
            // Update all existing point clouds using the updatePointSize function
            if (window.updatePointSize) {
                window.updatePointSize(newSize);
            }
        });
        
        // Initialize with default value
        const initialSize = parseFloat(pointSizeSlider.value);
        pointSizeValue.textContent = initialSize.toFixed(1);
    }
}

export function setupLegendToggle() {
    const toggleLegendButton = document.getElementById('toggleLegend');
    const legendContainer = document.getElementById('legend');
    
    if (toggleLegendButton && legendContainer) {
        toggleLegendButton.addEventListener('click', () => {
            const isLegendVisible = !legendContainer.classList.contains('hidden');
            legendContainer.classList.toggle('hidden', isLegendVisible);
        });
    }
} 
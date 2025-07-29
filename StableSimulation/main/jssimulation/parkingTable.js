import * as THREE from 'three';

export function updateParkingTable(parkingStatusMap, zoomCallback) {
    const tableBody = document.getElementById('parkingTableBody');
    if (!tableBody) return;

    let tableHTML = `
        <div class="parking-status-header">Real-time Parking Status</div>`;
    
    const free = Object.values(parkingStatusMap).filter(s => s.status === 'free').length;
    const total = Object.keys(parkingStatusMap).length;
    tableHTML += `<div class="parking-status-summary">${free} / ${total} free</div>`;
    
    tableHTML += `
        <table class="parking-status-table">
            <thead>
                <tr class="parking-table-header"><th>ID</th><th>Status</th><th>Timer</th></tr>
            </thead>
            <tbody>`;

    const now = Date.now();

    const entries = Object.entries(parkingStatusMap);
    entries.forEach(([uid, info]) => {
        const duration = Math.floor((now - info.lastChange) / 1000);
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const statusClass = info.status === "free" ? "free"
                            : info.status === "occupied" ? "occupied"
                            : "unknown";

        tableHTML += `
            <tr class="${statusClass} clickable" data-uid="${uid}">
                <td>${uid}</td>
                <td>${info.status}</td>
                <td>${mins}m ${secs < 10 ? '0' + secs : secs}s</td>
            </tr>`;
    });

    tableHTML += `</tbody></table>`;
    tableBody.innerHTML = tableHTML;

    // Aktiviraj klik za svaki red
    tableBody.querySelectorAll("tr[data-uid]").forEach(row => {
        const uid = row.getAttribute("data-uid");
        row.addEventListener("click", () => zoomCallback(uid));
    });
}

export function zoomToParkingSpot(uid, jsonscene, freescene, camera, controls, zoomAnimationId, zoomStartTime) {
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

    if (zoomAnimationId.current) {
        cancelAnimationFrame(zoomAnimationId.current);
    }

    zoomStartTime.current = performance.now();
    const duration = 1000; // ms

    function animateZoom(now) {
        const t = Math.min((now - zoomStartTime.current) / duration, 1);
        const easedT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // lagani easing

        camera.position.lerpVectors(startPos, endPos, easedT);
        controls.target.lerpVectors(startTarget, endTarget, easedT);
        controls.update();

        if (t < 1) {
            zoomAnimationId.current = requestAnimationFrame(animateZoom);
        } else {
            zoomAnimationId.current = null;
        }
    }

    zoomAnimationId.current = requestAnimationFrame(animateZoom);
} 
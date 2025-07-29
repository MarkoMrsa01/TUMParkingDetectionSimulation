export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: 0,
            renderTime: 0,
            memoryUsage: 0,
            pointcloudCount: 0,
            vehicleCount: 0,
            parkingSpotCount: 0,
            systemLoad: 0
        };
        
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.renderStartTime = 0;
        this.renderEndTime = 0;
        
        // Performance thresholds
        this.thresholds = {
            fps: { optimal: 19, warning: 10, critical: 0 },
            renderTime: { optimal: 50, warning: 80, critical: 120 }, // optimal je sada <= 50ms
            memoryUsage: { optimal: 200, warning: 500, critical: 1000 }, // MB
            systemLoad: { optimal: 50, warning: 75, critical: 90 } // percentage
        };
    }
    
    startRender() {
        this.renderStartTime = performance.now();
    }
    
    endRender() {
        this.renderEndTime = performance.now();
        this.metrics.renderTime = this.renderEndTime - this.renderStartTime;
    }
    
    update(renderer) {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.frameCount++;
        if (deltaTime >= 1000) { // Update every second
            this.metrics.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.frameCount = 0;
            this.lastTime = currentTime;
            // Update renderer info (bez objectCount)
            if (renderer && renderer.info) {
                this.metrics.geometryCount = renderer.info.memory.geometries;
                this.metrics.textureCount = renderer.info.memory.textures;
                this.metrics.triangleCount = renderer.info.render.triangles;
            } else {
                this.metrics.geometryCount = '-';
                this.metrics.textureCount = '-';
                this.metrics.triangleCount = '-';
            }
            // Calculate system load
            this.calculateSystemLoad();
            // Update UI
            this.updateUI();
        }
    }
    
    updateMemoryUsage() {
        if (performance.memory) {
            this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        }
    }
    
    calculateSystemLoad() {
        // Calculate system load based on FPS and render time only
        let load = 0;
        // FPS factor (lower FPS = higher load)
        const fpsFactor = Math.max(0, (30 - this.metrics.fps) / 30) * 60; // veći uticaj FPS-a
        // Render time factor
        const renderFactor = Math.min(100, (this.metrics.renderTime / 50) * 40);
        load = Math.min(100, fpsFactor + renderFactor);
        this.metrics.systemLoad = Math.round(load);
    }
    
    updateUI() {
        // Update FPS
        const fpsElement = document.getElementById('fpsValue');
        if (fpsElement) {
            fpsElement.textContent = this.metrics.fps;
            fpsElement.style.color = this.getColorForMetric('fps', this.metrics.fps);
        }
        // Update render time
        const renderTimeElement = document.getElementById('renderTimeValue');
        if (renderTimeElement) {
            renderTimeElement.textContent = `${Math.round(this.metrics.renderTime)}ms`;
            renderTimeElement.style.color = this.getColorForMetric('renderTime', this.metrics.renderTime);
        }
        // Ukloni memory usage
        // const memoryElement = document.getElementById('memoryValue');
        // if (memoryElement) {
        //     if (performance.memory) {
        //         memoryElement.textContent = `${this.metrics.memoryUsage}MB`;
        //     } else {
        //         memoryElement.textContent = 'N/A (browser unsupported)';
        //     }
        //     memoryElement.style.color = this.getColorForMetric('memoryUsage', this.metrics.memoryUsage);
        // }
        // Update pointcloud count
        const pointcloudElement = document.getElementById('pointcloudCountValue');
        if (pointcloudElement) {
            pointcloudElement.textContent = this.metrics.pointcloudCount;
        }
        // Ukloni objectCount
        // const objectElement = document.getElementById('objectCountValue');
        // if (objectElement) objectElement.textContent = this.metrics.objectCount;
        const geometryElement = document.getElementById('geometryCountValue');
        if (geometryElement) geometryElement.textContent = this.metrics.geometryCount;
        const textureElement = document.getElementById('textureCountValue');
        if (textureElement) textureElement.textContent = this.metrics.textureCount;
        const triangleElement = document.getElementById('triangleCountValue');
        if (triangleElement) triangleElement.textContent = this.metrics.triangleCount;
        // Ukloni updatePerformanceBar i System Status
        // this.updatePerformanceBar();
    }
    
    getColorForMetric(metricName, value) {
        const threshold = this.thresholds[metricName];
        if (!threshold) return '#333';
        if (metricName === 'renderTime') {
            if (value <= threshold.optimal) return '#4caf50'; // Green
            if (value <= threshold.warning) return '#ff9800'; // Orange
            return '#f44336'; // Red
        } else if (metricName === 'fps') {
            if (value >= threshold.optimal) return '#4caf50'; // Green
            if (value >= threshold.warning) return '#ff9800'; // Orange
            return '#f44336'; // Red
        } else {
            if (value >= threshold.optimal) return '#4caf50'; // Green
            if (value >= threshold.warning) return '#ff9800'; // Orange
            return '#f44336'; // Red
        }
    }
    
    // Ukloni metodu updatePerformanceBar
    
    setPointcloudCount(count) {
        this.metrics.pointcloudCount = count;
    }
    
    getMetrics() {
        return { ...this.metrics };
    }
    
    // Ukloni metodu getSystemStatus
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor(); 
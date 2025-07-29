import * as THREE from 'three';

// Cache for config to avoid repeated fetches
let configCache = null;

export async function loadConfig() {
    // Return cached config if available
    if (configCache) {
        return configCache;
    }
    
    // console.time('config-loading');
    
    try {
        const response = await fetch('./Config.txt');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.text();
        const config = parseConfigFile(data);
        
        // Cache the config
        configCache = config;
        
        // console.timeEnd('config-loading');
        return config;
    } catch (error) {
        console.error('[CONFIG] Error loading config:', error);
        const defaultConfig = getDefaultConfig();
        configCache = defaultConfig;
        // console.timeEnd('config-loading');
        return defaultConfig;
    }
}

export function parseConfigFile(data) {
    // TM matrica više nije potrebna jer su PCD fajlovi već transformisani u UTM 32N
    // Koristimo identičnu matricu jer su podaci već u pravom koordinatnom sistemu
    let TM = new THREE.Matrix4().identity();
    const lines = data.split('\n');
    let section = ''; 
    let pointCloudPaths = [];
    let boundingBoxPaths = [];
    let boundingBoxType = '';
    let simulateTraffic = false;
    let pointSize = 1.2; // Default veličina tačaka

    lines.forEach(line => {
        line = line.trim();

        if (line.startsWith('#') || line === '') {
            return;  // 忽略注释和空行
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

        if (line.startsWith('point_size:')) {
            section = 'point_size';
            return;
        }

        if (section === 'pointclouds') {
            const [path, count] = line.split(',').map(item => item.trim());
            pointCloudPaths.push({ path, count: parseInt(count) });
        } 
        else if (section === 'boundingbox_type') {
            boundingBoxType = line;
        } 
        else if (section === 'boundingboxes') {
            const [path, count] = line.split(',').map(item => item.trim());
            boundingBoxPaths.push({ path, count: parseInt(count) });
        } 
        else if (section === 'simulate_traffic') {
            simulateTraffic = (line.toLowerCase().trim() === 'yes');
        }
        else if (section === 'point_size') {
            pointSize = parseFloat(line.trim());
        }
    });

    return { TM, pointCloudPaths, boundingBoxPaths, boundingBoxType, simulateTraffic, pointSize };
}

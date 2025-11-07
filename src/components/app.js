// Configuración de la aplicación
const CONFIG = {
    FIREBASE: {
        apiKey: "AIzaSyByBawppJfWRPzFVgOhuxK_KWPGbTCjxkE",
        authDomain: "starnet-report-program.firebaseapp.com",
        databaseURL: "https://starnet-report-program-default-rtdb.firebaseio.com",
        projectId: "starnet-report-program",
        storageBucket: "starnet-report-program.firebasestorage.app",
        messagingSenderId: "837993869502",
        appId: "1:837993869502:web:eb183b3041378ea40aeeef",
    },
    STORAGE_KEYS: {
        NODES: 'starnetAppNodes',
        LAST_SYNC: 'starnetLastSync'
    },
    // Sincronización eliminada, Firebase 'on' lo maneja
    MAP: {
        DEFAULT_CENTER: [-66.2442, 9.8606], // Altagracia de Orituco
        DEFAULT_ZOOM: 14,
        MARKER_ICON: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNy41ODYgMiA0IDUuNTg2IDQgMTBDNCAxNC40MTQgNy41ODYgMTggMTIgMThDMTYuNDE0IDE4IDIwIDE0LjQxNCAyMCAxMEMyMCA1LjU4NiAxNi40MTQgMiAxMiAyWk0xMiAxMkMxMC44OTcgMTIgMTAgMTEuMTAzIDEwIDEwQzEwIDguODk3IDEwLjg5NyA4IDEyIDhDMTMuMTAzIDggMTQgOC44OTcgMTQgMTBDMTQgMTEuMTAzIDEzLjEwMyAxMiAxMiAxMloiIGZpbGw9IiMwMDc3YjYiLz4KPC9zdmc+'
    }
};

// Estado global de la aplicación
class AppState {
    constructor() {
        this.nodes = [];
        this.activeSection = 'Reportes'; // Sección inicial
        this.isOnline = navigator.onLine;
        this.map = null;
        this.vectorSource = null;
    }
}

// ------------------------------------------
// --- FUNCIONES DE UTILIDAD Y PERSISTENCIA ---
// ------------------------------------------

/**
 * Intenta cargar los nodos desde localStorage.
 * @returns {Array<Object>} Un array de nodos o un array vacío si falla.
 */
function getNodesFromLocal() {
    try {
        const json = localStorage.getItem(CONFIG.STORAGE_KEYS.NODES);
        return json ? JSON.parse(json) : [];
    } catch (e) {
        console.error('❌ Error al leer nodos de localStorage:', e);
        return [];
    }
}

/**
 * Guarda el array de nodos en localStorage.
 * @param {Array<Object>} nodes Los nodos a guardar.
 */
function saveNodesToLocal(nodes) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEYS.NODES, JSON.stringify(nodes));
        localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        console.log(`💾 Nodos guardados en caché local. Total: ${nodes.length}`);
    } catch (e) {
        console.error('❌ Error al guardar nodos en localStorage:', e);
    }
}

// ----------------------------------
// --- FUNCIONES DE SINCRONIZACIÓN (MEJORADO) ---
// ----------------------------------

/**
 * Configura el listener de Firebase para actualizaciones en tiempo real.
 * @param {AppState} appState Estado global de la aplicación.
 * @param {firebase.database.Database} database Instancia de la base de datos.
 */
function setupFirebaseListener(appState, database) {
    // CAMBIO: Apuntar a la nueva ruta en la base de datos
    const nodesRef = database.ref('central/fiberService/cabinets');
    
    // Usar 'on' en lugar de 'once' para actualizaciones en tiempo real
    nodesRef.on('value', (snapshot) => {
        console.log('🔄 Recibidos datos de Firebase (desde central/fiberService/cabinets)...');
        const data = snapshot.val();
        let fetchedNodes = [];

        if (data) {
            // CAMBIO: Adaptar la lectura a la nueva estructura de datos (array o-bjeto)
            if (Array.isArray(data)) {
                // Manejar si 'cabinets' es un ARRAY en Firebase
                fetchedNodes = data
                    .filter(cabinet => cabinet && typeof cabinet.latitude === 'number' && typeof cabinet.longitude === 'number') // Filtrar nulos y datos inválidos
                    .map(cabinet => ({
                        id: cabinet.nodeId, // Usar nodeId como ID
                        lat: cabinet.latitude, // Mapear latitude -> lat
                        lon: cabinet.longitude, // Mapear longitude -> lon
                        name: cabinet.location || `Gabinete ${cabinet.nodeId}`, // Usar location o un nombre por defecto
                        status: cabinet.status,
                        originalData: cabinet // Guardar data original si es necesario
                    }));
            } else if (typeof data === 'object' && data !== null) {
                // Manejar si 'cabinets' es un OBJETO en Firebase (común para arrays guardados)
                fetchedNodes = Object.keys(data).map(key => {
                    const cabinet = data[key];
                    // Asegurarse que el gabiente tiene datos válidos
                    if (cabinet && typeof cabinet.latitude === 'number' && typeof cabinet.longitude === 'number') {
                        return {
                            id: cabinet.nodeId || key, // Usar nodeId o la clave de Firebase como ID
                            lat: cabinet.latitude, // Mapear latitude -> lat
                            lon: cabinet.longitude, // Mapear longitude -> lon
                            name: cabinet.location || `Gabinete ${cabinet.nodeId}`, // Usar location o un nombre por defecto
                            status: cabinet.status,
                            originalData: cabinet // Guardar data original
                        };
                    }
                    return null; // Ignorar este elemento
                }).filter(Boolean); // Filtrar los nulos
            }
        }

        if (fetchedNodes.length > 0) {
            appState.nodes = fetchedNodes;
            saveNodesToLocal(fetchedNodes); // Guardar el resultado
            updateUI(appState); // Actualizar toda la UI con los nuevos datos
            console.log(`✅ Sincronización exitosa. Total de nodos: ${fetchedNodes.length}`);
        } else {
            console.log('ℹ️ Sincronización completa, no se encontraron nodos en Firebase.');
            appState.nodes = []; // Limpiar si no hay nodos
            saveNodesToLocal([]);
            updateUI(appState);
        }
    }, (error) => {
        console.error('❌ Error en el listener de Firebase:', error);
    });
}

// -----------------------------
// --- FUNCIONES DE ACTUALIZACIÓN DE UI ---
// -----------------------------

/**
 * Dibuja los marcadores en el mapa usando los datos de appState.nodes.
 * @param {AppState} appState Estado global de la aplicación.
 */
function drawMarkers(appState) {
    if (!appState.map || !appState.vectorSource) {
        console.error('❌ Mapa o fuente de vector no inicializados para dibujar marcadores.');
        return;
    }

    appState.vectorSource.clear();
    
    if (appState.nodes.length === 0) {
        console.log('ℹ️ No hay nodos para dibujar en el mapa.');
        return;
    }

    const markerStyle = new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1],
            src: CONFIG.MAP.MARKER_ICON,
            scale: 1.5,
        }),
    });

    const features = appState.nodes.map(node => {
        if (typeof node.lat !== 'number' || typeof node.lon !== 'number') {
             console.warn(`⚠️ Nodo inválido (lat/lon faltante):`, node);
             return null;
        }

        const point = new ol.geom.Point(ol.proj.fromLonLat([node.lon, node.lat]));
        
        const feature = new ol.Feature({
            geometry: point,
            nodeData: node 
        });
        
        feature.setId(node.id); // Asignar ID al feature para buscarlo
        feature.setStyle(markerStyle);
        return feature;
    }).filter(f => f !== null); 

    appState.vectorSource.addFeatures(features);
    console.log(`🗺️ Dibujados ${features.length} marcadores en el mapa.`);
}

/**
 * Función central para actualizar toda la UI después de un cambio de datos.
 * @param {AppState} appState Estado global de la aplicación.
 */
function updateUI(appState) {
    console.log('🎨 Actualizando interfaz de usuario...');
    
    drawMarkers(appState);
    updateNodeList(appState); // Actualizar la lista de nodos/reportes
}

/**
 * Muestra la información detallada de un nodo en el panel izquierdo.
 * @param {Object} nodeData Datos del nodo.
 * @param {AppState} appState Estado global de la aplicación.
 */
function displayNodeInfo(nodeData, appState) {
    console.log('ℹ️ Mostrar información del nodo:', nodeData);
    
    const sidebarContent = document.getElementById('sidebarContent');
    const infoLoading = document.getElementById('infoLoading');
    
    if (sidebarContent) {
        // Ocultar mensaje de "Selecciona un nodo"
        if(infoLoading) infoLoading.style.display = 'none';

        // (MEJORADO) Contenido HTML más estructurado
        sidebarContent.innerHTML = `
            <div class="node-info-card">
                <h3>${nodeData.name || 'Nodo Desconocido'}</h3>
                <p><strong>ID:</strong> ${nodeData.id}</p>
                <p><strong>Estado:</strong> ${nodeData.status || 'OK'}</p>
                <p><strong>Coordenadas:</strong> ${nodeData.lat.toFixed(4)}, ${nodeData.lon.toFixed(4)}</p>
                <button class="info-btn" onclick="AppManager.viewNodeOnMap('${nodeData.id}')">Ver en Mapa</button>
            </div>
        `;
        
        // Mostrar panel en móvil
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar-info').classList.add('is-open');
            document.getElementById('sidebar-nodes').classList.remove('is-open');
        }
    }
}

/**
 * Centra el mapa en un nodo específico.
 * @param {string} nodeId El ID del nodo.
 * @param {AppState} appState Estado global de la aplicación.
 */
function viewNodeOnMap(nodeId, appState) {
    if (!appState.map || !appState.vectorSource) return;

    const feature = appState.vectorSource.getFeatureById(nodeId);
    if (feature) {
        const geometry = feature.getGeometry();
        appState.map.getView().animate({
            center: geometry.getCoordinates(),
            zoom: 16, // Zoom más cercano al ver un nodo
            duration: 1000
        });
    }
}

/**
 * Actualiza la lista en el panel derecho (Nodos o Reportes).
 * @param {AppState} appState Estado global de la aplicación.
 */
function updateNodeList(appState) {
    const listElement = document.getElementById('nodeList');
    const listTitle = document.getElementById('sidebarTitle');
    
    if (!listElement || !listTitle) return;

    listTitle.textContent = appState.activeSection; // Actualizar título

    if (appState.activeSection === 'Reportes') {
        listElement.innerHTML = `
            <div class="loading-state">
                <span>La sección de reportes no está implementada.</span>
            </div>
        `;
    } else if (appState.activeSection === 'Nodos') {
        if (appState.nodes.length === 0) {
            listElement.innerHTML = `
                <div class="loading-state">
                    <span>No hay nodos para mostrar.</span>
                </div>
            `;
            return;
        }

        // (MEJORADO) Crear lista de nodos interactiva
        listElement.innerHTML = appState.nodes.map(node => 
            `<button class="node-list-item" onclick="AppManager.displayNodeById('${node.id}')">
                <span class="node-list-name">${node.name || 'Nodo'}</span>
                <span class="node-list-id">${node.id}</span>
            </button>`
        ).join('');
    }
}

/**
 * Función helper para ser llamada desde el HTML (onclick)
 * @param {string} nodeId 
 */
function displayNodeById(nodeId) {
    const node = window.AppManager.appState.nodes.find(n => n.id === nodeId);
    if (node) {
        displayNodeInfo(node, window.AppManager.appState);
        viewNodeOnMap(nodeId, window.AppManager.appState); // Centrar mapa también
    }
}


// ------------------------------------------
// --- LÓGICA PRINCIPAL DE LA APLICACIÓN ---
// ------------------------------------------

async function initApplication() {
    // Exponer el estado global para acceso de funciones helper
    const appState = new AppState();
    window.AppManager.appState = appState; 
    
    try {
        const app = firebase.initializeApp(CONFIG.FIREBASE);
        const database = firebase.database();
        
        setupConnectivityMonitoring(appState);
        await initializeMap(appState);
        
        // Carga inicial y configuración del listener
        await loadInitialData(appState, database); 
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        throw error;
    }
}

function setupConnectivityMonitoring(appState) {
    const updateOnlineStatus = () => {
        appState.isOnline = navigator.onLine;
        const statusElement = document.getElementById('connectivityStatus');
        
        if (statusElement) {
            statusElement.textContent = appState.isOnline ? '🟢 En línea' : '🔴 Sin conexión';
            statusElement.style.background = appState.isOnline ? '#10b981' : '#ef4444';
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    if (!document.getElementById('connectivityStatus')) {
        const connectivityElement = document.createElement('div');
        connectivityElement.id = 'connectivityStatus';
        connectivityElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 15px;
            color: white;
            font-size: 12px;
            z-index: 10000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(connectivityElement);
    }
    
    updateOnlineStatus();
}

async function initializeMap(appState) {
    return new Promise((resolve) => {
        if (typeof ol === 'undefined') {
            throw new Error('OpenLayers no está disponible');
        }

        appState.vectorSource = new ol.source.Vector();
        const vectorLayer = new ol.layer.Vector({
            source: appState.vectorSource,
        });

        appState.map = new ol.Map({
            target: "map",
            layers: [
                new ol.layer.Tile({ 
                    source: new ol.source.OSM() 
                }),
                vectorLayer
            ],
            view: new ol.View({
                center: ol.proj.fromLonLat(CONFIG.MAP.DEFAULT_CENTER),
                zoom: CONFIG.MAP.DEFAULT_ZOOM,
            }),
        });

        // Evento de clic en el mapa
        appState.map.on('click', function(evt) {
            const feature = appState.map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
            if (feature) {
                const nodeData = feature.get('nodeData');
                if (nodeData) {
                    displayNodeInfo(nodeData, appState);
                }
            }
        });

        // (MEJORADO) Quitar estado de carga añadiendo una clase
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.classList.add('map-loaded');
        }

        resolve();
    });
}

// Carga inicial de datos (MEJORADO)
async function loadInitialData(appState, database) {
    // 1. Cargar desde localStorage primero (Offline-first)
    const localNodes = getNodesFromLocal();
    if (localNodes.length > 0) {
        appState.nodes = localNodes;
        updateUI(appState); // Actualizar UI con datos locales
        console.log(`📁 Cargados ${localNodes.length} nodos desde caché local`);
    }

    // 2. Configurar el listener de Firebase (manejará online/offline)
    if (appState.isOnline) {
        setupFirebaseListener(appState, database);
    } else {
        console.warn('⚠️ Sin conexión. Mostrando datos locales. Se sincronizará al reconectar.');
    }
    
    // Listener para reconectar
    window.addEventListener('online', () => {
        if (!window.firebaseListenerAttached) { // Evitar múltiples listeners
             setupFirebaseListener(appState, database);
             window.firebaseListenerAttached = true;
        }
    });
}

/**
 * Establece la sección activa (llamada desde HTML).
 * @param {'Reportes' | 'Nodos'} sectionName 
 */
function setActiveSection(sectionName) {
    if (window.AppManager.appState) {
        window.AppManager.appState.activeSection = sectionName;
        updateNodeList(window.AppManager.appState); // Actualizar la lista
    }
}

// Exportar para uso global
window.AppManager = {
    initApplication,
    CONFIG,
    setActiveSection, // Exponer para botones
    displayNodeById,  // Exponer para clics en la lista
    viewNodeOnMap,    // Exponer para botón en tarjeta de info
    appState: null      // Se llenará en initApplication
};
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
    SYNC: {
        INTERVAL: 5 * 60 * 1000, // 5 minutos
        RETRY_DELAY: 10000, // 10 segundos para reintentos
        MAX_RETRIES: 3
    },
    MAP: {
        DEFAULT_CENTER: [-66.2442, 9.8606], // Altagracia de Orituco
        DEFAULT_ZOOM: 14,
        // Ícono de marcador SVG codificado en base64
        MARKER_ICON: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDNy41ODYgMiA0IDUuNTg2IDQgMTBDNCAxNC40MTQgNy41ODYgMTggMTIgMThDMTYuNDE0IDE4IDIwIDE0LjQxNCAyMCAxMEMyMCA1LjU4NiAxNi40MTQgMiAxMiAyWk0xMiAxMkMxMC44OTcgMTIgMTAgMTEuMTAzIDEwIDEwQzEwIDguODk3IDEwLjg5NyA4IDEyIDhDMTMuMTAzIDggMTQgOC44OTcgMTQgMTBDMTQgMTEuMTAzIDEzLjEwMyAxMiAxMiAxMloiIGZpbGw9IiMwMDc3YjYiLz4KPC9zdmc+'
    }
};

// Estado global de la aplicación
class AppState {
    constructor() {
        this.nodes = [];
        this.activeSection = 'Reportes';
        this.syncRetries = 0;
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
// --- FUNCIONES DE SINCRONIZACIÓN ---
// ----------------------------------

/**
 * Recupera los nodos desde Firebase y actualiza el estado y la UI.
 * @param {AppState} appState Estado global de la aplicación.
 * @param {firebase.database.Database} database Instancia de la base de datos.
 */
async function fetchNodesFromFirebase(appState, database) {
    if (!appState.isOnline) {
        console.warn('⚠️ No se puede sincronizar: Sin conexión.');
        return;
    }

    try {
        console.log('🔄 Sincronizando datos con Firebase...');
        const snapshot = await database.ref('nodes').once('value');
        const data = snapshot.val();
        
        let fetchedNodes = [];
        if (data) {
            // Convertir el objeto de Firebase a un array.
            fetchedNodes = Object.keys(data).map(key => ({ 
                id: key, 
                ...data[key] 
            }));
        }

        if (fetchedNodes.length > 0) {
            appState.nodes = fetchedNodes;
            saveNodesToLocal(fetchedNodes); // Guardar el resultado de la sincronización
            updateUI(appState);
            console.log(`✅ Sincronización exitosa. Total de nodos: ${fetchedNodes.length}`);
            appState.syncRetries = 0;
        } else {
            // Esto podría ser normal si no hay datos en Firebase
            console.log('ℹ️ Sincronización completa, no se encontraron nodos en Firebase.');
        }
    } catch (error) {
        appState.syncRetries++;
        console.error(`❌ Error en fetchNodesFromFirebase (Intento ${appState.syncRetries}):`, error);
        
        if (appState.syncRetries < CONFIG.SYNC.MAX_RETRIES) {
            // Lógica de reintento simple
        } else {
            console.error('🛑 Se alcanzó el número máximo de reintentos de sincronización.');
        }
    }
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

    // 1. Limpiar marcadores existentes
    appState.vectorSource.clear();
    
    // Si no hay nodos, terminamos
    if (appState.nodes.length === 0) {
        console.log('ℹ️ No hay nodos para dibujar en el mapa.');
        return;
    }

    // Estilo del marcador (usando el SVG base64 de CONFIG)
    const markerStyle = new ol.style.Style({
        image: new ol.style.Icon({
            anchor: [0.5, 1], // Centro inferior
            src: CONFIG.MAP.MARKER_ICON,
            scale: 1.5,
        }),
    });

    // 2. Crear nuevas Features (marcadores)
    const features = appState.nodes.map(node => {
        // Asegúrate de que las coordenadas sean válidas
        if (typeof node.lat !== 'number' || typeof node.lon !== 'number') {
             console.warn(`⚠️ Nodo inválido (lat/lon faltante):`, node);
             return null;
        }

        // Crear el punto de geometría en coordenadas de OpenLayers (Proyección WGS84 a Web Mercator)
        const point = new ol.geom.Point(ol.proj.fromLonLat([node.lon, node.lat]));
        
        const feature = new ol.Feature({
            geometry: point,
            // Guardar los datos del nodo para usarlos en el evento 'click'
            nodeData: node 
        });
        
        feature.setStyle(markerStyle);
        return feature;
    }).filter(f => f !== null); // Filtrar nodos inválidos

    // 3. Añadir las Features a la fuente del vector
    appState.vectorSource.addFeatures(features);
    console.log(`🗺️ Dibujados ${features.length} marcadores en el mapa.`);
}

/**
 * Función central para actualizar toda la UI después de un cambio de datos.
 * @param {AppState} appState Estado global de la aplicación.
 */
function updateUI(appState) {
    console.log('🎨 Actualizando interfaz de usuario...');
    
    // 1. Dibujar los marcadores en el mapa
    drawMarkers(appState);

    // 2. Actualizar la lista o sección de reportes/nodos (Implementar aquí)
    updateNodeList(appState); 

    // Opcional: Centrar el mapa si es la carga inicial y hay nodos
    if (appState.nodes.length > 0 && appState.map) {
        // Se podría añadir lógica para ajustar la vista al 'extent' (límites) de todos los marcadores
    }
}

/**
 * Muestra la información detallada de un nodo al hacer clic en su marcador.
 * @param {Object} nodeData Datos del nodo.
 * @param {AppState} appState Estado global de la aplicación.
 */
function displayNodeInfo(nodeData, appState) {
    console.log('ℹ️ Mostrar información del nodo:', nodeData);
    
    // Lógica para rellenar el sidebar
    const infoSidebar = document.getElementById('sidebar-info');
    if (infoSidebar) {
        // Ejemplo simple de contenido
        infoSidebar.innerHTML = `
            <h3>${nodeData.name || 'Nodo Desconocido'}</h3>
            <p>ID: ${nodeData.id}</p>
            <p>Lat: ${nodeData.lat.toFixed(4)}, Lon: ${nodeData.lon.toFixed(4)}</p>
            <p>Estado: ${nodeData.status || 'OK'}</p>
            <button>Ver Detalles</button>
        `;
        
        // Mostrar panel en móvil (ya estaba en tu código original)
        if (window.innerWidth <= 768) {
            infoSidebar.classList.add('is-open');
            document.getElementById('sidebar-nodes').classList.remove('is-open');
        }
    }
}

/**
 * Simulación de función para actualizar la lista de nodos en el sidebar
 * (Necesitas implementar el DOM real para esta parte)
 * @param {AppState} appState Estado global de la aplicación.
 */
function updateNodeList(appState) {
    const listElement = document.getElementById('node-list');
    if (listElement) {
        listElement.innerHTML = appState.nodes.map(node => 
            `<li>${node.name || 'Nodo'} (${node.id})</li>`
        ).join('');
    }
}


// ------------------------------------------
// --- LÓGICA PRINCIPAL DE LA APLICACIÓN ---
// ------------------------------------------

// Inicialización de la aplicación
async function initApplication() {
    const appState = new AppState();
    
    try {
        // Inicializar Firebase
        const app = firebase.initializeApp(CONFIG.FIREBASE);
        const database = firebase.database();
        
        // Configurar detección de conectividad
        setupConnectivityMonitoring(appState);
        
        // Inicializar componentes
        // Línea 54 del código original
        initializeDataSync(appState, database); 
        await initializeMap(appState);
        
        // Carga inicial de datos
        // Línea 57 del código original
        await loadInitialData(appState, database); 
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error en inicialización:', error);
        // Propaga el error para que se pueda ver en la consola del navegador
        // Línea 62 del código original
        throw error;
    }
}

// Monitoreo de conectividad
function setupConnectivityMonitoring(appState) {
    const updateOnlineStatus = () => {
        appState.isOnline = navigator.onLine;
        const statusElement = document.getElementById('connectivityStatus');
        
        if (statusElement) {
            statusElement.textContent = appState.isOnline ? '🟢 En línea' : '🔴 Sin conexión';
            statusElement.style.background = appState.isOnline ? '#10b981' : '#ef4444';
        }
        
        if (appState.isOnline) {
            appState.syncRetries = 0; 
        }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Crear elemento de estado de conectividad (si no existe)
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

// Inicialización del mapa
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

        // Evento de clic optimizado
        appState.map.on('click', function(evt) {
            const feature = appState.map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
            if (feature) {
                const nodeData = feature.get('nodeData');
                if (nodeData) {
                    displayNodeInfo(nodeData, appState);
                    
                    // Mostrar panel en móvil
                    if (window.innerWidth <= 768) {
                        const sidebarInfo = document.getElementById('sidebar-info');
                        const sidebarNodes = document.getElementById('sidebar-nodes');
                        if (sidebarInfo) sidebarInfo.classList.add('is-open');
                        if (sidebarNodes) sidebarNodes.classList.remove('is-open');
                    }
                }
            }
        });

        // Remover estado de carga (asumiendo que hay un elemento o estilo '::before' que se quiere quitar)
        const mapElement = document.getElementById('map');
        if (mapElement) {
            // Esta línea es difícil de manejar desde JS vanilla, a menos que se use un DOM element real.
            // Para fines prácticos, se asume que una clase o estilo se eliminaría.
            mapElement.classList.remove('map-loading'); 
        }

        resolve();
    });
}

// Sincronización de datos
function initializeDataSync(appState, database) {
    // Sincronización periódica
    // Línea 162 del código original
    setInterval(() => {
        // Línea 164 del código original
        if (appState.isOnline) {
            fetchNodesFromFirebase(appState, database);
        }
    }, CONFIG.SYNC.INTERVAL);

    // Sincronización cuando vuelve la conexión
    window.addEventListener('online', () => {
        if (appState.isOnline) {
            fetchNodesFromFirebase(appState, database);
        }
    });
}

// Carga inicial de datos
async function loadInitialData(appState, database) {
    // 1. Cargar desde localStorage
    // Línea 179 del código original
    const localNodes = getNodesFromLocal();
    if (localNodes.length > 0) {
        appState.nodes = localNodes;
        updateUI(appState);
        console.log(`📁 Cargados ${localNodes.length} nodos desde caché local`);
    }

    // 2. Intentar sincronizar con Firebase
    if (appState.isOnline) {
        await fetchNodesFromFirebase(appState, database);
    }
}


// Exportar para uso global si es necesario
window.AppManager = {
    initApplication,
    CONFIG
};
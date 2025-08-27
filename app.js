const firebaseConfig = {
  apiKey: "AIzaSyByBawppJfWRPzFVgOhuxK_KWPGbTCjxkE",
  authDomain: "starnet-report-program.firebaseapp.com",
  databaseURL: "https://starnet-report-program-default-rtdb.firebaseio.com",
  projectId: "starnet-report-program",
  storageBucket: "starnet-report-program.firebasestorage.app",
  messagingSenderId: "837993869502",
  appId: "1:837993869502:web:eb183b3041378ea40aeeef"
};

// 1. Corrige la inicialización de Firebase
const app = firebase.initializeApp(firebaseConfig); // Usa el objeto firebase global
const database = firebase.database(); // Obtiene la referencia a la base de datos

function initApp(db) {  // Recibe la instancia de la base de datos
  // Referencias DOM
  const btns = {
    reportes: document.getElementById("btnReportes"),
    nodos: document.getElementById("btnNodos"),
    menu: document.getElementById("btnMenu"),
  };
  const sidebarTitle = document.getElementById("sidebarTitle");
  const sidebarContent = document.getElementById("sidebarContent");
  const nodeList = document.getElementById("nodeList");
  
  // Estado de la aplicación
  let allNodes = [];
  let activeSection = "Reportes";
  
  // Contenido estático
  const sidebarContents = {
    Reportes: {
      title: "Reportes",
      html: `<div class='sidebar-content'>
        <span>Aquí puedes ver y generar reportes del sistema.</span><br>
        <span>Selecciona un nodo para ver detalles específicos.</span>
      </div>`,
    },
    Nodos: {
      title: "Nodos",
      html: `<div class='sidebar-content'>
        <span>Listado de nodos registrados en el sistema.</span><br>
        <span>Haz clic en un nodo para ver más información.</span>
      </div>`,
    },
    Menu: {
      title: "Menú",
      html: `<div class='sidebar-content'>
        <span>Opciones del sistema:</span>
        <ul><li>Configuración</li><li>Ayuda</li><li>Salir</li></ul>
      </div>`,
      nodeList: `<button class='node-btn'><span class='node-title'>Configuración</span></button>
                 <button class='node-btn'><span class='node-title'>Ayuda</span></button>
                 <button class='node-btn'><span class='node-title'>Salir</span></button>`,
    },
  };

  // Clase CSS según estado del nodo
  function getNodeStatusClass(status) {
    const estados = {
      "active": "status-activo",
      "inactive": "status-inactivo",
      "maintenance": "status-mantenimiento"
    };
    return estados[status] || "";
  }

  // Renderiza lista de nodos
  function renderNodeList(nodes) {
    if (!nodes || nodes.length === 0) {
      nodeList.innerHTML = "<span class='node-info'>No hay nodos para mostrar.</span>";
      return;
    }
    
    nodeList.innerHTML = nodes.map(node => {
      const statusClass = getNodeStatusClass(node.status);
      return `<button class='node-btn ${statusClass}'>
                <span class='node-title'>${node.nodeId}</span>
                <span class='node-info'>Ubicación: ${node.location}</span>
                <span class='node-info'>Cajas: ${node.boxCount}/${node.capacity}</span>
                <span class='node-info'>Estado: ${node.status}</span>
              </button>`;
    }).join("");
  }

  // Actualiza sección activa
  function setActiveSection(sectionName) {
    activeSection = sectionName;
    
    // Actualiza botones
    Object.values(btns).forEach(btn => btn.classList.remove("active"));
    const btnKey = sectionName.toLowerCase();
    if (btns[btnKey]) btns[btnKey].classList.add("active");
    
    // Actualiza contenido
    const content = sidebarContents[sectionName];
    sidebarTitle.textContent = content.title;
    sidebarContent.innerHTML = content.html;
    
    // Para menú usa contenido estático, de lo contrario nodos de Firebase
    sectionName === "Menu" 
      ? nodeList.innerHTML = content.nodeList
      : renderNodeList(allNodes);
  }

  // 2. Corrige la referencia a la base de datos usando el parámetro
  const nodesRef = db.ref('central/fiberService/cabinets');
  nodesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    allNodes = data ? Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    })) : [];
    
    console.log("Nodos recibidos:", allNodes);
    setActiveSection(activeSection);  // Actualiza la vista con nuevos datos
  }, (error) => {
    console.error("Error leyendo datos:", error);
    nodeList.innerHTML = "<span class='node-info' style='color:red;'>Error en conexión con base de datos.</span>";
  });

  // 3. Corrige los manejadores de eventos
  btns.reportes.addEventListener('click', () => setActiveSection("Reportes"));
  btns.nodos.addEventListener('click', () => setActiveSection("Nodos"));
  btns.menu.addEventListener('click', () => setActiveSection("Menu"));

  // 4. Verifica si OpenLayers está cargado antes de crear el mapa
  if (window.ol) {
    const map = new ol.Map({
      target: "map",
      layers: [new ol.layer.Tile({ source: new ol.source.OSM() })],
      view: new ol.View({
        center: ol.proj.fromLonLat([-66.2442, 9.8606]), // Altagracia de Orituco
        zoom: 14,
      }),
    });
  } else {
    console.error("OpenLayers no está cargado");
  }

  // Inicializa vista
  setActiveSection("Reportes");
}

// 5. Inicializa la app con la base de datos
initApp(database);
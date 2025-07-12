// =================================================================
// 1. CONFIGURACIÓN DE FIREBASE
// REEMPLAZA ESTOS VALORES CON TUS PROPIAS CREDENCIALES
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyByBawppJfWRPzFVgOhuxK_KWPGbTCjxkE",
    authDomain: "starnet-report-program.firebaseapp.com",
    databaseURL: "https://starnet-report-program-default-rtdb.firebaseio.com", // ¡Importante! Asegúrate que sea la URL de Realtime Database
    projectId: "starnet-report-program",
    storageBucket: "starnet-report-program.firebasestorage.app",
    messagingSenderId: "837993869502",
    appId: "1:837993869502:web:eb183b3041378ea40aeeef",
  };
  
  // =================================================================
  // 2. INICIALIZACIÓN DE LA APP Y SERVICIOS
  // =================================================================
  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  
  // =================================================================
  // 3. REFERENCIAS A ELEMENTOS DEL DOM
  // =================================================================
  const btns = {
    reportes: document.getElementById("btnReportes"),
    nodos: document.getElementById("btnNodos"),
    menu: document.getElementById("btnMenu"),
  };
  const sidebarTitle = document.getElementById("sidebarTitle");
  const sidebarContent = document.getElementById("sidebarContent");
  const nodeList = document.getElementById("nodeList");
  
  // =================================================================
  // 4. ESTADO DE LA APLICACIÓN Y DATOS
  // =================================================================
  let allNodes = []; // Almacenará los nodos de Firebase
  let activeSection = "Reportes"; // Mantiene la sección activa
  
  // Contenido estático para las barras laterales
  const sidebarContents = {
    Reportes: {
      title: "Reportes",
      html: `<div class='sidebar-content'>
        <span style='color:#333;font-size:1.1em;'>Aquí puedes ver y generar reportes del sistema.</span><br>
        <span style='color:#333;font-size:1.1em;'>Selecciona un nodo para ver detalles específicos.</span>
      </div>`,
    },
    Nodos: {
      title: "Nodos",
      html: `<div class='sidebar-content'>
        <span style='color:#333;font-size:1.1em;'>Listado de nodos registrados en el sistema.</span><br>
        <span style='color:#333;font-size:1.1em;'>Haz clic en un nodo para ver más información.</span>
      </div>`,
    },
    Menu: {
      title: "Menú",
      html: `<div class='sidebar-content'>
        <span style='color:#333;font-size:1.1em;'>Opciones del sistema:</span>
        <ul style='margin:8px 0 0 16px;padding:0;'><li>Configuración</li><li>Ayuda</li><li>Salir</li></ul>
      </div>`,
      nodeList: `<button class='node-btn'><span class='node-title'>Configuración</span></button>
                 <button class='node-btn'><span class='node-title'>Ayuda</span></button>
                 <button class='node-btn'><span class='node-title'>Salir</span></button>`,
    },
  };
  
  // =================================================================
  // 5. LÓGICA DE RENDERIZADO Y MANIPULACIÓN DEL DOM
  // =================================================================
  
  /**
   * Devuelve la clase CSS correspondiente al estado del nodo.
   * @param {string} estado - El estado del nodo ("Activo", "Inactivo", "Mantenimiento").
   * @returns {string} - La clase CSS.
   */
  function getNodeStatusClass(estado) {
    switch (estado) {
      case "Activo":
        return "status-activo";
      case "Inactivo":
        return "status-inactivo";
      case "Mantenimiento":
        return "status-mantenimiento";
      default:
        return "";
    }
  }
  
  /**
   * Renderiza la lista de nodos en la barra lateral derecha.
   * @param {Array} nodesToRender - El array de nodos a mostrar.
   */
  function renderNodeList(nodesToRender) {
    if (!nodesToRender || nodesToRender.length === 0) {
      nodeList.innerHTML = "<span class='node-info'>No hay nodos para mostrar.</span>";
      return;
    }
    
    nodeList.innerHTML = nodesToRender
      .map(node => {
          const statusClass = getNodeStatusClass(node.Estado);
          return `<button class='node-btn ${statusClass}'>
                    <span class='node-title'>${node.ID_nodo}</span>
                    <span class='node-info'>Cajas: ${node.Cantidad_cajas} | Estado: ${node.Estado}</span>
                  </button>`;
      })
      .join("");
  }
  
  /**
   * Actualiza la interfaz para mostrar la sección seleccionada.
   * @param {string} sectionName - El nombre de la sección ("Reportes", "Nodos", "Menu").
   */
  function setActiveSection(sectionName) {
    activeSection = sectionName;
  
    // Actualizar clase 'active' en los botones de navegación
    Object.values(btns).forEach(btn => btn.classList.remove("active"));
    if (btns[sectionName.toLowerCase()]) {
      btns[sectionName.toLowerCase()].classList.add("active");
    }
  
    // Actualizar contenido de las barras laterales
    const content = sidebarContents[sectionName];
    sidebarTitle.textContent = content.title;
    sidebarContent.innerHTML = content.html;
  
    if (sectionName === "Menu") {
      nodeList.innerHTML = content.nodeList;
    } else {
      renderNodeList(allNodes); // Renderiza los nodos de Firebase para Reportes y Nodos
    }
  }
  
  // =================================================================
  // 6. LÓGICA DE FIREBASE Y EVENTOS
  // =================================================================
  
  // Escuchar cambios en la referencia 'nodos' de la base de datos
  const nodesRef = database.ref('nodos');
  nodesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    // Convertir el objeto de Firebase a un array de nodos
    allNodes = data ? Object.keys(data).map(key => ({ ID_nodo: key, ...data[key] })) : [];
    
    console.log("Datos recibidos de Firebase:", allNodes);
    
    // Volver a renderizar la sección activa con los datos actualizados
    setActiveSection(activeSection);
  }, (error) => {
    console.error("Error al leer datos de Firebase:", error);
    nodeList.innerHTML = "<span class='node-info' style='color:red;'>Error al conectar con la base de datos.</span>";
  });
  
  // Asignar eventos a los botones de navegación
  btns.reportes.onclick = () => setActiveSection("Reportes");
  btns.nodos.onclick = () => setActiveSection("Nodos");
  btns.menu.onclick = () => setActiveSection("Menu");
  
  // =================================================================
  // 7. INICIALIZACIÓN DEL MAPA (OpenLayers)
  // =================================================================
  document.addEventListener("DOMContentLoaded", function () {
    const map = new ol.Map({
      target: "map",
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM(),
        }),
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat([-66.2442, 9.8606]), // Altagracia de Orituco
        zoom: 14,
      }),
    });
  
    // Inicializa la vista con la sección de Reportes
    setActiveSection("Reportes");
  });
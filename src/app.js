// =================================================================
// 1. CONFIGURACIÓN DE FIREBASE DESDE JSON
// =================================================================
fetch('public/firebase.config.json')
  .then(response => response.json())
  .then(firebaseConfig => {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    // ...el resto de tu código JS aquí...
  })
  .catch(error => {
    console.error('Error cargando la configuración de Firebase:', error);
  });
// ...existing code...

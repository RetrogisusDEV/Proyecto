(function () {
  'use strict'; 

  // --- Constantes de Almacenamiento ---
  const STORAGE_KEY = 'app_users';
  const SESSION_KEY = 'app_current_user';
  const ATTEMPTS_KEY = 'app_login_attempts';
  const MAX_ATTEMPTS_LOCK = 5;
  const MAX_ATTEMPTS_BLOCK = 10;
  const LOCK_DURATION_MS = 10 * 1000; // 10 segundos de bloqueo temporal

  // --- Selectores DOM ---
  const qs = (selector) => document.querySelector(selector);
  const qsa = (selector) => document.querySelectorAll(selector);

  // --- Funciones de Utilidad (Almacenamiento) ---

  function loadUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error parseando usuarios en localStorage', e);
      return [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error guardando usuarios en localStorage', e);
    }
  }

  function loadAttempts() {
    try {
      const raw = localStorage.getItem(ATTEMPTS_KEY);
      return raw ? JSON.parse(raw) : { count: 0, lockUntil: null, blocked: false };
    } catch (e) {
      return { count: 0, lockUntil: null, blocked: false };
    }
  }

  function saveAttempts(obj) {
    try {
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error('Error guardando intentos en localStorage', e);
    }
  }

  function resetAttempts() { 
    saveAttempts({ count: 0, lockUntil: null, blocked: false }); 
  }

  // --- Funciones de Interfaz de Usuario (UI) ---

  function showMessage(text, type = 'info') {
    const el = qs('#message');
    el.textContent = text;
    // Remueve clases de mensaje existentes y añade la nueva
    el.className = 'message ' + (type === 'error' ? 'error' : (type === 'success' ? 'success' : ''));
  }

  function clearMessage() {
    const el = qs('#message');
    el.textContent = '';
    el.className = 'message';
  }

  /**
   * Muestra el formulario de login y oculta el de registro, o viceversa.
   * @param {boolean} showLogin - true para mostrar Login, false para mostrar Register.
   */
  function toggleForms(showLogin) {
    const loginForm = qs('#login-form');
    const registerForm = qs('#register-form');
    
    // Usamos la clase 'hidden' (definida en el HTML/CSS)
    loginForm.classList.toggle('hidden', !showLogin);
    registerForm.classList.toggle('hidden', showLogin);

    // Limpia mensajes y resetea campos al cambiar de formulario
    clearMessage();
    loginForm.reset();
    registerForm.reset();
  }

  function disableAuthControls(disabled) {
    const controls = qsa('.auth-form input, .auth-form button');
    controls.forEach(el => el.disabled = disabled);
  }

  // --- Lógica de Bloqueo de Intentos ---

  function updateLockState() {
    let a = loadAttempts();
    const now = Date.now();

    if (a.blocked) {
      disableAuthControls(true);
      showMessage('Acceso bloqueado permanentemente. Contacta al administrador.', 'error');
      return true;
    }
    
    if (a.lockUntil && now < a.lockUntil) {
      const secs = Math.ceil((a.lockUntil - now) / 1000);
      disableAuthControls(true);
      showMessage(`Demasiados intentos fallidos. Intenta de nuevo en ${secs} s.`, 'error');
      return true;
    }
    
    // Si el bloqueo temporal ha expirado
    if (a.lockUntil && now >= a.lockUntil) {
      a.lockUntil = null;
      a.count = 0; // Se resetea el contador tras el bloqueo temporal
      saveAttempts(a);
      clearMessage();
    }

    disableAuthControls(false);
    return false;
  }

  // --- Lógica de Registro (Handler) ---

  function registerUser(e) {
    e.preventDefault();
    
    const name = qs('#reg-name').value.trim();
    const password = qs('#reg-password').value;
    const confirm = qs('#reg-password-confirm').value;

    if (!name || !password || !confirm) {
      showMessage('Rellena todos los campos.', 'error');
      return;
    }
    if (password.length < 8) {
      showMessage('La contraseña debe tener al menos 8 caracteres.', 'error');
      return;
    }
    if (password !== confirm) {
      showMessage('Las contraseñas no coinciden.', 'error');
      return;
    }

    const users = loadUsers();
    const exists = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      showMessage('Ya existe una cuenta con ese usuario.', 'error');
      return;
    }

    // Nota: En una app real, la contraseña debe ser hasheada antes de guardarse.
    users.push({ name, password }); 
    saveUsers(users);

    showMessage('Registro correcto. Ya puedes iniciar sesión.', 'success');
    qs('#register-form').reset();
    
    setTimeout(() => {
      toggleForms(true); // Muestra login
    }, 2000);
  }

  // --- Lógica de Acceso (Handler) ---

  function loginUser(e) {
    e.preventDefault();
    if (updateLockState()) return; // Previene el login si está bloqueado

    const name = qs('#login-name').value.trim();
    const password = qs('#login-password').value;

    if (!name || !password) {
      showMessage('Rellena usuario y contraseña.', 'error');
      return;
    }

    const users = loadUsers();
    // Validación sencilla (nombre coincidente y contraseña exacta)
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
    
    if (!user) {
      let a = loadAttempts();
      a.count = (a.count || 0) + 1;

      if (a.count >= MAX_ATTEMPTS_BLOCK) {
        // Bloqueo permanente
        a.blocked = true;
        showMessage('Cuenta bloqueada tras demasiados intentos fallidos.', 'error');
      } else if (a.count >= MAX_ATTEMPTS_LOCK) {
        // Bloqueo temporal
        a.lockUntil = Date.now() + LOCK_DURATION_MS; 
        showMessage(`Límite de intentos alcanzado. Campos deshabilitados por ${LOCK_DURATION_MS / 1000} s.`, 'error');
      } else if (a.count === MAX_ATTEMPTS_LOCK - 2) {
        // Advertencia antes del bloqueo temporal
        showMessage(`Advertencia: quedan ${MAX_ATTEMPTS_LOCK - a.count} intentos antes de una restricción temporal.`, 'error');
      } else {
        showMessage('Credenciales incorrectas.', 'error');
      }

      saveAttempts(a);
      updateLockState(); // Refresca el estado de UI (deshabilita controles si aplica)
      return;
    }

    // --- Login Exitoso ---
    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name }));
    resetAttempts();
    showMessage('Inicio de sesión correcto. Redireccionando...', 'success');

    setTimeout(() => {
      // Redirección a la página de gestión o principal
      window.location.href = 'gestion.html';
    }, 700);
  }

  // --- Inicialización ---

  function initialize() {
    // 1. Asignar manejadores de envío de formularios
    qs('#register-form').addEventListener('submit', registerUser);
    qs('#login-form').addEventListener('submit', loginUser);

    // 2. Asignar manejadores para los enlaces de "toggle"
    qs('#show-register-link').addEventListener('click', (e) => {
      e.preventDefault();
      toggleForms(false); // Mostrar registro
    });
    qs('#show-login-link').addEventListener('click', (e) => {
      e.preventDefault();
      toggleForms(true); // Mostrar login
    });

    // 3. Establecer el estado inicial (Login visible)
    // El HTML ya lo establece con la clase 'hidden', pero esta llamada
    // asegura que el estado JS y de UI estén sincronizados, y limpia mensajes/campos.
    toggleForms(true); 

    // 4. Comprobar estado de bloqueo al cargar y actualizar UI
    updateLockState();

    // 5. Iniciar el "poller" para actualizar el contador de bloqueo cada segundo
    setInterval(updateLockState, 1000);
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();
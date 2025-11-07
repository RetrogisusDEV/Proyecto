(function () {
  const STORAGE_KEY = 'app_users';
  const SESSION_KEY = 'app_current_user';
  const ATTEMPTS_KEY = 'app_login_attempts';

  function qs(selector) { return document.querySelector(selector); }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Error parseando users en localStorage', e);
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

  function showMessage(text, type = 'info') {
    const el = qs('#message');
    el.textContent = text;
    el.className = 'message ' + (type === 'error' ? 'error' : (type === 'success' ? 'success' : ''));
  }

  function clearMessage() {
    const el = qs('#message');
    el.textContent = '';
    el.className = 'message';
  }

  function toggleForms(showLogin) {
    qs('#login-form').hidden = !showLogin;
    qs('#register-form').hidden = showLogin;
    clearMessage();
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

  function resetAttempts() { saveAttempts({ count: 0, lockUntil: null, blocked: false }); }

  function disableAuthControls(disabled) {
    Array.from(document.querySelectorAll('#login-form input, #login-form button')).forEach(i => i.disabled = disabled);
    Array.from(document.querySelectorAll('#register-form input, #register-form button')).forEach(i => i.disabled = disabled);
    const actions = document.querySelectorAll('.auth-actions button');
    actions.forEach(b => b.disabled = disabled);
  }

  function updateLockState() {
    const a = loadAttempts();
    const now = Date.now();
    const el = qs('#message');

    if (a.blocked) {
      disableAuthControls(true);
      showMessage('Cuenta bloqueada tras múltiples intentos. Contacta al administrador.', 'error');
      return true;
    }
    if (a.lockUntil && now < a.lockUntil) {
      const secs = Math.ceil((a.lockUntil - now) / 1000);
      disableAuthControls(true);
      showMessage(`Demasiados intentos. Intenta de nuevo en ${secs} s.`, 'error');
      return true;
    }
    if (a.lockUntil && now >= a.lockUntil) {
      a.lockUntil = null;
      saveAttempts(a);
      el.textContent = ''; 
    }

    disableAuthControls(false);
    return false;
  }

  function registerUser(e) {
    e.preventDefault();
    const name = qs('#reg-name').value.trim();
    const password = qs('#reg-password').value;
    const confirm = qs('#reg-password-confirm').value;

    if (!name || !password) {
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

    users.push({ name, password });
    saveUsers(users);

    showMessage('Registro correcto. Ya puedes iniciar sesión.', 'success');
    qs('#register-form').reset();
    // mostrar el login desde los botones de acción
    showLoginFromActions();
  }

  function loginUser(e) {
    e.preventDefault();
    // check lock state first
    if (updateLockState()) return;

    const name = qs('#login-name').value.trim();
    const password = qs('#login-password').value;

    if (!name || !password) {
      showMessage('Rellena usuario y contraseña.', 'error');
      return;
    }

    const users = loadUsers();
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
    if (!user) {
      // incrementar contador de intentos
      const a = loadAttempts();
      a.count = (a.count || 0) + 1;

      // advertencia al 3er intento (quedan 2 antes de la restricción temporal a 5)
      if (a.count === 3) {
        showMessage('Advertencia: quedan 2 intentos antes de una restricción temporal.', 'error');
      } else if (a.count === 5) {
        // iniciar bloqueo temporal de 10s
        a.lockUntil = Date.now() + 10 * 1000;
        showMessage('Se ha alcanzado límite de intentos. Campos deshabilitados 10 s.', 'error');
      } else if (a.count >= 10) {
        a.blocked = true;
        showMessage('Cuenta bloqueada tras demasiados intentos.', 'error');
      } else {
        showMessage('Credenciales incorrectas.', 'error');
      }

      saveAttempts(a);
      return;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: user.name }));
    resetAttempts();
    showMessage('Inicio de sesión correcto. Redireccionando...', 'success');

    setTimeout(() => {
      window.location.href = 'gestion.html';
    }, 700);
  }

  function showLoginFromActions() {
    const actions = qs('.auth-actions');
    if (actions) actions.hidden = true;
    toggleForms(true);
  }

  function showRegisterFromActions() {
    const actions = qs('.auth-actions');
    if (actions) actions.hidden = true;
    toggleForms(false);
  }

  function enableForm(formId) {
    const form = qs(`#${formId}`);
    Array.from(form.elements).forEach(el => el.disabled = false);
  }

  function disableForm(formId) {
    const form = qs(`#${formId}`);
    Array.from(form.elements).forEach(el => el.disabled = true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    qs('#register-form').addEventListener('submit', registerUser);
    qs('#login-form').addEventListener('submit', loginUser);

    toggleForms(false);
    disableForm('login-form');
    disableForm('register-form');

    const btnShowLogin = qs('#btn-show-login');
    const btnShowRegister = qs('#btn-show-register');
    if (btnShowLogin) {
      btnShowLogin.addEventListener('click', () => enableForm('login-form'));
    }
    if (btnShowRegister) {
      btnShowRegister.addEventListener('click', () => enableForm('register-form'));
    }

    const showLoginLink = qs('#show-login');
    const showRegisterLink = qs('#show-register');
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLoginFromActions(); });
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showRegisterFromActions(); });

    updateLockState();

    const intervalId = setInterval(() => {
      const a = loadAttempts();
      if (a.lockUntil && Date.now() < a.lockUntil) {
        updateLockState();
      } else if (a.lockUntil && Date.now() >= a.lockUntil) {
        updateLockState();
        clearInterval(intervalId); 
      }
    }, 1000);

    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      showMessage('Ya has iniciado sesión. Redireccionando...', 'success');
      setTimeout(() => { window.location.href = 'gestion.html'; }, 10);
    }
  });
})();

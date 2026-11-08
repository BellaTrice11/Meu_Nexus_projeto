// src/auth.js — lógica da página login.html
import { supabase } from './supabase.js';

const DASHBOARD_URL = './index.html';
const siteUrl = 'https://bellatrice11.github.io/Meu_Nexus_projeto/login.html';

const form = document.getElementById('nexus-auth-form');
const emailInput = document.getElementById('nexus-email');
const usernameInput = document.getElementById('nexus-username');
const passwordInput = document.getElementById('nexus-password');
const confirmInput = document.getElementById('nexus-confirm-password');

const usernameField = document.getElementById('nexus-username-field');
const passwordField = document.getElementById('nexus-password-field');
const confirmField = document.getElementById('nexus-confirm-field');

const submitButton = document.getElementById('nexus-submit');
const forgotButton = document.getElementById('nexus-forgot');
const switchButton = document.getElementById('nexus-switch');
const message = document.getElementById('nexus-auth-message');
const subtitle = document.getElementById('nexus-auth-subtitle');

let mode = 'login'; // login | register | forgot | reset
let recoveryEmail = '';

// Link de recuperação de senha: não pode redirecionar para o dashboard.
let recovering = location.hash.includes('type=recovery');

function goToDashboard() {
  location.replace(DASHBOARD_URL);
}

function friendlyError(error) {
  const text = (error && error.message) || '';
  if (/invalid login credentials/i.test(text)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(text)) return 'Confirme seu e-mail antes de entrar.';
  if (/user already registered/i.test(text)) return 'Este e-mail já está cadastrado.';
  if (/password should be at least/i.test(text)) return 'A senha é muito curta.';
  if (/rate limit|too many/i.test(text)) return 'Muitas tentativas. Aguarde um pouco.';
  return text || 'Erro desconhecido.';
}

function setMode(newMode) {
  mode = newMode;

  const registering = mode === 'register';
  const forgot = mode === 'forgot';
  const resetting = mode === 'reset';

  usernameField.hidden = !registering;
  confirmField.hidden = !(registering || resetting);
  passwordField.hidden = forgot;

  usernameInput.required = registering;
  confirmInput.required = registering || resetting;
  passwordInput.required = !forgot;

  passwordInput.autocomplete = registering || resetting
    ? 'new-password'
    : 'current-password';

  emailInput.disabled = false;
  emailInput.required = true;

  if (resetting) {
    subtitle.textContent = 'Crie sua nova senha';
    submitButton.textContent = 'SALVAR NOVA SENHA';
    forgotButton.hidden = true;
    switchButton.hidden = true;
    confirmInput.placeholder = 'Digite a nova senha novamente';
    if (recoveryEmail) emailInput.value = recoveryEmail;

  } else if (registering) {
    subtitle.textContent = 'Crie sua conta gamer';
    submitButton.textContent = 'CRIAR MINHA CONTA';
    forgotButton.hidden = true;
    switchButton.hidden = false;
    switchButton.textContent = 'Já tenho uma conta';
    confirmInput.placeholder = 'Digite a senha novamente';

  } else if (forgot) {
    subtitle.textContent = 'Vamos recuperar seu acesso';
    submitButton.textContent = 'ENVIAR LINK DE RECUPERAÇÃO';
    forgotButton.hidden = true;
    switchButton.hidden = false;
    switchButton.textContent = 'Voltar para o login';

  } else {
    subtitle.textContent = 'Entre no seu universo gamer';
    submitButton.textContent = 'ENTRAR NA NEXUS';
    forgotButton.hidden = false;
    switchButton.hidden = false;
    switchButton.textContent = 'Novo cadastro';
  }

  message.textContent = '';
}

switchButton.addEventListener('click', () => {
  setMode(mode === 'login' ? 'register' : 'login');
});

forgotButton.addEventListener('click', () => setMode('forgot'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const username = usernameInput.value.trim();
  const confirmation = confirmInput.value;

  submitButton.disabled = true;
  message.textContent = 'Aguarde, gamer...';

  try {
    if (mode === 'register') {
      if (password !== confirmation) {
        throw new Error('As senhas não são iguais.');
      }
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        throw new Error('O usuário deve ter de 3 a 20 letras, números ou _.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: siteUrl
        }
      });
      if (error) throw error;

      if (data.session) {
        goToDashboard();
        return;
      }
      message.textContent =
        'Cadastro iniciado! Confira seu e-mail e confirme sua conta antes de entrar.';

    } else if (mode === 'forgot') {
      recoveryEmail = email;

      const { error } = await supabase.auth.resetPasswordForEmail(
        recoveryEmail,
        { redirectTo: siteUrl }
      );
      if (error) throw error;

      message.textContent =
        'Se esse e-mail estiver cadastrado, você receberá um link de recuperação. Confira também o spam.';

    } else if (mode === 'reset') {
      if (password !== confirmation) {
        throw new Error('As senhas não são iguais.');
      }
      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Depois de redefinir, o usuário já está autenticado.
      recovering = false;
      goToDashboard();
      return;

    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      goToDashboard();
      return;
    }

  } catch (error) {
    message.textContent = 'Não foi possível concluir: ' + friendlyError(error);

  } finally {
    submitButton.disabled = false;
  }
});

// Link de recuperação do Supabase abre a tela de nova senha.
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    recovering = true;
    recoveryEmail = session?.user?.email || recoveryEmail;
    setMode('reset');
    if (recoveryEmail) emailInput.value = recoveryEmail;
    message.textContent = 'Link validado! Digite sua nova senha.';
  }
});

// Quem já está logado vai direto para o dashboard.
(async function checkSession() {
  if (recovering) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session && !recovering) goToDashboard();
})();
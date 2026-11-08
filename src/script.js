import { supabase } from './supabase.js';

/* ==========================================================================
   ESTADO LOCAL E TOAST
   ========================================================================== */
const toast = document.getElementById('toast');
let toastTimer;
const STORAGE_KEY = 'nexusGamingV2';
let appState = { posts: [], likes: {}, comments: {}, joined: {}, games: [] };
let nexusCurrentUser = null;

export function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// Vincula ao escopo global imediatamente
window.notify = notify;
window.likePost = likePost;
window.commentPost = commentPost;
window.sendComment = sendComment;
window.joinCommunity = joinCommunity;
window.showView = showView;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) appState = { ...appState, ...JSON.parse(saved) };
  } catch (error) {
    console.warn('Não foi possível carregar os dados salvos.', error);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (error) {
    notify('Não foi possível salvar os dados neste dispositivo.');
  }
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function getBaseLikes(post) {
  return Number(post.dataset.baseLikes || post.dataset.likes || 0);
}

/* ==========================================================================
   POSTS & INTERAÇÕES
   ========================================================================== */
export function likePost(button) {
  const post = button.closest('.post');
  if (!post) return;
  const id = post.dataset.postId;
  if (!id) return;

  appState.likes[id] = !appState.likes[id];
  const liked = appState.likes[id];
  const count = button.querySelector('span');

  button.classList.toggle('liked', liked);
  button.firstChild.textContent = liked ? '♥ Curtido ' : '♡ Curtir ';
  if (count) count.textContent = String(getBaseLikes(post) + (liked ? 1 : 0));
  post.dataset.likes = String(getBaseLikes(post) + (liked ? 1 : 0));
  saveState();
}

export function commentPost(button) {
  const post = button.closest('.post');
  if (!post) return;
  const area = post.querySelector('.comment-area');
  if (!area) return;
  
  area.hidden = !area.hidden;

  if (!area.hidden && !area.querySelector('.comment-input-row')) {
    area.innerHTML =
      '<div class="comment-input-row" style="display:flex;gap:8px;margin-top:12px">' +
      '<input aria-label="Escreva um comentário" placeholder="Escreva um comentário..." ' +
      'style="flex:1;min-width:0;background:#0d111e;border:1px solid #2a3148;border-radius:9px;color:white;padding:10px;font-size:16px">' +
      '<button class="primary-btn btn-send-comment" style="padding:8px 10px">Enviar</button>' +
      '</div><div class="comments-list"></div>';
    renderComments(post);
  }
}

function renderComments(post) {
  const list = post.querySelector('.comments-list');
  if (!list) return;
  list.replaceChildren();

  (appState.comments[post.dataset.postId] || []).forEach(comment => {
    const item = document.createElement('p');
    item.style.cssText =
      'font-size:12px;color:#cbd0e3;background:#0d111e;border-radius:8px;padding:10px;margin:8px 0 0;overflow-wrap:anywhere';
    item.textContent = 'Você: ' + comment;
    list.appendChild(item);
  });
}

export function sendComment(button) {
  const post = button.closest('.post');
  if (!post) return;
  const input = post.querySelector('.comment-input-row input');
  if (!input) return;
  const text = input.value.trim();

  if (!text) {
    notify('Escreva um comentário primeiro.');
    input.focus();
    return;
  }

  const id = post.dataset.postId;
  if (!appState.comments[id]) appState.comments[id] = [];
  appState.comments[id].push(text);

  saveState();
  renderComments(post);
  input.value = '';
}

export function joinCommunity(button) {
  const card = button.closest('[data-community]');
  const community = card ? card.dataset.community : button.textContent.trim();

  appState.joined[community] = !appState.joined[community];
  const joined = appState.joined[community];

  button.classList.toggle('joined', joined);
  button.textContent = joined ? '✓ Entrou' : '+ Entrar';
  saveState();
  notify(joined ? 'Você entrou nesta comunidade neste dispositivo!' : 'Você saiu da comunidade.');
}

function makePostElement(data) {
  const post = document.createElement('article');
  post.className = 'post';
  post.dataset.postId = data.id;
  post.dataset.baseLikes = String(data.likes || 0);
  post.dataset.likes = String((data.likes || 0) + (appState.likes[data.id] ? 1 : 0));
  post.dataset.search = (data.text || '').toLowerCase();

  const head = document.createElement('div');
  head.className = 'post-head';
  head.innerHTML =
    '<div class="post-avatar">JG</div><div><div class="post-user">Você ' +
    '<span class="badge">NOVO</span></div><div class="post-meta">Na comunidade gamer · ' +
    safeText(data.time || 'salvo') + '</div></div>';

  const copy = document.createElement('div');
  copy.className = 'post-copy';
  copy.textContent = data.text;

  const actions = document.createElement('div');
  actions.className = 'post-actions';
  actions.innerHTML =
    '<button class="action-btn btn-like">♡ Curtir <span>' + (data.likes || 0) + '</span></button>' +
    '<button class="action-btn btn-comment">▢ Comentar</button>' +
    '<button class="action-btn btn-share">↗ Compartilhar</button>';

  const area = document.createElement('div');
  area.className = 'comment-area';
  area.hidden = true;

  post.append(head, copy, actions, area);

  const likeButton = actions.querySelector('.btn-like');
  if (likeButton) {
    likeButton.dataset.baseLikes = String(data.likes || 0);
    if (appState.likes[data.id]) {
      likeButton.classList.add('liked');
      likeButton.firstChild.textContent = '♥ Curtido ';
      likeButton.querySelector('span').textContent = String((data.likes || 0) + 1);
    }
  }

  return post;
}

function publishPost(text, restoring = false) {
  const data = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    text,
    likes: 0,
    time: 'agora'
  };
  const feed = document.getElementById('feed');
  if (feed) feed.prepend(makePostElement(data));
  if (!restoring) {
    appState.posts.unshift(data);
    saveState();
  }
}

function restoreSavedPosts() {
  const feed = document.getElementById('feed');
  if (!feed) return;

  (appState.posts || []).slice().reverse()
    .forEach(data => feed.prepend(makePostElement(data)));

  document.querySelectorAll('#feed .post').forEach(post => {
    const id = post.dataset.postId;
    const base = getBaseLikes(post);
    post.dataset.baseLikes = String(base);
    post.dataset.likes = String(base + (appState.likes[id] ? 1 : 0));

    const likeButton = post.querySelector('.btn-like');
    if (likeButton) {
      likeButton.dataset.baseLikes = String(base);
      likeButton.classList.toggle('liked', !!appState.likes[id]);
      likeButton.firstChild.textContent = appState.likes[id] ? '♥ Curtido ' : '♡ Curtir ';
      likeButton.querySelector('span').textContent = String(base + (appState.likes[id] ? 1 : 0));
    }
    renderComments(post);
  });

  document.querySelectorAll('[data-community]').forEach(card => {
    const key = card.dataset.community;
    const button = card.querySelector('.join-btn');
    if (button && appState.joined[key]) {
      button.classList.add('joined');
      button.textContent = '✓ Entrou';
    }
  });

  updatePostStat();
}

function updatePostStat() {
  const stat = document.getElementById('postStat');
  if (stat) stat.textContent = String(320 + (appState.posts || []).length);
}

/* ==========================================================================
   NAVEGAÇÃO ENTRE TELAS
   ========================================================================== */
const viewInfo = {
  'Amigos': { icon: '♧', title: 'Meus amigos', text: 'Encontre jogadores, acompanhe quem está online e monte sua equipe.', cards: [['Jogadores online', 'Luna.exe está jogando Valorant.', 'Ver jogadores'], ['RafaCraft', 'Jogando Minecraft.', 'Convidar'], ['MikaGG', 'Jogando Fortnite.', 'Convidar']] },
  'Jogos': { icon: '🎮', title: 'Meus jogos', text: 'Sua biblioteca gamer para organizar os jogos que você curte.', cards: [['Minecraft', 'Construção, sobrevivência e criatividade.', 'Favorito'], ['The Legend of Zelda', 'Explore Hyrule e descubra segredos.', 'Favorito'], ['GTA Online', 'Corridas e aventuras com amigos.', 'Favorito']] },
  'Comunidades': { icon: '🌐', title: 'Explorar comunidades', text: 'Encontre sua galera e participe das conversas sobre seus jogos favoritos.', cards: [['⛏️ Minecraft Brasil', '12,4 mil membros · Construção e survival.', 'Entrar'], ['🗡️ Guerreiros de Hyrule', '8,2 mil membros · Zelda e aventura.', 'Entrar'], ['🚗 GTA V Brasil', '21,8 mil membros · Corridas e missões.', 'Entrar']] },
  'Mensagens': { icon: '✉', title: 'Mensagens', text: 'Sua central de conversas com outros jogadores.', cards: [['Luna.exe', 'Última atividade: jogando Valorant.', 'Abrir conversa'], ['RafaCraft', 'Última atividade: jogando Minecraft.', 'Abrir conversa']] },
  'Conquistas': { icon: '🏆', title: 'Minhas conquistas', text: 'Acompanhe seu progresso e celebre suas vitórias gamer.', cards: [['Primeiro passo', 'Você começou sua jornada no NEXUS.', 'Conquista inicial'], ['Criador de conteúdo', 'Publique sua primeira mensagem.', 'Continue jogando'], ['Espírito de equipe', 'Entre em uma comunidade gamer.', 'Jogue junto']] },
  'Perfil': { icon: '👤', title: 'Meu perfil gamer', text: 'Personalize sua identidade gamer.', cards: [] }
};

export function showView(view) {
  const main = document.getElementById('mainContent');
  const welcome = document.getElementById('welcome');
  const feedHead = document.getElementById('feedHead');
  const composer = document.getElementById('composer');
  const feed = document.getElementById('feed');
  const right = document.getElementById('rightCol');
  const homeProfileCard = document.getElementById('homeProfileCard');

  if (!main) return;

  document.querySelectorAll('[data-view]').forEach(button =>
    button.classList.toggle('active', button.dataset.view === view)
  );

  document.querySelectorAll('.extra-view').forEach(node => node.remove());

  if (view === 'Início') {
    if (homeProfileCard) homeProfileCard.hidden = false;
    window.dispatchEvent(new Event('nexus:show-home'));

    if (welcome) welcome.hidden = false;
    if (feedHead) feedHead.hidden = false;
    if (composer) composer.hidden = false;
    if (feed) feed.hidden = false;
    if (right) right.hidden = false;

    const feedTitle = document.getElementById('feedTitle');
    if (feedTitle) feedTitle.textContent = 'Feed da comunidade';
    document.querySelectorAll('#feed .post').forEach(post => post.style.display = '');
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    main.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (homeProfileCard) homeProfileCard.hidden = true;
  if (welcome) welcome.hidden = true;
  if (right) right.hidden = true;

  const info = viewInfo[view];
  if (!info) return;

  if (view === 'Perfil') {
    if (feedHead) feedHead.hidden = false;
    if (composer) composer.hidden = false;
    if (feed) feed.hidden = false;

    const page = document.createElement('section');
    page.className = 'extra-view nexus-profile';

    const template = document.getElementById('profile-template');
    if (template) {
      page.append(template.content.cloneNode(true));
      main.insertBefore(page, feedHead);
      window.dispatchEvent(new CustomEvent('nexus:open-profile', { detail: { page } }));
    }

    main.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (feedHead) feedHead.hidden = true;
  if (composer) composer.hidden = true;
  if (feed) feed.hidden = true;

  const page = document.createElement('section');
  page.className = 'extra-view';

  const icon = document.createElement('div');
  icon.className = 'view-icon';
  icon.textContent = info.icon;

  const title = document.createElement('h2');
  title.textContent = info.title;

  const description = document.createElement('p');
  description.textContent = info.text;

  const cards = document.createElement('div');
  cards.className = 'view-list';

  info.cards.forEach(item => {
    const card = document.createElement('div');
    card.className = 'view-card';

    const heading = document.createElement('strong');
    heading.textContent = item[0];

    const detail = document.createElement('span');
    detail.textContent = item[1];

    const action = document.createElement('button');
    action.className = 'primary-btn';
    action.textContent = item[2];
    action.style.fontSize = '10px';
    action.style.padding = '8px 10px';

    action.addEventListener('click', () => {
      if (view === 'Comunidades') {
        const key = item[0].replace(/^[^\wÀ-ÿ]+\s*/, '');
        appState.joined[key] = !appState.joined[key];
        saveState();
        action.textContent = appState.joined[key] ? '✓ Entrou' : 'Entrar';
        notify(appState.joined[key] ? 'Você entrou na comunidade!' : 'Você saiu da comunidade.');

      } else if (view === 'Jogos' && item[2] === 'Favorito') {
        if (!appState.games.includes(item[0])) appState.games.push(item[0]);
        else appState.games = appState.games.filter(game => game !== item[0]);
        saveState();
        action.textContent = appState.games.includes(item[0]) ? '★ Favoritado' : 'Favorito';
        notify(appState.games.includes(item[0]) ? 'Jogo adicionado aos favoritos!' : 'Jogo removido dos favoritos.');
      } else {
        notify('Esta função será conectada em uma próxima etapa.');
      }
    });

    if (view === 'Comunidades' && appState.joined[item[0].replace(/^[^\wÀ-ÿ]+\s*/, '')]) {
      action.textContent = '✓ Entrou';
    }
    if (view === 'Jogos' && appState.games.includes(item[0])) {
      action.textContent = '★ Favoritado';
    }

    card.append(heading, detail, action);
    cards.appendChild(card);
  });

  page.append(icon, title, description, cards);
  main.appendChild(page);
  main.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   DELEGAÇÃO DE EVENTOS DE CLIQUE (RESOLVE BOTÕES DE LOGOUT E FEED)
   ========================================================================== */
document.addEventListener('click', async (event) => {
  const target = event.target;

  // Botão de Logout
  const logoutBtn = target.closest('#logout-btn');
  if (logoutBtn) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    location.replace('./login.html');
    return;
  }

  // Navegação [data-view]
  const viewBtn = target.closest('[data-view]');
  if (viewBtn) {
    showView(viewBtn.dataset.view);
    return;
  }

  // Atalhos [data-go]
  const goBtn = target.closest('[data-go]');
  if (goBtn) {
    showView(goBtn.dataset.go);
    return;
  }

  // Curtir post
  const likeBtn = target.closest('.btn-like');
  if (likeBtn) {
    likePost(likeBtn);
    return;
  }

  // Comentar post
  const commentBtn = target.closest('.btn-comment');
  if (commentBtn) {
    commentPost(commentBtn);
    return;
  }

  // Enviar comentário
  const sendCommentBtn = target.closest('.btn-send-comment');
  if (sendCommentBtn) {
    sendComment(sendCommentBtn);
    return;
  }

  // Entrar em Comunidade
  const joinBtn = target.closest('.join-btn');
  if (joinBtn) {
    joinCommunity(joinBtn);
    return;
  }

  // Compartilhar e menus
  const shareBtn = target.closest('.btn-share');
  if (shareBtn) {
    notify('Compartilhamento online estará disponível quando criarmos as contas.');
    return;
  }

  const menuBtn = target.closest('.post-menu');
  if (menuBtn) {
    notify('Mais opções estarão disponíveis em breve.');
    return;
  }
});

/* ==========================================================================
   INICIALIZAÇÃO DO DOM E AUTENTICAÇÃO
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !currentSession) {
      location.replace('./login.html');
      return;
    }

    const appElement = document.getElementById('app');
    if (appElement) appElement.hidden = false;

    loadState();
    restoreSavedPosts();
    updateHomeProfile();

  } catch (err) {
    console.error('Erro na inicialização:', err);
    location.replace('./login.html');
  }
});

/* Outros ouvintes estáticos */
document.getElementById('notify-btn')?.addEventListener('click', () => notify('Suas notificações aparecerão aqui!'));
document.getElementById('btn-attach-img')?.addEventListener('click', () => notify('O envio de imagens será adicionado na próxima etapa.'));
document.getElementById('btn-tag-game')?.addEventListener('click', () => notify('A marcação de jogos será adicionada em breve.'));

document.getElementById('publishBtn')?.addEventListener('click', () => {
  const input = document.getElementById('composerText');
  if (!input) return;
  const value = input.value.trim();

  if (!value) {
    notify('Escreva algo antes de publicar.');
    input.focus();
    return;
  }

  publishPost(value);
  input.value = '';
  updatePostStat();
  notify('Publicação salva neste dispositivo!');
});

document.getElementById('searchInput')?.addEventListener('input', event => {
  const query = event.target.value.toLowerCase().trim();
  document.querySelectorAll('#feed .post').forEach(post => {
    const text = (post.innerText + ' ' + (post.dataset.search || '')).toLowerCase();
    post.style.display = text.includes(query) ? '' : 'none';
  });
});

document.getElementById('feedSort')?.addEventListener('change', event => {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const posts = [...feed.querySelectorAll('.post')];

  if (event.target.value === 'popular') {
    posts.sort((a, b) => Number(b.dataset.likes || 0) - Number(a.dataset.likes || 0));
  } else {
    posts.sort((a, b) => {
      const aNew = a.dataset.postId.startsWith('p_') ? 1 : 0;
      const bNew = b.dataset.postId.startsWith('p_') ? 1 : 0;
      return bNew - aNew;
    });
  }
  posts.forEach(post => feed.appendChild(post));
});

document.getElementById('invite-friends')?.addEventListener('click', () => {
  const linkDownload = 'https://github.com/BellaTrice11/Meu_Nexus_projeto/releases/tag/dev';
  const mensagem =
    '🎮🔥 VOCÊ FOI CONVIDADO PARA O NEXUS GAMING V2! 🔥🎮\n\n' +
    'Fala, gamer! 💜 Bora fazer parte da nossa comunidade gamer?\n\n' +
    '🚀 Baixe e instale o NEXUS GAMING V2 pelo link abaixo:\n\n' +
    linkDownload + '\n\n' +
    'Chame seus amigos e bora jogar juntos! 🕹️💜\n\n' +
    'NEXUS GAMING V2 — Nossa comunidade, nossa diversão!';

  window.open('https://wa.me/?text=' + encodeURIComponent(mensagem), '_blank', 'noopener');
});

supabase.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT') location.replace('./login.html');
});

/* ==========================================================================
   PERFIL (Supabase)
   ========================================================================== */
async function loadNexusProfile() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = session?.user;
  if (!user) return null;

  nexusCurrentUser = user;

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Gamer';

  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: user.id, username, status: 'online' })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: again, error: againError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (againError) throw againError;
      return again;
    }
    throw error;
  }

  return data;
}

async function updateHomeProfile() {
  try {
    const profile = await loadNexusProfile();
    if (!profile) return;

    const name = document.getElementById('homeProfileName');
    const status = document.getElementById('homeProfileStatus');
    const photo = document.getElementById('homeProfilePhoto');
    const photoCard = document.getElementById('homeProfilePhotoCard');
    const nameCard = document.getElementById('homeProfileNameCard');
    const cover = document.getElementById('homeProfileCover');

    if (name) name.textContent = profile.username || 'Gamer';
    if (nameCard) nameCard.textContent = profile.username || 'Gamer';

    const statuses = { online: '🟢 Online', away: '🌙 Ausente', offline: '⚫ Offline' };
    if (status) status.textContent = statuses[profile.status] || '🟢 Online';

    if (profile.avatar_url) {
      if (photo) { photo.src = profile.avatar_url; photo.hidden = false; }
      if (photoCard) { photoCard.src = profile.avatar_url; photoCard.hidden = false; }
    }

    if (cover && profile.cover_url && profile.profile_theme === 'custom') {
      cover.src = profile.cover_url;
      cover.style.display = 'block';
    } else if (cover) {
      cover.style.display = 'none';
    }

  } catch (error) {
    console.error('Erro ao atualizar perfil na Home:', error);
  }
}

window.addEventListener('nexus:show-home', updateHomeProfile);

function extensionFrom(file) {
  const type = (file.type.split('/')[1] || 'png').toLowerCase();
  if (type === 'jpeg') return 'jpg';
  if (type === 'svg+xml') return 'svg';
  return type.replace(/[^a-z0-9]/g, '') || 'png';
}

window.addEventListener('nexus:open-profile', async (event) => {
  const page = event.detail.page;

  const photo = page.querySelector('#profile-photo');
  const photoInput = page.querySelector('#profile-photo-input');
  const photoLabel = page.querySelector('label[for="profile-photo-input"]');
  const editButton = page.querySelector('#profile-edit-button');
  const cover = page.querySelector('#profile-cover-image');
  const coverInput = page.querySelector('#profile-cover-input');
  const profileCard = page.querySelector('.nexus-profile-card');
  const customization = page.querySelector('.profile-customization');

  const nameInput = page.querySelector('#profile-name-input');
  const statusSelect = page.querySelector('#profile-status-select');
  const themeSelect = page.querySelector('#profile-theme-select');

  const gamerName = page.querySelector('#profile-gamer-name');
  const statusText = page.querySelector('#profile-status');
  const saveButton = page.querySelector('#profile-save-button');
  const message = page.querySelector('#profile-message');

  try {
    const profile = await loadNexusProfile();
    if (!profile) throw new Error('Usuário não encontrado.');

    if (customization) customization.hidden = true;
    if (photoLabel) photoLabel.hidden = true;
    if (photo) photo.hidden = !profile.avatar_url;

    function openProfileEditor() {
      if (customization) customization.hidden = false;
      if (photoLabel) photoLabel.hidden = false;
    }

    if (editButton) editButton.addEventListener('click', openProfileEditor);
    if (photo) {
      photo.addEventListener('click', openProfileEditor);
      photo.style.cursor = 'pointer';
    }

    if (nameInput) nameInput.value = profile.username || '';
    if (gamerName) gamerName.textContent = profile.username || 'Gamer';
    if (statusSelect) statusSelect.value = profile.status || 'online';
    if (themeSelect) themeSelect.value = profile.profile_theme || 'galaxy';

    if (profile.avatar_url && photo) photo.src = profile.avatar_url;
    if (profile.cover_url && cover) cover.src = profile.cover_url;

    function updateTheme() {
      if (!themeSelect || !profileCard) return;
      const theme = themeSelect.value;
      profileCard.dataset.theme = theme;

      const colors = { galaxy: '#9b6cff', technology: '#00d9ff', custom: '#c084fc' };
      profileCard.style.setProperty('--profile-glow', colors[theme] || colors.galaxy);

      if (cover) cover.style.display = theme === 'custom' && profile.cover_url ? 'block' : 'none';
    }

    function updateStatusText() {
      if (!statusSelect || !statusText) return;
      const labels = { online: '🟢 Online', away: '🌙 Ausente', offline: '⚫ Offline' };
      statusText.textContent = labels[statusSelect.value];
    }

    updateTheme();
    updateStatusText();

    if (themeSelect) {
      themeSelect.addEventListener('change', () => {
        updateTheme();
        if (themeSelect.value === 'custom' && !profile.cover_url && coverInput) {
          coverInput.click();
        }
      });
    }

    if (statusSelect) statusSelect.addEventListener('change', updateStatusText);

    if (coverInput) {
      coverInput.addEventListener('change', async () => {
        const file = coverInput.files[0];
        if (!file || !nexusCurrentUser) return;

        if (!file.type.startsWith('image/')) {
          if (message) message.textContent = 'Escolha um arquivo de imagem.';
          coverInput.value = '';
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          if (message) message.textContent = 'A capa deve ter no máximo 5 MB.';
          coverInput.value = '';
          return;
        }

        if (message) message.textContent = 'Enviando sua capa...';

        try {
          const filePath = `${nexusCurrentUser.id}/cover-${Date.now()}.${extensionFrom(file)}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: false, contentType: file.type });
          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          const coverUrl = publicData.publicUrl;

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ cover_url: coverUrl, profile_theme: 'custom', updated_at: new Date().toISOString() })
            .eq('id', nexusCurrentUser.id);

          if (updateError) throw updateError;

          profile.cover_url = coverUrl;
          if (cover) cover.src = coverUrl;
          if (themeSelect) themeSelect.value = 'custom';
          updateTheme();

          if (message) message.textContent = 'Sua capa foi salva! 💜';
        } catch (error) {
          if (message) message.textContent = 'Erro ao enviar capa: ' + error.message;
        } finally {
          coverInput.value = '';
        }
      });
    }

    if (photoInput) {
      photoInput.addEventListener('change', async () => {
        const file = photoInput.files[0];
        if (!file || !nexusCurrentUser) return;

        if (!file.type.startsWith('image/')) {
          if (message) message.textContent = 'Escolha um arquivo de imagem.';
          photoInput.value = '';
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          if (message) message.textContent = 'A imagem deve ter no máximo 5 MB.';
          photoInput.value = '';
          return;
        }

        const previousPhoto = photo.src;
        const previousHidden = photo.hidden;
        const previewUrl = URL.createObjectURL(file);
        photo.src = previewUrl;
        photo.hidden = false;
        if (message) message.textContent = 'Enviando sua foto...';

        try {
          const filePath = `${nexusCurrentUser.id}/${Date.now()}.${extensionFrom(file)}`;
          const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: false, contentType: file.type });
          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          const avatarUrl = publicData.publicUrl;

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
            .eq('id', nexusCurrentUser.id);

          if (updateError) throw updateError;

          profile.avatar_url = avatarUrl;
          photo.src = avatarUrl;
          if (message) message.textContent = 'Foto atualizada com sucesso! 💜';
        } catch (error) {
          photo.src = previousPhoto;
          photo.hidden = previousHidden;
          if (message) message.textContent = 'Erro ao enviar foto: ' + error.message;
        } finally {
          URL.revokeObjectURL(previewUrl);
          photoInput.value = '';
        }
      });
    }

    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        const username = nameInput.value.trim();

        if (!username) {
          if (message) message.textContent = 'Digite seu nome gamer.';
          return;
        }

        if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
          if (message) message.textContent = 'Use de 3 a 20 letras, números ou _ (sem espaços).';
          return;
        }

        saveButton.disabled = true;
        if (message) message.textContent = 'Salvando alterações...';

        try {
          const { error } = await supabase
            .from('profiles')
            .update({
              username,
              status: statusSelect.value,
              profile_theme: themeSelect.value,
              updated_at: new Date().toISOString()
            })
            .eq('id', nexusCurrentUser.id);

          if (error) throw error;

          if (gamerName) gamerName.textContent = username;
          updateStatusText();
          updateTheme();

          if (message) message.textContent = 'Perfil atualizado com sucesso! 🎮';
          showView('Início');
        } catch (error) {
          if (message) message.textContent = 'Erro ao salvar: ' + error.message;
        } finally {
          saveButton.disabled = false;
        }
      });
    }

  } catch (error) {
    if (message) message.textContent = 'Erro ao carregar perfil: ' + error.message;
    console.error(error);
  }
});
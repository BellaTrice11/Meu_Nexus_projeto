export function initFriendsModal(supabase, notify) {
  const modalOverlay = document.getElementById('friendModalOverlay');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const searchResults = document.getElementById('searchResults');
  const requestsArea = document.getElementById('requestsArea');
  const friendsArea = document.getElementById('friendsArea');
  const sentArea = document.getElementById('sentArea');
  const resultsCount = document.getElementById('resultsCount');

  if (!modalOverlay) return;

  // Funções para controlar a abertura e fechamento da janela flutuante
  window.openFriendsModal = async () => {
    modalOverlay.style.display = 'flex';
    await loadData();
  };

  window.closeFriendsModal = () => {
    modalOverlay.style.display = 'none';
  };

  // Evento do botão de fechar (X)
  closeModalBtn.addEventListener('click', window.closeFriendsModal);

  // Fechar clicando fora da janela (no fundo escuro)
  modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
      window.closeFriendsModal();
    }
  });

 

  // Validação de Sessão do Usuário
  async function getCurrentUser() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      notify('Faça login para acessar seus amigos.');
      return null;
    }
    return authData.user;
  }

  function createMessage(message) {
    const p = document.createElement('p');
    p.textContent = message;
    p.style.color = 'var(--text-muted, #94a3b8)';
    p.style.gridColumn = '1 / -1';
    p.style.textAlign = 'center';
    p.style.padding = '1rem 0';
    return p;
  }

  function createPlayerCard(
  username,
  status,
  buttonText,
  action,
  buttonStyleClass = '',
  avatarUrl = null
) {
  const card = document.createElement('div');
  card.className = 'player-card';

  const initial = username
    ? username.charAt(0).toUpperCase()
    : '?';

  const isOnline = status === 'online';

  const statusDisplay = (status === 'online' || status === 'offline')
    ? (isOnline ? '● Online' : '○ Offline')
    : status;

  const avatarWrapper = document.createElement('div');
  avatarWrapper.className = 'avatar-wrapper';

 const avatar = document.createElement('div');
avatar.className = 'avatar-placeholder';

if (avatarUrl) {
  const img = document.createElement('img');
  img.src = avatarUrl;
  img.alt = `Foto de ${username}`;
  img.className = 'player-avatar';

  img.onerror = () => {
    img.remove();
    avatar.textContent = initial;
  };

  avatar.appendChild(img);
} else {
  avatar.textContent = initial;
}

const statusDot = document.createElement('span');
statusDot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
  avatarWrapper.append(avatar, statusDot);

  const playerInfo = document.createElement('div');
  playerInfo.className = 'player-info';

  const name = document.createElement('h3');
  name.textContent = username || 'Jogador';

  const statusText = document.createElement('p');
  statusText.className = 'player-status-text';
  statusText.textContent = statusDisplay;

  playerInfo.append(name, statusText);

  const button = document.createElement('button');
  button.className = `btn-action ${buttonStyleClass}`;
  button.textContent = buttonText;

  button.addEventListener('click', action);

  card.append(avatarWrapper, playerInfo, button);

  return card;
}

  async function getProfiles(ids) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (!uniqueIds.length) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, status, avatar_url')
      .in('id', uniqueIds);

    if (error) {
      console.error('Erro ao buscar perfis:', error);
      return {};
    }

    return Object.fromEntries((data || []).map(profile => [profile.id, profile]));
  }

  async function loadData() {
    const user = await getCurrentUser();
    if (!user) return;

    requestsArea.innerHTML = '';
    friendsArea.innerHTML = '';
    sentArea.innerHTML = '';

    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (error) {
      console.error(error);
      notify('Não foi possível carregar seus amigos.');
      return;
    }

   // Identifica amizades já aceitas
const acceptedPairs = new Set(
  (requests || [])
    .filter(item => item.status === 'accepted')
    .map(item => [item.sender_id, item.receiver_id].sort().join('_'))
);

// Solicitações recebidas
const received = (requests || []).filter(item => {
  const pair = [item.sender_id, item.receiver_id].sort().join('_');

  return (
    item.receiver_id === user.id &&
    item.status === 'pending' &&
    !acceptedPairs.has(pair)
  );
});

// Solicitações enviadas
const sent = (requests || []).filter(item => {
  const pair = [item.sender_id, item.receiver_id].sort().join('_');

  return (
    item.sender_id === user.id &&
    item.status === 'pending' &&
    !acceptedPairs.has(pair)
  );
});

// Amizades aceitas sem duplicação
const accepted = [];
const addedFriends = new Set();

for (const item of (requests || [])) {
  if (item.status !== 'accepted') continue;

  const otherId = item.sender_id === user.id
    ? item.receiver_id
    : item.sender_id;

  if (addedFriends.has(otherId)) continue;

  addedFriends.add(otherId);
  accepted.push(item);
}

    const otherIds = (requests || []).map(item =>
      item.sender_id === user.id ? item.receiver_id : item.sender_id
    );

    const profiles = await getProfiles(otherIds);

    // Renderizar Solicitações Recebidas
    if (!received.length) {
      requestsArea.append(createMessage('Nenhuma solicitação pendente.'));
    } else {
      for (const request of received) {
        const profile = profiles[request.sender_id];
        requestsArea.append(
          createPlayerCard(
            profile?.username || 'Jogador',
            'Quer adicionar você.',
            'Aceitar',
            async () => {
              const { error } = await supabase
                .from('friend_requests')
                .update({ status: 'accepted' })
                .eq('id', request.id);

              if (error) {
                notify('Não foi possível aceitar.');
                return;
              }
              notify('Amizade aceita! ❤️');
              loadData();
            },
            'accepted'
          )
        );
      }
    }

   // Renderizar Meus Amigos
if (!accepted.length) {
  friendsArea.append(createMessage('Você ainda não tem amigos adicionados.'));
} else {
  for (const friendship of accepted) {
    const otherId = friendship.sender_id === user.id
      ? friendship.receiver_id
      : friendship.sender_id;

    const profile = profiles[otherId];

    friendsArea.append(
      createPlayerCard(
        profile?.username || 'Jogador',
        profile?.status || 'Membro do NEXUS',
        'Remover',
        async () => {
          if (!confirm('Deseja remover este amigo?')) return;

          const { error } = await supabase
            .from('friend_requests')
            .delete()
            .eq('id', friendship.id);

          if (error) {
            notify('Não foi possível remover.');
            return;
          }

          notify('Amigo removido.');
          loadData();
        },
        '',
        profile?.avatar_url
      )
    );
  }
}

    
    // Renderizar Solicitações Enviadas
    if (!sent.length) {
      sentArea.append(createMessage('Nenhuma solicitação enviada.'));
    } else {
      for (const request of sent) {
        const profile = profiles[request.receiver_id];

        sentArea.append(
          createPlayerCard(
            profile?.username || 'Jogador',
            'Aguardando resposta...',
            'Cancelar',
            async () => {
              const confirmed = confirm(
                'Deseja realmente cancelar esta solicitação?'
              );

              if (!confirmed) return;

              const { error } = await supabase
                .from('friend_requests')
                .delete()
                .eq('id', request.id)
                .eq('sender_id', user.id)
                .eq('status', 'pending');

              if (error) {
                console.error('Erro ao cancelar solicitação:', error);
                notify('Não foi possível cancelar a solicitação.');
                return;
              }

              notify('Solicitação cancelada! ❤️');

              await loadData();
            },
            'pending',
            profile?.avatar_url
          )
        );
      }
    }


  async function searchPlayers() {
    const user = await getCurrentUser();
    if (!user) return;

    const term = searchInput.value.trim();
    searchResults.innerHTML = '';

    if (term.length < 2) {
      searchResults.append(createMessage('Digite pelo menos 2 letras.'));
      resultsCount.textContent = '0 encontrados';
      return;
    }

    const { data: players, error } = await supabase
      .from('profiles')
      .select('id, username, status')
      .ilike('username', `%${term}%`)
      .neq('id', user.id)
      .limit(20);

    if (error || !players?.length) {
      searchResults.append(createMessage('Nenhum jogador encontrado.'));
      resultsCount.textContent = '0 encontrados';
      return;
    }

    resultsCount.textContent = `${players.length} encontrados`;

    const { data: existingRequests } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

   for (const player of players) {
     const existing = (existingRequests || []).find(request =>
       (request.sender_id === user.id && request.receiver_id === player.id) ||
       (request.sender_id === player.id && request.receiver_id === user.id)
     );

      let buttonText = 'Adicionar';
      let buttonStyleClass = '';
      let action = async () => {
        const { error } = await supabase
          .from('friend_requests')
          .insert({ sender_id: user.id, receiver_id: player.id, status: 'pending' });

        if (error) {
          notify('Erro ao enviar solicitação.');
          return;
        }

        notify('Solicitação enviada! 🎮');
        searchPlayers();
        loadData();
      };

      if (existing?.status === 'accepted') {
        buttonText = 'Já são amigos';
        buttonStyleClass = 'accepted';
        action = () => notify('Vocês já são amigos!');
      } else if (existing?.sender_id === user.id) {
        buttonText = 'Solicitação enviada';
        buttonStyleClass = 'pending';
        action = () => notify('Você já enviou uma solicitação.');
      } else if (existing?.receiver_id === user.id) {
        buttonText = 'Solicitação recebida';
        buttonStyleClass = 'pending';
        action = () => notify('Confira suas solicitações recebidas.');
      }

      searchResults.append(
        createPlayerCard(player.username, player.status, buttonText, action, buttonStyleClass)
      );
    }
  }

  searchButton.addEventListener('click', searchPlayers);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchPlayers();
  });
}
}
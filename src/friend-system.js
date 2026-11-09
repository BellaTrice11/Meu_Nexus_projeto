export async function renderFriendsView(container, supabase, notify) {
  container.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = 'Meus amigos';

  const description = document.createElement('p');
  description.textContent = 'Encontre jogadores e monte sua equipe no NEXUS!';

  const searchArea = document.createElement('div');
  searchArea.className = 'friend-search';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Digite o nome de um jogador...';

  const searchButton = document.createElement('button');
  searchButton.textContent = 'Buscar';

  const searchResults = document.createElement('div');

  const requestsTitle = document.createElement('h3');
  requestsTitle.textContent = 'Solicitações recebidas';

  const requestsArea = document.createElement('div');

  const friendsTitle = document.createElement('h3');
  friendsTitle.textContent = 'Meus amigos';

  const friendsArea = document.createElement('div');

  const sentTitle = document.createElement('h3');
  sentTitle.textContent = 'Solicitações enviadas';

  const sentArea = document.createElement('div');

  searchArea.append(searchInput, searchButton);

  container.append(
    title,
    description,
    searchArea,
    searchResults,
    requestsTitle,
    requestsArea,
    friendsTitle,
    friendsArea,
    sentTitle,
    sentArea
  );

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    notify('Faça login para acessar seus amigos.');
    return;
  }

  const user = authData.user;

  function createMessage(message) {
    const p = document.createElement('p');
    p.textContent = message;
    return p;
  }

  function createPlayerCard(username, status, buttonText, action) {
    const card = document.createElement('div');
    card.className = 'friend-card';

    const info = document.createElement('div');

    const name = document.createElement('strong');
    name.textContent = username || 'Jogador';

    const statusText = document.createElement('p');
    statusText.textContent = status || 'Jogador do NEXUS';

    info.append(name, statusText);

    const button = document.createElement('button');
    button.textContent = buttonText;
    button.addEventListener('click', action);

    card.append(info, button);
    return card;
  }

  async function getProfiles(ids) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);

    if (!uniqueIds.length) return {};

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, status')
      .in('id', uniqueIds);

    if (error) {
      console.error('Erro ao buscar perfis:', error);
      return {};
    }

    return Object.fromEntries((data || []).map(profile => [profile.id, profile]));
  }

  async function loadFriends() {
    requestsArea.innerHTML = '';
    friendsArea.innerHTML = '';
    sentArea.innerHTML = '';

    const { data: requests, error } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (error) {
      console.error(error);
      notify('Não foi possível carregar seus amigos. Verifique as permissões do Supabase.');
      return;
    }

    const received = (requests || []).filter(
      item => item.receiver_id === user.id && item.status === 'pending'
    );

    const sent = (requests || []).filter(
      item => item.sender_id === user.id && item.status === 'pending'
    );

    const accepted = (requests || []).filter(
      item => item.status === 'accepted'
    );

    const otherIds = (requests || []).map(item =>
      item.sender_id === user.id ? item.receiver_id : item.sender_id
    );

    const profiles = await getProfiles(otherIds);

    if (!received.length) {
      requestsArea.append(createMessage('Você não tem solicitações pendentes.'));
    }

    for (const request of received) {
      const profile = profiles[request.sender_id];

      requestsArea.append(
        createPlayerCard(
          profile?.username || 'Jogador',
          'Quer adicionar você como amigo.',
          'Aceitar',
          async () => {
            const { error } = await supabase
              .from('friend_requests')
              .update({ status: 'accepted' })
              .eq('id', request.id);

            if (error) {
              console.error(error);
              notify('Não foi possível aceitar. Verifique as permissões.');
              return;
            }

            notify('Amizade aceita! ❤️');
            loadFriends();
          }
        )
      );
    }

    if (!accepted.length) {
      friendsArea.append(createMessage('Você ainda não tem amigos adicionados.'));
    }

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
            const confirmed = confirm('Deseja remover este amigo?');
            if (!confirmed) return;

            const { error } = await supabase
              .from('friend_requests')
              .delete()
              .eq('id', friendship.id);

            if (error) {
              console.error(error);
              notify('Não foi possível remover. Verifique a política de exclusão.');
              return;
            }

            notify('Amigo removido.');
            loadFriends();
          }
        )
      );
    }

    if (!sent.length) {
      sentArea.append(createMessage('Você não enviou solicitações.'));
    }

    for (const request of sent) {
      const profile = profiles[request.receiver_id];

      sentArea.append(
        createPlayerCard(
          profile?.username || 'Jogador',
          'Aguardando resposta...',
          'Pendente',
          () => notify('Sua solicitação ainda está aguardando resposta.')
        )
      );
    }
  }

  async function searchPlayers() {
    const term = searchInput.value.trim();
    searchResults.innerHTML = '';

    if (term.length < 2) {
      searchResults.append(createMessage('Digite pelo menos 2 letras para buscar.'));
      return;
    }

    const { data: players, error } = await supabase
      .from('profiles')
      .select('id, username, status')
      .ilike('username', `%${term}%`)
      .neq('id', user.id)
      .limit(20);

    if (error) {
      console.error(error);
      searchResults.append(
        createMessage('Não foi possível pesquisar. Verifique se os perfis podem ser consultados.')
      );
      return;
    }

    if (!players?.length) {
      searchResults.append(createMessage('Nenhum jogador encontrado.'));
      return;
    }

    const { data: existingRequests, error: requestError } = await supabase
      .from('friend_requests')
      .select('sender_id, receiver_id, status')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (requestError) {
      console.error(requestError);
      notify('Não foi possível verificar suas amizades.');
      return;
    }

    for (const player of players) {
      const existing = (existingRequests || []).find(request =>
        (request.sender_id === user.id && request.receiver_id === player.id) ||
        (request.sender_id === player.id && request.receiver_id === user.id)
      );

      let buttonText = 'Adicionar';
      let action = async () => {
        const { error } = await supabase
          .from('friend_requests')
          .insert({
            sender_id: user.id,
            receiver_id: player.id,
            status: 'pending'
          });

        if (error) {
          console.error(error);
          notify('Não foi possível enviar. Talvez já exista uma solicitação.');
          return;
        }

        notify('Solicitação de amizade enviada! 🎮');
        searchPlayers();
        loadFriends();
      };

      if (existing?.status === 'accepted') {
        buttonText = 'Já são amigos';
        action = async () => notify('Vocês já são amigos!');
      } else if (existing?.sender_id === user.id) {
        buttonText = 'Solicitação enviada';
        action = async () => notify('Você já enviou uma solicitação.');
      } else if (existing?.receiver_id === user.id) {
        buttonText = 'Solicitação recebida';
        action = async () => notify('Confira suas solicitações recebidas.');
      }

      searchResults.append(
        createPlayerCard(player.username, player.status, buttonText, action)
      );
    }
  }

  searchButton.addEventListener('click', searchPlayers);

  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') searchPlayers();
  });

  await loadFriends();
}
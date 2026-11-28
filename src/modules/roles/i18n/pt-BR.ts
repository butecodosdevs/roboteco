import type { Messages } from '@/i18n/types';

export const rolesPtBR: Messages['roles'] = {
  command: { name: 'cargos', description: 'Gerencia os cargos que os membros podem escolher' },
  add: { name: 'adicionar', description: 'Permite que os membros escolham um cargo' },
  remove: { name: 'remover', description: 'Impede que os membros escolham um cargo' },
  panel: { name: 'painel', description: 'Posta o seletor de cargos em um canal' },
  options: {
    role: { name: 'cargo', description: 'O cargo' },
    description: { name: 'descricao', description: 'Aparece abaixo do cargo no seletor' },
    channel: { name: 'canal', description: 'Onde postar o seletor' },
  },
  picker: {
    title: 'Escolha seus cargos',
    description:
      'Escolha os cargos que você quer no menu abaixo. Desmarque um cargo para removê-lo.',
    placeholder: 'Selecione cargos',
  },
  reaction: {
    command: {
      name: 'cargosreacao',
      description: 'Dá cargos quando os membros reagem a uma mensagem',
    },
    setup: { name: 'configurar', description: 'Liga emojis a cargos em uma mensagem existente' },
    remove: { name: 'remover', description: 'Desliga um emoji, ou todos, de uma mensagem' },
    list: { name: 'listar', description: 'Lista as mensagens com cargos por reação' },
    options: {
      message: { name: 'mensagem', description: 'ID ou link da mensagem' },
      pairs: {
        name: 'cargos',
        description:
          'Pares de emoji e cargo, ex.: 🎮 @Gamer 🎨 @Artista (IDs de cargo também valem)',
      },
      channel: { name: 'canal', description: 'Canal da mensagem (padrão: este, ou o do link)' },
      emoji: { name: 'emoji', description: 'Só este emoji (padrão: todos)' },
    },
    replies: {
      done: '{count} cargo(s) ligados em {url}',
      pair: '{emoji} → {role}',
      invalid: 'Ignorado, não é um emoji seguido de um cargo: {items}',
      duplicate: 'Ignorado {emoji}: aparece duas vezes.',
      tooMany: 'Ignorado: uma mensagem pode ter no máximo {max} reações.',
      reactFailed:
        'Ignorado {emoji}: não consigo reagir com ele (emojis personalizados precisam ser de um servidor onde estou).',
      messageNotFound: 'Não encontrei essa mensagem. Use o ID com o canal certo, ou cole o link.',
      reactPermission: 'Preciso de Adicionar reações e Ler histórico de mensagens em {channel}.',
      removed: '{count} cargo(s) por reação removidos.',
      none: 'Nenhum cargo por reação ainda. Configure com /cargosreacao configurar.',
      listTitle: 'Cargos por reação',
    },
  },
  replies: {
    added: 'Os membros agora podem escolher {role}.',
    removed: '{role} não pode mais ser escolhido.',
    notListed: '{role} não está entre os cargos escolhíveis.',
    tooMany: 'O seletor comporta no máximo 25 cargos.',
    aboveYou: 'Você não pode distribuir {role}: ele não está abaixo do seu cargo mais alto.',
    staffRole:
      '{role} dá permissões de equipe, então não pode ir para quem escolher ou reagir. Dê esse cargo manualmente.',
    unassignable:
      'Não posso atribuir {role}: ele é gerenciado por uma integração ou não está abaixo do meu cargo mais alto.',
    panelPosted: 'Seletor de cargos postado em {channel}.',
    postFailed: 'Não consegui postar em {channel}. Verifique minhas permissões lá.',
    noRoles: 'Ainda não há cargos escolhíveis. Adicione alguns com /cargos adicionar.',
    botPermission: 'Preciso da permissão Gerenciar cargos para isso.',
    changes: 'Adicionados: {added}\nRemovidos: {removed}',
    nothing: 'Nada mudou.',
    none: 'nenhum',
  },
};

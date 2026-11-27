import type { Messages } from '@/i18n/types';

export const welcomePtBR: Messages['welcome'] = {
  command: { name: 'boasvindas', description: 'Configura as boas-vindas e o cargo de entrada' },
  channel: {
    name: 'canal',
    description: 'Define o canal de boas-vindas (vazio desativa as mensagens)',
  },
  message: {
    name: 'mensagem',
    description: 'Define o texto de boas-vindas (vazio restaura o padrão)',
  },
  role: { name: 'cargo', description: 'Dá um cargo aos novos membros (vazio desativa)' },
  test: { name: 'testar', description: 'Mostra uma prévia da mensagem de boas-vindas' },
  options: {
    channel: { name: 'canal', description: 'Canal de boas-vindas' },
    text: { name: 'texto', description: 'Use {user}, {server} e {count}' },
    role: { name: 'cargo', description: 'Cargo para novos membros' },
  },
  defaultMessage: 'Bem-vindo(a) ao **{server}**, {user}! Você é o membro #{count}.',
  replies: {
    channelSet: 'As boas-vindas serão postadas em {channel}.',
    channelCleared: 'Mensagens de boas-vindas desativadas.',
    messageSet: 'Mensagem de boas-vindas atualizada.',
    messageReset: 'Mensagem de boas-vindas restaurada para o padrão.',
    roleSet: 'Novos membros vão receber {role}.',
    roleCleared: 'Novos membros não vão receber cargo.',
    unassignable:
      'Não posso atribuir {role}: ele é gerenciado por uma integração ou não está abaixo do meu cargo mais alto.',
    notConfigured: 'Defina um canal de boas-vindas primeiro com /boasvindas canal.',
    testSent: 'Prévia postada em {channel}.',
    intentDisabled:
      'Aviso: o bot está rodando sem a intent Server Members, então não verá novos membros até o dono do bot ativá-la.',
  },
};

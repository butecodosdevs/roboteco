import type { Messages } from '@/i18n/types';

export const privacyPtBR: Messages['privacy'] = {
  command: {
    name: 'privacidade',
    description: 'Veja ou apague os dados que o bot guarda sobre você',
  },
  info: { name: 'info', description: 'Quais dados o bot guarda' },
  delete: { name: 'apagar', description: 'Apaga seus dados do bot' },
  forget: { name: 'esquecer', description: 'Apaga os dados de um membro neste servidor (equipe)' },
  options: {
    user: { name: 'usuario', description: 'De quem apagar os dados' },
  },
  infoText: [
    '**O que o roboteco guarda sobre os membros**',
    '• Níveis: seu XP em cada servidor.',
    '• Tags e sugestões que você criou, e seus votos em sugestões.',
    '• Lembretes que você criou.',
    '• Tickets que você abriu e denúncias que você fez.',
    '• Casos de moderação sobre você. São registros do servidor e são mantidos.',
    '',
    'Os registros do servidor e de moderação são mensagens do Discord no servidor, então o bot não pode apagá-los.',
    'Quando o bot sai de um servidor, os dados desse servidor são apagados após {days} dias.',
    'Use /privacidade apagar para apagar seus dados.',
  ].join('\n'),
  confirmSelf:
    'Isto apaga seus níveis, tags, sugestões e votos, lembretes, tickets e denúncias em **todos** os servidores. Casos de moderação são mantidos. Continuar?',
  confirmForget:
    'Isto apaga os níveis, tags, sugestões e votos, lembretes, tickets e denúncias de {user} neste servidor. Casos de moderação são mantidos. Continuar?',
  buttons: { confirm: 'Apagar', cancel: 'Cancelar' },
  replies: {
    deleted: 'Pronto. Os dados foram apagados.',
    cancelled: 'Nada foi apagado.',
    notYours: 'Só quem executou o comando pode confirmar.',
    notAllowed: 'Você precisa da permissão Gerenciar servidor para isso.',
  },
};

import type { Messages } from '@/i18n/types';

export const reportsPtBR: Messages['reports'] = {
  menus: { message: 'Denunciar mensagem', user: 'Denunciar usuário' },
  command: { name: 'denuncias', description: 'Configura as denúncias' },
  channel: { name: 'canal', description: 'Define o canal para onde vão as denúncias' },
  options: {
    channel: { name: 'canal', description: 'Canal de denúncias' },
  },
  modal: {
    title: 'Denunciar aos moderadores',
    reason: 'O que está errado?',
    placeholder: 'Descreva o problema',
  },
  embed: {
    title: 'Denúncia #{id}',
    reporter: 'Denunciado por',
    target: 'Usuário denunciado',
    message: 'Mensagem',
    reason: 'Motivo',
    status: 'Status',
    handledBy: '{status} por {moderator}',
    jump: 'Ir para a mensagem',
    noContent: '(sem texto)',
  },
  status: { open: 'Aberta', resolved: 'Resolvida', dismissed: 'Descartada' },
  buttons: { resolve: 'Resolver', dismiss: 'Descartar' },
  replies: {
    sent: 'Obrigado. Os moderadores foram avisados.',
    notConfigured: 'As denúncias não estão configuradas neste servidor.',
    self: 'Você não pode denunciar a si mesmo.',
    channelSet: 'As denúncias serão enviadas para {channel}.',
    notAllowed: 'Você precisa da permissão Gerenciar mensagens para tratar denúncias.',
    messageGone: 'Essa mensagem não existe mais.',
  },
};

import type { Messages } from '@/i18n/types';

export const honeypotPtBR: Messages['honeypot'] = {
  command: { name: 'honeypot', description: 'Bane quem postar em um canal armadilha' },
  set: { name: 'definir', description: 'Define o canal honeypot' },
  disable: { name: 'desativar', description: 'Desativa o honeypot' },
  status: { name: 'status', description: 'Mostra a configuração do honeypot' },
  options: {
    channel: { name: 'canal', description: 'Quem postar aqui será banido' },
    deleteMessages: {
      name: 'apagar_mensagens',
      description: 'Quanto das mensagens recentes do usuário banido apagar',
    },
  },
  windows: {
    none: 'Nenhuma',
    hour: 'Última hora',
    day: 'Últimas 24 horas',
    week: 'Últimos 7 dias',
  },
  replies: {
    set: 'Honeypot definido em {channel}. Quem postar lá será banido.',
    warningFailed: 'Não consegui postar o aviso em {channel}. Verifique minhas permissões lá.',
    disabled: 'Honeypot desativado.',
    notConfigured: 'Nenhum canal honeypot está configurado.',
    status: 'Honeypot: {channel}. Mensagens apagadas ao banir: {window}.',
    missingBanPermission: 'Preciso da permissão Banir Membros para usar o honeypot.',
  },
  warning:
    '**Não poste neste canal.** Ele é uma armadilha para bots de spam: quem enviar uma mensagem aqui é banido automaticamente.',
  banReason: 'Honeypot: postou em #{channel}',
};

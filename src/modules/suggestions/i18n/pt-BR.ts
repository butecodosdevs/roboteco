import type { Messages } from '@/i18n/types';

export const suggestionsPtBR: Messages['suggestions'] = {
  suggest: { name: 'sugerir', description: 'Sugere algo para o servidor' },
  command: { name: 'sugestoes', description: 'Gerencia as sugestões' },
  channel: { name: 'canal', description: 'Define o canal onde as sugestões são postadas' },
  approve: { name: 'aprovar', description: 'Aprova uma sugestão' },
  deny: { name: 'recusar', description: 'Recusa uma sugestão' },
  options: {
    content: { name: 'sugestao', description: 'Sua sugestão' },
    channel: { name: 'canal', description: 'Canal de sugestões' },
    id: { name: 'id', description: 'Número da sugestão' },
    reason: { name: 'motivo', description: 'Por quê (aparece na sugestão)' },
  },
  status: { pending: 'Aberta', approved: 'Aprovada', denied: 'Recusada' },
  embed: {
    footer: 'Sugestão #{id} · {status}',
    decision: 'Decisão de {moderator}',
    noReason: 'Nenhum motivo informado',
  },
  replies: {
    posted: 'Sua sugestão foi postada em {channel}.',
    notConfigured:
      'As sugestões ainda não foram configuradas. Peça a um moderador para usar /sugestoes canal.',
    channelSet: 'As sugestões serão postadas em {channel}.',
    notFound: 'A sugestão #{id} não existe.',
    decided: 'Sugestão #{id} marcada como {status}.',
    postFailed: 'Não consegui postar em {channel}. Verifique minhas permissões lá.',
  },
};

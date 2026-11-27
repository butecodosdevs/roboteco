import type { Messages } from '@/i18n/types';

export const starboardPtBR: Messages['starboard'] = {
  command: { name: 'destaques', description: 'Configura o mural de destaques' },
  channel: { name: 'canal', description: 'Define o canal de destaques e o mínimo de estrelas' },
  disable: { name: 'desativar', description: 'Desativa o mural de destaques' },
  options: {
    channel: { name: 'canal', description: 'Canal de destaques' },
    threshold: { name: 'minimo', description: 'Estrelas necessárias (padrão 3)' },
  },
  post: {
    header: '⭐ **{count}** · {channel}',
    jump: 'Ir para a mensagem',
  },
  replies: {
    set: 'Mensagens com {threshold} ⭐ serão postadas em {channel}.',
    disabled: 'Mural de destaques desativado.',
  },
};

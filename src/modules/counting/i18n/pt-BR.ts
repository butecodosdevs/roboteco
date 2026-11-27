import type { Messages } from '@/i18n/types';

export const countingPtBR: Messages['counting'] = {
  command: { name: 'contagem', description: 'Configura um canal de contagem' },
  channel: { name: 'canal', description: 'Define o canal de contagem (vazio desativa)' },
  options: { channel: { name: 'canal', description: 'Canal de contagem' } },
  broken: '{user} quebrou a contagem em **{count}**! Recomecem do 1. Recorde: **{record}**.',
  twice: '{user}, você não pode contar duas vezes seguidas! Recomecem do 1. Recorde: **{record}**.',
  replies: {
    set: 'Contagem em {channel}. Comecem do 1!',
    disabled: 'Contagem desativada.',
    intentDisabled:
      'Aviso: o bot está rodando sem a intent Message Content, então não consegue ler os números até o dono do bot ativá-la.',
  },
};

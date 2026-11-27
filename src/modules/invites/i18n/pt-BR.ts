import type { Messages } from '@/i18n/types';

export const invitesPtBR: Messages['invites'] = {
  command: { name: 'convites', description: 'Rastreamento de convites' },
  count: { name: 'contar', description: 'Quantos membros alguém convidou' },
  top: { name: 'top', description: 'Quem mais convidou' },
  options: { user: { name: 'usuario', description: 'De quem contar os convites (padrão você)' } },
  replies: {
    count: '{user} convidou **{active}** membro(s) que ainda estão aqui ({total} no total).',
    none: 'Nenhum convite rastreado ainda.',
    topTitle: 'Quem mais convidou',
    line: '**{position}.** {user} · {active} ({total} no total)',
    intentDisabled:
      'Aviso: o bot está rodando sem a intent Server Members, então as entradas não estão sendo rastreadas até o dono do bot ativá-la.',
  },
};

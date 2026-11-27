import type { Messages } from '@/i18n/types';

export const birthdaysPtBR: Messages['birthdays'] = {
  command: { name: 'aniversario', description: 'Aniversários' },
  set: { name: 'definir', description: 'Salva seu aniversário' },
  remove: { name: 'remover', description: 'Esquece seu aniversário' },
  upcoming: { name: 'proximos', description: 'Próximos aniversários neste servidor' },
  setup: {
    name: 'configurar',
    description: 'Escolhe onde os aniversários são anunciados (equipe)',
  },
  options: {
    month: { name: 'mes', description: 'Mês (1-12)' },
    day: { name: 'dia', description: 'Dia (1-31)' },
    channel: { name: 'canal', description: 'Canal de anúncios (vazio desativa)' },
    role: { name: 'cargo', description: 'Cargo dado no dia (opcional)' },
  },
  announce: '🎂 Feliz aniversário {users}!',
  replies: {
    saved: 'Salvo: {day}/{month}.',
    invalidDate: 'Essa data não existe.',
    removed: 'Seu aniversário foi removido.',
    none: 'Nenhum aniversário salvo ainda.',
    upcomingTitle: 'Próximos aniversários',
    line: '{date} · {user}',
    configured: 'Os aniversários serão anunciados em {channel}.',
    disabled: 'Anúncios de aniversário desativados.',
    notAllowed: 'Você precisa da permissão Gerenciar servidor para isso.',
    unassignable:
      'Não posso atribuir {role}: ele é gerenciado por uma integração ou não está abaixo do meu cargo mais alto.',
  },
};

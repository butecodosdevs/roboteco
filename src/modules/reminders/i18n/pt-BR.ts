import type { Messages } from '@/i18n/types';

export const remindersPtBR: Messages['reminders'] = {
  remind: { name: 'lembrar', description: 'Cria um lembrete' },
  command: { name: 'lembretes', description: 'Gerencia seus lembretes' },
  list: { name: 'listar', description: 'Lista seus lembretes' },
  cancel: { name: 'cancelar', description: 'Cancela um lembrete' },
  options: {
    when: { name: 'em', description: 'Quando, ex.: 10m, 2h30m, 3d' },
    text: { name: 'texto', description: 'Do que te lembrar' },
    id: { name: 'id', description: 'Número do lembrete' },
  },
  delivery: '⏰ {user}, lembrete: {text}',
  replies: {
    set: 'Lembrete #{id} marcado para {when}.',
    invalidTime: 'Não entendi esse tempo. Use algo como 10m, 2h30m ou 3d (de 1 minuto a 1 ano).',
    tooMany: 'Você pode ter no máximo {max} lembretes.',
    none: 'Você não tem lembretes.',
    listTitle: 'Seus lembretes',
    line: '**#{id}** · {when} · {text}',
    cancelled: 'Lembrete #{id} cancelado.',
    notFound: 'O lembrete #{id} não existe.',
  },
};

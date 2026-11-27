import type { Messages } from '@/i18n/types';

export const scheduledPostsPtBR: Messages['scheduledPosts'] = {
  command: { name: 'agendar', description: 'Agenda mensagens para serem postadas depois' },
  post: { name: 'mensagem', description: 'Agenda uma mensagem' },
  list: { name: 'listar', description: 'Lista as mensagens agendadas' },
  cancel: { name: 'cancelar', description: 'Cancela uma mensagem agendada' },
  options: {
    channel: { name: 'canal', description: 'Onde postar' },
    in: { name: 'em', description: 'Quando sai a primeira postagem, ex.: 30m, 2h, 1d' },
    message: { name: 'mensagem', description: 'O que postar' },
    repeat: { name: 'repetir', description: 'Repetir (padrão não)' },
    id: { name: 'id', description: 'Número da mensagem agendada' },
  },
  repeats: { none: 'Não', daily: 'Todo dia', weekly: 'Toda semana' },
  replies: {
    scheduled: 'A mensagem #{id} será postada em {channel} {when}.',
    invalidTime: 'Use um tempo como 30m, 2h ou 1d (de 1 minuto a 1 ano).',
    none: 'Nada agendado.',
    listTitle: 'Mensagens agendadas',
    line: '**#{id}** · {channel} · {when} · {repeat} · {preview}',
    cancelled: 'Mensagem agendada #{id} cancelada.',
    notFound: 'A mensagem agendada #{id} não existe.',
    tooMany: 'Um servidor pode ter no máximo {max} mensagens agendadas.',
  },
};

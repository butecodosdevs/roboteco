import type { Messages } from '@/i18n/types';

export const antiraidPtBR: Messages['antiraid'] = {
  command: { name: 'antiraid', description: 'Protege o servidor contra entradas em massa' },
  config: {
    name: 'configurar',
    description: 'Bloqueia o servidor quando muitos membros entram rápido demais',
  },
  lockdown: { name: 'bloquear', description: 'Bloqueia o servidor agora' },
  unlock: { name: 'desbloquear', description: 'Encerra o bloqueio' },
  options: {
    joins: { name: 'entradas', description: 'Entradas que disparam o bloqueio (0 desativa)' },
    seconds: { name: 'segundos', description: 'Dentro de quantos segundos (padrão 10)' },
  },
  alert: {
    title: 'Bloqueio contra raid',
    automatic: '{count} membros entraram em {seconds}s. Convites pausados e verificação em Alta.',
    manual: 'Bloqueio iniciado por {user}. Convites pausados e verificação em Alta.',
    unlocked: 'Bloqueio encerrado por {user}. Convites e nível de verificação restaurados.',
  },
  replies: {
    configured: 'O bloqueio dispara com {joins} entradas em {seconds}s.',
    disabled: 'Bloqueio automático desativado.',
    locked: 'Servidor bloqueado. Use /antiraid desbloquear quando acabar.',
    alreadyLocked: 'O servidor já está bloqueado.',
    unlocked: 'Bloqueio encerrado.',
    notLocked: 'O servidor não está bloqueado.',
    botPermission: 'Preciso da permissão Gerenciar servidor para bloqueios.',
    intentDisabled:
      'Aviso: o bot está rodando sem a intent Server Members, então não verá entradas até o dono do bot ativá-la.',
  },
};

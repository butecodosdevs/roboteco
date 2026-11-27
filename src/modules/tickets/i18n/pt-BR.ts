import type { Messages } from '@/i18n/types';

export const ticketsPtBR: Messages['tickets'] = {
  command: { name: 'tickets', description: 'Configura os tickets de suporte' },
  panel: { name: 'painel', description: 'Posta o botão "abrir um ticket" em um canal' },
  staff: { name: 'equipe', description: 'Define o cargo que atende os tickets' },
  options: {
    channel: { name: 'canal', description: 'Onde postar o botão' },
    role: { name: 'cargo', description: 'Cargo da equipe' },
  },
  panelMessage: {
    title: 'Precisa de ajuda?',
    description: 'Aperte o botão para abrir um ticket privado com a equipe.',
    open: 'Abrir um ticket',
  },
  thread: {
    name: 'ticket-{user}',
    welcome: 'Oi {user}! Descreva seu problema e {staff} vai te ajudar em breve.',
    staffFallback: 'a equipe',
    close: 'Fechar ticket',
    closed: 'Ticket fechado por {user}.',
  },
  replies: {
    panelPosted: 'Botão de ticket postado em {channel}.',
    staffSet: 'Os tickets vão notificar {role}.',
    alreadyOpen: 'Você já tem um ticket aberto: {thread}.',
    opened: 'Seu ticket está aberto: {thread}.',
    unsupported: 'Os tickets precisam de um canal de texto comum.',
    botPermission: 'Preciso das permissões Criar tópicos privados e Gerenciar tópicos aqui.',
    notAllowed: 'Só o dono do ticket ou a equipe podem fechá-lo.',
    postFailed: 'Não consegui postar em {channel}. Verifique minhas permissões lá.',
  },
};

import type { Messages } from '@/i18n/types';

export const tempVoicePtBR: Messages['tempVoice'] = {
  admin: { name: 'vozdinamica', description: 'Configura canais de voz criados ao entrar' },
  setup: { name: 'configurar', description: 'Transforma um canal de voz em gerador de canais' },
  remove: { name: 'remover', description: 'Faz um gerador parar de criar canais' },
  list: { name: 'listar', description: 'Lista os geradores de canais' },
  command: { name: 'voz', description: 'Gerencia seu canal de voz temporário' },
  rename: { name: 'nome', description: 'Renomeia seu canal' },
  limit: { name: 'limite', description: 'Define quantas pessoas podem entrar (0 = ilimitado)' },
  kick: { name: 'expulsar', description: 'Desconecta alguém e impede de voltar' },
  invite: { name: 'convidar', description: 'Deixa alguém entrar, mesmo com o canal trancado' },
  lock: { name: 'trancar', description: 'Só convidados podem entrar' },
  unlock: { name: 'destrancar', description: 'Qualquer um pode entrar de novo' },
  claim: { name: 'assumir', description: 'Assume o canal quando o dono saiu' },
  transfer: { name: 'transferir', description: 'Passa seu canal para alguém que está nele' },
  options: {
    hub: { name: 'canal', description: 'Canal de voz onde os membros entram para ganhar o seu' },
    emptyAfter: {
      name: 'vazio_apos',
      description: 'Minutos que um canal vazio espera antes de ser apagado (padrão 1)',
    },
    idleAfter: {
      name: 'inativo_apos',
      description: 'Minutos com todos mutados/ensurdecidos antes de apagar (0 = nunca, padrão 10)',
    },
    category: {
      name: 'categoria',
      description: 'Categoria dos canais criados (padrão: a do gerador)',
    },
    hubLimit: {
      name: 'limite',
      description: 'Limite padrão de membros dos canais criados (0 = ilimitado)',
    },
    name: { name: 'nome', description: 'Novo nome do canal' },
    size: { name: 'tamanho', description: 'Limite de membros, de 0 a 99' },
    user: { name: 'usuario', description: 'O membro' },
  },
  channelName: 'Canal de {user}',
  welcome:
    '{user}, este canal é seu e você é o admin dele: edite-o (nome, limite de membros, permissões), clique com o botão direito nas pessoas para desconectar, mover, silenciar ou ensurdecer, e gerencie este chat. Atalhos: `/voz nome`, `/voz limite`, `/voz expulsar`, `/voz convidar`, `/voz trancar`, `/voz destrancar`, `/voz transferir`.',
  invited: '{owner} te convidou para {channel}.',
  replies: {
    hubSet: 'Entrar em {channel} agora cria um canal de voz temporário.',
    hubRemoved: '{channel} não cria mais canais.',
    notHub: '{channel} não é um gerador.',
    noHubs: 'Nenhum gerador ainda. Crie um com /vozdinamica configurar.',
    hubsTitle: 'Geradores de canais',
    hubLine: '{channel} · limite {limit} · vazio {empty} min · inativo {idle} min',
    categoryRule: 'Os canais são criados em **{category}**, e quem cria administra o canal.',
    noCategory: 'sem categoria',
    emptyRule: 'Canais vazios são apagados após {minutes} minuto(s) se ninguém entrar.',
    idleRule:
      'Canais onde todos estão mutados ou ensurdecidos são apagados após {minutes} minuto(s).',
    idleOff: 'Canais nunca são apagados por inatividade.',
    notInTemp: 'Entre primeiro no seu canal de voz temporário.',
    notOwner: 'Só o dono do canal pode fazer isso.',
    renamed: 'Renomeado para **{name}**.',
    renameQueued:
      'O Discord permite 2 renomeações a cada 10 minutos, então o novo nome **{name}** será aplicado em breve.',
    limited: 'Limite de membros definido para {size}.',
    unlimited: 'Limite de membros removido.',
    kicked: '{user} foi removido e não pode mais entrar.',
    kickSelf: 'Você não pode expulsar a si mesmo.',
    invitedReply: '{user} agora pode entrar. O link foi enviado para ele.',
    invitedNoDm:
      '{user} agora pode entrar. Não consegui mandar DM, então compartilhe {channel} com ele.',
    locked: 'Trancado. Só convidados podem entrar agora.',
    unlocked: 'Destrancado. Qualquer um pode entrar.',
    claimed: 'O canal agora é seu.',
    ownerPresent: 'O dono ainda está aqui.',
    transferred: '{user} agora é o dono do canal.',
    notInChannel: '{user} não está no seu canal.',
    botPermission:
      'Preciso de Gerenciar canais, Gerenciar cargos, Mover membros, Silenciar membros, Ensurdecer membros e Gerenciar mensagens, porque só posso dar ao dono permissões que eu tenho.',
  },
};

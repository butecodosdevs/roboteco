import type { Messages } from '@/i18n/types';

export const dropsPtBR: Messages['drops'] = {
  command: { name: 'drops', description: 'Airdrops em canais movimentados' },
  setup: { name: 'configurar', description: 'Inicia um airdrop a cada N mensagens em um canal' },
  disable: { name: 'desativar', description: 'Para os drops em um canal' },
  list: { name: 'listar', description: 'Canais com drops' },
  top: { name: 'top', description: 'Quem mais ganhou airdrops' },
  options: {
    channel: { name: 'canal', description: 'O canal' },
    every: {
      name: 'a_cada',
      description: 'Mensagens contadas entre airdrops (uma por membro a cada 5 s)',
    },
    xp: { name: 'xp', description: 'XP que cada vencedor recebe' },
    lifetime: { name: 'duracao', description: 'Segundos para reagir antes do sorteio (padrão 60)' },
    winners: { name: 'vencedores', description: 'Quantos dos que reagiram ganham (padrão 1)' },
  },
  drop: {
    title: '🎁 Airdrop!',
    description:
      'Reaja com {emoji} para participar. {winners} vencedor(es) sorteado(s) ganham **{xp} XP** cada. Sorteio {when}.',
    ended: 'Airdrop encerrado. Vencedores: {winners} (+{xp} XP cada, de {entrants} participantes).',
    noEntries: 'Airdrop encerrado. Ninguém reagiu a tempo.',
    announce: '🎉 {winners} ganhou o airdrop: **{xp} XP**!',
  },
  replies: {
    configured:
      'Um airdrop para {winners} vencedor(es) valendo {xp} XP vai aparecer a cada {every} mensagens em {channel}.',
    disabled: 'Drops desativados em {channel}.',
    notConfigured: 'Os drops não estão ativos em {channel}.',
    none: 'Nenhum canal tem drops ainda.',
    listTitle: 'Canais com drops',
    line: '{channel} · a cada {every} mensagens · {xp} XP · {progress}/{every} contadas até agora',
    topTitle: 'Quem mais ganhou airdrops',
    topLine: '**{position}.** {user} · {claims} vitórias · {xp} XP',
    noClaims: 'Ninguém ganhou um airdrop ainda.',
  },
};

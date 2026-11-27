import type { Messages } from '@/i18n/types';

export const levelsPtBR: Messages['levels'] = {
  rank: { name: 'nivel', description: 'Mostra o seu nível ou o de outra pessoa' },
  leaderboard: { name: 'ranking', description: 'Membros com mais XP' },
  command: { name: 'niveis', description: 'Configura os níveis' },
  reward: { name: 'recompensa', description: 'Dá um cargo quando os membros chegam a um nível' },
  unreward: { name: 'remover_recompensa', description: 'Remove a recompensa de um nível' },
  announce: {
    name: 'anunciar',
    description: 'Escolhe se as subidas de nível são anunciadas no chat',
  },
  options: {
    user: { name: 'usuario', description: 'De quem mostrar o nível' },
    level: { name: 'nivel', description: 'Nível' },
    role: { name: 'cargo', description: 'Cargo a dar' },
    enabled: { name: 'ativado', description: 'Postar mensagens de subida de nível' },
  },
  card: {
    level: 'Nível',
    xp: 'XP',
    rank: 'Posição',
    progress: '{current} / {needed} XP para o nível {next}',
  },
  board: {
    title: 'Ranking',
    line: '**{position}.** {user} · nível {level} · {xp} XP',
  },
  levelUp: 'Parabéns {user}, você chegou ao nível **{level}**!',
  replies: {
    noXp: '{user} ainda não tem XP.',
    empty: 'Ninguém ganhou XP ainda.',
    rewardSet: 'Quem chegar ao nível {level} ganha {role}.',
    rewardRemoved: 'Recompensa do nível {level} removida.',
    noReward: 'Não há recompensa para o nível {level}.',
    announceOn: 'As subidas de nível serão anunciadas.',
    announceOff: 'As subidas de nível não serão anunciadas.',
    unassignable:
      'Não posso atribuir {role}: ele é gerenciado por uma integração ou não está abaixo do meu cargo mais alto.',
  },
};

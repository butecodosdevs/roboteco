import type { Messages } from '@/i18n/types';

export const feedsPtBR: Messages['feeds'] = {
  command: { name: 'feeds', description: 'Posta novos itens de feeds RSS, Atom ou do YouTube' },
  add: { name: 'adicionar', description: 'Segue um feed' },
  remove: { name: 'remover', description: 'Deixa de seguir um feed' },
  list: { name: 'listar', description: 'Lista os feeds seguidos' },
  options: {
    url: { name: 'url', description: 'URL do feed (RSS/Atom, ou feed de um canal do YouTube)' },
    channel: { name: 'canal', description: 'Onde postar os novos itens' },
    id: { name: 'id', description: 'Número do feed' },
  },
  post: '**{feed}**: {title}\n{link}',
  replies: {
    added: 'Seguindo **{title}** em {channel}. Novos itens são verificados a cada 10 minutos.',
    invalid: 'Essa URL não aponta para um feed RSS ou Atom público legível.',
    tooMany: 'Um servidor pode seguir no máximo {max} feeds.',
    removed: 'Feed #{id} removido.',
    notFound: 'O feed #{id} não existe.',
    none: 'Nenhum feed ainda. Adicione um com /feeds adicionar.',
    listTitle: 'Feeds seguidos',
    line: '**#{id}** · {title} · {channel}',
  },
};

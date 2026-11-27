import type { Messages } from '@/i18n/types';

export const tagsPtBR: Messages['tags'] = {
  command: { name: 'tag', description: 'Salva e recupera trechos de texto' },
  add: { name: 'adicionar', description: 'Salva uma tag' },
  show: { name: 'mostrar', description: 'Posta uma tag salva' },
  list: { name: 'listar', description: 'Lista todas as tags' },
  delete: { name: 'apagar', description: 'Apaga uma tag' },
  options: {
    name: { name: 'nome', description: 'Nome da tag' },
    content: { name: 'conteudo', description: 'Texto a salvar' },
  },
  replies: {
    saved: 'Tag **{name}** salva.',
    exists: 'Já existe uma tag chamada **{name}**.',
    notFound: 'Nenhuma tag chamada **{name}**.',
    deleted: 'Tag **{name}** apagada.',
    notAllowed: 'Só o autor ou quem tem Gerenciar mensagens pode apagar **{name}**.',
    empty: 'Nenhuma tag ainda. Crie uma com /tag adicionar.',
    listTitle: 'Tags ({count})',
  },
};

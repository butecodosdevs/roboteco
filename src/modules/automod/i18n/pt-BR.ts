import type { Messages } from '@/i18n/types';

export const automodPtBR: Messages['automod'] = {
  command: { name: 'automod', description: 'Gerencia as regras de AutoMod nativas do Discord' },
  invites: { name: 'convites', description: 'Bloqueia links de convite do Discord' },
  links: { name: 'links', description: 'Bloqueia todos os links' },
  keywords: { name: 'palavras', description: 'Bloqueia mensagens com certas palavras' },
  mentions: { name: 'mencoes', description: 'Bloqueia mensagens com menções demais' },
  spam: { name: 'spam', description: 'Ativa o filtro de spam do Discord' },
  list: { name: 'listar', description: 'Lista as regras de AutoMod' },
  remove: { name: 'remover', description: 'Apaga uma regra de AutoMod' },
  options: {
    words: {
      name: 'palavras',
      description: 'Palavras separadas por vírgula; * é curinga, ex.: palavr*',
    },
    limit: { name: 'limite', description: 'Máximo de menções por mensagem (padrão 5)' },
    timeout: {
      name: 'castigo',
      description: 'Também castiga o autor, em minutos (só palavras e menções)',
    },
    rule: { name: 'regra', description: 'A regra' },
  },
  ruleNames: {
    invites: 'roboteco: links de convite',
    links: 'roboteco: links',
    keywords: 'roboteco: palavras',
    mentions: 'roboteco: menções em massa',
    spam: 'roboteco: spam',
  },
  blockMessage: 'Esta mensagem foi bloqueada pelas regras do servidor.',
  replies: {
    created:
      'A regra **{name}** está ativa. Os alertas vão para o canal de log de moderação quando houver um.',
    exists: 'Essa regra já existe. Remova-a primeiro para alterá-la.',
    limitReached: 'O limite do Discord para esse tipo de regra foi atingido neste servidor.',
    botPermission: 'Preciso da permissão Gerenciar servidor para gerenciar o AutoMod.',
    none: 'Nenhuma regra de AutoMod neste servidor.',
    listTitle: 'Regras de AutoMod',
    removed: 'Regra **{name}** apagada.',
    notFound: 'Essa regra não existe.',
    noWords: 'Informe pelo menos uma palavra.',
  },
};

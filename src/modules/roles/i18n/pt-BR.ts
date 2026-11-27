import type { Messages } from '@/i18n/types';

export const rolesPtBR: Messages['roles'] = {
  command: { name: 'cargos', description: 'Gerencia os cargos que os membros podem escolher' },
  add: { name: 'adicionar', description: 'Permite que os membros escolham um cargo' },
  remove: { name: 'remover', description: 'Impede que os membros escolham um cargo' },
  panel: { name: 'painel', description: 'Posta o seletor de cargos em um canal' },
  options: {
    role: { name: 'cargo', description: 'O cargo' },
    description: { name: 'descricao', description: 'Aparece abaixo do cargo no seletor' },
    channel: { name: 'canal', description: 'Onde postar o seletor' },
  },
  picker: {
    title: 'Escolha seus cargos',
    description:
      'Escolha os cargos que você quer no menu abaixo. Desmarque um cargo para removê-lo.',
    placeholder: 'Selecione cargos',
  },
  replies: {
    added: 'Os membros agora podem escolher {role}.',
    removed: '{role} não pode mais ser escolhido.',
    notListed: '{role} não está entre os cargos escolhíveis.',
    tooMany: 'O seletor comporta no máximo 25 cargos.',
    unassignable:
      'Não posso atribuir {role}: ele é gerenciado por uma integração ou não está abaixo do meu cargo mais alto.',
    panelPosted: 'Seletor de cargos postado em {channel}.',
    postFailed: 'Não consegui postar em {channel}. Verifique minhas permissões lá.',
    noRoles: 'Ainda não há cargos escolhíveis. Adicione alguns com /cargos adicionar.',
    botPermission: 'Preciso da permissão Gerenciar cargos para isso.',
    changes: 'Adicionados: {added}\nRemovidos: {removed}',
    nothing: 'Nada mudou.',
    none: 'nenhum',
  },
};

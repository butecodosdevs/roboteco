import type { Messages } from '@/i18n/types';

export const customCommandsPtBR: Messages['customCommands'] = {
  command: {
    name: 'comandopersonalizado',
    description: 'Cria comandos de barra que respondem com texto',
  },
  add: { name: 'adicionar', description: 'Cria ou atualiza um comando personalizado' },
  remove: { name: 'remover', description: 'Apaga um comando personalizado' },
  list: { name: 'listar', description: 'Lista os comandos personalizados' },
  options: {
    name: { name: 'nome', description: 'Nome do comando: letras minúsculas, números, - e _' },
    response: { name: 'resposta', description: 'O que o comando responde' },
    description: { name: 'descricao', description: 'Aparece no menu de comandos' },
  },
  defaultDescription: 'Comando personalizado',
  replies: {
    saved: '/{name} salvo. Pode levar um instante para aparecer no menu.',
    invalidName: 'Os nomes usam de 1 a 32 letras minúsculas, números, - ou _.',
    reserved: '/{name} já é um comando do bot.',
    tooMany: 'Um servidor pode ter no máximo {max} comandos personalizados.',
    removed: '/{name} apagado.',
    notFound: 'Não existe o comando personalizado /{name}.',
    none: 'Nenhum comando personalizado ainda.',
    listTitle: 'Comandos personalizados',
  },
};

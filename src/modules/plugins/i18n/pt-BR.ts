import type { Messages } from '@/i18n/types';

export const pluginsPtBR: Messages['plugins'] = {
  command: { name: 'plugin', description: 'Plugins da comunidade' },
  list: { name: 'listar', description: 'Lista os plugins instalados' },
  replies: {
    forbidden: 'Você precisa de {permissions} para usar isto.',
    lateModal: 'O plugin **{plugin}** tentou abrir um formulário tarde demais. Tente de novo.',
    expired: 'Este controle é de um plugin que não está mais instalado.',
    guildOnly: 'Este comando só funciona dentro de um servidor.',
    timeout: 'O plugin **{plugin}** demorou demais e foi interrompido.',
    crash: 'O plugin **{plugin}** falhou.',
    invalid: 'O plugin **{plugin}** enviou uma resposta que não consigo usar.',
    empty: 'O plugin **{plugin}** não tinha nada a dizer.',
    none: 'Nenhum plugin instalado.',
    listTitle: 'Plugins',
    line: '**{plugin}** {version} · {commands} · permissões: {permissions}',
    noPermissions: 'nenhuma',
  },
};

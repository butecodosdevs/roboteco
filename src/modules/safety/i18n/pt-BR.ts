import type { Messages } from '@/i18n/types';

export const safetyPtBR: Messages['safety'] = {
  command: {
    name: 'seguranca',
    description: 'Remove links e arquivos que verificações de segurança confirmam ser maliciosos',
  },
  toggle: { name: 'alternar', description: 'Liga ou desliga a verificação neste servidor' },
  timeout: {
    name: 'castigo',
    description: 'Castiga membros que tiveram a mensagem removida (0 desliga)',
  },
  status: {
    name: 'status',
    description: 'Mostra as configurações e quais verificações estão ativas',
  },
  options: {
    enabled: { name: 'ativado', description: 'Se deve verificar as mensagens' },
    minutes: { name: 'minutos', description: 'Duração do castigo em minutos, 0 para nenhum' },
  },
  sources: {
    phishingList: 'Lista de domínios de phishing',
    safeBrowsing: 'Google Safe Browsing',
    urlhaus: 'URLhaus',
    malwareBazaar: 'MalwareBazaar',
    virusTotal: 'VirusTotal',
    clamav: 'ClamAV',
  },
  deleteReason: 'Conteúdo malicioso confirmado por {sources}',
  log: {
    title: 'Conteúdo malicioso encontrado',
    author: '**Autor:** {user} ({id})',
    channel: '**Canal:** {channel}',
    finding: '`{target}`: {source} ({detail})',
    recheck: 'Encontrado quando a mensagem foi verificada de novo depois de enviada.',
    notDeleted:
      '⚠️ Não consegui apagar a mensagem. Me dê a permissão Gerenciar Mensagens nesse canal.',
    timedOut: 'O autor foi castigado por {minutes} minutos.',
  },
  notice:
    '{user}, removi sua mensagem porque uma verificação de segurança ({sources}) confirmou que ela tem algo malicioso. Se você não quis enviar isso, sua conta pode estar comprometida: troque sua senha.',
  dm: 'Sua mensagem em **{server}** foi removida porque uma verificação de segurança confirmou que ela é maliciosa:\n{findings}\nSe você não quis enviar isso, sua conta ou seu dispositivo podem estar comprometidos: troque sua senha e verifique seu dispositivo com um antivírus.',
  replies: {
    enabled:
      'A verificação está ligada. Mensagens só são removidas quando uma verificação confirma uma ameaça; o que for desconhecido continua no ar. As remoções aparecem no log de moderação (/moderacao log).',
    disabled: 'A verificação está desligada.',
    timeoutSet: 'Membros que tiverem a mensagem removida serão castigados por {minutes} minutos.',
    timeoutOff: 'Membros que tiverem a mensagem removida não serão castigados.',
    statusTitle: 'Verificação de segurança',
    statusState: 'Status',
    statusOn: 'Ligada',
    statusOff: 'Desligada',
    statusTimeout: 'Castigo',
    statusTimeoutMinutes: '{minutes} minutos',
    statusTimeoutOff: 'Nenhum',
    statusSources: 'Verificações',
    sourceOn: '✅ {source}',
    sourceList: '✅ {source} ({count} domínios)',
    sourceOff: '➖ {source} (não configurado neste bot)',
    sourceDown: '⚠️ {source} (configurado, mas sem resposta)',
    statusWarnings: 'Avisos',
    noMessageContent:
      'O bot está rodando sem o intent Message Content, então não consegue ver links nem arquivos.',
    noManageMessages: 'Preciso da permissão Gerenciar Mensagens para remover mensagens.',
    noLogChannel:
      'Nenhum canal de log de moderação está definido, então as remoções não são registradas. Use /moderacao log.',
  },
};

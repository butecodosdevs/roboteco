export const embedsPtBR = {
  command: { name: 'embeds', description: 'Conserta previews de link quebrados com o embeds.now' },
  toggle: { name: 'alternar', description: 'Liga ou desliga o conserto de links neste servidor' },
  status: { name: 'status', description: 'Mostra a configuração atual do conserto de links' },
  options: {
    enabled: { name: 'ativado', description: 'Se deve consertar os links' },
  },
  sites: {
    twitter: 'X / Twitter',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    reddit: 'Reddit',
    spotify: 'Spotify',
    threads: 'Threads',
    bluesky: 'Bluesky',
    pinterest: 'Pinterest',
    facebook: 'Facebook',
  },
  deleteReason: 'Repostada com o preview do link corrigido (embeds.now)',
  replies: {
    noPermission: 'Você precisa da permissão Gerenciar Servidor para usar /embeds.',
    enabled:
      'Conserto de links ligado. Ele funciona nos canais onde tenho Gerenciar Mensagens e Gerenciar Webhooks; para deixar um canal de fora, tire uma delas de mim lá.',
    disabled: 'Conserto de links desligado.',
    statusTitle: 'Conserto de links',
    statusState: 'Status',
    statusOn: 'Ligado',
    statusOff: 'Desligado',
    statusSites: 'Sites',
  },
} as const;

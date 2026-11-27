import type { Messages } from '@/i18n/types';

export const verificationPtBR: Messages['verification'] = {
  command: { name: 'verificacao', description: 'Configura a verificação de entrada' },
  setup: {
    name: 'configurar',
    description: 'Posta o botão de verificação e escolhe o cargo que ele dá',
  },
  options: {
    channel: { name: 'canal', description: 'Onde postar o botão' },
    role: { name: 'cargo', description: 'Cargo dado aos membros verificados' },
    minAge: { name: 'idade_minima', description: 'Idade mínima da conta em dias (padrão 0)' },
  },
  panel: {
    title: 'Verificação',
    description: 'Aperte o botão abaixo para confirmar que você é humano e acessar o servidor.',
    button: 'Verificar',
  },
  replies: {
    posted: 'Botão de verificação postado em {channel}. Ele dá {role}.',
    verified: 'Você está verificado. Bem-vindo(a)!',
    already: 'Você já está verificado.',
    tooNew: 'Sua conta é nova demais para verificar aqui. Tente de novo {when}.',
    notConfigured: 'A verificação não está configurada neste servidor.',
    unassignable:
      'Não posso atribuir {role}: ele é gerenciado por uma integração ou não está abaixo do meu cargo mais alto.',
    postFailed: 'Não consegui postar em {channel}. Verifique minhas permissões lá.',
  },
};

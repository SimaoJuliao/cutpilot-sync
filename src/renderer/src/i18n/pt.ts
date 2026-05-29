export const pt = {
  app: {
    title: 'VIDEO EDITOR',
  },

  onboarding: {
    eyebrow:    'editor de vídeo automático',
    titleLine1: 'O teu vídeo',
    titleLine2: 'editado',
    titleLine3: 'em segundos',
    step1:      'Seleciona o teu vídeo',
    step2:      'A IA analisa e decide os cortes',
    step3:      'Recebe o resultado pronto a publicar',
    startBtn:   'Começar',
    oneTimeNote: 'não voltarás a ver este ecrã',
  },

  stepUpload: {
    dropPrompt:    'Arrasta ou clica para selecionar',
    dropFormats:   'MP4  ·  MOV  ·  MKV  ·  AVI  ·  WEBM',
    readyLabel:    'Pronto',
    swapHint:      'clica para trocar',
    ffmpegWarning: 'FFmpeg não encontrado —',
    ffmpegLink:    'instalar aqui',
    startBtn:      'Editar vídeo',
  },

  stepProcess: {
    patience:   'Isto pode demorar alguns minutos',
    errorTitle: 'Algo correu mal',
    retryBtn:   'Tentar novamente',
  },

  stepDone: {
    eyebrow:        'resultado',
    title:          'Editado.',
    durationLabel:  'duração',
    segmentsLabel:  'cortes',
    openFolderBtn:  'Abrir pasta',
    editAnotherBtn: '+ editar outro vídeo',
  },

  auth: {
    loginTitle:  'BEM-VINDO.',
    signupTitle: 'CRIAR CONTA.',
    forgotTitle: 'RECUPERAR PASSWORD.',
    verifyTitle: 'VERIFICA O TEU EMAIL.',
    resetTitle:  'NOVA PASSWORD.',

    loginTab:  'Entrar',
    signupTab: 'Registar',

    emailLabel:           'Email',
    passwordLabel:        'Password',
    newPasswordLabel:     'Nova password',
    confirmPasswordLabel: 'Confirmar password',

    loginBtn:          'Entrar',
    signupBtn:         'Criar conta',
    sendLinkBtn:       'Enviar link',
    setPasswordBtn:    'Definir password',
    changePasswordBtn: 'Alterar password',
    saveBtn:           'Guardar',
    logoutBtn:         'Terminar sessão',
    deleteAccountBtn:  'Eliminar conta',
    deleteConfirmBtn:  'Sim, eliminar definitivamente',
    cancelBtn:         'Cancelar',
    resendBtn:         'Reenviar email de confirmação',

    forgotLink:     'Esqueceste a password?',
    backToLogin:    '← Voltar',
    noAccount:      'Não tens conta?',
    hasAccount:     'Já tens conta?',
    differentEmail: '← Usar outro email',
    showPassword:   'mostrar',
    hidePassword:   'ocultar',

    forgotDesc:    'Envia-te um link para redefinires a password.',
    verifyDesc:    'Enviámos um email de confirmação para',
    verifySubDesc: 'Clica no link para ativar a tua conta.',
    deleteWarning: 'Esta ação é permanente. Todos os teus dados serão removidos.',

    settingsTitle:   'A TUA CONTA',
    sectionSecurity: 'Segurança',
    sectionSession:  'Sessão',
    sectionDanger:   'Zona de risco',

    linkSent:        'Link enviado! Verifica o teu email.',
    passwordChanged: 'Password alterada com sucesso.',
    passwordReset:   'Password definida. Podes fazer login.',

    errors: {
      invalidCredentials: 'Email ou password incorretos.',
      emailTaken:         'Este email já está registado.',
      weakPassword:       'A password deve ter pelo menos 6 caracteres.',
      invalidEmail:       'Email inválido.',
      passwordMismatch:   'As passwords não coincidem.',
      emailNotConfirmed:  'Email ainda não confirmado. Verifica a tua caixa de entrada.',
      rateLimit:          'Demasiadas tentativas. Aguarda um momento.',
      generic:            'Algo correu mal. Tenta novamente.',
    },
  },
} as const

export type Strings = typeof pt

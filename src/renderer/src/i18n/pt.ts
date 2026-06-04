export const pt = {
  app: {
    title: 'CUTPILOT SYNC',
    accountBtn: 'conta',
    accountBtnLabel: 'Definições da conta',
    closeLabel: 'Fechar definições',
  },

  stepLabels: {
    upload: 'Carregar vídeo',
    process: 'A processar',
    done: 'Concluído',
    onboarding: 'Boas-vindas',
  },

  onboarding: {
    eyebrow: 'editor de vídeo automático',
    titleLine1: 'O teu vídeo',
    titleLine2: 'editado',
    titleLine3: 'em minutos',
    startBtn: 'Começar',
    oneTimeNote: 'não voltarás a ver este ecrã',

    // Workflow steps
    step1Label: 'Seleciona o vídeo',
    step1Desc: 'Qualquer vídeo com áudio — câmara, ecrã ou talking head. Opcionalmente adiciona um segundo vídeo para dois ficheiros cortados em sincronia.',
    step2Label: 'A IA decide os cortes',
    step2Desc: 'Transcrição palavra a palavra. Detecção automática de enganos, repetições e pausas longas.',
    step3Label: 'Recebe o resultado',
    step3Desc: 'Vídeo limpo e pronto a publicar. Se usaste dois vídeos, recebes dois ficheiros cortados em sincronia.',

    // Dual-video callout
    dualVideoTitle: 'Dois vídeos sincronizados',
    dualVideoDesc: 'Tens câmara + ecrã, ou dois vídeos diferentes? Adiciona o segundo — não precisa de áudio, a app corta ambos nos mesmos pontos.',
  },

  stepUpload: {
    // Main video
    mainLabel: 'Vídeo principal',
    mainSublabel: 'com áudio',
    dropPrompt: 'Arrasta ou clica para selecionar',
    dropFormats: 'MP4  ·  MOV  ·  MKV  ·  AVI  ·  WEBM',
    readyLabel: 'Pronto',
    swapHint: 'clica para trocar',
    ffmpegWarning: 'FFmpeg não encontrado —',
    ffmpegLink: 'instalar aqui',
    startBtn: 'Editar vídeo',
    // Webcam section
    webcamLabel: 'Câmara',
    webcamOptional: 'opcional',
    webcamPrompt: 'Adicionar vídeo da câmara',
    webcamHint: 'Será cortado nos mesmos pontos — sem áudio necessário',
    webcamReadyLabel: 'Câmara pronta',
    syncOffsetLabel: 'Offset de sync (seg.)',
    syncOffsetHint: '0 = arrancaram em simultâneo',
    // Header above the two zones
    sectionTitle: 'Selecionar vídeos',
    // Drag-over state
    dropHere: 'Soltar aqui',
    // Webcam extras
    webcamRemoveLabel: 'Remover câmara',
    secUnit: 'seg.',
    webcamBadge: '+ câmara',
  },

  stepProcess: {
    patience: 'Isto pode demorar alguns minutos',
    errorTitle: 'Algo correu mal',
    retryBtn: 'Tentar novamente',
    phaseTranscribe: 'A analisar o áudio…',
    phaseAnalyse: 'A identificar os melhores momentos…',
    phaseExport: 'A exportar o teu vídeo…',
    phaseDone: 'Concluído!',
    subTranscribe: 'Transcrição palavra a palavra',
    subAnalyse: 'Detecção de enganos, repetições e silêncios',
    subExport: 'Re-codificação frame-precisa e normalização de áudio',
    // Short phase labels shown in the step indicator
    phaseTranscribeShort: 'Transcrição',
    phaseAnalyseShort: 'Análise',
    phaseExportShort: 'Exportar',
    // Aria label prefix for the progress ring ("Progresso: X%")
    progressAriaPrefix: 'Progresso',
  },

  stepDone: {
    eyebrow: 'resultado',
    title: 'Editado.',
    durationLabel: 'duração',
    segmentsLabel: 'cortes',
    openFolderBtn: 'Abrir pasta',
    editAnotherBtn: '+ editar outro vídeo',
    // dual video
    mainFileLabel: 'Principal',
    webcamFileLabel: 'Câmara',
    filesLabel: 'ficheiros',
  },

  auth: {
    loginTitle: 'BEM-VINDO.',
    signupTitle: 'CRIAR CONTA.',
    forgotTitle: 'RECUPERAR PASSWORD.',
    verifyTitle: 'VERIFICA O TEU EMAIL.',
    resetTitle: 'NOVA PASSWORD.',

    loginTab: 'Entrar',
    signupTab: 'Registar',

    emailLabel: 'Email',
    passwordLabel: 'Password',
    newPasswordLabel: 'Nova password',
    confirmPasswordLabel: 'Confirmar password',

    loginBtn: 'Entrar',
    signupBtn: 'Criar conta',
    sendLinkBtn: 'Enviar link',
    setPasswordBtn: 'Definir password',
    changePasswordBtn: 'Alterar password',
    saveBtn: 'Guardar',
    logoutBtn: 'Terminar sessão',
    deleteAccountBtn: 'Eliminar conta',
    deleteConfirmBtn: 'Sim, eliminar definitivamente',
    cancelBtn: 'Cancelar',
    resendBtn: 'Reenviar email de confirmação',

    forgotLink: 'Esqueceste a password?',
    backToLogin: '← Voltar',
    noAccount: 'Não tens conta?',
    hasAccount: 'Já tens conta?',
    differentEmail: '← Usar outro email',
    showPassword: 'mostrar',
    hidePassword: 'ocultar',

    forgotDesc: 'Envia-te um link para redefinires a password.',
    verifyDesc: 'Enviámos um email de confirmação para',
    verifySubDesc: 'Clica no link para ativar a tua conta.',
    deleteWarning: 'Esta ação é permanente. Todos os teus dados serão removidos.',

    settingsTitle: 'A TUA CONTA',
    sectionSecurity: 'Segurança',
    sectionSession: 'Sessão',
    sectionDanger: 'Zona de risco',

    linkSent: 'Link enviado! Verifica o teu email.',
    passwordChanged: 'Password alterada com sucesso.',
    passwordReset: 'Password definida. Podes fazer login.',

    notAuthenticated: 'Não estás autenticado.',

    errors: {
      invalidCredentials: 'Email ou password incorretos.',
      emailTaken: 'Este email já está registado.',
      weakPassword: 'A password deve ter pelo menos 6 caracteres.',
      invalidEmail: 'Email inválido.',
      passwordMismatch: 'As passwords não coincidem.',
      emailNotConfirmed: 'Email ainda não confirmado. Verifica a tua caixa de entrada.',
      rateLimit: 'Demasiadas tentativas. Aguarda um momento.',
      generic: 'Algo correu mal. Tenta novamente.',
    },
  },
} as const

export type Strings = typeof pt

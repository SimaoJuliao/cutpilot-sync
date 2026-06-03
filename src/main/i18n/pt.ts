/**
 * pt.ts — Portuguese strings for the main process (Electron dialogs, system notifications).
 * Mirror of src/renderer/src/i18n/pt.ts — same pattern, separate file because
 * main and renderer are built as independent bundles and cannot share imports.
 *
 * To add a new language (e.g. English):
 *   1. Duplicate this file as en.ts and translate every value.
 *   2. In index.ts, swap the import to use en.ts (or detect locale automatically).
 */

export const pt = {
  updater: {
    title: 'Atualização disponível',
    message: 'Uma nova versão do CutPilot Sync foi descarregada.',
    detail: 'Clica em "Reiniciar" para instalar a atualização agora, ou "Mais tarde" para instalar na próxima vez que abrires a app.',
    restartBtn: 'Reiniciar agora',
    laterBtn: 'Mais tarde',
  },
} as const

export type MainStrings = typeof pt

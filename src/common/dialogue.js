// Long layout padding from the PC script does not fit the watch text panel.
// Preserve paragraph breaks, short indents, punctuation and the raw saved text.
export function formatDialogue(text){
  return String(text||'').replace(/(^|\n)[ \t\u3000]{3,}/g,'$1');
}

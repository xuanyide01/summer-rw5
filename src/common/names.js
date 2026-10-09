// Keep the story's short form, but use the complete name in character labels.
export function visibleText(text,fullName){
  const value=String(text||'').replace(/䌷/g,'紬').replace(/紬[·・\s]?文德斯/g,'紬文德斯').replace(/Tsumugi/g,'紬文德斯').replace(/؟/g,'？');
  return fullName?value.replace(/紬(?!文德斯)/g,'紬文德斯'):value;
}
// The bundled subset covers every original line containing the missing glyph.
// Other lines keep the built-in font, without depending on font-stack fallback.
export function textFont(text){return /紬/.test(String(text||''))?'summername':'sans-serif';}

// PCM s16le, with two seconds of silence after the complete title track.
// Stop before EOF; never use native loop, seek or periodic native getters.
export const TITLE_CONTENT_MS=237000;
export const TITLE_RESTART_GAP_MS=1200;
export const TITLE_LOAD_TIMEOUT_MS=10000;
export function makeTitleMusic(audio,changed){
  let owned=false,wanted=false,failed=false,destroyed=false,timer=null,loadTimer=null,generation=0,announced=false;
  function cancel(){if(timer!==null)clearTimeout(timer);if(loadTimer!==null)clearTimeout(loadTimer);timer=null;loadTimer=null;}
  // Set ownership before src: a failing setter can already have acquired a stream.
  // Never stop another application's player when we have not acquired our own.
  function close(){if(!owned)return;owned=false;try{audio.stop();}catch(e){}console.log('SUMMER_RW5 audio stopped');}
  function stop(){wanted=false;generation++;cancel();close();}
  function failure(data,code){if(destroyed)return;failed=true;console.error('SUMMER_RW5 audio error',String(data),code);stop();if(changed)changed(false);}
  function later(fn,ms,token){if(timer!==null)clearTimeout(timer);const id=setTimeout(()=>{if(token!==generation||destroyed||timer!==id)return;timer=null;fn();},ms);timer=id;}
  function arm(token){later(()=>{if(!wanted||!owned)return;close();console.log('SUMMER_RW5 title guarded stop');later(()=>{if(wanted&&!failed)play();},TITLE_RESTART_GAP_MS,token);},TITLE_CONTENT_MS,token);}
  function loaded(){if(!owned||!wanted||destroyed||failed)return;if(loadTimer!==null)clearTimeout(loadTimer);loadTimer=null;console.log('SUMMER_RW5 audio loaded title');}
  function play(){
    if(!wanted||failed||destroyed||!audio)return;const token=++generation;announced=false;
    try{
      owned=true;audio.autoplay=false;audio.loop=false;
      loadTimer=setTimeout(()=>{if(token!==generation||!owned||!wanted||destroyed)return;loadTimer=null;failure('Title data did not load; playback released');},TITLE_LOAD_TIMEOUT_MS);
      audio.src='/common/title-theme.wav';
      if(!owned||!wanted||failed||destroyed||token!==generation)return;
      audio.play();
      if(!owned||!wanted||failed||destroyed||token!==generation)return;
      if(!announced)arm(token);if(changed)changed(true);
    }catch(e){failure(e);}
  }
  if(audio){
    audio.onplay=()=>{if(!owned||!wanted||destroyed||failed||announced)return;announced=true;console.log('SUMMER_RW5 audio playing title');arm(generation);};
    audio.onloadeddata=loaded;
    audio.onstop=()=>{console.log('SUMMER_RW5 audio stop callback');if(owned&&wanted){console.log('SUMMER_RW5 audio interrupted');stop();}};
    audio.onpause=()=>{console.log('SUMMER_RW5 audio paused');stop();};
    audio.onended=()=>{console.log('SUMMER_RW5 unexpected audio EOF');if(owned&&wanted)failure('Unexpected EOF; replay disabled');};
    audio.onerror=(data,code)=>{if(owned&&wanted)failure(data,code);};
  }
  const controller={update(value){if(!value){stop();return;}wanted=true;if(!owned&&timer===null&&!failed&&!destroyed)play();},stop,
    retry(){if(destroyed)return;failed=false;if(changed)changed(true);},
    destroy(){stop();destroyed=true;if(audio){audio.onplay=null;audio.onloadeddata=null;audio.onstop=null;audio.onpause=null;audio.onended=null;audio.onerror=null;}}};
  return controller;
}

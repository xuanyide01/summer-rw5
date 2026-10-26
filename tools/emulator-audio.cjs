// Host preview only; watches use @system.audio directly.
exports.makeAudioMonitor=function(now=()=>Date.now()){
 let pending='',state={playing:false,revision:0,position:0,duration:237.0,updatedAt:now()};
 return {get(){return {...state};},feed(chunk){pending+=chunk;const lines=pending.split('\n');pending=lines.pop().slice(-10000);
  for(const line of lines){
   if(/SUMMER_RW5 audio stopped|SUMMER_RW5 audio paused|SUMMER_RW5 audio ended|SUMMER_RW5 audio error|SUMMER_RW5 app destroyed/.test(line)){state.playing=false;state.position=0;state.updatedAt=now();}
   if(/SUMMER_RW5 audio playing /.test(line)){state.playing=true;state.revision++;state.position=0;state.updatedAt=now();}
   const m=line.match(/audio_media_player_query_cb\(\),volume:\d+ position:(\d+) duration:(\d+)/);
   if(m&&state.playing){state.position=Number(m[1])/1000;state.duration=Number(m[2])/1000;state.updatedAt=now();}
  }
 }};
};

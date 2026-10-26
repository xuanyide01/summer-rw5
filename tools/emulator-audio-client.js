(()=>{
 const control=document.createElement('button'),label=document.createElement('p'),audio=new Audio('/title-audio.wav');
 control.textContent='启用预览声音';label.textContent='预览声音默认关闭。';document.querySelector('aside').append(control,label);
 let enabled=false,busy=false,revision=-1;
 control.onclick=()=>{enabled=!enabled;control.textContent=enabled?'关闭预览声音':'启用预览声音';if(!enabled){audio.pause();label.textContent='预览声音已关闭。';}else sync();};
 async function sync(){
  if(busy)return;busy=true;
  try{const r=await fetch('/audio-state',{cache:'no-store'});if(!r.ok)return;const s=await r.json();
   if(!enabled||document.hidden||!s.playing){audio.pause();label.textContent=enabled?'当前未播放标题音乐。':'预览声音已关闭。';return;}
   const position=Math.max(0,Math.min(s.duration-0.1,s.position+(Date.now()-s.updatedAt)/1000));
   if(revision!==s.revision||audio.paused){revision=s.revision;audio.currentTime=position;await audio.play();}
   else if(Math.abs(audio.currentTime-position)>1.5)audio.currentTime=position;
   label.textContent='正在播放标题目录曲。';
  }catch(e){audio.pause();enabled=false;control.textContent='启用预览声音';label.textContent='点击按钮后可启用声音。';}
  finally{busy=false;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.pause();else sync();});
 setInterval(sync,500);
})();

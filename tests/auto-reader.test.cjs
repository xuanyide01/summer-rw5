const test=require('node:test'),assert=require('node:assert/strict');
const {api,model}=require('./page-harness.cjs');
test('three waits begin after final glyph, extend long paragraphs and retain old settings',()=>{
 assert.equal(api.autoWait(0,20),2600);assert.equal(api.autoWait(1,20),1500);assert.equal(api.autoWait(2,20),800);assert.equal(api.autoWait(1,61),1555);assert.equal(api.autoWait(1,10000),6500);
 const m=model({fontSize:28,textSpeed:0,autoSpeed:2,autoEnabled:true});assert.equal(m.p.autoEnabled,false);assert.equal(m.p.autoSpeed,2);m.start();m.p.showMenu();m.p.cycleAutoSpeed();const value=JSON.parse(m.saved.get('summer_rw5_settings_v1'));assert.equal(value.autoSpeed,0);assert.equal(value.textSpeed,0);assert.ok(!('autoEnabled' in value));
});
test('automatic glyph rate stays 30 ms and preserves independent manual display preference',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);const current=m.position();assert.equal(m.p.textSpeed,0);assert.ok(m.p.displayText.length<m.p.fullText.length);
 const remaining=(m.p.fullText.length-m.p.displayText.length)*30;m.tick(remaining-1);assert.equal(m.position(),current);m.tick(1);assert.equal(m.p.displayText,m.p.fullText);m.tick(api.autoWait(m.p.autoSpeed,m.p.fullText.length)-1);assert.equal(m.position(),current);m.tick(1);assert.notEqual(m.position(),current);
});
test('manual completion starts a fresh automatic wait, without consuming the next line',()=>{
 const m=model();m.start();m.enable();m.tick(1500);const current=m.position();m.p.advance();assert.equal(m.p.displayText,m.p.fullText);m.tick(api.autoWait(m.p.autoSpeed,m.p.fullText.length)-1);assert.equal(m.position(),current);m.tick(1);assert.notEqual(m.position(),current);
});
test('menus and all 30 slots pause auto; return restarts the wait without changing old save keys',()=>{
 const m=model(),p=m.p;m.start();m.enable();const before=m.position();m.tick(500);p.showMenu();m.tick(60000);assert.equal(m.position(),before);p.openSlots('load');m.tick(10000);assert.equal(p.mode,'slots');assert.equal(p._slotData.length,30);assert.equal(m.position(),before);p.closeSlots();p.resume();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('original choice never selects itself; selecting manually resumes automatic reading',()=>{
 const m=model(),p=m.p;m.start();p.clearTyping();p.autoEnabled=true;p.session=api.newState(7);p.session.cursor=24;p.cachedChapter=0;p.renderFrame();m.tick(30);assert.equal(p.mode,'choice');const before=JSON.stringify(p.session);m.tick(60000);assert.equal(JSON.stringify(p.session),before);assert.equal(p.autoEnabled,true);p.pick(0);m.tick(30);assert.equal(p.mode,'play');m.tick(p.fullText.length*30+api.autoWait(p.autoSpeed,p.fullText.length)+30);assert.ok(m.messages.some(x=>x.startsWith('SUMMER_RW5 auto advance')));
});
test('dragging or scrolling body pauses auto and cannot trigger a manual tap',()=>{
 const m=model(),p=m.p;m.start();m.enable();const before=m.position();p.dialogueTouchStart({touches:[{clientX:250,clientY:420}]});m.tick(60000);assert.equal(m.position(),before);p.dialogueTouchMove({touches:[{clientX:250,clientY:350}]});p.dialogueTouchEnd();p.dialogueTap();assert.equal(m.position(),before);m.tick(500);p.dialogueScrolled();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('background pauses text and auto, foreground restarts the wait',()=>{
 const m=model();m.start();m.enable();const before=m.position();m.tick(400);m.p.onHide();m.tick(60000);assert.equal(m.position(),before);m.p.onShow();m.tick(1499);assert.equal(m.position(),before);m.tick(1);assert.notEqual(m.position(),before);
});
test('previous line, title, error, ending and destroy disable auto and clear callbacks',()=>{
 for(const action of ['goBack','toTitle','fail','onDestroy','ending']){
  const m=model(),p=m.p;m.start();m.enable();if(action==='ending'){p.session=api.newState(7);p.session.cursor=api.catalog.scenes['7'].length;p.session.stack=[];p.session.progression='story';p.renderFrame();m.tick(30);assert.equal(p.mode,'end');}else p[action]('test');const before=m.position();m.tick(60000);assert.equal(p.autoEnabled,false,action);assert.equal(m.position(),before,action);assert.equal(m.timers.size,0,action);
 }
});
test('cancelled timers cannot advance changed sessions or consume replacement timers',()=>{
 const m=model();m.start();m.enable();const callback=m.timers.get(m.p._autoTimer).fn,before=m.position();m.p.showMenu();m.p.resume();const current=m.p._autoTimer;callback();assert.equal(m.position(),before);assert.equal(m.p._autoTimer,current);m.p.loading=true;m.tick(2000);assert.equal(m.position(),before);
});

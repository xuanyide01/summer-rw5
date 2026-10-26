"""Whole original title BGM, signed 16-bit PCM, no ADPCM/MP3 decoder or ZIP inflate."""
import hashlib,json,os,struct,subprocess,sys,wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('SUMMER_AUDIO_CACHE',str(ROOT.parent/'summer-original-audio')));OUT.mkdir(exist_ok=True)
source=OUT/'BGM32.ogg'
if '--cached-source' not in sys.argv:
    from luca_format import ROOT as GAME,pak_index
    file=GAME/'files/music/MUSIC.PAK';entry=next(e for e in pak_index(file) if e['name']=='BGM32')
    with file.open('rb') as f:f.seek(entry['offset']);raw=f.read(entry['size'])
    source.write_bytes(raw)
raw=source.read_bytes();assert hashlib.sha256(raw).hexdigest()=='a1f480903426d02f287230a2b421f330960abcd864282041ed7fc402b419ecf5'
assert raw.startswith(b'OggS');seconds=struct.unpack_from('<Q',raw,raw.rfind(b'OggS')+6)[0]/48000
rate=int(os.environ.get('SUMMER_TITLE_SAMPLE_RATE','4000'));audio=ROOT/'src/common/title-theme.wav'
subprocess.run([os.environ['WATCH_FFMPEG'],'-y','-v','error','-i',str(source),'-af',f'atrim=duration={seconds},afade=t=out:st={seconds-.12}:d=0.12,apad=pad_dur=2','-map_metadata','-1','-fflags','+bitexact','-flags:a','+bitexact','-ac','1','-ar',str(rate),'-c:a','pcm_s16le',str(audio)],check=True)
with wave.open(str(audio),'rb') as f:
    assert (f.getsampwidth(),f.getnchannels(),f.getframerate(),f.getcomptype())==(2,1,rate,'NONE')
    length=f.getnframes()/rate;assert length>=seconds+1.999
    f.setpos(f.getnframes()-rate);assert not any(f.readframes(rate))
report={'source':'MUSIC.PAK/BGM32','sourceSha256':hashlib.sha256(raw).hexdigest(),'file':'common/title-theme.wav','sourceContentSeconds':seconds,'wholeTrackPreserved':True,'fileSeconds':length,'codec':'WAV PCM signed 16-bit little endian','sampleRate':rate,'channels':1,'bytes':audio.stat().st_size,'sha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'silentGuardSeconds':2,'guardedStopMilliseconds':int(seconds*1000),'restartGapMilliseconds':1200,'audioQualityTradeoff':'4 kHz mono to retain the complete 237-second track, uncompressed PCM and unchanged story/CG pixels within 25,000,000 bytes. Lower bandwidth than the 11.025 kHz ADPCM build.','doesNotChangeSystemVolume':True,'devicePlaybackRequiresNewPhysicalTest':True}
(ROOT/'reports/title-audio-v023.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps(report),flush=True)

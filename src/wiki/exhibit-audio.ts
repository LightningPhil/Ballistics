/** Opt-in, gesture-unlocked audio for the two museum experiments. */
export class ExhibitAudio {
  private context?:AudioContext;
  private engine?:AudioBufferSourceNode;
  private rumble?:OscillatorNode;
  private engineGain?:GainNode;
  private fuseGain?:GainNode;
  private master?:GainNode;
  private enabled=false;
  private closed=false;
  private revision=0;
  private report:(message:string)=>void;
  constructor(report:(message:string)=>void) {this.report=report;}
  async enable() {
    if(this.closed)return;
    this.enabled=true;const revision=++this.revision;
    try {
      if(!this.context){
        const Context=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
        if(!Context)throw new Error('Web Audio unavailable');
        const c=this.context=new Context();this.master=c.createGain();this.master.gain.value=.45;this.master.connect(c.destination);
        this.engineGain=c.createGain();this.engineGain.gain.value=0;this.engineGain.connect(this.master);
        const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        this.engine=c.createBufferSource();this.engine.buffer=buffer;this.engine.loop=true;
        const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1500;
        this.engine.connect(filter).connect(this.engineGain);this.engine.start();
        const sizzle=c.createBiquadFilter();sizzle.type='bandpass';sizzle.frequency.value=2800;sizzle.Q.value=.6;
        this.fuseGain=c.createGain();this.fuseGain.gain.value=0;
        this.engine.connect(sizzle).connect(this.fuseGain).connect(this.master);
        this.rumble=c.createOscillator();this.rumble.type='triangle';this.rumble.frequency.value=85;
        const low=c.createGain();low.gain.value=.2;this.rumble.connect(low).connect(this.engineGain);this.rumble.start();
      }
      const c=this.context;
      await c.resume();
      if(this.closed||!this.enabled||revision!==this.revision)return;
      if(c.state!=='running')throw new Error('Audio suspended');
      this.master!.gain.setTargetAtTime(.45,c.currentTime,.01);
      this.report('Quiet sound effects on · silent while paused.');
    }catch{if(!this.closed&&revision===this.revision){this.enabled=false;this.report('Audio could not start. Try Sound again and check browser or device mute.');}}
  }
  setEngine(active:boolean,level=0){const c=this.context;if(!c||this.closed)return;this.engineGain!.gain.setTargetAtTime(this.enabled&&active?.08+.13*Math.max(0,Math.min(1,level)):0,c.currentTime,.05);}
  setFuse(active:boolean,progress=0){const c=this.context;if(!c||this.closed)return;this.fuseGain!.gain.setTargetAtTime(this.enabled&&active?.10+.025*Math.sin(progress*117)**2:0,c.currentTime,.015);}
  effect(kind:'boom'|'whoosh'){
    const c=this.context;if(!this.enabled||!c||c.state!=='running')return;
    const duration=kind==='boom'?.45:.6,buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*(kind==='boom'?6:4));
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind==='boom'?950:2100;gain.gain.value=kind==='boom'?.35:.14;
    source.connect(filter).connect(gain).connect(this.master!);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  mute(){this.enabled=false;++this.revision;this.setEngine(false);this.setFuse(false);if(this.context&&!this.closed)this.master!.gain.setTargetAtTime(0,this.context.currentTime,.015);this.report('Sound off.');}
  dispose(){this.closed=true;this.enabled=false;++this.revision;this.engine?.stop();this.rumble?.stop();void this.context?.close().catch(()=>{});}
}

// import { Wav, CWav, NWav, Lfsr, Synth } from 'https://codepen.io/m-nakasato/pen/RwXopJg.js';
// import { Wav, CWav, NWav, Lfsr, Synth } from 'https://codepen.io/m-nakasato/pen/yLmEbJR.js';
import { Wav, CWav, NWav, Synth } from 'https://codepen.io/m-nakasato/pen/MWNLqQx.js';

import { Analyser } from 'https://codepen.io/m-nakasato/pen/gbYpBPj.js';

import { lfsr } from 'https://codepen.io/m-nakasato/pen/yyBOvYx.js'

const $ = document.querySelector.bind(document);
const _ = document.querySelectorAll.bind(document);
// let _AC = new window.AudioContext;
let _AC;
// let analyser = new Analyser(_AC);
let analyser;
let synth;
let xhr = new XMLHttpRequest();
let sample;
xhr.responseType = 'arraybuffer';
xhr.withCredentials = true;
xhr.onload = () => {
  _debug('response');
  _AC.decodeAudioData(xhr.response, (data) => sample = data);
  let src = new AudioBufferSourceNode(_AC, {buffer:sample});
  src.connect(_AC.destination);
  let sTime = _AC.currentTime;
  src.start(sTime);
  src.stop(sTime + 1);
  src.onended = () => {
    src.disconnect();
    src.buffer = null;
  };
};
let gbWf = {
  test: '8BEDA8ADFE410279CEDCCB9757413545',
  //Ah2: '8DFEA7679AA9777899976679A96213',
  Ah: 'DFFD8311259BCCBA8754338CED820025',
  Ee: 'ABCCDEEEFFEDCA874474046225644788',
  Oo: 'CDBA999BDFFEC9753443365354102469',
  Eh: 'FFECA8743019804EF869CB758A88BEFF',
  //Oh: 'BCBACEFCA9AB976986456530135434',
  //Oh: '8998CFDA74479CCA75355530355205',
  //Oh: '889AB3539C96678A9767788866789788',
  Oh: 'DFFFDA864322123579CFFEDD82001347',
  sinesaw: '8ACDEEFFFFEEDCA80123456789ABCDEF',
  dblsaw: '0123456789ABCDEF02468ACE02468ACE',
  arrow1: '00FF11EE22DD33CC44BB55AA66997788',
  arrow2: '0000EEEE2222CCCC4444AAAA66668888',
  epiano: '756424202202545877BCBFFEEFCDEBAB',
  guitar: '8FDBABB0047B657650358ACA6A531254',
  bass: '011234556778899ABCDEFDCA86420677',
  tom1: '00112469BDEEEFFFFEEEEDB964211100',
  tom2: 'BB9999999999AACC0000000000000000',
  custom: 'FFFFFFFFFFFFFFFF0000000000000000'
};

class Sequencer {
  #synth; #seq; #pTime; #score; #playID;
  constructor(synths, score) {
    this.#synth = synths;
    this.#seq = this.#parse(score);
    // _debug(JSON.stringify(this.#seq, null, '\t'));
    //this.#pTime = this.#calcPTime(score)
    this.#score = score;
  }
  //get playTime() {return this.#pTime;}
  /*#calcPTime(score) {
    _debug('spb: ' + 60 / score.bpm);
    return score.beat * 60 / score.bpm * score.barSeq.length;
  }*/
  #simile(base, recursion) {
    let rst = [];
    base.forEach(elem => {
      if (/^[%\*][24]?$/.test(elem)) {
        let r = /[24]/.exec(elem);
        r = r === null ? 1 : r[0] - 0;
        for (let i = 0; i < r; i++)
          rst.push(rst[rst.length - r]);
      } else {
        recursion ?
          rst.push(this.#simile(elem.split('/'))) :
          rst.push(elem);
      }
    });
    return rst;
  }
  #setOpt(plData, opt) {
    opt.forEach(o => {
      let [k, v] = o.split(':');
      //todo: vib、tremで第2引数以降の省略に対応する
      plData[1][k] = isNaN(v) ? v.split('-').map(_v => isNaN(_v) ? _v : Number(_v)) : v - 0;
    });
  }
  #parse(score) {
    let seq = [], spb = 60 / score.bpm;
    score.notes.forEach((note, ch) => {
      let bars = this.#simile(note.split('|'), 1), chData = [];
      score.barSeq.forEach(barNum => {
        bars[barNum].forEach(beat => {
          let repeatBuf;
          beat.split(' ').forEach(noteInfo => {
            if (noteInfo == '+') {
              chData.push(repeatBuf);
              return;
            }
            let note = noteInfo.split(',');
            let plData = [note[0], {}];
            let dot = /\.$/.test(note[1]) ? 1.5 : 1;
            if (/t$/.test(note[1])) {
              note[1] = note[1].slice(0,-1);
              note[1] *= 1.5;
            };
            plData[1].dur = spb * 4 / note[1] * dot;
            if (score.set[ch]['ini']) this.#setOpt(plData, score.set[ch]['ini'].split(','));
            if (note.length > 2 && /^set/.test(note[2])) {
              let setName = note[2].split(':')[1];
              let set = score.set[ch][setName].split(',');
              note.pop();
              set.forEach(def => note.push(def));
            }
            if (note.length > 2) this.#setOpt(plData, note.slice(2));
            repeatBuf = plData;
            chData.push(plData);
          });
        });
      });
      seq.push(chData);
    });
    return seq;
  }
  #play(offset, channel, sTime) {
    let eTime = 0;
    channel.forEach(ch => {
      let nextTime = sTime;
      if (offset > 0) nextTime -= offset;
      this.#seq[ch].forEach(note => {
        if (nextTime < 0) {
          nextTime += note[1].dur;
        } else {
          if (note[0] == '_') {
            nextTime += note[1].dur;
          } else {
            note[1].sTime = nextTime;
            nextTime = this.#synth[ch].play(...note).eTime;
          }
        }
      });
      if (eTime < nextTime) eTime = nextTime;
    });
    return {sTime, eTime};
  }
  #fullCh() {
    let chNum = this.#score.notes.length;
    return [...Array(chNum)].map((_, i) => i);
  }
  play(offset = 0, ch = this.#fullCh(), sTime = this.#synth[0].now, cnt = 0) {
    let score = this.#score;
    let intro = score.beat * 60 / score.bpm * score.intro;
    let os = cnt == 0 ? offset : intro;
    let rst = this.#play(os, ch, sTime);
    _debug(JSON.stringify(rst) + 'cnt: ' + cnt);
    //_debug(rst.eTime - rst.sTime);
    if (score.loop) {
      this.#playID = setTimeout(() => {
        this.play(offset, ch, rst.eTime, cnt + 1);
      // }, (rst.eTime - rst.sTime - 1) * 1000);
      }, (rst.eTime - rst.sTime) * 1000);
    }
  }
  stop() {
    clearTimeout(this.#playID);
    this.#synth.forEach(synth => synth.discard());
  }
}

//studio
//metronome sawtooth c7 c6 c6
//拍を繰り返す際、対象の拍が1以外はエラー(2拍は2)
//小節を繰り返す際、対象の小節が4(8, 16)以外はエラー
//1小節が4(3)より大きい分は繰越、未満はエラー

let bgm;

function seqTest() {
  let synths = [];
  _('#ch select').forEach(w => synths.push(getSynth(w.value)));
  let bpm = $('#bpm').valueAsNumber;
  score.bpm = bpm;
  bgm = new Sequencer(synths, score);
  let skip = $('#skip').value;
  let ch = [];
  _('#ch li input').forEach((chSw, idx) => {
    if (chSw.checked) ch.push(idx)});
  //_debug(score.barSeq.length);
  bgm.play(0.6 * 4 * skip, ch);
  //_debug('estimate: ' + bgm.playTime);
}

//先頭に休符を入れたのは、最初の音の再生が間に合わないための暫定対応
let score = {
  bpm: 100,
  beat: 4, //2, 3, 4
  loop: 1, //0, 1
  intro: 1,
  notes: [
    '_,16/E5,16 + _,16 E5,16/_,16 C5,16 E5,16 _,16/G5,16 _,8./G4,16 _,8.' +
    '|C5,16 _,8 G4,16/_,8 E4,16 _,16/_,16 A4,16 _,16 B4,16/_,16 A#4,16 A4,16 _,16' +
    '|G4,8t,set:tri E5,8t,set:tri G5,8t,set:tri/A5,16 _,16 F5,16 G5,16/_,16 E5,16 _,16 C5,16/D5,16 B4,16 _,8' +
    '|_,8 G5,16 F#5,16/F5,16 D#5,16 _,16 E5,16/_,16 G#4,16 A4,16 C5,16/_,16 A4,16 C5,16 D5,16' +
    '|_,8 G5,16 F#5,16/F5,16 D#5,16 _,16 E5,16/_,16 C6,16 _,16 C6,16/C6,16 _,8.' +
    '|_,8 G5,16 F#5,16/F5,16 D#5,16 _,16 E5,16/_,16 G#4,16 A4,16 C5,16/_,16 A4,16 C5,16 D5,16' +
    '|_,8 D#5,16 _,16/_,16 D5,16 _,8/C5,16 _,8./_,4' +
    '|C5,16 + _,16 C5,16/_,16 C5,16 D5,16 _,16/E5,16 C5,16 _,16 A4,16/G4,16 _,8.' +
    '|C5,16 + _,16 C5,16/_,16 C5,16 D5,16 E5,16/_,4/*' +
    '|E5,16 C5,16 _,16 G4,16/_,8 G#4,16 _,16/A4,16 F5,16 _,16 F5,16/A4,16 _,8.' +
    '|B4,8t,set:tri A5,8t,set:tri +/A5,8t,set:tri G5,8t,set:tri F5,8t,set:tri/E5,16 C5,16 _,16 A4,16/G4,16 _,8.' +
    '|B4,16 F5,16 _,16 F5,16/F5,8t,set:tri E5,8t,set:tri D5,8t,set:tri/C5,16 _,8./_,4',
    
    '_,16/F#4,16 + _,16 F#4,16/_,16 F#4,16 + _,16/B4,16 _,8./_,4' +
    '|E4,16 _,8 C4,16/_,8 G3,16 _,16/_,16 C4,16 _,16 D4,16/_,16 C#4,16 C4,16 _,16' +
    '|C4,8t,set:tri G4,8t,set:tri B4,8t,set:tri/C5,16 _,16 A4,16 B4,16/_,16 A4,16 _,16 E4,16/F4,16 D4,16 _,8' +
    '|_,8 E5,16 D#5,16/D5,16 B4,16 _,16 C5,16/_,16 E4,16 F4,16 G4,16/_,16 C4,16 E4,16 F4,16' +
    '|_,8 E5,16 D#5,16/D5,16 B4,16 _,16 C5,16/_,16 F5,16 _,16 F5,16/F5,16 _,8.' +
    '|_,8 E5,16 D#5,16/D5,16 B4,16 _,16 C5,16/_,16 E4,16 F4,16 G4,16/_,16 C4,16 E4,16 F4,16' +
    '|_,8 G#4,16 _,16/_,16 F4,16 _,8/E4,16 _,8./_,4' +
    '|G#4,16 + _,16 G#4,16/_,16 G#4,16 A#4,16 _,16/G4,16 E4,16 _,16 E4,16/C4,16 _,8.' +
    '|G#4,16 + _,16 G#4,16/_,16 G#4,16 A#4,16 G4,16/_,4/*' +
    '|C5,16 A4,16 _,16 E4,16/_,8 E4,16 _,16/F4,16 C5,16 _,16 C5,16/F4,16 _,8.' +
    '|G4,8t,set:tri F5,8t,set:tri +/F5,8t,set:tri E5,8t,set:tri D5,8t,set:tri/C5,16 A4,16 _,16 F4,16/E4,16 _,8.' +
    '|G4,16 D5,16 _,16 D5,16/D5,8t,set:tri C5,8t,set:tri B4,8t,set:tri/G4,16 E4,16 _,16 E4,16/C4,16 _,8.',
    
    '_,16/D3,16 + _,16 D3,16/_,16 D3,16 + _,16/G4,16 _,8./G3,16 _,8.' +
    '|G3,16 _,8 E3,16/_,8 C3,16 _,16/_,16 F3,16 _,16 G3,16/_,16 F#3,16 F3,16 _,16' +
    '|E3,8t C4,8t E4,8t/F4,16 _,16 D4,16 E4,16/_,16 C4,16 _,16 A3,16/B3,16 G3,16 _,8' +
    '|C3,16 _,8 G3,16/_,8 C4,16 _,16/F3,16 _,8 C4,16/C4,16 + F3,16 _,16' +
    '|C3,16 _,8 E3,16/_,8 G3,16 C4,16/_,16 G5,16 _,16 G5,16/G5,16 _,16 G3,16 _,16' +
    '|C3,16 _,8 G3,16/_,8 C4,16 _,16/F3,16 _,8 C4,16/C4,16 + F3,16 _,16' +
    '|C3,16 _,16 G#3,16 _,16/_,16 A#3,16 _,8/C4,16 _,8 G3,16/G3,16 _,16 C3,16 _,16' +
    '|G#2,16 _,8 D#3,16/_,8 G#3,16 _,16/G3,16 _,8 C3,16/_,8 G2,16 _,16' +
    '|%' +
    '|C3,16 _,8 F#3,16/G3,16 _,16 C4,16 _,16/F3,16 _,16 F3,16 _,16/C4,16 + F3,16 _,16' +
    '|D3,16 _,8 F3,16/G3,16 _,16 B3,16 _,16/G3,16 _,16 G3,16 _,16/C4,16 + G3,16 _,16' +
    '|G3,16 _,8 G3,16/G3,8t A3,8t B3,8t/C4,16 _,16 G3,16 _,16/C3,16 _,8.',
    
    '_,16/1,16 _,16 1,16,set:chh 1,16/_,16 1,16,set:chh 1,16 _,16/1,16 _,8 1,16/_,16 1,16,set:chh + +' +
    '|19,16,set:bd _,16 1,16,set:chh 1,16,set:chh2/1,16 _,16 1,16,set:chh 1,16,set:chh2/*2' +
    '|%' +
    '|%2' +
    '|%2' +
    '|1,16 _,8 1,16/_,8 1,16 _,16/1,16 _,8 1,16/_,16 1,16,set:chh + +' +
    '|%' +
    '|1,16,set:chh _,8 1,16,set:chh/1,16 _,16 1,16,set:chh _,16/*2' +
    '|%' +
    '|%',
  ],
  barSeq: [0,1,2,1,2,3,4,5,6,3,4,5,6,7,8,7,0,1,2,1,2,9,10,9,11,9,10,9,11,7,8,7,0,9,10,9,11],
  //barSeq: [0,1,2,1,2,3,4,5,6],
  set: [
    {
      //ini:'env:.01-.15-0-.05,vol:.85',
      // ini:'env:.01-0-1-.01,vol:.85',
      ini:'env:.01-.15-.75-.05,vol:.85',
      //tri:'env:.01-.183-0-.1,vol:.85'
      // tri:'env:.01-0-1-.03,vol:.85'
      tri:'env:.01-.151-.0-.0,vol:.85'
    },
    {
      //ini:'env:.01-.15-0-.05,vol:.85',
      // ini:'env:.01-0-1-.01,vol:.85',
      ini:'env:.01-.15-.75-.05,vol:.85',
      //tri:'env:.01-.183-0-.1,vol:.85'
      tri:'env:.01-0-1-.03,vol:.85'
    },
    {
      ini:'env:.01-.15-1-.05',
    },
    {
      ini:'env:0-.15-0-.05,vol:.5',
      chh:'env:.01-.01-0-0,vol:.5',
      chh2:'env:.01-.01-0-0,vol:.5,swg:1',
      bd:'env:0-.2-0-.13,vol:.5',
    }
  ]
};

function getFcPitches() {
  let fcPitches = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
  let pitches = [...new Set(fcPitches.map(fcp => Math.round((_AC.sampleRate / 1789772.5) * fcp)))].filter(pitch => pitch != 0);
  return pitches;
}

function analyze(freq, dur) {
  let sTime = _AC.currentTime;
  let delay = 1 / freq * 1000 * 50;
  let timeoutId = setInterval(() => {
    $('#analyser').innerHTML = '';
    $('#analyser').append(analyser.getOscillo(freq));
    $('#analyser').append(' ');
    $('#analyser').append(analyser.getSpectrum());
  }, delay);
  setTimeout(() => clearTimeout(timeoutId), dur * 1000 - 100);
}

function initView(synth) {
  // _debug('initView');
  // $('#pwr').classList.replace('off', 'on');
  _('#keyboard input').forEach(key => key.remove());
  let wave = $('#waveform').value;
  if (wave == 'noise') {
    // let pitches = [...Array(8)].map((_, i) => 2 ** i);
    let pitches = synth.notes;
    for (let i = 0; i < pitches.length; i++) {
      let keyElm = document.createElement('input');
      keyElm.setAttribute('type', 'button');
      // keyElm.setAttribute('value', pitches[i]);
      keyElm.setAttribute('value', i);
      $('#keyboard').append(keyElm);
    }
  } else if (wave == 'fcNoise') {
    // let pitches = getFcPitches();
    let pitches = synth.notes;
    for (let i = 0; i < pitches.length; i++) {
      let keyElm = document.createElement('input');
      keyElm.setAttribute('type', 'button');
      // keyElm.setAttribute('value', pitches[i]);
      keyElm.setAttribute('value', i);
      $('#keyboard').append(keyElm);
    }
  } else {
    for (let octNum = 2; octNum < 8; octNum++) {
      for (let noteIdx = 0; noteIdx < 12; noteIdx++) {
        if (octNum == 7 && noteIdx > 0) break;
        let note = synth.notes[noteIdx];
        let pitchName = note + octNum;
        let keyElm = document.createElement('input');
        keyElm.setAttribute('type', 'button');
        keyElm.setAttribute('value', pitchName);
        if (note.slice(-1) == '#') keyElm.classList.add('short');
        $('#keyboard').prepend(keyElm);
      }
    }
  }
  
  _('#keyboard input').forEach(key => {
    key.addEventListener('touchstart', e => {
      // _debug('touchstart');
      e.preventDefault();
    });
    key.addEventListener('pointerdown', e => {
      e.preventDefault();
      // _debug('pointerdown');
      let keyNum = e.target.value;
      let tone = $('#tone').value == '' ? undefined : $('#tone').value;
      let dur = isNaN($('#duration').valueAsNumber) ? undefined : $('#duration').valueAsNumber;
      let vol = isNaN($('#volume').valueAsNumber) ? undefined : $('#volume').valueAsNumber;
      let det = isNaN($('#detune').valueAsNumber) ? undefined : $('#detune').valueAsNumber;
      let swp = isNaN($('#sweep').valueAsNumber) ? undefined : $('#sweep').valueAsNumber;
      let envA = $('#envA').valueAsNumber;
      let envD = $('#envD').valueAsNumber;
      let envS = $('#envS').valueAsNumber;
      let envR = $('#envR').valueAsNumber;
      let env = isNaN(envA) || isNaN(envD) || isNaN(envS) || isNaN(envR) ? undefined : [envA, envD, envS, envR];
      let vDepth = isNaN($('#vDepth').valueAsNumber) ? undefined : $('#vDepth').valueAsNumber;
      let vRate = isNaN($('#vRate').valueAsNumber) ? undefined : $('#vRate').valueAsNumber;
      let vWave = $('#vWave').value == '' ? undefined : $('#vWave').value;
      let tDepth = isNaN($('#tDepth').valueAsNumber) ? undefined : $('#tDepth').valueAsNumber;
      let tRate = isNaN($('#tRate').valueAsNumber) ? undefined : $('#tRate').valueAsNumber;
      let tWave = $('#tWave').value == '' ? undefined : $('#tWave').value;
      let rtn = synth.play(keyNum, {tone: tone, dur: dur, vol: vol, det: det, swp: swp, env: env, vib: [vDepth, vRate, vWave], trem: [tDepth, tRate, tWave]});
      e.target.classList.add('on');
      analyze(rtn.freq, dur);
    });
    key.addEventListener('pointerup', e => {
      // _debug('pointerup');
      e.preventDefault();
      e.target.classList.remove('on');
    });
  });
  
  if (wave == 'gbWave') {
    if ($('#cwt table').innerHTML == '') initCwt();
    $('#cwt').classList.remove('hide');
  } else {
    $('#cwt').classList.add('hide');
  }
}

function initCwt() {
  let tbl = $('#cwt table');
  tbl.innerHTML = '';
  for (let r = 15; r >= 0; r--) {
    let tr = document.createElement('tr');
    for (let c = 0; c < 32; c++) {
      let td = document.createElement('td');
      let rb = document.createElement('input');
      rb.setAttribute('type', 'radio');
      rb.setAttribute('name', 'cwt' + c);
      rb.setAttribute('value', r.toString(16).toUpperCase());
      //td.innerHTML = r.toString(16).toUpperCase();
      td.append(rb);
      tr.append(td);
    }
    tbl.append(tr);
  }
  _('#cwt input[type=radio]').forEach(rb => {
    rb.onclick = e => {
      let cwtNum = e.target.name.replace('cwt', '');
      //_debug(cwtNum);
      let cw = $('#cwt input[type=text]');
      let newCwt = '';
      for (let i = 0; i < cw.value.length; i++) {
        //_debug(cw.value[i]);
        newCwt += i == cwtNum ? e.target.value : cw.value[i];
      }
      //_debug(newCwt);
      cw.value = newCwt;
      $('#cwt input[type=text]').dispatchEvent(new Event('change'));
    };
  });
  $('#cwt input[type=text]').dispatchEvent(new Event('change'));
}

function getSynth(wave, analyserNode) {
  let WavClass, prm;
  switch (wave) {
    case 'sine':
    case 'square':
    case 'sawtooth':
    case 'triangle':
      WavClass = Wav;
      prm = wave;
      break;
    case 'fcPulse':
      WavClass = CWav;
      prm = ['F0', 'F000', 'F0000000'];
      break;
    case 'fcTriangle':
      WavClass = CWav;
      prm = ['0123456789ABCDEFFEDCBA9876543210'];
      break;
    case 'noise':
      // let f = (t) => ((((t / 2) & 128 & (5e5 / (t & 4095))) % 255) / 127 - 1) * Math.exp(-t / 5e3);
      WavClass = NWav;
      prm = {};
      break;
    case 'fcNoise':
      let functions = [lfsr(), lfsr(6)];
      let pitches = getFcPitches();
      WavClass = NWav;
      prm = {functions, pitches};
      break;
    case 'gbWave':
      let customWf = $('#cwt input[type=text]').value;
      gbWf['custom'] = customWf;
      WavClass = CWav;
      prm = Object.values(gbWf);
      break;
  }
  // _AC.resume();
  let wav = new WavClass(_AC, prm);
  return new Synth(_AC, wav, analyserNode);
}

function initSynth() {
  let wave = $('#waveform').value;
  synth = getSynth(wave, analyser.node);
}

function initSeq() {
  let chs = $('#ch');
  let wave = ['fcPulse', 'fcPulse', 'fcTriangle', 'fcNoise'];
  for (let ch = 0; ch < 4; ch++) {
    let chElm = document.createElement('li');
    let swElm = document.createElement('input');
    swElm.setAttribute('type', 'checkbox');
    swElm.setAttribute('checked', 'checked');
    chElm.append(swElm);
    let wfElm = $('#waveform').cloneNode(true);
    wfElm.removeAttribute('id');
    wfElm.value = wave[ch];
    chElm.append(wfElm);
    chs.append(chElm);
  }
  for (let seq = 0; seq < score.barSeq.length; seq++) {
    let optElm = document.createElement('option');
    optElm.innerText = seq;
    $('#skip').append(optElm);
  }
}

function setEvent() {
  $('#state').onclick = () => {
    _debug(_AC.state);
  }
  
  $('#resume').onclick = () => {
    _AC.resume();
  }
  
  $('#memChk').onclick = () => {
    _debug(window.crossOriginIsolated);
  }
  
  $('#keyA2').onclick = () => {
    // alert('keyA2');
    xhr.open('GET', 'https://m-nakasato.github.io/experiment/Piano.ff.A2.m4a', true);
    xhr.send();
    // let src = new AudioBufferSourceNode(_AC, {buffer:sample});
    // src.connect(_AC.destination);
    // let sTime = _AC.currentTime;
    // src.start();
    // src.start(sTime);
    // src.stop(sTime + 1);
    // src.onended = () => {
    //   src.disconnect();
    //   src.buffer = null;
    // };
  }
  
  $('#pwr').onclick = () => {
    if ($('#pwr').classList.contains('on')) {
      _AC.close();
    } else {
      _AC = new window.AudioContext;
      analyser = new Analyser(_AC)
      initSynth();
      initView(synth);
    }
    $('#pwr').classList.toggle('on');
  };
  
  $('#waveform').onchange = e => {
    $('#tone').innerHTML = '';
    let tones = [];
    if (e.target.value.indexOf('fcPulse') == 0) {
      tones = ['1:1', '1:3', '1:7'];
    } else if (e.target.value == 'gbWave') {
      tones = Object.keys(gbWf);
    } else if (e.target.value == 'fcNoise') {
      tones = ['long', 'short'];
    }
    tones.forEach((opt, idx) => {
      let optElm = document.createElement('option');
      optElm.innerText = opt;
      optElm.value = idx;
      $('#tone').append(optElm);
    });
    initSynth();
    initView(synth);
  };
  
  $('#cwt input[type=text]').onchange = e => {
    initSynth();
    initView(synth);
  };
  
  $('#coin').onclick = () => {
    let tone = $('#tone').value == '' ? undefined : $('#tone').value;
    let rtn = synth.play('B5', {tone: tone, dur: 0.1});
    let rtn2 = synth.play('E6', {tone: tone, sTime: rtn.eTime, dur: 1, env: [0,0,1,1]});
    analyze(rtn2.freq, 1.1);
  };

  $('#gameover').onclick = () => {
    let pulse = getSynth('fcPulse');
    let triangle = getSynth('fcTriangle');
    let base = .4;
    let pitch = [
      ['A#4', 'A#4', 'A#4', 'A#4', 'C#5', 'C5', 'C#5', 'C5', 'A#4', 'A#4', 'A#4', 'A#4'],
      ['F4', 'F#4', 'F4', 'F#4', 'F4', 'F#4', 'F4', 'F#4'],
      ['A#3', 'C#4', 'A#3', 'C#4', 'A#3', 'C#4', 'A#3', 'C#4'],
    ];
    let dur = [
      [base, base/3*2, base/3, base, base/3*2, base/3, base/10, base/3*2-base/10, base/3, base/3*2, base/3, base*2],
      [base, base, base, base, base, base, base, base],
      [base, base, base, base, base, base, base, base],
    ];
    let rtn = [];
    rtn[0] = triangle.play(pitch[0][0], {dur: dur[0][0], vol:1});
    rtn[1] = pulse.play(pitch[1][0], {dur: dur[1][0], vol:.75});
    rtn[2] = pulse.play(pitch[2][0], {dur: dur[2][0], vol:.75});
    for (let i = 1; i < pitch[0].length; i++) {
      rtn[0] = triangle.play(pitch[0][i], {sTime: rtn[0].eTime, dur: dur[0][i], vol:1});
    }
    for (let i = 1; i < pitch[1].length; i++) {
      rtn[1] = pulse.play(pitch[1][i], {sTime: rtn[1].eTime, dur: dur[1][i], vol:.75});
      rtn[2] = pulse.play(pitch[2][i], {sTime: rtn[2].eTime, dur: dur[2][i], vol:.75});
    }
  };
  
  $('#seqPlay').onclick = () => {
    seqTest();
  };
  $('#seqStop').onclick = () => bgm.stop();
  
  $('#cwt input[type=text]').onchange = e => {
    let cwt = e.target;
    if (cwt.value == '') cwt.value = 'FFFFFFFFFFFFFFFF0000000000000000';
    for (let i = 0; i < cwt.value.length; i++) {
      //_debug(cwt.value[i]);
      _('input[name=cwt' + i + ']').forEach(rb => {
        rb.checked = cwt.value[i] == rb.value ? true : false;
      });
    }
    initSynth();
  };
  
  $('#cwt input[type=button]').onclick = e => {
    let tone = $('#tone').value;
    if (tone == 'custom') return;
    let wf = gbWf[tone];
    $('#cwt input[type=text]').value = wf;
    $('#cwt input[type=text]').dispatchEvent(new Event('change'));
  };
  
  initSeq();
}

function adjustContainer() {
  let contentWidth = 340;
  let scale = window.innerWidth / contentWidth;
  _debug(window.innerWidth + ', ' + scale);
  $('#container').style.transform = 'scale(' + scale + ')';
}

function _debug(text) {
  $('#debug').innerHTML = $('#debug').innerHTML + '<br/>' +text;
}

window.onload = function() {
  //adjustContainer();
  
  setEvent();
  
  /*let e = new Event('change');
  $('#waveform').value = 'gbWave';
  $('#waveform').dispatchEvent(e);
  $('#option').value = 'Ah';*/
}
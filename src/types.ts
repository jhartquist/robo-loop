export type PianoRollConfig = {
  midiStart: number
  midiEnd: number
  totalSteps: number
  width: number
  height: number
  bpm: number
}

export type PlayerConfig = {
  clicks: boolean
  recording: boolean
  midiMin: number
  midiMax: number
  temp: number
}

export interface Note {
  midi: number
  start: number
  end: number
}

export interface Sequence {
  notes: Note[]
  qpm: number
  stepsPerQuarter: number
  quartersPerBar: number
  numBars: number
}

export interface QNote {
  pitch: number
  quantizedStartStep: number
  quantizedEndStep: number
}

export interface QSeq {
  notes: QNote[]
  quantizationInfo: { stepsPerQuarter: number }
  tempos: { time: number; qpm: number }[]
  totalQuantizedSteps: number
}

export type NotePoint = { midi: number; step: number }

export type ToneNote = [{ '16n': number }, Note]

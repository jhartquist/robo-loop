import * as Tone from 'tone'
import { Note, Sequence, ToneNote } from '@/types'
import { drumPlayers } from '@/instruments'

export const tonePattern = (seq: Sequence): ToneNote[] => {
  return seq.notes.map(note => [{ '16n': note.start }, note])
}

export const getPart = (samp: Tone.Sampler): Tone.Part => {
  return new Tone.Part((time, note: Note) => {
    const dur = { '16n': note.end - note.start }
    const noteName = Tone.Frequency(note.midi, 'midi').toNote()
    samp.triggerAttackRelease(noteName, dur, time)
  })
}

export const getClickPart = (): Tone.Part => {
  const pattern: [{ '4n': number }, string][] = [
    [{ '4n': 0 }, 'hatClosed'],
    [{ '4n': 1 }, 'hatClosed'],
    [{ '4n': 2 }, 'hatClosed'],
    [{ '4n': 3 }, 'hatClosed'],
  ]
  const part = new Tone.Part((time, drum: string) => {
    drumPlayers.player(drum).start(time)
  }, pattern)
  part.loop = true
  part.loopStart = 0
  part.loopEnd = '1m'
  return part
}

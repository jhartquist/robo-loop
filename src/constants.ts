export const MARGIN = 36
export const MIDI_MIN = 48
export const MIDI_MAX = 83

export const noteColors = [
  'rgb(255,   0,   0)',
  'rgb(255, 127,   0)',
  'rgb(255, 255,   0)',
  'rgb(127, 255,   0)',
  'rgb(  0, 255,   0)',
  'rgb(  0, 255, 127)',
  'rgb(  0, 255, 255)',
  'rgb(  0, 127, 255)',
  'rgb(  0,   0, 255)',
  'rgb(127,   0, 255)',
  'rgb(255,   0, 255)',
  'rgb(255,   0, 127)',
]

export const KEYBOARD_TO_MIDI: { [key: string]: number } = {
  a: 60,
  s: 61,
  d: 62,
  f: 63,
  g: 64,
  h: 65,
  j: 66,
  k: 67,
  l: 68,
  ';': 69,
}

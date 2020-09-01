import * as d3 from 'd3'
import { computed, reactive } from 'vue'
import { Note, Sequence, PlayerConfig } from '@/types'
import { MARGIN, MIDI_MIN, MIDI_MAX } from './constants'

export function getComputed() {
  const sequence = reactive<Sequence>({
    notes: [
      { midi: 60, start: 0, end: 4 },
      { midi: 64, start: 4, end: 8 },
      { midi: 67, start: 8, end: 10 },
    ] as Note[],
    qpm: 120,
    stepsPerQuarter: 4,
    quartersPerBar: 4,
    numBars: 2,
  })

  const config = reactive<PlayerConfig>({
    clicks: true,
    recording: false,
    midiMin: MIDI_MIN,
    midiMax: MIDI_MAX,
    temp: 1.0,
  })

  const numSteps = computed(
    () => sequence.stepsPerQuarter * sequence.quartersPerBar * sequence.numBars,
  )

  const winDim = reactive({
    width: 0,
    height: 0,
  })
  const winPos = reactive({
    x: computed<number>(() => -winDim.width / 2),
    y: computed<number>(() => -winDim.height / 2),
  })

  const gridDim = reactive({
    width: computed(() => winDim.width - 2 * MARGIN),
    height: computed(() => winDim.height - 2 * MARGIN),
  })
  const gridPos = reactive({
    x: computed(() => winPos.x + MARGIN),
    y: computed(() => winPos.y + MARGIN),
  })

  const midiNotes = computed(() => d3.range(config.midiMin, config.midiMax + 1))
  const numNotes = computed(() => midiNotes.value.length)

  const xScale = computed(() =>
    d3
      .scaleLinear()
      .domain([0, numSteps.value])
      .range([gridPos.x, gridPos.x + gridDim.width]),
  )
  const yScale = computed(() =>
    d3
      .scaleBand<number>()
      .domain(midiNotes.value)
      .range([gridPos.y + gridDim.height, gridPos.y]),
  )

  const stepsPerSecond = computed(() => {
    return (sequence.stepsPerQuarter * sequence.qpm) / 60
  })

  return {
    config,
    sequence,

    midiNotes,
    numSteps,
    numNotes,

    xScale,
    yScale,

    winPos,
    winDim,
    gridPos,
    gridDim,

    stepsPerSecond,
  }
}

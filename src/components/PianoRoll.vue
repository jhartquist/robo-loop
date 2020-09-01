<template>
  <div id="container" />
  {{ onNotes }}
</template>

<script lang="ts">
import {
  defineComponent,
  PropType,
  toRefs,
  watch,
  onMounted,
  computed,
  ref,
} from 'vue'
import * as d3 from 'd3'
import { noteColors } from '@/constants'
import { PianoRollConfig, QSeq, QNote, Selection } from '@/types'

const BG_COLOR = '#eee'
const BG_OPACITY = 0.2
const NOTE_COLORS = noteColors
const MARGIN = 30

const STATIC_OPACITY = 0.5
const ACTIVE_NOTE_OPACITY = 1
const ACTIVE_PITCH_OPACITY = 0.3

const filterVisibleMidi = (
  notes: QNote[],
  minMidi: number,
  maxMidi: number,
) => {
  return notes.filter(n => n.pitch >= minMidi && n.pitch <= maxMidi)
}

export default defineComponent({
  props: {
    config: {
      type: Object as PropType<PianoRollConfig>,
      required: true,
    },
    staticSeq: {
      type: Object as PropType<QSeq>,
      default: [],
    },
    activeNotes: {
      type: Array as PropType<QNote[]>,
      required: true,
    },
    onNotes: {
      type: Set as PropType<Set<number>>,
      required: true,
    },
  },
  setup(props) {
    const { config, staticSeq, activeNotes, onNotes } = toRefs(props)

    const mainWidth = computed(() => config.value.width - 2 * MARGIN)
    const mainHeight = computed(() => config.value.height - 2 * MARGIN)
    const midiNotes = computed(() =>
      d3.range(config.value.midiStart, config.value.midiEnd + 1),
    )

    const secondsPerStep = computed(() => {
      const seq = staticSeq.value
      const stepsPerMinute =
        seq.quantizationInfo.stepsPerQuarter * config.value.bpm
      return 60 / stepsPerMinute
    })

    // scales
    const xScale = computed(() =>
      d3
        .scaleLinear()
        .domain([0, config.value.totalSteps])
        .range([0, mainWidth.value - 1]),
    )
    const yScale = computed(() =>
      d3
        .scaleBand<number>()
        .domain(midiNotes.value)
        .range([mainHeight.value, 0]),
    )
    const colorScale = computed(() =>
      d3
        .scaleOrdinal<number, string>()
        .domain(d3.range(NOTE_COLORS.length))
        .range(NOTE_COLORS),
    )

    // axes
    const xAxisMaker = computed(() => d3.axisBottom<number>(xScale.value))
    const yAxisMaker = computed(() =>
      d3
        .axisLeft(yScale.value)
        // .tickFormat(this.midiToName)
        .tickSize(0)
        .tickPadding(6),
    )

    const init = () => {
      const svg = d3
        .select('#container')
        .append('svg')
        .attr('id', 'svg')
        .attr('width', config.value.width)
        .attr('height', config.value.height)
        .style('background', BG_COLOR)
      const viz = svg
        .append('g')
        .attr('id', 'viz')
        .attr('transform', `translate(${MARGIN},${MARGIN})`)

      const bg = viz.append('g')
      bg.append('rect')
        .attr('id', 'bgBlack')
        .style('fill', 'black')
      bg.append('g').attr('id', 'bgNotes')
      bg.append('g').attr('id', 'xAxis')
      bg.append('g').attr('id', 'yAxis')
      // draw active sequence on top of bg
      viz.append('g').attr('id', 'staticSeq')
      viz.append('g').attr('id', 'activeSeq')

      viz
        .append('line')
        .attr('id', 'scrubber')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', mainHeight.value)
        .style('stroke', 'white')
        .style('stroke-width', 1)
      // viz
      //   .append('rect')
      //   .attr('id', 'scrubber')
      //   .attr('width', mainWidth.value)
      //   .attr('height', mainHeight.value)
      //   .style('opacity', 0.5)

      // d3.select('body').on('keydown', () => {
      //   emit('key-down', d3.event.key)
      // })
      // d3.select('body').on('keyup', () => {
      //   emit('key-up', d3.event.key)
      // })
    }

    const drawContainer = () => {
      d3.select('#svg')
        .attr('width', config.value.width)
        .attr('height', config.value.height)
      d3.select('#bgBlack')
        .style('fill', 'black')
        .attr('width', mainWidth.value)
        .attr('height', mainHeight.value)
      d3.select('#bgNotes')
        .selectAll('rect')
        .data(midiNotes.value)
        .join('rect')
        .attr('y', d => yScale.value(d) || 0)
        .attr('width', mainWidth.value)
        .attr('height', yScale.value.bandwidth())
        .style('fill', n => colorScale.value(n % NOTE_COLORS.length))
        .style('opacity', n =>
          onNotes.value.has(n) ? ACTIVE_PITCH_OPACITY : BG_OPACITY,
        )
      ;(d3.select('#xAxis') as Selection)
        .call(xAxisMaker.value)
        .attr('transform', `translate(0,${mainHeight.value})`)
      ;(d3.select('#yAxis') as Selection).call(yAxisMaker.value)
    }

    const drawStaticSeq = () => {
      d3.select('#staticSeq')
        .selectAll('rect.note')
        .data(
          filterVisibleMidi(
            staticSeq.value.notes,
            config.value.midiStart,
            config.value.midiEnd,
          ),
        )
        .join('rect')
        .attr('class', 'note')
        .attr('x', note => xScale.value(note.quantizedStartStep))
        .attr('y', note => yScale.value(note.pitch) || 0)
        .attr('width', note =>
          xScale.value(note.quantizedEndStep - note.quantizedStartStep),
        )
        .attr('height', yScale.value.bandwidth())
        .style('fill', note =>
          colorScale.value(note.pitch % NOTE_COLORS.length),
        )
        .style('stroke', '#ccc')
        .style('stroke-width', 1)
        .style('opacity', STATIC_OPACITY)
        .style('shape-rendering', 'crispEdges')
    }

    const drawActiveNotes = () => {
      const filteredNotes: QNote[] = filterVisibleMidi(
        activeNotes.value,
        config.value.midiStart,
        config.value.midiEnd,
      )
      const activeSel = d3
        .select('#activeSeq')
        .selectAll('rect.note')
        .data(filteredNotes, (d): string => {
          const note = d as QNote
          const k = `${note.pitch}_${note.quantizedStartStep}` //_${note.quantizedEndStep}`
          return k
        })
      activeSel
        .enter()
        .append('rect')
        .attr('class', 'note')
        .attr('x', note => xScale.value(note.quantizedStartStep))
        .attr('y', note => yScale.value(note.pitch) || 0)
        .attr('width', 0) // note => xScale.value(note.endTime - note.startTime))
        .attr('height', yScale.value.bandwidth())
        .style('fill', note =>
          colorScale.value(note.pitch % NOTE_COLORS.length),
        )
        .style('stroke', 'white')
        .style('stroke-width', 2)
        .style('stroke-opacity', 1)
        .style('opacity', ACTIVE_NOTE_OPACITY)
        .style('shape-rendering', 'crispEdges')
        .transition()
        .ease(d3.easeLinear)
        .duration(note => {
          return (
            secondsPerStep.value *
            (note.quantizedEndStep - note.quantizedStartStep) *
            1000
          )
        })
        .attr('width', note =>
          xScale.value(note.quantizedEndStep - note.quantizedStartStep),
        )

      activeSel
        .filter(note => {
          // debugger
          return !onNotes.value.has(note.pitch)
        })
        .transition()
        .duration(0)
        .attr('x', note => xScale.value(note.quantizedStartStep))
        .attr('y', note => yScale.value(note.pitch) || 0)
        .attr('width', note =>
          xScale.value(note.quantizedEndStep - note.quantizedStartStep),
        )
        .attr('height', yScale.value.bandwidth())

      activeSel
        .exit()
        // .transition()
        // .duration(100)
        // .style('opacity', 0)
        .remove()
    }

    const drawAll = () => {
      drawContainer()
      drawStaticSeq()
      drawActiveNotes()
    }

    const startScrubber = () => {
      const totalTime =
        staticSeq.value.totalQuantizedSteps * secondsPerStep.value
      const scrubber = d3.select('#scrubber')
      function repeat() {
        scrubber
          .attr('x1', 0)
          .attr('x2', 0)
          .transition('testTrans')
          .duration(totalTime * 1000)
          .ease(d3.easeLinear)
          .attr('x1', mainWidth.value)
          .attr('x2', mainWidth.value)
          .on('end', repeat)
      }
      repeat()
    }

    // init elements
    onMounted(() => {
      init()
      drawAll()
    })
    watch(config, drawAll, { deep: true })
    watch(staticSeq, drawStaticSeq, { deep: true })
    watch(activeNotes, drawActiveNotes, { deep: true })
    watch(onNotes, drawContainer, { deep: true })

    return {
      secondsPerStep,
      mainWidth,
      mainHeight,
      startScrubber,
    }
  },
  methods: {
    // startScrubber() {},
    stopScrubber() {
      d3.select('#scrubber')
        .transition()
        .duration(0)
    },
  },
})
</script>

<style scoped></style>

<template>
  <div id="controls">
    <div id="buttons">
      <button @click="playStop">{{ playButtonText }}</button><br /><br />
      <button @click="clear">Clear</button>
      <button @click="duplicate">Duplicate</button><br />
    </div>
    <div>
      Clicks:
      <input type="checkbox" v-model="config.clicks" /><br />
      Recording:
      <input type="checkbox" v-model="config.recording" />
    </div>
    <div>
      <label for="bpm">BPM:</label> {{ sequence.qpm }}<br />

      <input
        name="bpm"
        type="range"
        min="40"
        max="200"
        step="1"
        v-model.number="sequence.qpm"
      /><br />
      <label for="temp">Randomness:</label><br />
      <input
        name="temp"
        type="range"
        min="0"
        max="1.5"
        step=".1"
        v-model.number="config.temp"
      />
    </div>
    <div>
      <label for="numBars"># Bars:</label>
      <input
        name="numBars"
        type="number"
        min="1"
        max="8"
        v-model.number="sequence.numBars"
      /><br />
      <label for="selectionLength"># Improv Beats</label>
      <input
        type="number"
        name="selectionLength"
        min="1"
        max="32"
        v-model.number="selection.length"
      />
    </div>
  </div>
  <div ref="canvas"></div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, onMounted, watch } from 'vue'
import p5 from 'p5'
import * as d3 from 'd3'
import * as Tone from 'tone'

import { getComputed } from '@/sketch'
import { getPart, tonePattern, getClickPart } from '@/audio'
import { Note, NotePoint, QSeq, QNote } from '@/types'
import { noteColors, KEYBOARD_TO_MIDI, MARGIN } from '@/constants'
import { pianoSampler } from '@/instruments'
import * as mm from '@magenta/music'

export default defineComponent({
  setup() {
    const canvas = ref<HTMLElement | undefined>()
    const {
      config,
      sequence,
      midiNotes,
      numSteps,
      numNotes,
      xScale,
      yScale,
      winDim,
      gridPos,
      gridDim,
      stepsPerSecond,
    } = getComputed()

    const part = getPart(pianoSampler)
    part.loop = true
    part.loopStart = 0
    part.start()
    const clickPart = getClickPart()
    const currentSteps = (live = false) => {
      let steps = part.progress * numSteps.value
      if (live) {
        steps -= Tone.context.lookAhead * stepsPerSecond.value
      }
      return steps
    }

    const activeMidiNotes = new Set<number>()
    const currentNotes: { [key: number]: Note | undefined } = {}

    const selection = reactive({
      start: 16,
      length: 4, // # beats
    })

    const selectionEnd = computed(
      () => selection.start + selection.length * sequence.quartersPerBar,
    )

    const noteSequenceStart = computed<QSeq>(() => {
      const prefixSteps = selection.start
      return {
        notes: sequence.notes
          .filter(n => n.end <= prefixSteps)
          .map(n => ({
            pitch: n.midi,
            quantizedStartStep: n.start,
            quantizedEndStep: n.end,
          })),
        quantizationInfo: { stepsPerQuarter: sequence.stepsPerQuarter },
        tempos: [{ time: 0, qpm: sequence.qpm }],
        totalQuantizedSteps: prefixSteps,
      }
    })

    const noteSequenceEnd = computed<QSeq>(() => {
      const numEndSteps = numSteps.value - selectionEnd.value
      return {
        notes: sequence.notes
          .filter(n => n.start >= selectionEnd.value)
          .map(n => ({
            pitch: n.midi,
            quantizedStartStep: n.start - selectionEnd.value,
            quantizedEndStep: n.end - selectionEnd.value,
          })),
        quantizationInfo: { stepsPerQuarter: sequence.stepsPerQuarter },
        tempos: [{ time: 0, qpm: sequence.qpm }],
        totalQuantizedSteps: numEndSteps,
      }
    })

    const worker = new Worker('worker.js')

    const generate = async () => {
      const temp = config.temp
      const steps = 16
      const startSeq = noteSequenceStart.value
      const endSeq = noteSequenceEnd.value
      worker.postMessage({ startSeq, endSeq, steps, temp })
    }

    const makeLoop = () => {
      return new Tone.Loop(() => {
        for (const k in currentNotes) {
          const note = currentNotes[k]
          if (note) {
            note.end = numSteps.value
            currentNotes[k] = undefined
            if (config.recording) {
              sequence.notes.push(note)
            }
          }
        }
        generate()
      }, `${sequence.numBars}m`).start(0)
    }

    let loop: Tone.Loop | null = null

    watch(
      () => sequence.qpm,
      () => (Tone.Transport.bpm.value = sequence.qpm),
      { immediate: true },
    )

    watch(
      () => sequence.notes,
      () => {
        const pattern = tonePattern(sequence)
        part.clear()
        pattern.forEach(v => part.add(v[0], v[1]))
      },
      { immediate: true, deep: true },
    )

    watch(
      () => sequence.numBars,
      () => {
        part.loopEnd = `${sequence.numBars}m`
        if (loop) loop.dispose()
        loop = makeLoop()
      },
      { immediate: true },
    )

    watch(
      () => config.clicks,
      () => {
        if (config.clicks) {
          clickPart.start()
        } else {
          clickPart.stop()
        }
      },
      { immediate: true },
    )

    const playButtonText = ref('Play')

    const play = async () => {
      await Tone.start()

      Tone.Transport.start()
      playButtonText.value = 'Stop'
    }

    const stop = () => {
      Tone.Transport.stop()
      playButtonText.value = 'Play'
    }

    const playStop = () => {
      if (Tone.Transport.state == 'started') {
        stop()
      } else {
        play()
      }
    }

    const sketch = (s: p5) => {
      let font: p5.Font
      s.preload = () => {
        font = s.loadFont('/fonts/Inconsolata-Bold.ttf')
      }
      const setDims = () => {
        winDim.width = s.windowWidth
        winDim.height = s.windowHeight - 100
      }
      s.setup = () => {
        setDims()
        const canvas = s.createCanvas(winDim.width, winDim.height, s.WEBGL)
        canvas.position(0, 100)
        s.textFont(font)
        s.textSize(14)
      }
      s.windowResized = () => {
        setDims()
        s.resizeCanvas(winDim.width, winDim.height)
      }

      const COLORS = noteColors.map(c => s.color(c))
      const colorWithAlpha = (i: number, alpha: number): p5.Color => {
        const c = COLORS[i % COLORS.length]
        c.setAlpha(alpha * 255)
        return c
      }

      const drawRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        z: number,
      ) => {
        const x2 = x + w
        const y2 = y + h
        s.quad(x, y, z, x, y2, z, x2, y2, z, x2, y, z)
      }

      const drawNote = (
        midiNum: number,
        startStep: number,
        endStep: number,
        alpha: number,
        z: number,
      ) => {
        const color = colorWithAlpha(midiNum, alpha)
        const x1 = xScale.value(startStep)
        const x2 = xScale.value(endStep)
        const y1 = yScale.value(midiNum) || 0
        const y2 = y1 + yScale.value.bandwidth()
        s.fill(color)
        s.quad(x1, y1, z, x1, y2, z, x2, y2, z, x2, y1, z)
      }

      const vLine = (x: number, z: number) => {
        s.line(x, gridPos.y, z, x, gridPos.y + gridDim.height, z)
      }

      s.draw = () => {
        s.background(0)

        // background
        s.noStroke()
        s.fill(0)
        drawRect(gridPos.x, gridPos.y, gridDim.width, gridDim.height, 0)

        // selection
        s.fill(100)
        drawRect(
          xScale.value(selection.start),
          gridPos.y,
          xScale.value(selectionEnd.value) - xScale.value(selection.start),
          gridDim.height,
          0.1,
        )

        // bg note colors & note labels
        midiNotes.value.forEach(midiNote => {
          const alpha = activeMidiNotes.has(midiNote) ? 0.4 : 0.2
          drawNote(midiNote, 0, numSteps.value, alpha, 0.2)
          s.fill(255)
          s.text(
            Tone.Frequency(midiNote, 'midi').toNote(),
            gridPos.x - 26,
            14 + (yScale.value(midiNote) || 0),
          )
        })

        // time markers
        s.strokeWeight(1)
        d3.range(numSteps.value).forEach(i => {
          const x = xScale.value(i)
          let stroke = 25
          s.fill(255)

          if (i % sequence.stepsPerQuarter == 0) {
            const beatNum =
              ((i / sequence.stepsPerQuarter) % sequence.quartersPerBar) + 1
            s.text(beatNum.toString(), x, gridPos.y + gridDim.height + 14)
            stroke = 50
          }
          if (i % (sequence.stepsPerQuarter * sequence.quartersPerBar) == 0) {
            const barNum =
              i / (sequence.stepsPerQuarter * sequence.quartersPerBar) + 1
            s.text(barNum.toString(), x, gridPos.y + gridDim.height + 28)
            stroke = 100
          }
          const color = s.color(255)
          color.setAlpha(stroke)
          s.stroke(color)
          vLine(x, 0.3)
        })

        const currentTime = currentSteps()

        // sequenced notes
        s.stroke(0)
        s.strokeWeight(1)
        sequence.notes.forEach(note => {
          const alpha =
            note.start < currentTime && note.end > currentTime ? 1.0 : 0.5
          drawNote(note.midi, note.start, note.end, alpha, 1)
        })

        // active notes
        s.stroke(255)
        s.strokeWeight(2)
        Object.values(currentNotes).forEach(note => {
          if (note) {
            drawNote(note.midi, note.start, currentTime, 1.0, 1.1)
          }
        })

        // scrubber
        s.stroke(255)
        s.strokeWeight(1)
        const scrubX = xScale.value(currentTime)
        vLine(scrubX, 1.0)
      }

      const getPitchAndStep = (): NotePoint | null => {
        if (s.mouseButton == 'right') return null
        const gx = s.mouseX - MARGIN
        const gy = s.mouseY - MARGIN
        if (gx < 0 || gx > gridDim.width || gy < 0 || gy > gridDim.height)
          return null
        const step = Math.floor((gx / gridDim.width) * numSteps.value)
        const midi =
          config.midiMax - Math.floor((gy / gridDim.height) * numNotes.value)
        return { midi, step }
      }

      const getNoteAtPoint = (point: NotePoint): Note | null => {
        const note = sequence.notes.find(n => {
          return (
            n.midi == point.midi &&
            n.start <= point.step &&
            n.end >= point.step + 1
          )
        })
        return note || null
      }

      let drawingStartPoint: NotePoint | null = null
      let drawingNote: Note | null = null

      let selDragStart: NotePoint | null = null
      s.mousePressed = () => {
        const point = getPitchAndStep()
        if (point) {
          if (
            point.step >= selection.start &&
            point.step < selectionEnd.value
          ) {
            selDragStart = point
            s.cursor('grabbing')
            return
          }

          const note = getNoteAtPoint(point)
          if (note) {
            const idx = sequence.notes.indexOf(note)
            sequence.notes.splice(idx, 1)
          } else if (!drawingNote) {
            drawingStartPoint = point
            drawingNote = {
              midi: point.midi,
              start: point.step,
              end: point.step + 1,
            }
            sequence.notes.push(drawingNote)
          }
        }
      }
      s.mouseDragged = () => {
        const point = getPitchAndStep()
        if (point) {
          if (drawingNote && drawingStartPoint) {
            if (point.step >= drawingStartPoint.step) {
              drawingNote.start = drawingStartPoint.step
              drawingNote.end = point.step + 1
            } else {
              drawingNote.start = point.step
              drawingNote.end = drawingStartPoint.step + 1
            }
          } else if (selDragStart) {
            const diff = Math.round(point.step - selDragStart.step)
            selDragStart.step += diff
            selection.start += diff
          }
        }
      }

      s.mouseReleased = () => {
        if (drawingNote) {
          drawingNote = null
          drawingStartPoint = null
        }
      }

      s.mouseMoved = () => {
        const point = getPitchAndStep()
        if (point) {
          if (
            point.step >= selection.start &&
            point.step < selectionEnd.value
          ) {
            s.cursor('grab')
          } else {
            s.cursor(s.ARROW)
          }
        }
      }

      s.keyPressed = () => {
        const midiNum = KEYBOARD_TO_MIDI[s.key]
        if (midiNum) {
          activeMidiNotes.add(midiNum)
          const noteName = Tone.Frequency(midiNum, 'midi').toNote()
          pianoSampler.triggerAttack(noteName, Tone.immediate())
          const note: Note = {
            midi: midiNum,
            start: currentSteps(true),
            end: numSteps.value,
          }
          currentNotes[midiNum] = note
        }

        if (s.key == ' ') {
          playStop()
        }
      }
      s.keyReleased = () => {
        const midiNum = KEYBOARD_TO_MIDI[s.key]
        if (midiNum) {
          activeMidiNotes.delete(midiNum)
          const noteName = Tone.Frequency(midiNum, 'midi').toNote()
          pianoSampler.triggerRelease(noteName, Tone.immediate())

          const note = currentNotes[midiNum]
          if (note) {
            note.end = currentSteps(true)
            currentNotes[midiNum] = undefined
            if (config.recording) {
              sequence.notes.push(note)
            }
          }
        }
      }
    }

    const init = async () => {
      new p5(sketch, canvas.value)
    }
    onMounted(() => {
      init()
    })

    const clear = () => {
      sequence.notes.length = 0
    }

    const duplicate = () => {
      const notesDup: Note[] = sequence.notes.map(n => {
        return {
          midi: n.midi,
          start: n.start + numSteps.value,
          end: n.end + numSteps.value,
        }
      })
      sequence.numBars *= 2
      sequence.notes = sequence.notes.concat(notesDup)
    }

    worker.onmessage = event => {
      const result = event.data.result
      let newSeq = mm.sequences.concatenate([noteSequenceStart.value, result])
      if (noteSequenceEnd.value.totalQuantizedSteps) {
        newSeq = mm.sequences.concatenate([newSeq, noteSequenceEnd.value])
      }

      sequence.notes = newSeq.notes.map((note: QNote) => {
        return {
          midi: note.pitch,
          start: note.quantizedStartStep,
          end: note.quantizedEndStep,
        }
      })
    }

    return {
      config,
      sequence,
      part,
      playStop,
      clear,
      duplicate,
      generate,
      selection,
      playButtonText,
    }
  },
})
</script>

<style>
html,
body {
  padding: 0;
  margin: 0;
  overflow: hidden;
}

#controls {
  background: #ccc;
  height: 100px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 8px;
}

#controls.div {
  align-items: left;
  margin-right: 10px;
}
</style>

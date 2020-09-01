importScripts(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.7.4/dist/tf.min.js',
)
importScripts('https://cdn.jsdelivr.net/npm/@magenta/music@^1.19.0/es6/core.js')
importScripts(
  'https://cdn.jsdelivr.net/npm/@magenta/music@^1.19.0/es6/music_rnn.js',
)
const rnn = new music_rnn.MusicRNN('/models/basic_rnn')

// Main script asks for work.
self.onmessage = async event => {
  const seq = event.data.startSeq
  // const endSeq = event.data.endSeq
  // const seq = core.sequences

  const temp = event.data.temp
  const steps = event.data.steps
  if (!rnn.isInitialized()) {
    await rnn.initialize()
  }
  const result = await rnn.continueSequence(seq, steps, temp)
  postMessage({ result })
}

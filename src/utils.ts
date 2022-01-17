import { Transform, TransformCallback, TransformOptions } from 'stream'


export type Timer = [number, number]

export function startTimer(): Timer {
  return process.hrtime()
}

export function stopTimer(t: Timer): number {
  const end = process.hrtime(t)
  return (end[0]* 1000000000 + end[1]) / 1000000
}

export function humanReadableFilesize(size: number) {
  const i = Math.floor(Math.log(size) / Math.log(1024))
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

export function slice(start?: number, end?: number) {
  return new Slice(start, end)
}

export class Slice extends Transform {

  _start
  _end
  _offset = 0
  _state = 0

  _emitUp = false
  _emitDown = false
  
  constructor(start?: number, end?: number, opts?: TransformOptions & { lenght: number }) {
    super({ ...opts })

    this._start = start || 0
    this._end = end || Infinity
  }

  _transform(chunk: any, _: string, done: TransformCallback) {
    this._offset += chunk.length

    if (!this._emitUp && this._offset >= this._start) {
      this._emitUp = true
      const start = chunk.length - (this._offset - this._start)

      if(this._offset > this._end) {
          var end = chunk.length - (this._offset - this._end)
          this._emitDown = true
          this.push(chunk.slice(start, end))
      } else {
          this.push(chunk.slice(start, chunk.length))
      }

      return done()
    }

    if (this._emitUp && !this._emitDown) {
      if (this._offset >= this._end) {
        this._emitDown = true
        this.push(chunk.slice(0, chunk.length - (this._offset - this._end)))
      } else {
        this.push(chunk)
      }
      return done()
    }

    return done()
  }
  
}

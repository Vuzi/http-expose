
import chalk from 'chalk'

export type Timer = [number, number]

const Log = {
  info(...message: any[]) {
    console.log(chalk.blue.bold('[i]'), ...message);
  },
  verbose(...message: any[]) {
    console.log(chalk.gray.bold('[v]'), ...message);
  },
  warn(...message: any[]) {
    console.log(chalk.yellow.bold('[w]'), ...message.map(m => chalk.yellow(m)));
  },
  err(...message: any[]) {
    console.log(chalk.red.bold('[!]'), ...message.map(m => chalk.red(m)));
  },
  text(...text: any) {
    console.log(...text)
  },
  startTimer(): Timer {
    return process.hrtime()
  },
  stopTimer(t: Timer): number {
    const end = process.hrtime(t)
    return (end[0] + (end[1] / 1e9))
  }
}

export default Log

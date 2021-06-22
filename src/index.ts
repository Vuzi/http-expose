import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import Log from '@root/logger'
import { StaticServer } from '@root/server'


async function main() {

  Log.info('Starting the application 🚀')

  const args =
    await yargs(hideBin(process.argv))
      .usage('Usage: serve <directory> [options]')
      .version()
      .help('h')
      .alias('h', 'help')
      .positional('directory', {
        type: 'string',
        description: 'Directory to serve',
        demandOption: true
      })
      .option('port', {
        alias: 'p',
        type: 'number',
        description: 'HTTP port',
        default: 8000
      })
      .option('host', {
        type: 'string',
        description: 'HTTP host',
        default: 'localhost'
      })
      .option('nocache', {
        type: 'boolean',
        description: 'Disable caching',
        default: false
      })
      .option('cors-allow-origin', {
        type: 'string',
        description: 'Cors allow origin setting',
        default: '*'
      })
      .option('verbose', {
        type: 'boolean',
        description: 'Verbose',
        default: false
      })
      .argv

  const host = args.host
  const port = args.port
  const source = args._[0] + ''
  const verbose = args['verbose']
  const noCache = args['nocache']
  const corsOrigins = args['cors-allow-origin'].split(',').map(o => o.trim()).filter(o => o !== '')
    
  if (verbose) {
    Log.verbose('Verbose mode activated 📃')
    if (noCache)
      Log.verbose('No cache option enabled')
    if (args['cors-allow-origin'] !== '*')
      Log.verbose(`Cors origin authorised ${corsOrigins}`)
  }

  const server = new StaticServer({
    host,
    port,
    source,
    noCache: noCache,
    allowedOrigins: corsOrigins
  })

  server.on('start', (host, port, source) => {
    Log.info(`Server started on http://${host}:${port} for directory '${source}' ✔️`)
  })

  if (verbose)
    server.on('request', (req) => {
      Log.verbose(`Request received for ${req.url}`)
    })

  server.on('response', (path, response, time) => {
    Log.info(`${response.code} - ${path} (${time}ms)`)
  })

  server.on('error', (path, error, time) => {
    Log.warn(`${error.code} - ${path} (${time}ms)`)
  })

  async function cleanup() {
    Log.info('Stopping the application 🔥')

    await server.stop()
    process.exit()
  }

  process.on('SIGINT', cleanup)
  process.on('SIGQUIT', cleanup)
  process.on('SIGTERM', cleanup)

  server.start()
}

main()

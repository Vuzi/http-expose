import http, { IncomingMessage, ServerResponse } from 'http'
import fs, { promises, Stats } from 'fs'
import path from 'path'
import { URL } from 'url'
import crypto from 'crypto'
import zlib from 'zlib'
import { Readable, Transform } from 'stream'
import { TypedEmitter } from 'tiny-typed-emitter'
import mime from 'mime-types'
import { createHttpTerminator, HttpTerminator } from 'http-terminator'

import { startTimer, stopTimer, slice, humanReadableFilesize } from '@root/utils'

const RANGE_REGEX = /bytes=(\d+)?-(\d+)?/

interface ServerEvents {
  'start': (host: string, port: number, source: string) => void
  'error': (path: string, e: AppError, time: number) => void
  'failure': (error: Error) => void,
  'response': (path: string, r: Response, time: number) => void
  'request': (req: IncomingMessage) => void
}

interface Range {
  from: number
  to: number
}

export interface AppError {
  code: number
  message: string
}

export interface Response {
  code: number
  headers: Record<string, string>
  content?: Readable
}

interface DirectoryElement {
  filename: string
  filepath: string
  size: number,
  created: Date,
  isDirectory: boolean
}

function isAppError(e: any): e is AppError {
  return (e as AppError).code !== undefined
}

const AppError = {
  from: (code: number,  message: string): AppError => ({ code, message })
}

interface Encoder {
  name: string,
  encode: () => Transform
}

export interface ServerConfig {
  host: string
  port: number
  listDir: boolean
  allowedOrigins: string[]
  noCache: boolean
  source: string
}

export class StaticServer extends TypedEmitter<ServerEvents> {

  host: string
  port: number
  source: string
  serverOrigin: string
  listDir: boolean
  noCache: boolean
  allowedOrigins: string[] // Empty if all origins are allowed
  directory: string

  server?: http.Server
  terminator?: HttpTerminator

  encoders: Record<string, Encoder>

  constructor(conf: ServerConfig) {
    super()

    this.host = conf.host
    this.port = conf.port
    this.source = conf.source
    this.listDir = conf.listDir
    this.noCache = conf.noCache
    this.allowedOrigins = conf.allowedOrigins.find(v => v === '*') ? [] : conf.allowedOrigins
    this.directory = path.normalize(conf.source)
    this.serverOrigin = `http://${conf.host}:${conf.port}`

    this.encoders = {
      'gzip': {
        name: 'gzip',
        encode: () => zlib.createGzip()
      }
    }
  }

  start(): void {
    try {
      this.server = http.createServer((req, res) => this.handleRequest(req, res))
      this.terminator = createHttpTerminator({ server: this.server })

      this.server.on('error', e => {
        this.emit('failure', e)
        this.stop()
      })

      this.server.listen(this.port, this.host, () => {
        this.emit('start', this.host, this.port, this.source)
      })
    } catch (e: any) {
      this.emit('failure', e)
    }
  }

  async stop(): Promise<void> {
    await this.terminator?.terminate()
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const timer = startTimer()
    this.emit('request', req)

    // Parse the URL
    const url = new URL(req.url!!, this.serverOrigin)

    try {
      const result = await this.computeResult(url, req)
      
      res.writeHead(result.code, result.headers)
      if (result.content)
        result.content.pipe(res).on('close', () => {
          this.emit('response', url.pathname, result, stopTimer(timer))
        })
      else {
        res.end(() => {
          this.emit('response', url.pathname, result, stopTimer(timer))
        })
      }
  
    } catch(e) {
      if (isAppError(e)) {
        res.writeHead(e.code)
        res.end(e.message)
        this.emit('error', url.pathname, e, stopTimer(timer))
      } else {
        res.writeHead(500)
        res.end('Internal server error')
        this.emit('error', url.pathname, AppError.from(500, 'Internal server error'), stopTimer(timer))
      }
    }
  }

  private async computeResult(url: URL, req: IncomingMessage): Promise<Response>  {
    // For now, only support GET (TODO support HEAD)
    if (req.method !== 'GET')
      throw AppError.from(305, `Unsupported method ${req.method}`)
  
    const origin = req.headers.origin?.trim() || '*'

    // Check the origin
    if (this.allowedOrigins.length > 0 && !this.allowedOrigins.includes(origin))
      throw AppError.from(403, 'Invalid origin')

    // Target path, based on the provided directories
    const target = path.join(this.directory, url.pathname)
  
    // Only param we handle
    const download = (url.searchParams.get('download') ?? 'false').toLocaleLowerCase() === 'true'
  
    // Make sure we don't try to escape
    if (!this.isSubDirectory(this.directory, target))
      throw AppError.from(403, `Forbidden resource`)
  
    const file = await this.getFileInfo(target)

    if (file.isFile()) {
      const etag = this.getEtag(file)
      const encoding = (req.headers['accept-encoding'])?.toString().split(',').map(s => s.trim())
      const range = req.headers.range !== undefined ? this.getRange(req, file) : undefined
      const mimeType = mime.lookup(path.extname(target)) || 'application/octet-stream'
      
      // Find any available encoder
      const encoder = encoding?.map(e => this.encoders[e]).find(e => e !== undefined)

      const commonHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': this.allowedOrigins.length > 0 ? origin : '*',
        'Accept-Ranges': 'bytes',
        'Content-Type': mimeType,
        'Cache-Control': 'public',
        'ETag': `${etag}`,
        'Last-Modified': new Date(file.mtime).toUTCString(),
        ...(download ? { 'Content-Disposition': `attachment;filename=${path.basename(target)}` } : {})
      }

      if (range) {
        let headers: Record<string, string> = {
          ...commonHeaders,
          'Content-Length': `${range.to - range.from + 1}`, // Because range is 0 indexed
          'Content-Range': `bytes ${range.from}-${range.to}/${file.size}`
        }

        // Get the partial file content
        const buffer = this.getFileContent(target, range)

        return { code: 206, headers, content: buffer }
      } else if (this.needFile(req, file, etag)) {
        let headers: Record<string, string> = {
          ...commonHeaders,
          ...(encoder ?
            { 'Content-Encoding': encoder.name } :
            { 'Content-Length': `${file.size}` }
          )
        }

        // If there's no cache, get the file content
        const buffer = encoder ? this.getFileContent(target).pipe(encoder.encode()) : this.getFileContent(target)
    
        return { code: 200, headers, content: buffer }
      } else {
        // File already cached
        return { code: 304, headers: commonHeaders }
      }
    } else if (file.isDirectory() && this.listDir) {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': this.allowedOrigins.length > 0 ? origin : '*',
        'Accept-Ranges': 'bytes',
        'Content-Type': 'text/html; charset=utf-8'
      }

      const content = await this.getDirectoryContent(target)
      const contentHtml = `
        <html>
          <header>
            <title>Content of /${target}</title>
          </header>
          <body>
            <h1>Content of /${target}</h1>
            <ul>
              ${this.parentElementToHtml(target)}
              ${content.map(this.elementToHtml).join('')}
            </ul>
          </body>
        </html>`

      return { code: 200, headers, content: this.getStringContent(contentHtml) }
    } else {
      throw AppError.from(400, `Invalid request (not a file)`)
    }
  }

  private parentElementToHtml(dir: string) {
    const relative = path.relative(this.source, dir)

    if (relative === '') {
      return ''
    } else {
      return `
        <li>
          🠔
          <a href="/${path.dirname(relative)}">Parent Directory</a>
        </li>
      `
    }
  }

  private elementToHtml(element: DirectoryElement) {
    const icon = element.isDirectory ? '📁' : '📄'

    return `
      <li>
        ${icon}
        <a href="/${element.filepath}">${element.filename}</a> 
        (${humanReadableFilesize(element.size)}) - Created ${element.created.toLocaleString()}
      </li>`
  }

  private async getDirectoryContent(directory: string): Promise<DirectoryElement[]> {
    const content = await promises.readdir(directory)

    return await Promise.all(content.map(async filename => {
      const filepath = path.join(directory, filename)
      const stat = await promises.stat(filepath)

      return {
        filename,
        filepath: path.relative(this.source, filepath),
        size: stat.size,
        created: stat.birthtime,
        isDirectory: stat.isDirectory()
      }
    }))
  }

  private getRange(req: IncomingMessage, file: Stats): Range {
    const result = RANGE_REGEX.exec(req.headers.range!!)
  
    if (result === null)
      throw AppError.from(416, `Invalid range`)

    let from = result[1] !== undefined ? parseInt(result[1], 10) : undefined
    let to = result[2] !== undefined ? parseInt(result[2], 10) : undefined

    if (from === undefined && to === undefined)
      throw AppError.from(416, `Invalid range`)

    if (from === undefined) {
      from = file.size - to!!
      to = file.size - 1
    } else if (to === undefined) {
      to = file.size - 1
    }
  
    if (from === NaN || to === NaN || to > file.size || from > to || from < 0 || to < 0)
      throw AppError.from(416, `Invalid range`)
    
    return { from, to }
  }
  
  private needFile(req: IncomingMessage, file: Stats, etag: string): boolean {
    if (this.noCache)
      return true // Override any cache mecanism

    const ifNoneMatch = req.headers['if-none-match']
    const ifModifiedSince = req.headers['if-modified-since'] && new Date(req.headers['if-modified-since'])

    if (
        (!ifNoneMatch && !ifModifiedSince) ||
        (ifNoneMatch && ifNoneMatch !== etag) ||
        (ifModifiedSince && ifModifiedSince < new Date(file.mtime.setMilliseconds(0)))
      )
      // The file is needed because there's either no cache or an outdated cache
      return true
    else
      return false
  }

  private async getFileInfo(file: string): Promise<Stats> {
    try {
      return await promises.stat(file)
    } catch(e: any) {
      if (e.code === 'ENOENT' || e.code === 'ENOTDIR') {
        // 404, not found
        throw AppError.from(404, `File not found`)
      } else if (e.code === 'EISDIR') {
        // 400, is a dir
        throw AppError.from(400, `Invalid request (not a file)`)
      } else if (e.code === 'EPERM') {
        // 403
        throw AppError.from(403, `Forbidden resource`)
      } else {
        console.error(e)
        throw AppError.from(500, `Internal server error`)
      }
    }
  }

  private getFileContent(file: string, range?: Range): Readable {
     if (range) 
      return fs.createReadStream(file).pipe(slice(range.from, range.to + 1))  
     else
      return fs.createReadStream(file)
  }

  private getStringContent(value: string): Readable {
    var stream = new Readable()
    stream.push(value)
    stream.push(null)

    return stream
  }
  
  private getEtag(file: Stats): string {
    return '"' + crypto
      .createHash('md5')
      .update(`${file.ino}-${file.size}-${file.mtime}`)
      .digest('base64') + '"'
  }
  
  private isSubDirectory(parent: string, dir: string): boolean {
    const relative = path.relative(parent, dir)
    return !!(!relative.startsWith('..') && !path.isAbsolute(relative))
  }
  
}

export default StaticServer

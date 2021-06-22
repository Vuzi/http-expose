# HTTP Expose 🌐  

<p align="center">
   <img src="https://badgen.net/badge/Built%20With/NodeJs/3C873A?con=typescript">
   <img src="https://badgen.net/badge/-/TypeScript/blue?icon=typescript&label">
   <img src="https://github.com/vuzi/http-expose/actions/workflows/build.yml/badge.svg">
</p>
 
<p align="center">

   <a href="https://www.npmjs.com/package/http-expose">
      <img src="https://nodei.co/npm/http-expose.png?compact=true" />
   </a>
</p>


To expose a folder `./example` on `htttp://localhost:8000` ↴

```shell
$ expose ./example --port=8000
```

And now your directory is accessible ↴
```
$ curl http://localhost:8000/my/file.txt
this is my file content!
```

And for more, see [usage](#command-line-usage) 🚀
## What's that?
**HTTP Expose** is a very simple and lightweight **static HTTP server**. It can be used to expose a
provided directory to the internet through HTTP. 🧙‍♂️ The exposed directory will handle range request,
caching and gzipping.

It can also be used programmmatically to do exactly the exact same thing 💻

## Features
- HTTP range request
- HTTP caching
- CORS
- Gzip
- Usable in command line, and programatically
- Simple to use & configure

## Lib usage
TODO ⚠️

## Command line usage

Start with installing ↴
```shell
$ npm install -g http-expose
```
List of available arguments ↴
```
$ expose -h

Usage: http-expose <directory> [options]

Positionals:
  directory  Directory to expose                                        [string]

Options:
      --version            Show version number                         [boolean]
  -h, --help               Show help                                   [boolean]
  -p, --port               HTTP port                      [number] [default: 80]
      --host               HTTP host             [string] [default: "localhost"]
      --nocache            Disable caching            [boolean] [default: false]
      --cors-allow-origin  Cors allow origin setting     [string] [default: "*"]
      --verbose            Verbose                    [boolean] [default: false]

```

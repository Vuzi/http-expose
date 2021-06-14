# HTTP Expose
🌍  Static HTTP server, useable through command line &amp; lib

## Usage

To expose a folder `./example` on `htttp://localhost:8000` ↴

```shell
$ http-expose ./example --port=8000
```

And now your directory is accessible ↴
```
$ curl http://localhost:8000/my/file.txt
this is my file content!
```

And for more, see [usage](#command-line-arguments) 🚀
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

## Command line arguments

```
$ expose-http -h

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

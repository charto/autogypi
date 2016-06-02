autogypi
========

[![build status](https://travis-ci.org/charto/autogypi.svg?branch=master)](http://travis-ci.org/charto/autogypi)
[![dependency status](https://david-dm.org/charto/autogypi.svg)](https://david-dm.org/charto/autogypi)
[![npm version](https://img.shields.io/npm/v/autogypi.svg)](https://www.npmjs.com/package/autogypi)

`autogypi` handles issues with C++ libraries published on npm.
It generates required compiler and `node-gyp` options for you and works great
with [`nbind`](https://github.com/charto/nbind#readme).

`node-gyp` is very good at fixing relative paths between `.gypi` files
in different locations, but it cannot automatically find other npm packages,
which may have been installed globally or in a `node_modules` directory
higher up in the directory tree or hidden inside another package.
`autogypi` deals with them.

Features
========

- Initialize configuration for a `node-gyp` -based project.
- Generate C++ compiler options.
- Guess include directories to use headers from other packages.
- Include additional `.gypi` files required by other packages.

Usage
=====

Installation
------------

Add in the `scripts` section of your `package.json`:

```json
  "scripts": {
    "autogypi": "autogypi",
    "node-gyp": "node-gyp",

    "install": "autogypi && node-gyp configure build"
  }
```

Then run the commands:

```bash
npm install --save autogypi
```

Configuring `node-gyp`
----------------------

You should add `auto-top.gypi` in the in the `includes` section
at the top level of your `binding.gyp` file and `auto.gypi` in the `includes`
section of each target inside.

If you don't have a `binding.gyp` file yet, you can create one now with the
required changes already made. For example:

```bash
npm run -- autogypi --init-gyp -p nbind -s example.cc
```

Replace `example.cc` with the name of your C++ source file.
You can add multiple `-s` options, one for each source file.

The `-p nbind` option means the C++ code uses a package called
[`nbind`](https://github.com/charto/nbind#readme).
Multiple `-p` options can be added to add any other packages
compatible with `autogypi`.

The above command creates two files with contents:

**`binding.gyp`**

```json
{
  "targets": [
    {
      "includes": [
        "auto.gypi"
      ],
      "sources": [
        "example.cc"
      ]
    }
  ],
  "includes": [
    "auto-top.gypi"
  ]
}
```

**`autogypi.json`**

```json
{
  "dependencies": [
    "nbind"
  ],
  "includes": []
}
```

It also prints an error if the packages you listed as dependencies are missing.
For example you can install `nbind` and run `autogypi` again:

```bash
npm install --save nbind
npm run autogypi
```

Compiling your project
----------------------

Call `autogypi` and `node-gyp` from the install script in your
`package.json` file, for example like
`autogypi && node-gyp configure build`
or from the command line:
`npm run autogypi && npm run node-gyp configure build`

`autogypi` generates two `.gypi` files according to its configuration.
For example with only `nbind` as a dependency they look like:

**`auto-top.gypi`**

```json
{
  "includes": [
    "node_modules/nbind/src/nbind-common.gypi"
  ]
}
```

**`auto.gypi`**

```json
{
  "include_dirs": [
    "node_modules/nbind/node_modules/nan"
  ],
  "includes": [
    "node_modules/nbind/src/nbind.gypi"
  ]
}
```

Publishing a C++ library on npm
-------------------------------

Packages should include an `autogypi.json` file in their root directory
if they require or are intended to be used by other modules.
They should list any .gypi files of their own that are required to compile
or use the module. For example:

```json
{
  "dependencies": [
    "nan"
  ],
  "includes": [
    "example.gypi"
  ]
}
```

The `example.gypi` file would then contain any gyp settings
required to successfully compile and include it in other packages.

Modules without any `autogypi.json` file get their root directory
added to `include_dirs`. This is enough to successfully use the `nan` module.
More heuristics may be added later if needed.

Command line options
====================

Run `npm run -- autogypi --help` to see the command line options:

```
  Usage: autogypi [options]

  Generate node-gyp dependency files.

  Options:

    -h, --help                output usage information
    -V, --version             output the version number
    -r, --root <path>         root path for config files, default is shell working directory
    -c, --config <path>       config file, default autogypi.json
    -o, --output <path>       per-target gypi file to create, default auto.gypi
    -t, --output-top <path>   top-level gypi file to create, default auto-top.gypi
    -T, --no-output-top       omit top-level gypi file
    -p, --package <path>      add dependency on another npm package
    -I, --include-dir <path>  add include directory for header files
    --save [flag]             save changes to config file
    --init-gyp [path]         create gyp file (default binding.gyp, implies --save) with options:
    -s, --source <path>         - add C or C++ source file
```

Renaming `autogypi.json`, `auto.gypi` and `auto-top.gypi` using the relevant
command line parameters will affect generating the `.gypi` files and also
the contents of any `binding.gyp` generated using the `--init-gyp` option.

API
===
Docs generated using [`docts`](https://github.com/charto/docts)
>
> <a name="api-AutogypiConfig"></a>
> ### Interface [`AutogypiConfig`](#api-AutogypiConfig)
> <em>Format of autogypi.json files published in Node.js modules.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L36-L47)  
>  
> Properties:  
> > **.dependencies**<sub>?</sub> <sup><code>string[]</code></sup>  
> > &emsp;<em>List of required Node.js modules.</em>  
> > **.includes**<sub>?</sub> <sup><code>string[]</code></sup>  
> > &emsp;<em>Additional gypi files to include inside relevant targets.</em>  
> > **.topIncludes**<sub>?</sub> <sup><code>string[]</code></sup>  
> > &emsp;<em>Additional gypi files to include at top level.</em>  
> > **.output**<sub>?</sub> <sup><code>string</code></sup>  
> > &emsp;<em>Path to auto.gypi to generate.</em>  
> > **.outputTop**<sub>?</sub> <sup><code>string</code></sup>  
> > &emsp;<em>Path to auto-top.gypi to generate.</em>  
>
> <a name="api-BindingConfig"></a>
> ### Interface [`BindingConfig`](#api-BindingConfig)
> <em>Options for generating an initial binding.gyp file.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L12-L21)  
>  
> Properties:  
> > **.basePath** <sup><code>string</code></sup>  
> > &emsp;<em>Directory where the binding.gyp will be stored.</em>  
> > **.outputPath** <sup><code>string</code></sup>  
> > &emsp;<em>Absolute path to generated auto.gypi to include in default target.</em>  
> > **.outputTopPath** <sup><code>string</code></sup>  
> > &emsp;<em>Absolute path to generated auto-top.gypi to include at top level.</em>  
> > **.sourceList** <sup><code>string[]</code></sup>  
> > &emsp;<em>List of absolute paths to C/C++ source files to compile.</em>  
>
> <a name="api-GenerateOptions"></a>
> ### Interface [`GenerateOptions`](#api-GenerateOptions)
> <em>General options for generating gypi files.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L25-L32)  
>  
> Properties:  
> > **.configPath** <sup><code>string</code></sup>  
> > &emsp;<em>Absolute path to autogypi.json.</em>  
> > **.outputPath** <sup><code>string</code></sup>  
> > &emsp;<em>Absolute path to auto.gypi to generate.</em>  
> > **.outputTopPath** <sup><code>string</code></sup>  
> > &emsp;<em>Absolute path to auto-top.gypi to generate.</em>  
>
> <a name="api-generate"></a>
> ### Function [`generate`](#api-generate)
> <em>Write auto.gypi and auto-top.gypi files according to config.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L188-L216)  
> > **generate( )** <sup>&rArr; <code>Bluebird&lt;{}[]&gt;</code></sup> [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L188-L216)  
> > &emsp;&#x25aa; opts <sup><code>[GenerateOptions](#api-GenerateOptions)</code></sup>  
> > &emsp;&#x25aa; config <sup><code>[AutogypiConfig](#api-AutogypiConfig)</code></sup> <em>Contents of autogypi.json.</em>  
>
> <a name="api-initGyp"></a>
> ### Function [`initGyp`](#api-initGyp)
> <em>Return an object with contents for an initial binding.gyp file.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L220-L241)  
> > **initGyp( )** <sup>&rArr; <code>any</code></sup> [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L220-L241)  
> > &emsp;&#x25aa; opts <sup><code>[BindingConfig](#api-BindingConfig)</code></sup>  
>
> <a name="api-writeJson"></a>
> ### Function [`writeJson`](#api-writeJson)
> <em>Save pretty-printed JSON object to a file or print an appropriate error.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L62-L84)  
> > **writeJson( )** <sup>&rArr; <code>Bluebird&lt;{}&gt;</code></sup> [`<>`](http://github.com/charto/autogypi/blob/cc6e9d1/src/autogypi.ts#L62-L84)  
> > &emsp;&#x25aa; outputPath <sup><code>string</code></sup>  
> > &emsp;&#x25aa; json <sup><code>any</code></sup>  
> > &emsp;&#x25ab; name<sub>?</sub> <sup><code>string</code></sup>  
> > &emsp;&#x25ab; header<sub>?</sub> <sup><code>string</code></sup>  

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/autogypi/master/LICENSE)
Copyright (c) 2015-2016 BusFaster Ltd

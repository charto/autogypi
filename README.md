autogypi
========

[![build status](https://travis-ci.org/charto/autogypi.svg?branch=master)](http://travis-ci.org/charto/autogypi)
[![dependency status](https://david-dm.org/charto/autogypi.svg)](https://david-dm.org/charto/autogypi)
[![npm version](https://img.shields.io/npm/v/autogypi.svg)](https://www.npmjs.com/package/autogypi)

Autogypi generates a `.gypi` file you can include from the main `binding.gyp` file of your own module.
The generated file includes references to other `.gypi` files bundled with any required npm modules.
Modules requiring more modules are handled recursively.

Why?
----

To easily publish in npm and use any C++ libraries designed for use in Node.js plugins.

Gyp is very good at fixing relative paths between .gypi files in different locations, but it cannot automatically find other npm modules
which may have been installed globally or in a node_modules directory higher up in the directory tree or hidden inside another module.

Usage
-----

For a real-world example that uses autogypi, check out [nbind](https://www.npmjs.com/package/nbind).

Call autogypi from the install script in your package.json file, for example:

```json
"scripts": {
    "install": "autogypi && node-gyp configure build"
}
```

By default, autogypi reads a configuration file called `autogypi.json`. You can pass another name as a command line parameter.
The contents are as follows:

```json
{
    "dependencies": [
        "nbind"
    ],
    "output": "auto.gypi"
}
```

Required npm modules are listed in dependencies.
These could perhaps later be parsed automatically from the package.json file,
but currently listing them in the configuration file allows listing only the modules
containing C++ code relevant to your node-gyp project.

Include the generated `auto.gypi` from your `binding.gyp` file:

```json
{
    "targets": [
        {
            "target_name": "example",
            "includes": ["auto.gypi"],
            "sources": ["Example.cc"]
        }
    ]
}
```

Modules should include their own `autogypi.json` in their root directory if they require or are intended to be used by other modules.
They may omit the output field, but should list any .gypi files of their own that are required to compile or use the module. For example:

```json
{
    "dependencies": [
        "nan"
    ],
    "includes": [
        "nbind.gypi"
    ]
}
```

The `nbind.gypi` file would then contain any gyp settings required to successfully compile and include it in other modules, for example:

```json
{
    "include_dirs": [
        "."
    ],
    "sources": ["Binding.cc"]
}
```

Modules without any `autogypi.json` file get their root directory added to `include_dirs`.
This is enough to successfully use the `nan` module. More heuristics may be added later if needed.

API
===
Docs generated using [`docts`](https://github.com/charto/docts)
>
> <a name="api-AutogypiConfig"></a>
> ### Interface [`AutogypiConfig`](#api-AutogypiConfig)
> <em>Format of autogypi.json files published in Node.js modules.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L36-L47)  
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
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L12-L21)  
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
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L25-L32)  
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
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L175-L196)  
> > **generate( )** <sup>&rArr; <code>Bluebird&lt;void&gt;</code></sup> [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L175-L196)  
> > &emsp;&#x25aa; opts <sup><code>[GenerateOptions](#api-GenerateOptions)</code></sup>  
> > &emsp;&#x25aa; config <sup><code>[AutogypiConfig](#api-AutogypiConfig)</code></sup> <em>Contents of autogypi.json.</em>  
>
> <a name="api-initGyp"></a>
> ### Function [`initGyp`](#api-initGyp)
> <em>Return an object with contents for an initial binding.gyp file.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L200-L221)  
> > **initGyp( )** <sup>&rArr; <code>any</code></sup> [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L200-L221)  
> > &emsp;&#x25aa; opts <sup><code>[BindingConfig](#api-BindingConfig)</code></sup>  
>
> <a name="api-writeJson"></a>
> ### Function [`writeJson`](#api-writeJson)
> <em>Save pretty-printed JSON object to a file or print an appropriate error.</em>  
> Source code: [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L62-L78)  
> > **writeJson( )** <sup>&rArr; <code>Bluebird&lt;{}&gt;</code></sup> [`<>`](http://github.com/charto/autogypi/blob/cd73a7b/src/autogypi.ts#L62-L78)  
> > &emsp;&#x25aa; outputPath <sup><code>string</code></sup>  
> > &emsp;&#x25aa; json <sup><code>any</code></sup>  
> > &emsp;&#x25ab; name<sub>?</sub> <sup><code>string</code></sup>  
> > &emsp;&#x25ab; header<sub>?</sub> <sup><code>string</code></sup>  

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/autogypi/master/LICENSE)
Copyright (c) 2015-2016 BusFaster Ltd

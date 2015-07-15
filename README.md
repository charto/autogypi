autogypi
========

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
    "install": "autogypi && node-gyp configure && node-gyp build"
}
```

By default, autogypi reads a configuration file called `autogypi.json`. You can pass another name as a command line parameter.
The contents are as follows:

```json
{
    "dependencies": [
        "nbind"
    ],
    "resolver": "gypiresolver.js",
    "output": "auto.gypi"
}
```

Required npm modules are listed in dependencies. These could perhaps later be parsed automatically from the package.json file, but
currently listing them in the configuration file allows listing only the modules containing C++ code relevant to your node-gyp project.

Modules should include a copy of `gypiresolver.js` from this package. If the path to it is omitted from `autogypi.js`, it's assumed
to be found in the module's root directory.

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
    ],
    "resolver": "gypiresolver.js"
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

The contents of `gypiresolver.js` distributed with the module must be as follows or equivalent:

```js
module.exports = function(moduleNameList) {
    return(moduleNameList.map(function(moduleName) {
        return(require.resolve(moduleName));
    }));
};
```

Its purpose is to look for modules from the context of other modules, so they can be found inside
nested `node_modules` directories or other special locations.

Modules without any `autogypi.json` file get their root directory added to `include_dirs`.
This is enough to successfully use the `nan` module. More heuristics may be added later if needed.

License
=======

[The MIT License](https://raw.githubusercontent.com/charto/autogypi/master/LICENSE)
Copyright (c) 2015 BusFaster Ltd

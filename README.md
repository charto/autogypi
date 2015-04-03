autogypi
========

Autogypi handles dependencies for node-gyp projects. It generates a .gypi file you can include from the main binding.gyp file of your own module.
The generated .gypi file includes references to other .gypi files bundled with any required npm modules.
Modules requiring more modules are handled recursively.

Why?
----

To easily publish in npm and use any C++ libraries designed for use in Node.js plugins.

Gyp is very good at fixing relative paths between .gypi files in different locations, but it cannot automatically find other npm modules
which may have been installed globally or in a node_modules directory higher up in the directory tree or hidden inside another module.

Usage
-----

Call autogypi from the install script in your package.json file, for example:

    "scripts": {
        "install": "autogypi && node-gyp configure && node-gyp build"
    }

By default, autogypi reads a configuration file called autogypi.json. You can pass another name as a command line parameter.
The contents are as follows:

    {
        "dependencies": [
            "nbind"
        ],
        "output": "auto.gypi"
    }

Required npm modules are listed in dependencies. These could perhaps later be parsed automatically from the package.json file, but
currently listing them in the configuration file allows listing only the modules containing C++ code relevant to your node-gyp project.

Include the generated auto.gypi from your binding.gyp file:

    {
        "targets": [
            {
                "target_name": "example",
                "includes": ["auto.gypi"],
                "sources": ["Example.cc"]
            }
        ]
    }

Modules should include their own autogypi.json if they require other modules. They should omit the output field, but list any .gypi files of their own that are required to compile the module. For example:

    {
        "dependencies": [
            "nan"
        ],
        "includes": [
            "nbind.gypi"
        ]
    }

The nbind.gypi file would then contain any gyp settings required to successfully compile and include it in other modules:

    {
        "include_dirs": [
            "."
        ],
        "sources": ["Binding.cc"],
        ...
    }

Modules without any autogypi.json file get their root directory added to include_dirs.
This is enough to successfully use the "nan" module. More heuristics may be added later if needed.

License
=======

[The MIT License](https://raw.githubusercontent.com/jjrv/nbind/master/LICENSE)
Copyright (c) 2015 BusFaster Ltd

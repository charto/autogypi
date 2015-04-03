// This file is part of autogypi, copyright (C) 2015 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

var fs = require('fs');
var path = require('path');

/** Get full paths of named modules.
  * @param {Array.<string>} moduleNameList Module names.
  * @return {Array.<string>} Full paths to modules. */
function resolver(moduleNameList) {
	return(moduleNameList.map(function(moduleName) {
		return(require.resolve(moduleName));
	}));
}

/** Read configuration file in JSON format.
  * @param {string} confPath Path of file to read.
  * @return {Object.<string, *>} File contents. */
function readConf(confPath) {
	try {
		var confData = fs.readFileSync(confPath);
	} catch(err) {
		console.error(err);
		throw('Error reading ' + confPath);
	}

	try {
		var conf = JSON.parse(confData);
	} catch(err) {
		console.error(err);
		throw('Error parsing JSON from ' + confPath);
	}

	return(conf);
}

/** @param {string} confPath Configuration file path to show in error messages.
  * @param {Array.<string>} dependList Names of required npm modules.
  * @param {*} resolver Like resolver function defined in this file, but possibly executing in the context of another module.
  * @param {{gypi: *}} result Object that forms the output .gypi file when written out as JSON. */ 
function findDepends(confPath, dependList, resolver, result) {
	var dependPathList;
	var dependCount;
	var moduleName, modulePath, nextPath, resolverPath;
	var moduleConfFound;
	var moduleConf;
	var moduleResolver;
	var depth;

	// Get full paths to modules.
	try {
		dependPathList = resolver(dependList);
	} catch(err) {
		console.error(err);
		throw('Unable to find a required module referenced in ' + confPath);
	}
	dependCount = dependList.length;

	for(dependNum = 0; dependNum < dependCount; dependNum++) {
		moduleName = dependList[dependNum];
		modulePath = path.dirname(path.relative('.', dependPathList[dependNum]));

		moduleConfFound = false;
		depth = 0;

		// Module entry point returned by require.resolve might be in
		// a subdirectory. Look for the module root directory containing the
		// module's packages.json and hopefully autogypi.json file.

		while(1) {
			moduleConfPath = path.join(modulePath, 'autogypi.json');

			if(fs.existsSync(moduleConfPath)) {
				// Found autogypi configuration for the module, process it.
				moduleConfFound = true;
				break;
			}

			// Found a package.json file, attempt to process the module.
			if(fs.existsSync(path.join(modulePath, 'package.json'))) break;

			// This is not the root of the module so move one directory up.
			nextPath = path.resolve(modulePath, '..');

			// Bail out if we cannot go up any more, or already reached a
			// node_modules directory which should be outside the module's
			// directory tree, or we've been stuck going up a number of
			// levels already.
			if(
				nextPath === modulePath
			||	path.basename(nextPath).toLowerCase() === 'node_modules'
			||	++depth > 20
			) {
				throw('Cannot find package.json in module ' + moduleName + ' referenced in ' + confPath);
			}

			modulePath = nextPath;
		}

		console.log('Found module ' + moduleName + ' in ' + modulePath);

		if(moduleConfFound) {
			// Luckily this module has an autogypi.json file specifying
			// how it should be included. Check if it also has a script
			// to resolve the full paths of its required npm modules.
			resolverPath = path.resolve(modulePath, 'gypiresolver.js');
			moduleConf = readConf(moduleConfPath);

			if(fs.existsSync(resolverPath)) {
				// resolverPath = path.join('..', path.relative(__dirname, resolverPath)).substr(1);
				resolverPath = path.resolve(__dirname, resolverPath);
				moduleResolver = require(resolverPath);
			} else {
				// Try to resolve any required npm modules from the
				// context of this module, instead of from the module
				// actually requiring them. This may fail...
				moduleResolver = resolver;
			}

			// Parse the configuration file...
			parseConf(moduleConfPath, moduleConf, moduleResolver, result);
		} else {
			// No configuration file found, try to do something useful for
			// hopefully getting the module compiled.
			result.gypi['include_dirs'].push(modulePath);
		}
	}
}

/** Parse an autogypi.json configuration file.
  * @param {string} confPath Path to configuration file to parse.
  * @param {Object.<string, *>} conf Configuration file contents as an object.
  * @param {*} resolver Like resolver function defined in this file, but possibly executing in the context of another module.
  * @param {{gypi: *}} result Object that forms the output .gypi file when written out as JSON. */ 
function parseConf(confPath, conf, resolver, result) {
	var dependList = conf['dependencies'];
	var includeList = conf['includes'];

	// Read the names of required npm modules and try to find their paths
	// and possible autogypi.json files.
	if(dependList && resolver) findDepends(confPath, dependList, resolver, result);

	// If the module comes with .gypi files, add their correct
	// relative paths to the .gypi file this script will produce.
	if(includeList) {
		Array.prototype.push.apply(
			result.gypi['includes'],
			includeList.map(function(includePath) {
				return(path.relative('.', path.join(path.dirname(confPath), includePath)));
			})
		);
	}
}

// Initialize output file template.
var result = {
	gypi: {
		includes: [],
		include_dirs: [],
	},
	outputPath: null
};

// Get path to configuration file from the command line or set it to a default value.
var confPath = process.argv[2];
if(!confPath) confPath = 'autogypi.json';

var conf = readConf(confPath);

result.outputPath = conf['output'];
if(!result.outputPath) {
	throw('"output" property with output file path is missing from configuration file ' + confPath);
}

parseConf(confPath, conf, resolver, result);

// Serialize generated .gypi contents as JSON to output file.
fs.writeFileSync(result.outputPath, JSON.stringify(result.gypi) + '\n');

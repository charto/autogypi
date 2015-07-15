// This file is part of autogypi, copyright (C) 2015 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

var fs = require('fs');
var path = require('path');

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

/** Module entry point returned by require.resolve might be in a subdirectory.
  * Look for the module root directory containing the module's packages.json
  * and hopefully autogypi.json file.
  * @param {string} modulePath Path to some file or directory inside the module.
  * @return {{modulePath: string, moduleConfPath: string}} Path to module root
  *   and possible autogypi.json file. */
function findModuleRoot(modulePath, depend, confPath) {
	var nextPath;
	var moduleConfFound = false;
	var moduleConfPath;
	var depth = 0;

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
			throw('Cannot find package.json for dependency ' + depend + ' referenced in ' + confPath);
		}

		modulePath = nextPath;
	}

	return({
		modulePath: modulePath,
		moduleConfPath: moduleConfFound ? moduleConfPath : null
	});
}

/** @param {string} confPath Configuration file path to show in error messages.
  * @param {Array.<string>} dependList Names of required npm modules.
  * @param {*} resolver Like resolver function defined in this file, but possibly executing in the context of another module.
  * @param {{gypi: *}} result Object that forms the output .gypi file when written out as JSON. */ 
function findDepends(confPath, dependList, resolver, result) {
	var dependNum, dependCount;
	var depend;
	var modulePath, moduleConfPath, entryPath, resolverPath;
	var moduleRootInfo;
	var moduleConf;
	var moduleList, modulePathList, rawPathList;
	var pathTbl;

	function notPathy(name) {
		return(
			// Scoped module names start with an @.
			name.match(/^@/) ||
			// Names containing no slashes are probably module names.
			!name.match(/[/\\]/)
			// Names containing a single slash might be references to packages
			// published on Github but autogypi doesn't support that, so such
			// a condition is omitted here.
		);
	}
	function isPathy(name) {return(!notPathy(name));}

	// Divide dependencies into two groups according to whether they look like paths.
	// Anything that's not a path is assumed to be a resolvable module name.
	rawPathList = dependList.filter(isPathy);
	moduleList = dependList.filter(notPathy);

	// Get full paths to modules.
	try {
		modulePathList = resolver(moduleList);
	} catch(err) {
		console.error(err);
		throw('Unable to find a required module referenced in ' + confPath);
	}

	pathTbl = {};

	// Associate module names with their full paths.
	dependCount = moduleList.length;
	for(dependNum = 0; dependNum < dependCount; dependNum++) {
		pathTbl[moduleList[dependNum]] = modulePathList[dependNum];
	}

	// Associate possibly relative path references with full paths.
	rawPathList.forEach(function(rawPath) {
		pathTbl[rawPath] = path.resolve(path.dirname(confPath), rawPath);
	});

	dependCount = dependList.length;

	for(dependNum = 0; dependNum < dependCount; dependNum++) {
		depend = dependList[dependNum];

		// If the dependency is a module name, avoid including the same module
		// twice even if it would be found in a different path from inside
		// another module (multiple copies of a library in a C++ project is
		// unlikely to work).
		if(notPathy(depend)) {
			if(result.foundModuleTbl[depend]) continue;
			result.foundModuleTbl[depend] = true;
		}

		// Get full path associated with dependency.
		// If it's not a directory (so likely it's the module's main
		// JavaScript file), start looking for the module's root from
		// that file's directory.
		entryPath = pathTbl[depend];
		if(!fs.statSync(entryPath).isDirectory()) entryPath = path.dirname(entryPath);

		// Look for the module's root directory and possible autogypi.conf.
		moduleRootInfo = findModuleRoot(entryPath, depend, confPath);
		modulePath = moduleRootInfo.modulePath;
		moduleConfPath = moduleRootInfo.moduleConfPath;

		// Ensure an identical module has not been included already based on
		// the full path of its root directory.
		if(result.foundPathTbl[modulePath]) continue;
		result.foundPathTbl[modulePath] = true;

		console.log('Found dependency ' + depend + ' in ' + modulePath);

		if(moduleConfPath) {
			// Luckily this module has an autogypi.json file specifying
			// how it should be included. Parse the configuration file.
			parseConf(moduleConfPath, resolver, result);
		} else {
			// No configuration file found, try to do something useful for
			// hopefully getting the module included. This is enough for nan.
			result.gypi['include_dirs'].push(modulePath);
		}
	}
}

/** Parse an autogypi.json configuration file.
  * @param {string} confPath Path to configuration file to parse.
  * @param {Object.<string, *>} conf Configuration file contents as an object.
  * @param {*} resolver Like resolver function defined in this file, but possibly executing in the context of another module.
  * @param {{gypi: *}} result Object that forms the output .gypi file when written out as JSON. */ 
function parseConf(confPath, resolverPrev, result) {
	var conf = readConf(confPath);
	var dependList = conf['dependencies'];
	var includeList = conf['includes'];
	var resolverPath = conf['resolver'];
	/** Get full paths of named modules.
	  * @param {Array.<string>} moduleNameList Module names.
	  * @return {Array.<string>} Full paths to modules. */
	var resolver;

	if(!resolverPath) resolverPath = 'gypiresolver.js';
	resolverPath = path.resolve(path.dirname(confPath), resolverPath);

	try {
		resolver = require(resolverPath);
	} catch(e) {
		console.log(err);
		console.log('Problem reading module path resolver ' + resolverPath);

		if(resolverPrev) {
			console.log('Trying resolver from requiring package instead.');
			resolver = resolverPrev;
		} else {
			console.log('Trying resolver from autogypi package instead.');
			resolver = require(path.resolve(__dirname, 'gypiresolver.js'));
		}
	}

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

	return(conf);
}

// Initialize output file template.
var result = {
	foundModuleTbl: {},
	foundPathTbl: {},
	gypi: {
		includes: [],
		include_dirs: [],
	},
	outputPath: null
};

// Get path to configuration file from the command line or set it to a default value.
var confPath = process.argv[2];
if(!confPath) confPath = 'autogypi.json';

confPath = path.resolve('.', confPath);
if(fs.statSync(confPath).isDirectory()) confPath = path.join(confPath, 'autogypi.json');

var conf = parseConf(confPath, null, result);

if(!conf['output']) {
	throw('"output" property with output file path is missing from configuration file ' + confPath);
}

result.outputPath = path.resolve(path.dirname(confPath), conf['output']);

// Serialize generated .gypi contents as JSON to output file.
fs.writeFileSync(result.outputPath, JSON.stringify(result.gypi) + '\n');

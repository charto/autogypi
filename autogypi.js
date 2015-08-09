// This file is part of autogypi, copyright (C) 2015 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

var fs = require('fs');
var path = require('path');
var link = require('@lib/autolink');

/** @param {string} confPath Configuration file path to show in error messages.
  * @param {Array.<string>} dependList Names of required npm modules.
  * @param {*} resolver Like resolver function defined in this file, but possibly executing in the context of another module.
  * @param {{gypi: *}} result Object that forms the output .gypi file when written out as JSON. */ 
function findDepends(confPath, dependList, resolver, result) {
	var dependNum, dependCount;
	var depend;
	var modulePath, entryPath, resolverPath;
	var moduleConfInfo;
	var moduleConf;
	var moduleList, modulePathList, rawPathList;
	var pathTbl;

	// Divide dependencies into two groups according to whether they look like paths.
	// Anything that's not a path is assumed to be a resolvable module name.
	rawPathList = dependList.filter(link.isPathy);
	moduleList = dependList.filter(link.notPathy);

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
		if(link.notPathy(depend)) {
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
		moduleConfInfo = link.findModuleConf(entryPath, ['autogypi.json', 'package.json']);
		if(!moduleConfInfo) {
			throw('Cannot find package.json for dependency ' + depend + ' referenced in ' + confPath);
		}

		modulePath = moduleConfInfo.modulePath;

		// Ensure an identical module has not been included already based on
		// the full path of its root directory.
		if(result.foundPathTbl[modulePath]) continue;
		result.foundPathTbl[modulePath] = true;

		console.log('Found dependency ' + depend + ' in ' + modulePath);

		if(moduleConfInfo.confName === 'autogypi.json') {
			// Luckily this module has an autogypi.json file specifying
			// how it should be included. Parse the configuration file.
			parseConf(moduleConfInfo.confPath, resolver, result);
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
	var conf = link.readConf(confPath);
	var dependList = conf['dependencies'];
	var includeList = conf['includes'];
	var resolverPath = conf['resolver'];
	/** Get full paths of named modules.
	  * @param {Array.<string>} moduleNameList Module names.
	  * @return {Array.<string>} Full paths to modules. */
	var resolver;

	if(!resolverPath) resolverPath = 'autoresolver.js';
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
			resolver = require(path.resolve(__dirname, 'autoresolver.js'));
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

var header = [
	'# Automatically generated file. Edits will be lost.',
	'# Based on: ' + path.relative(path.dirname(result.outputPath), confPath)
].join('\n');

// Serialize generated .gypi contents as JSON to output file.
fs.writeFileSync(result.outputPath, header + '\n' + JSON.stringify(result.gypi) + '\n');

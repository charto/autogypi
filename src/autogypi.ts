// This file is part of autogypi, copyright (C) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as fs from 'fs';
import * as path from 'path';

import * as Promise from 'bluebird';
import * as resolve from 'resolve';

/** Options for generating an initial binding.gyp file. */

export interface BindingConfig {
	/** Directory where the binding.gyp will be stored. */
	basePath: string;
	/** Absolute path to generated auto.gypi to include in default target. */
	outputPath: string;
	/** Absolute path to generated auto-top.gypi to include at top level. */
	outputTopPath: string;
	/** List of absolute paths to C/C++ source files to compile. */
	sourceList: string[];
}

/** General options for generating gypi files. */

export interface GenerateOptions {
	/** Absolute path to autogypi.json. */
	configPath: string;
	/** Absolute path to auto.gypi to generate. */
	outputPath: string;
	/** Absolute path to auto-top.gypi to generate. */
	outputTopPath: string;
}

/** Format of autogypi.json files published in Node.js modules. */

export interface AutogypiConfig {
	/** List of required Node.js modules. */
	dependencies?: string[];
	/** Additional gypi files to include inside relevant targets. */
	includes?: string[];
	/** Additional gypi files to include at top level. */
	topIncludes?: string[];
	/** Path to auto.gypi to generate. */
	output?: string;
	/** Path to auto-top.gypi to generate. */
	outputTop?: string;
}

interface Gypi {
	[ key: string ]: any;
	'include_dirs'?: string[];
	includes?: string[];
}

interface GypiPair {
	gypi?: Gypi;
	gypiTop?: Gypi;
}

/** Save pretty-printed JSON object to a file or print an appropriate error. */

export function writeJson(outputPath: string, json: any, name?: string, header?: string) {
	return((Promise.promisify(fs.writeFile as (path: string, data: string, options: any, cb: (err: NodeJS.ErrnoException) => void) => void))(
		outputPath,
		(
			(header || '') +
			JSON.stringify(json, null, 1).replace(
				/\n +/g,
				(indent: string) => indent.replace(/ /g, '\t')
			) +
			'\n'
		),
		{ encoding: 'utf-8' }
	).catch((err: NodeJS.ErrnoException) => {
		console.error('Warning: could not save ' + (name || 'json') + ' to ' + outputPath);
		console.error(err);
	}));
}

function parseConfig(configPath: string, config?: AutogypiConfig): Promise<GypiPair> {
	var basePath = path.dirname(configPath);
	if(!config) config = require(configPath);

	function resolveFile(relativePath: string) {
		return(path.resolve(basePath, relativePath));
	}

	// Get list of gypi options for required Node.js modules.

	var dependenciesDone = Promise.map(config.dependencies || [], (dep: string) => {
		// Find package.json file of required module.

		var resolveDone = Promise.promisify(resolve)(
			dep,
			{
				basedir: basePath,
				packageFilter: (json: any) => {
					json.main = 'package.json';
					return(json);
				}
			}
		);

		var subParseDone = resolveDone.then((entry: string) =>
		// Parse possible autogypi.json file specifying how to include the module.
			parseConfig(path.resolve(path.dirname(entry), 'autogypi.json'))
		).catch((err: any) => {
			// No configuration file found, just add the root directory to include paths.
			// This is enough for nan.
			var pair: GypiPair = {
				gypi: {
					'include_dirs': [ path.dirname(resolveDone.value() as string) ]
				}
			};

			return(pair);
		});

		return(subParseDone);
	});

	var parseDone = dependenciesDone.then((gypiList: GypiPair[]) => {
		var gypi: Gypi = {};
		var gypiTop: Gypi = {};

		// Flatten list of gypi options for required modules,
		// concatenating all lists of files with matching keys.

		for(var sub of gypiList) {
			for(var key of Object.keys(sub.gypi || {})) {
				gypi[key] = (gypi[key] || []).concat(sub.gypi[key]);
			}

			for(var key of Object.keys(sub.gypiTop || {})) {
				gypiTop[key] = (gypiTop[key] || []).concat(sub.gypiTop[key]);
			}
		}

		// Add options for this module. Make all paths absolute.

		if(config.includes) {
			gypi.includes = (gypi.includes || []).concat(config.includes.map(resolveFile));
		}

		if(config.topIncludes) {
			gypiTop.includes = (gypiTop.includes || []).concat(config.topIncludes.map(resolveFile));
		}

		var pair: GypiPair = {
			gypi: gypi,
			gypiTop: gypiTop
		}

		return(pair);
	});

	return(parseDone);
}

function relativize(outputPath: string, gypi: Gypi) {
	function relativizeList(pathList: string[]) {
		return(pathList.map((absolutePath: string) =>
			path.relative(outputPath, absolutePath)
		))
	}

	for(var key of ['include_dirs', 'includes']) {
		if(gypi[key]) gypi[key] = relativizeList(gypi[key]);
	}
}

/** Write auto.gypi and auto-top.gypi files according to config.
  * @param config Contents of autogypi.json. */

export function generate(opts: GenerateOptions, config: AutogypiConfig) {
	var parseDone = parseConfig(opts.configPath, config);

	var generateDone = parseDone.then((result: GypiPair) => {
		var header = [
			'# Automatically generated file. Edits will be lost.',
			'# Based on: ' + path.relative(path.dirname(opts.outputPath), opts.configPath),
			'', ''
		].join('\n');

		relativize(path.dirname(opts.outputPath), result.gypi);
		relativize(path.dirname(opts.outputTopPath), result.gypiTop);

		// Serialize generated .gypi contents as JSON to output files.
		writeJson(opts.outputPath, result.gypi, 'gypi', header);
		writeJson(opts.outputTopPath, result.gypiTop, 'gypi', header);
	});

	return(generateDone);
}

/** Return an object with contents for an initial binding.gyp file. */

export function initGyp(opts: BindingConfig) {
	var basePath = opts.basePath;

	var gyp = {
		includes: [
			path.relative(basePath, opts.outputTopPath)
		],

		targets: [
			{
				includes: [
					path.relative(basePath, opts.outputPath)
				],
				sources: opts.sourceList.map((src: string) => path.relative(basePath, src))
			}
		]
	};

	return(gyp);
}

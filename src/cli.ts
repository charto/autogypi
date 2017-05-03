// This file is part of autogypi, copyright (C) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as path from 'path';
import * as cmd from 'commander';

import {initGyp, generate, writeJson, AutogypiConfig, GenerateOptions} from './autogypi';

type _ICommand = typeof cmd;
interface Command extends _ICommand {
	arguments(spec: string): Command;
}

function parseBool(flag: string) {
	const falseTbl: { [key: string]: boolean } = {
		'0': true,
		'no': true,
		'false': true
	};

	return(!flag || !falseTbl[flag.toLowerCase()]);
}

function push(item: string, list: string[]) {
	list.push(item);
	return(list);
}

/* tslint:disable:max-line-length */

((cmd.version(require('../package.json').version) as Command)
	.description('Generate node-gyp dependency files.')
	.option('-r, --root <path>', 'root path for config files, default is shell working directory')
	.option('-c, --config <path>', 'config file, default autogypi.json')
	.option('-o, --output <path>', 'per-target gypi file to create, default auto.gypi')
	.option('-t, --output-top <path>', 'top-level gypi file to create, default auto-top.gypi')
	.option('-T, --no-output-top', 'omit top-level gypi file')
	.option('-p, --package <path>', 'add dependency on another npm package', push, [])
	.option('-I, --include-dir <path>', 'add include directory for header files', push, [])
	.option('--save [flag]', 'save changes to config file', parseBool)
	.option('--init-gyp [path]', 'create gyp file (default binding.gyp, implies --save) with options:', parseBool)
	.option('-s, --source <path>', '  - add C or C++ source file', push, [])
	.action(handleGenerate)
	.parse(process.argv)
);

/* tslint:enable:max-line-length */

handleGenerate(cmd.opts());

/** Return sorted unique values from multiple arrays. */

function concatUnique(...args: (string[] | undefined)[]) {
	const tbl: { [key: string]: any } = {};

	for(let list of args) {
		for(let item of list || []) {
			tbl[item] = true;
		}
	}

	return(Object.keys(tbl).sort());
}

function handleGenerate(opts: { [key: string]: any }) {
	const cwd = process.cwd();
	let root = opts['root'] || cwd;

	function resolve(pathName: string, pathDefault: string) {
		if(typeof(pathName) == 'string') {
			return(path.resolve(cwd, pathName));
		} else if(pathDefault) {
			return(path.resolve(root, pathDefault));
		} else {
			return(pathDefault);
		}
	}

	const configPath = resolve(opts['config'], 'autogypi.json')!;
	let gypPath: string | null | undefined;

	if(opts['initGyp']) gypPath = resolve(opts['initGyp'], 'binding.gyp');

	if(!opts['root']) {
		const refPath = configPath || gypPath;
		if(refPath) root = path.dirname(refPath);
	}

	let outputPath = resolve(opts['output'], 'auto.gypi');
	let outputTopPath: string | null = resolve(opts['outputTop'], 'auto-top.gypi');
	let config: AutogypiConfig = {};

	try {
		config = require(configPath);
	} catch(err) {}

	if(opts['output']) {
		config.output = path.relative(path.dirname(configPath), outputPath);
	} else {
		outputPath = path.resolve(path.dirname(configPath), config['output'] || outputPath);
	}

	if(typeof(opts['outputTop']) == 'string') {
		config.outputTop = path.relative(path.dirname(configPath), outputTopPath);
	} else {
		outputTopPath = path.resolve(path.dirname(configPath), config['outputTop'] || outputTopPath);
	}

	config['dependencies'] = concatUnique(config.dependencies, opts['package']);
	config['includes'] = concatUnique(config.includes, opts['includeDir']);

	if(opts['save'] || opts['initGyp']) writeJson(configPath, config, 'config');

	if(opts['outputTop'] === false) outputTopPath = null;

	if(opts['initGyp']) {
		gypPath = resolve(opts['initGyp'], 'binding.gyp');

		const gyp = initGyp({
			basePath: path.dirname(gypPath),
			outputPath: outputPath,
			outputTopPath: outputTopPath,
			sourceList: opts['source'].map((src: string) => path.resolve(cwd, src))
		});

		writeJson(gypPath, gyp, 'gyp template');
	}

	const generateOptions: GenerateOptions = {
		configPath: configPath,
		outputPath: outputPath,
		outputTopPath: outputTopPath
	};

	generate(
		generateOptions,
		config
	).catch((err: any) => {
		console.error('Error: could not generate gypi files:');
		console.error(err);
	});
}

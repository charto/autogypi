// This file is part of autogypi, copyright (C) 2015-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

declare module 'resolve' {
	interface ResolveOptions {
		basedir?: string;
		package?: any;
		extensions?: string[];
		readFile?: (path: string, cb: (err: any, data: string) => void) => void;
		isFile?: (path: string, cb: (err: any, result: boolean) => void) => void;
		packageFilter?: (json: any) => any;
		pathFilter?: (json: any, path: string, relativePath: string) => string;
	}

	var resolve: (name: string, opts: ResolveOptions, cb: (err: any, path: string) => void) => string;

	export = resolve;
}

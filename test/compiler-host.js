import './support.js';

import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import rimraf from 'rimraf';
import mkdirp from 'mkdirp';
import mimeTypes from 'mime-types';
import FileChangeCache from '../lib/file-change-cache';
import CompilerHost from '../lib/compiler-host';

const d = require('debug')('test:compiler-host');

let testCount=0;

describe('All available compilers', function() {
  it('should have a MIME type in mime-types', function() {
    _.each(Object.keys(global.compilersByMimeType), (type) => {
      d(`Extension for ${type} is ${mimeTypes.extension(type)}`);
      expect(mimeTypes.extension(type)).to.be.ok;
    });
  });
});

describe('The compiler host', function() {
  this.timeout(15*1000);

  beforeEach(function() {
    this.appRootDir = path.join(__dirname, '..');
    this.fileChangeCache = new FileChangeCache(this.appRootDir);
        
    this.tempCacheDir = path.join(__dirname, `__compile_cache_${testCount++}`);
    mkdirp.sync(this.tempCacheDir);
    
    this.compilersByMimeType = _.reduce(Object.keys(global.compilersByMimeType), (acc, type) => {
      let Klass = global.compilersByMimeType[type];
      acc[type] = new Klass();
      return acc;
    }, {});
    
    let InlineHtmlCompiler = Object.getPrototypeOf(this.compilersByMimeType['text/html']).constructor;
    this.compilersByMimeType['text/html'] = InlineHtmlCompiler.createFromCompilers(this.compilersByMimeType);
    
    this.fixture = new CompilerHost(this.tempCacheDir, this.compilersByMimeType, this.fileChangeCache, false);
  });
  
  afterEach(function() {
    rimraf.sync(this.tempCacheDir);
  });

  it('should compile basic HTML and not blow up', function() {
    let input = '<html><style type="text/less">body { font-family: "lol"; }</style></html>';
    let inFile = path.join(this.tempCacheDir, 'input.html');
    fs.writeFileSync(inFile, input);
    
    let result = this.fixture.compileSync(inFile);

    expect(result.mimeType).to.equal('text/html');
    expect(result.code.length > input.length).to.be.ok;
  });

  it('Should compile everything in the fixtures directory', async function() {
    let input = path.join(__dirname, '..', 'test', 'fixtures');

    await this.fixture.compileAll(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
  });
  
  it('Should compile everything in the fixtures directory sync', function() {
    let input = path.join(__dirname, '..', 'test', 'fixtures');

    this.fixture.compileAllSync(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
  });
  
  it('Should read files from cache once we compile them', async function() {
    let input = path.join(__dirname, '..', 'test', 'fixtures');

    await this.fixture.compileAll(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
    
    this.fixture = new CompilerHost(this.tempCacheDir, this.compilersByMimeType, this.fileChangeCache, true);
    this.fixture.compileUncached = () => Promise.reject(new Error("Fail!"));

    await this.fixture.compileAll(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
  });
  
  it('Should read files from cache once we compile them synchronously', function() {
    let input = path.join(__dirname, '..', 'test', 'fixtures');

    this.fixture.compileAllSync(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
    
    this.fixture = new CompilerHost(this.tempCacheDir, this.compilersByMimeType, this.fileChangeCache, true);
    this.fixture.compileUncached = () => { throw new Error("Fail!"); };

    this.fixture.compileAllSync(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
  });
  
  it('Should read files from serialized compiler information', async function() {
    let input = path.join(__dirname, '..', 'test', 'fixtures');

    d("Attempting to run initial compile");
    await this.fixture.compileAll(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
    
    d("Saving configuration");
    await this.fixture.saveConfiguration();
    
    d("Recreating from said configuration");
    this.fixture = await CompilerHost.createReadonlyFromConfiguration(this.tempCacheDir, this.appRootDir);
    this.fixture.compileUncached = () => Promise.reject(new Error("Fail!"));

    d("Recompiling everything from cached data");
    await this.fixture.compileAll(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
  });
  
  it('Should read files from serialized compiler information synchronously', function() {
    let input = path.join(__dirname, '..', 'test', 'fixtures');

    d("Attempting to run initial compile");
    this.fixture.compileAllSync(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
    
    d("Saving configuration");
    this.fixture.saveConfigurationSync();
    
    d("Recreating from said configuration");
    this.fixture = CompilerHost.createReadonlyFromConfigurationSync(this.tempCacheDir, this.appRootDir);
    this.fixture.compileUncached = () => Promise.reject(new Error("Fail!"));

    d("Recompiling everything from cached data");
    this.fixture.compileAllSync(input, (filePath) => {
      if (filePath.match(/invalid/)) return false;
      if (filePath.match(/binaryfile/)) return false;
      if (filePath.match(/minified/)) return false;
      if (filePath.match(/source_map/)) return false;
      if (filePath.match(/babelrc/)) return false;
      if (filePath.match(/compilerc/)) return false;
      
      return true;
    });
  });
});

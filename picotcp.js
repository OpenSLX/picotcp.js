
var Module = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  return (
function(Module) {
  Module = Module || {};

// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
Module["locateFile"] = function(path) {
  let url = import.meta.url;
  url = url.replace(/^file:\/\//, "");
  return url + "/../" + path;
};
Module["noExitRuntime"] = true;



// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;


// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';

  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  // MODULARIZE will export the module in the proper place outside, we don't need to export here

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', abort);

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) { // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (document.currentScript) { // web
    scriptDirectory = document.currentScript.src;
  }
  // When MODULARIZE (and not _INSTANCE), this JS may be executed later, after document.currentScript
  // is gone, so we saved it, and we use it here instead of any other info.
  if (_scriptDir) {
    scriptDirectory = _scriptDir;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  if (scriptDirectory.indexOf('blob:') !== 0) {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf('/')+1);
  } else {
    scriptDirectory = '';
  }


  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;


function staticAlloc(size) {
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}

function dynamicAlloc(size) {
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(20);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  var base = 0;
  for (var i = base; i < base + 20; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    return Module['dynCall_' + sig].call(null, ptr);
  }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
  tempRet0 = value;
}

var getTempRet0 = function() {
  return tempRet0;
}


var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 1024;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  argTypes = argTypes || [];
  // When the function takes numbers and returns a number, we can just return
  // the original function
  var numericArgs = argTypes.every(function(type){ return type === 'number'});
  var numericRet = returnType !== 'string';
  if (numericRet && numericArgs && !opts) {
    return getCFunc(ident);
  }
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (y + ' [' + x + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;




function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  if (typeof WebAssembly === 'object' && typeof WebAssembly.Memory === 'function') {
    Module['wasmMemory'] = new WebAssembly.Memory({ 'initial': TOTAL_MEMORY / WASM_PAGE_SIZE, 'maximum': TOTAL_MEMORY / WASM_PAGE_SIZE });
    buffer = Module['wasmMemory'].buffer;
  } else
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}




function integrateWasmJS() {
  // wasm.js has several methods for creating the compiled code module here:
  //  * 'native-wasm' : use native WebAssembly support in the browser
  //  * 'interpret-s-expr': load s-expression code from a .wast and interpret
  //  * 'interpret-binary': load binary wasm and interpret
  //  * 'interpret-asm2wasm': load asm.js code, translate to wasm, and interpret
  //  * 'asmjs': no wasm, just load the asm.js code and use that (good for testing)
  // The method is set at compile time (BINARYEN_METHOD)
  // The method can be a comma-separated list, in which case, we will try the
  // options one by one. Some of them can fail gracefully, and then we can try
  // the next.

  // inputs

  var method = 'native-wasm';

  var wasmTextFile = 'picotcp.wast';
  var wasmBinaryFile = 'picotcp.wasm';
  var asmjsCodeFile = 'picotcp.temp.asm.js';

  if (!isDataURI(wasmTextFile)) {
    wasmTextFile = locateFile(wasmTextFile);
  }
  if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile);
  }
  if (!isDataURI(asmjsCodeFile)) {
    asmjsCodeFile = locateFile(asmjsCodeFile);
  }

  // utilities

  var wasmPageSize = 64*1024;

  var info = {
    'global': null,
    'env': null,
    'asm2wasm': asm2wasmImports,
    'parent': Module // Module inside wasm-js.cpp refers to wasm-js.cpp; this allows access to the outside program.
  };

  var exports = null;


  function mergeMemory(newBuffer) {
    // The wasm instance creates its memory. But static init code might have written to
    // buffer already, including the mem init file, and we must copy it over in a proper merge.
    // TODO: avoid this copy, by avoiding such static init writes
    // TODO: in shorter term, just copy up to the last static init write
    var oldBuffer = Module['buffer'];
    if (newBuffer.byteLength < oldBuffer.byteLength) {
      err('the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here');
    }
    var oldView = new Int8Array(oldBuffer);
    var newView = new Int8Array(newBuffer);


    newView.set(oldView);
    updateGlobalBuffer(newBuffer);
    updateGlobalBufferViews();
  }

  function getBinary() {
    try {
      if (Module['wasmBinary']) {
        return new Uint8Array(Module['wasmBinary']);
      }
      if (Module['readBinary']) {
        return Module['readBinary'](wasmBinaryFile);
      } else {
        throw "both async and sync fetching of the wasm failed";
      }
    }
    catch (err) {
      abort(err);
    }
  }

  function getBinaryPromise() {
    // if we don't have the binary yet, and have the Fetch api, use that
    // in some environments, like Electron's render process, Fetch api may be present, but have a different context than expected, let's only use it on the Web
    if (!Module['wasmBinary'] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === 'function') {
      return fetch(wasmBinaryFile, { credentials: 'same-origin' }).then(function(response) {
        if (!response['ok']) {
          throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
        }
        return response['arrayBuffer']();
      }).catch(function () {
        return getBinary();
      });
    }
    // Otherwise, getBinary should be able to get it synchronously
    return new Promise(function(resolve, reject) {
      resolve(getBinary());
    });
  }

  // do-method functions


  function doNativeWasm(global, env, providedBuffer) {
    if (typeof WebAssembly !== 'object') {
      err('no native wasm support detected');
      return false;
    }
    // prepare memory import
    if (!(Module['wasmMemory'] instanceof WebAssembly.Memory)) {
      err('no native wasm Memory in use');
      return false;
    }
    env['memory'] = Module['wasmMemory'];
    // Load the wasm module and create an instance of using native support in the JS engine.
    info['global'] = {
      'NaN': NaN,
      'Infinity': Infinity
    };
    info['global.Math'] = Math;
    info['env'] = env;
    // handle a generated wasm instance, receiving its exports and
    // performing other necessary setup
    function receiveInstance(instance, module) {
      exports = instance.exports;
      if (exports.memory) mergeMemory(exports.memory);
      Module['asm'] = exports;
      Module["usingWasm"] = true;
      removeRunDependency('wasm-instantiate');
    }
    addRunDependency('wasm-instantiate');

    // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
    // to manually instantiate the Wasm module themselves. This allows pages to run the instantiation parallel
    // to any other async startup actions they are performing.
    if (Module['instantiateWasm']) {
      try {
        return Module['instantiateWasm'](info, receiveInstance);
      } catch(e) {
        err('Module.instantiateWasm callback failed with error: ' + e);
        return false;
      }
    }

    function receiveInstantiatedSource(output) {
      // 'output' is a WebAssemblyInstantiatedSource object which has both the module and instance.
      // receiveInstance() will swap in the exports (to Module.asm) so they can be called
      receiveInstance(output['instance'], output['module']);
    }
    function instantiateArrayBuffer(receiver) {
      getBinaryPromise().then(function(binary) {
        return WebAssembly.instantiate(binary, info);
      }).then(receiver, function(reason) {
        err('failed to asynchronously prepare wasm: ' + reason);
        abort(reason);
      });
    }
    // Prefer streaming instantiation if available.
    if (!Module['wasmBinary'] &&
        typeof WebAssembly.instantiateStreaming === 'function' &&
        !isDataURI(wasmBinaryFile) &&
        typeof fetch === 'function') {
      WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, { credentials: 'same-origin' }), info)
        .then(receiveInstantiatedSource, function(reason) {
          // We expect the most common failure cause to be a bad MIME type for the binary,
          // in which case falling back to ArrayBuffer instantiation should work.
          err('wasm streaming compile failed: ' + reason);
          err('falling back to ArrayBuffer instantiation');
          instantiateArrayBuffer(receiveInstantiatedSource);
        });
    } else {
      instantiateArrayBuffer(receiveInstantiatedSource);
    }
    return {}; // no exports yet; we'll fill them in later
  }


  // We may have a preloaded value in Module.asm, save it
  Module['asmPreload'] = Module['asm'];

  // Memory growth integration code

  var asmjsReallocBuffer = Module['reallocBuffer'];

  var wasmReallocBuffer = function(size) {
    var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE; // In wasm, heap size must be a multiple of 64KB. In asm.js, they need to be multiples of 16MB.
    size = alignUp(size, PAGE_MULTIPLE); // round up to wasm page size
    var old = Module['buffer'];
    var oldSize = old.byteLength;
    if (Module["usingWasm"]) {
      // native wasm support
      try {
        var result = Module['wasmMemory'].grow((size - oldSize) / wasmPageSize); // .grow() takes a delta compared to the previous size
        if (result !== (-1 | 0)) {
          // success in native wasm memory growth, get the buffer from the memory
          return Module['buffer'] = Module['wasmMemory'].buffer;
        } else {
          return null;
        }
      } catch(e) {
        return null;
      }
    }
  };

  Module['reallocBuffer'] = function(size) {
    if (finalMethod === 'asmjs') {
      return asmjsReallocBuffer(size);
    } else {
      return wasmReallocBuffer(size);
    }
  };

  // we may try more than one; this is the final one, that worked and we are using
  var finalMethod = '';

  // Provide an "asm.js function" for the application, called to "link" the asm.js module. We instantiate
  // the wasm module at that time, and it receives imports and provides exports and so forth, the app
  // doesn't need to care that it is wasm or polyfilled wasm or asm.js.

  Module['asm'] = function(global, env, providedBuffer) {
    // import table
    if (!env['table']) {
      var TABLE_SIZE = Module['wasmTableSize'];
      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024; // works in binaryen interpreter at least
      var MAX_TABLE_SIZE = Module['wasmMaxTableSize'];
      if (typeof WebAssembly === 'object' && typeof WebAssembly.Table === 'function') {
        if (MAX_TABLE_SIZE !== undefined) {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, 'maximum': MAX_TABLE_SIZE, 'element': 'anyfunc' });
        } else {
          env['table'] = new WebAssembly.Table({ 'initial': TABLE_SIZE, element: 'anyfunc' });
        }
      } else {
        env['table'] = new Array(TABLE_SIZE); // works in binaryen interpreter at least
      }
      Module['wasmTable'] = env['table'];
    }

    if (!env['__memory_base']) {
      env['__memory_base'] = Module['STATIC_BASE']; // tell the memory segments where to place themselves
    }
    if (!env['__table_base']) {
      env['__table_base'] = 0; // table starts at 0 by default, in dynamic linking this will change
    }

    // try the methods. each should return the exports if it succeeded

    var exports;
    exports = doNativeWasm(global, env, providedBuffer);

    assert(exports, 'no binaryen method succeeded.');


    return exports;
  };

  var methodHandler = Module['asm']; // note our method handler, as we may modify Module['asm'] later
}

integrateWasmJS();

// === Body ===

var ASM_CONSTS = [function($0) { Module.pointers[$0] = { writable: new SyncReadableWritableStream(), readable: new SyncWritableReadableStream(), }; },
 function($0, $1, $2, $3) { Module.pointers[$0] = { writable: new SyncReadableWritableStream(), readable: new SyncWritableReadableStream(), remoteIP: $1, remotePort: $2, }; Module.pointers[$3].readable._write(Module.pointers[$0]); },
 function($0) { Module.pointers[$0].readable.error(); },
 function($0, $1, $2) { Module.pointers[$0].readable._write(HEAPU8.slice($1, $1 + $2)); },
 function($0, $1) { const device = Module.pointers[$0]; const buffer = device.writable._read(); if (buffer === device.writable.EOF) return -1; if (!buffer) device.writable._onData = () => { Module._js_wakeup($1, $0); }; if (!buffer) return 0; Module._readBuffer = buffer; return buffer.byteLength; },
 function($0) { writeArrayToMemory(Module._readBuffer, $0); },
 function($0, $1) { const _unread = (reader, value) => { reader._read = new Proxy(reader._read, { apply(target, thisArg, args) { thisArg._read = target; return value; } }); }; const device = Module.pointers[$0]; if ($1 < Module._readBuffer.byteLength) { _unread(device.writable, Module._readBuffer.subarray($1)); } Module._readBuffer = null; },
 function($0) { Module.pointers[$0].readable._close(); },
 function($0, $1) { Module.pointers[$0] = { name: UTF8ToString($1), writable: new SyncReadableWritableStream(), readable: new SyncWritableReadableStream(), }; },
 function($0) { return Module.pointers[$0].readable.desiredSize },
 function($0, $1, $2) { Module.pointers[$0].readable._write(HEAPU8.slice($1, $1 + $2)) },
 function($0) { const device = Module.pointers[$0]; const buffer = device.writable._read(); if (!buffer) return 0; Module._readBuffer = buffer; return buffer.byteLength; },
 function($0) { writeArrayToMemory(Module._readBuffer, $0); Module._readBuffer = null; },
 function() { Module._readBuffer = null; Module.pointers = {}; }];

function _emscripten_asm_const_i(code) {
  return ASM_CONSTS[code]();
}

function _emscripten_asm_const_iii(code, a0, a1) {
  return ASM_CONSTS[code](a0, a1);
}

function _emscripten_asm_const_iiiii(code, a0, a1, a2, a3) {
  return ASM_CONSTS[code](a0, a1, a2, a3);
}

function _emscripten_asm_const_ii(code, a0) {
  return ASM_CONSTS[code](a0);
}

function _emscripten_asm_const_iiii(code, a0, a1, a2) {
  return ASM_CONSTS[code](a0, a1, a2);
}

function _emscripten_asm_const_di(code, a0) {
  return ASM_CONSTS[code](a0);
}




STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 11920;
/* global initializers */  __ATINIT__.push();







var STATIC_BUMP = 11920;
Module["STATIC_BASE"] = STATIC_BASE;
Module["STATIC_BUMP"] = STATIC_BUMP;

/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
}

function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];
  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];
  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];
  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];
  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];
  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];
  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];
}

// {{PRE_LIBRARY}}


  
  var SYSCALLS={buffers:[null,[],[]],printChar:function (stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};
  Module["SYSCALLS"] = SYSCALLS;function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall140"] = ___syscall140;

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
  Module["flush_NO_FILESYSTEM"] = flush_NO_FILESYSTEM;function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in FILESYSTEM=0
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall146"] = ___syscall146;

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall54"] = ___syscall54;

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
  Module["___syscall6"] = ___syscall6;

  function _abort() {
      Module['abort']();
    }
  Module["_abort"] = _abort;

  var _emscripten_asm_const_double=true;
  Module["_emscripten_asm_const_double"] = _emscripten_asm_const_double;

  var _emscripten_asm_const_int=true;
  Module["_emscripten_asm_const_int"] = _emscripten_asm_const_int;

  function _gettimeofday(ptr) {
      var now = Date.now();
      HEAP32[((ptr)>>2)]=(now/1000)|0; // seconds
      HEAP32[(((ptr)+(4))>>2)]=((now % 1000)*1000)|0; // microseconds
      return 0;
    }
  Module["_gettimeofday"] = _gettimeofday;

   

   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    }
  Module["_emscripten_memcpy_big"] = _emscripten_memcpy_big; 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    }
  Module["___setErrNo"] = ___setErrNo; 
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

var ASSERTIONS = false;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}



Module['wasmTableSize'] = 384;

Module['wasmMaxTableSize'] = 384;

function jsCall_ii(index,a1) {
    return functionPointers[index](a1);
}

function jsCall_iii(index,a1,a2) {
    return functionPointers[index](a1,a2);
}

function jsCall_iiii(index,a1,a2,a3) {
    return functionPointers[index](a1,a2,a3);
}

function jsCall_vi(index,a1) {
    functionPointers[index](a1);
}

function jsCall_vii(index,a1,a2) {
    functionPointers[index](a1,a2);
}

function jsCall_viiii(index,a1,a2,a3,a4) {
    functionPointers[index](a1,a2,a3,a4);
}

function jsCall_vji(index,a1,a2) {
    functionPointers[index](a1,a2);
}

Module.asmGlobalArg = {};

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "setTempRet0": setTempRet0, "getTempRet0": getTempRet0, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "jsCall_ii": jsCall_ii, "jsCall_iii": jsCall_iii, "jsCall_iiii": jsCall_iiii, "jsCall_vi": jsCall_vi, "jsCall_vii": jsCall_vii, "jsCall_viiii": jsCall_viiii, "jsCall_vji": jsCall_vji, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "_abort": _abort, "_emscripten_asm_const_di": _emscripten_asm_const_di, "_emscripten_asm_const_i": _emscripten_asm_const_i, "_emscripten_asm_const_ii": _emscripten_asm_const_ii, "_emscripten_asm_const_iii": _emscripten_asm_const_iii, "_emscripten_asm_const_iiii": _emscripten_asm_const_iiii, "_emscripten_asm_const_iiiii": _emscripten_asm_const_iiiii, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_gettimeofday": _gettimeofday, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm =Module["asm"]// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

Module["asm"] = asm;
var _PICO_TIME = Module["_PICO_TIME"] = function() {  return Module["asm"]["_PICO_TIME"].apply(null, arguments) };
var _PICO_TIME_MS = Module["_PICO_TIME_MS"] = function() {  return Module["asm"]["_PICO_TIME_MS"].apply(null, arguments) };
var _PICO_TIME_MS_129 = Module["_PICO_TIME_MS_129"] = function() {  return Module["asm"]["_PICO_TIME_MS_129"].apply(null, arguments) };
var _PICO_TIME_MS_159 = Module["_PICO_TIME_MS_159"] = function() {  return Module["asm"]["_PICO_TIME_MS_159"].apply(null, arguments) };
var _PICO_TIME_MS_256 = Module["_PICO_TIME_MS_256"] = function() {  return Module["asm"]["_PICO_TIME_MS_256"].apply(null, arguments) };
var _PICO_TIME_MS_321 = Module["_PICO_TIME_MS_321"] = function() {  return Module["asm"]["_PICO_TIME_MS_321"].apply(null, arguments) };
var _PICO_TIME_MS_326 = Module["_PICO_TIME_MS_326"] = function() {  return Module["asm"]["_PICO_TIME_MS_326"].apply(null, arguments) };
var _PICO_TIME_MS_348 = Module["_PICO_TIME_MS_348"] = function() {  return Module["asm"]["_PICO_TIME_MS_348"].apply(null, arguments) };
var _PICO_TIME_MS_84 = Module["_PICO_TIME_MS_84"] = function() {  return Module["asm"]["_PICO_TIME_MS_84"].apply(null, arguments) };
var ___DOUBLE_BITS_670 = Module["___DOUBLE_BITS_670"] = function() {  return Module["asm"]["___DOUBLE_BITS_670"].apply(null, arguments) };
var ___errno_location = Module["___errno_location"] = function() {  return Module["asm"]["___errno_location"].apply(null, arguments) };
var ___fwritex = Module["___fwritex"] = function() {  return Module["asm"]["___fwritex"].apply(null, arguments) };
var ___lctrans = Module["___lctrans"] = function() {  return Module["asm"]["___lctrans"].apply(null, arguments) };
var ___lctrans_impl = Module["___lctrans_impl"] = function() {  return Module["asm"]["___lctrans_impl"].apply(null, arguments) };
var ___lockfile = Module["___lockfile"] = function() {  return Module["asm"]["___lockfile"].apply(null, arguments) };
var ___mo_lookup = Module["___mo_lookup"] = function() {  return Module["asm"]["___mo_lookup"].apply(null, arguments) };
var ___overflow = Module["___overflow"] = function() {  return Module["asm"]["___overflow"].apply(null, arguments) };
var ___pthread_self_105 = Module["___pthread_self_105"] = function() {  return Module["asm"]["___pthread_self_105"].apply(null, arguments) };
var ___pthread_self_423 = Module["___pthread_self_423"] = function() {  return Module["asm"]["___pthread_self_423"].apply(null, arguments) };
var ___stdio_close = Module["___stdio_close"] = function() {  return Module["asm"]["___stdio_close"].apply(null, arguments) };
var ___stdio_seek = Module["___stdio_seek"] = function() {  return Module["asm"]["___stdio_seek"].apply(null, arguments) };
var ___stdio_write = Module["___stdio_write"] = function() {  return Module["asm"]["___stdio_write"].apply(null, arguments) };
var ___stdout_write = Module["___stdout_write"] = function() {  return Module["asm"]["___stdout_write"].apply(null, arguments) };
var ___strerror_l = Module["___strerror_l"] = function() {  return Module["asm"]["___strerror_l"].apply(null, arguments) };
var ___syscall_ret = Module["___syscall_ret"] = function() {  return Module["asm"]["___syscall_ret"].apply(null, arguments) };
var ___towrite = Module["___towrite"] = function() {  return Module["asm"]["___towrite"].apply(null, arguments) };
var ___unlockfile = Module["___unlockfile"] = function() {  return Module["asm"]["___unlockfile"].apply(null, arguments) };
var __pico_stack_recv_zerocopy = Module["__pico_stack_recv_zerocopy"] = function() {  return Module["asm"]["__pico_stack_recv_zerocopy"].apply(null, arguments) };
var _add_retransmission_timer = Module["_add_retransmission_timer"] = function() {  return Module["asm"]["_add_retransmission_timer"].apply(null, arguments) };
var _aodv_dev_cmp = Module["_aodv_dev_cmp"] = function() {  return Module["asm"]["_aodv_dev_cmp"].apply(null, arguments) };
var _aodv_elect_route = Module["_aodv_elect_route"] = function() {  return Module["asm"]["_aodv_elect_route"].apply(null, arguments) };
var _aodv_forward = Module["_aodv_forward"] = function() {  return Module["asm"]["_aodv_forward"].apply(null, arguments) };
var _aodv_lifetime = Module["_aodv_lifetime"] = function() {  return Module["asm"]["_aodv_lifetime"].apply(null, arguments) };
var _aodv_make_rreq = Module["_aodv_make_rreq"] = function() {  return Module["asm"]["_aodv_make_rreq"].apply(null, arguments) };
var _aodv_node_compare = Module["_aodv_node_compare"] = function() {  return Module["asm"]["_aodv_node_compare"].apply(null, arguments) };
var _aodv_parse_rack = Module["_aodv_parse_rack"] = function() {  return Module["asm"]["_aodv_parse_rack"].apply(null, arguments) };
var _aodv_parse_rerr = Module["_aodv_parse_rerr"] = function() {  return Module["asm"]["_aodv_parse_rerr"].apply(null, arguments) };
var _aodv_parse_rrep = Module["_aodv_parse_rrep"] = function() {  return Module["asm"]["_aodv_parse_rrep"].apply(null, arguments) };
var _aodv_parse_rreq = Module["_aodv_parse_rreq"] = function() {  return Module["asm"]["_aodv_parse_rreq"].apply(null, arguments) };
var _aodv_peer_eval = Module["_aodv_peer_eval"] = function() {  return Module["asm"]["_aodv_peer_eval"].apply(null, arguments) };
var _aodv_peer_new = Module["_aodv_peer_new"] = function() {  return Module["asm"]["_aodv_peer_new"].apply(null, arguments) };
var _aodv_peer_refresh = Module["_aodv_peer_refresh"] = function() {  return Module["asm"]["_aodv_peer_refresh"].apply(null, arguments) };
var _aodv_recv_valid_rreq = Module["_aodv_recv_valid_rreq"] = function() {  return Module["asm"]["_aodv_recv_valid_rreq"].apply(null, arguments) };
var _aodv_retrans_rreq = Module["_aodv_retrans_rreq"] = function() {  return Module["asm"]["_aodv_retrans_rreq"].apply(null, arguments) };
var _aodv_reverse_path_discover = Module["_aodv_reverse_path_discover"] = function() {  return Module["asm"]["_aodv_reverse_path_discover"].apply(null, arguments) };
var _aodv_send_reply = Module["_aodv_send_reply"] = function() {  return Module["asm"]["_aodv_send_reply"].apply(null, arguments) };
var _aodv_send_req = Module["_aodv_send_req"] = function() {  return Module["asm"]["_aodv_send_req"].apply(null, arguments) };
var _arp_compare = Module["_arp_compare"] = function() {  return Module["asm"]["_arp_compare"].apply(null, arguments) };
var _arp_expire = Module["_arp_expire"] = function() {  return Module["asm"]["_arp_expire"].apply(null, arguments) };
var _calc_score = Module["_calc_score"] = function() {  return Module["asm"]["_calc_score"].apply(null, arguments) };
var _calloc = Module["_calloc"] = function() {  return Module["asm"]["_calloc"].apply(null, arguments) };
var _checkLocalClosing = Module["_checkLocalClosing"] = function() {  return Module["asm"]["_checkLocalClosing"].apply(null, arguments) };
var _checkRemoteClosing = Module["_checkRemoteClosing"] = function() {  return Module["asm"]["_checkRemoteClosing"].apply(null, arguments) };
var _check_dev_serve_interrupt = Module["_check_dev_serve_interrupt"] = function() {  return Module["asm"]["_check_dev_serve_interrupt"].apply(null, arguments) };
var _check_dev_serve_polling = Module["_check_dev_serve_polling"] = function() {  return Module["asm"]["_check_dev_serve_polling"].apply(null, arguments) };
var _check_socket_sanity = Module["_check_socket_sanity"] = function() {  return Module["asm"]["_check_socket_sanity"].apply(null, arguments) };
var _checksum_is_ipv4 = Module["_checksum_is_ipv4"] = function() {  return Module["asm"]["_checksum_is_ipv4"].apply(null, arguments) };
var _checksum_is_ipv6 = Module["_checksum_is_ipv6"] = function() {  return Module["asm"]["_checksum_is_ipv6"].apply(null, arguments) };
var _cookie_compare = Module["_cookie_compare"] = function() {  return Module["asm"]["_cookie_compare"].apply(null, arguments) };
var _create_dev_js = Module["_create_dev_js"] = function() {  return Module["asm"]["_create_dev_js"].apply(null, arguments) };
var _create_node = Module["_create_node"] = function() {  return Module["asm"]["_create_node"].apply(null, arguments) };
var _destination_is_bcast = Module["_destination_is_bcast"] = function() {  return Module["asm"]["_destination_is_bcast"].apply(null, arguments) };
var _destination_is_mcast = Module["_destination_is_mcast"] = function() {  return Module["asm"]["_destination_is_mcast"].apply(null, arguments) };
var _device_init_ipv6_final = Module["_device_init_ipv6_final"] = function() {  return Module["asm"]["_device_init_ipv6_final"].apply(null, arguments) };
var _device_init_mac = Module["_device_init_mac"] = function() {  return Module["asm"]["_device_init_mac"].apply(null, arguments) };
var _device_init_nomac = Module["_device_init_nomac"] = function() {  return Module["asm"]["_device_init_nomac"].apply(null, arguments) };
var _devloop = Module["_devloop"] = function() {  return Module["asm"]["_devloop"].apply(null, arguments) };
var _devloop_in = Module["_devloop_in"] = function() {  return Module["asm"]["_devloop_in"].apply(null, arguments) };
var _devloop_out = Module["_devloop_out"] = function() {  return Module["asm"]["_devloop_out"].apply(null, arguments) };
var _devloop_sendto_dev = Module["_devloop_sendto_dev"] = function() {  return Module["asm"]["_devloop_sendto_dev"].apply(null, arguments) };
var _discard = Module["_discard"] = function() {  return Module["asm"]["_discard"].apply(null, arguments) };
var _dns_ns_cmp = Module["_dns_ns_cmp"] = function() {  return Module["asm"]["_dns_ns_cmp"].apply(null, arguments) };
var _do_enqueue_segment = Module["_do_enqueue_segment"] = function() {  return Module["asm"]["_do_enqueue_segment"].apply(null, arguments) };
var _dummy_560 = Module["_dummy_560"] = function() {  return Module["asm"]["_dummy_560"].apply(null, arguments) };
var _enqueue_segment_len = Module["_enqueue_segment_len"] = function() {  return Module["asm"]["_enqueue_segment_len"].apply(null, arguments) };
var _eth_check_headroom = Module["_eth_check_headroom"] = function() {  return Module["asm"]["_eth_check_headroom"].apply(null, arguments) };
var _filter_compare = Module["_filter_compare"] = function() {  return Module["asm"]["_filter_compare"].apply(null, arguments) };
var _filter_compare_address_port = Module["_filter_compare_address_port"] = function() {  return Module["asm"]["_filter_compare_address_port"].apply(null, arguments) };
var _filter_compare_addresses = Module["_filter_compare_addresses"] = function() {  return Module["asm"]["_filter_compare_addresses"].apply(null, arguments) };
var _filter_compare_ports = Module["_filter_compare_ports"] = function() {  return Module["asm"]["_filter_compare_ports"].apply(null, arguments) };
var _filter_compare_proto = Module["_filter_compare_proto"] = function() {  return Module["asm"]["_filter_compare_proto"].apply(null, arguments) };
var _filter_match_packet = Module["_filter_match_packet"] = function() {  return Module["asm"]["_filter_match_packet"].apply(null, arguments) };
var _filter_match_packet_addr = Module["_filter_match_packet_addr"] = function() {  return Module["asm"]["_filter_match_packet_addr"].apply(null, arguments) };
var _filter_match_packet_addr_in = Module["_filter_match_packet_addr_in"] = function() {  return Module["asm"]["_filter_match_packet_addr_in"].apply(null, arguments) };
var _filter_match_packet_addr_out = Module["_filter_match_packet_addr_out"] = function() {  return Module["asm"]["_filter_match_packet_addr_out"].apply(null, arguments) };
var _filter_match_packet_dev = Module["_filter_match_packet_dev"] = function() {  return Module["asm"]["_filter_match_packet_dev"].apply(null, arguments) };
var _filter_match_packet_dev_and_proto = Module["_filter_match_packet_dev_and_proto"] = function() {  return Module["asm"]["_filter_match_packet_dev_and_proto"].apply(null, arguments) };
var _filter_match_packet_find_rule = Module["_filter_match_packet_find_rule"] = function() {  return Module["asm"]["_filter_match_packet_find_rule"].apply(null, arguments) };
var _filter_match_packet_port = Module["_filter_match_packet_port"] = function() {  return Module["asm"]["_filter_match_packet_port"].apply(null, arguments) };
var _filter_match_packet_port_in = Module["_filter_match_packet_port_in"] = function() {  return Module["asm"]["_filter_match_packet_port_in"].apply(null, arguments) };
var _filter_match_packet_port_out = Module["_filter_match_packet_port_out"] = function() {  return Module["asm"]["_filter_match_packet_port_out"].apply(null, arguments) };
var _filter_match_packet_proto = Module["_filter_match_packet_proto"] = function() {  return Module["asm"]["_filter_match_packet_proto"].apply(null, arguments) };
var _first_segment = Module["_first_segment"] = function() {  return Module["asm"]["_first_segment"].apply(null, arguments) };
var _fix_delete_collisions = Module["_fix_delete_collisions"] = function() {  return Module["asm"]["_fix_delete_collisions"].apply(null, arguments) };
var _fix_insert_collisions = Module["_fix_insert_collisions"] = function() {  return Module["asm"]["_fix_insert_collisions"].apply(null, arguments) };
var _fmt_fp = Module["_fmt_fp"] = function() {  return Module["asm"]["_fmt_fp"].apply(null, arguments) };
var _fmt_o = Module["_fmt_o"] = function() {  return Module["asm"]["_fmt_o"].apply(null, arguments) };
var _fmt_u = Module["_fmt_u"] = function() {  return Module["asm"]["_fmt_u"].apply(null, arguments) };
var _fmt_x = Module["_fmt_x"] = function() {  return Module["asm"]["_fmt_x"].apply(null, arguments) };
var _fputs = Module["_fputs"] = function() {  return Module["asm"]["_fputs"].apply(null, arguments) };
var _free = Module["_free"] = function() {  return Module["asm"]["_free"].apply(null, arguments) };
var _frexp = Module["_frexp"] = function() {  return Module["asm"]["_frexp"].apply(null, arguments) };
var _frexpl = Module["_frexpl"] = function() {  return Module["asm"]["_frexpl"].apply(null, arguments) };
var _fwrite = Module["_fwrite"] = function() {  return Module["asm"]["_fwrite"].apply(null, arguments) };
var _get_node_by_addr = Module["_get_node_by_addr"] = function() {  return Module["asm"]["_get_node_by_addr"].apply(null, arguments) };
var _get_sock_dev = Module["_get_sock_dev"] = function() {  return Module["asm"]["_get_sock_dev"].apply(null, arguments) };
var _getint = Module["_getint"] = function() {  return Module["asm"]["_getint"].apply(null, arguments) };
var _heap_first = Module["_heap_first"] = function() {  return Module["asm"]["_heap_first"].apply(null, arguments) };
var _heap_get_element = Module["_heap_get_element"] = function() {  return Module["asm"]["_heap_get_element"].apply(null, arguments) };
var _heap_increase_size = Module["_heap_increase_size"] = function() {  return Module["asm"]["_heap_increase_size"].apply(null, arguments) };
var _heap_init = Module["_heap_init"] = function() {  return Module["asm"]["_heap_init"].apply(null, arguments) };
var _heap_insert = Module["_heap_insert"] = function() {  return Module["asm"]["_heap_insert"].apply(null, arguments) };
var _heap_peek = Module["_heap_peek"] = function() {  return Module["asm"]["_heap_peek"].apply(null, arguments) };
var _icmp6_cookie_compare = Module["_icmp6_cookie_compare"] = function() {  return Module["asm"]["_icmp6_cookie_compare"].apply(null, arguments) };
var _icmp6_initial_checks = Module["_icmp6_initial_checks"] = function() {  return Module["asm"]["_icmp6_initial_checks"].apply(null, arguments) };
var _if_nodecolor_black_fix_collisions = Module["_if_nodecolor_black_fix_collisions"] = function() {  return Module["asm"]["_if_nodecolor_black_fix_collisions"].apply(null, arguments) };
var _igmp_parameters_cmp = Module["_igmp_parameters_cmp"] = function() {  return Module["asm"]["_igmp_parameters_cmp"].apply(null, arguments) };
var _igmp_sources_cmp = Module["_igmp_sources_cmp"] = function() {  return Module["asm"]["_igmp_sources_cmp"].apply(null, arguments) };
var _igmp_timer_cmp = Module["_igmp_timer_cmp"] = function() {  return Module["asm"]["_igmp_timer_cmp"].apply(null, arguments) };
var _igmpparm_group_compare = Module["_igmpparm_group_compare"] = function() {  return Module["asm"]["_igmpparm_group_compare"].apply(null, arguments) };
var _igmpparm_link_compare = Module["_igmpparm_link_compare"] = function() {  return Module["asm"]["_igmpparm_link_compare"].apply(null, arguments) };
var _igmpt_group_compare = Module["_igmpt_group_compare"] = function() {  return Module["asm"]["_igmpt_group_compare"].apply(null, arguments) };
var _igmpt_link_compare = Module["_igmpt_link_compare"] = function() {  return Module["asm"]["_igmpt_link_compare"].apply(null, arguments) };
var _igmpt_type_compare = Module["_igmpt_type_compare"] = function() {  return Module["asm"]["_igmpt_type_compare"].apply(null, arguments) };
var _initconn_retry = Module["_initconn_retry"] = function() {  return Module["asm"]["_initconn_retry"].apply(null, arguments) };
var _input_segment_compare = Module["_input_segment_compare"] = function() {  return Module["asm"]["_input_segment_compare"].apply(null, arguments) };
var _invalid_flags = Module["_invalid_flags"] = function() {  return Module["asm"]["_invalid_flags"].apply(null, arguments) };
var _ipfilter = Module["_ipfilter"] = function() {  return Module["asm"]["_ipfilter"].apply(null, arguments) };
var _ipfilter_apply_filter = Module["_ipfilter_apply_filter"] = function() {  return Module["asm"]["_ipfilter_apply_filter"].apply(null, arguments) };
var _ipfilter_ptr_cmp = Module["_ipfilter_ptr_cmp"] = function() {  return Module["asm"]["_ipfilter_ptr_cmp"].apply(null, arguments) };
var _ipfilter_uint16_cmp = Module["_ipfilter_uint16_cmp"] = function() {  return Module["asm"]["_ipfilter_uint16_cmp"].apply(null, arguments) };
var _ipfilter_uint32_cmp = Module["_ipfilter_uint32_cmp"] = function() {  return Module["asm"]["_ipfilter_uint32_cmp"].apply(null, arguments) };
var _ipfilter_uint8_cmp = Module["_ipfilter_uint8_cmp"] = function() {  return Module["asm"]["_ipfilter_uint8_cmp"].apply(null, arguments) };
var _ipv4_link_compare = Module["_ipv4_link_compare"] = function() {  return Module["asm"]["_ipv4_link_compare"].apply(null, arguments) };
var _ipv4_mcast_groups_cmp = Module["_ipv4_mcast_groups_cmp"] = function() {  return Module["asm"]["_ipv4_mcast_groups_cmp"].apply(null, arguments) };
var _ipv4_mcast_sources_cmp = Module["_ipv4_mcast_sources_cmp"] = function() {  return Module["asm"]["_ipv4_mcast_sources_cmp"].apply(null, arguments) };
var _ipv4_route_compare = Module["_ipv4_route_compare"] = function() {  return Module["asm"]["_ipv4_route_compare"].apply(null, arguments) };
var _ipv6_compare_metric = Module["_ipv6_compare_metric"] = function() {  return Module["asm"]["_ipv6_compare_metric"].apply(null, arguments) };
var _ipv6_duplicate_detected = Module["_ipv6_duplicate_detected"] = function() {  return Module["asm"]["_ipv6_duplicate_detected"].apply(null, arguments) };
var _ipv6_frame_push_final = Module["_ipv6_frame_push_final"] = function() {  return Module["asm"]["_ipv6_frame_push_final"].apply(null, arguments) };
var _ipv6_link_compare = Module["_ipv6_link_compare"] = function() {  return Module["asm"]["_ipv6_link_compare"].apply(null, arguments) };
var _ipv6_mcast_groups_cmp = Module["_ipv6_mcast_groups_cmp"] = function() {  return Module["asm"]["_ipv6_mcast_groups_cmp"].apply(null, arguments) };
var _ipv6_mcast_sources_cmp = Module["_ipv6_mcast_sources_cmp"] = function() {  return Module["asm"]["_ipv6_mcast_sources_cmp"].apply(null, arguments) };
var _ipv6_push_hdr_adjust = Module["_ipv6_push_hdr_adjust"] = function() {  return Module["asm"]["_ipv6_push_hdr_adjust"].apply(null, arguments) };
var _ipv6_pushed_frame_checks = Module["_ipv6_pushed_frame_checks"] = function() {  return Module["asm"]["_ipv6_pushed_frame_checks"].apply(null, arguments) };
var _ipv6_pushed_frame_valid = Module["_ipv6_pushed_frame_valid"] = function() {  return Module["asm"]["_ipv6_pushed_frame_valid"].apply(null, arguments) };
var _ipv6_route_add_link = Module["_ipv6_route_add_link"] = function() {  return Module["asm"]["_ipv6_route_add_link"].apply(null, arguments) };
var _ipv6_route_compare = Module["_ipv6_route_compare"] = function() {  return Module["asm"]["_ipv6_route_compare"].apply(null, arguments) };
var _isdigit = Module["_isdigit"] = function() {  return Module["asm"]["_isdigit"].apply(null, arguments) };
var _js_add_ipv4 = Module["_js_add_ipv4"] = function() {  return Module["asm"]["_js_add_ipv4"].apply(null, arguments) };
var _js_pico_err = Module["_js_pico_err"] = function() {  return Module["asm"]["_js_pico_err"].apply(null, arguments) };
var _js_socket_bind = Module["_js_socket_bind"] = function() {  return Module["asm"]["_js_socket_bind"].apply(null, arguments) };
var _js_socket_connect = Module["_js_socket_connect"] = function() {  return Module["asm"]["_js_socket_connect"].apply(null, arguments) };
var _js_socket_open = Module["_js_socket_open"] = function() {  return Module["asm"]["_js_socket_open"].apply(null, arguments) };
var _js_wakeup = Module["_js_wakeup"] = function() {  return Module["asm"]["_js_wakeup"].apply(null, arguments) };
var _listen_find = Module["_listen_find"] = function() {  return Module["asm"]["_listen_find"].apply(null, arguments) };
var _llvm_bswap_i16 = Module["_llvm_bswap_i16"] = function() {  return Module["asm"]["_llvm_bswap_i16"].apply(null, arguments) };
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function() {  return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments) };
var _long_be = Module["_long_be"] = function() {  return Module["asm"]["_long_be"].apply(null, arguments) };
var _long_be_13 = Module["_long_be_13"] = function() {  return Module["asm"]["_long_be_13"].apply(null, arguments) };
var _long_be_160 = Module["_long_be_160"] = function() {  return Module["asm"]["_long_be_160"].apply(null, arguments) };
var _long_be_203 = Module["_long_be_203"] = function() {  return Module["asm"]["_long_be_203"].apply(null, arguments) };
var _long_be_234 = Module["_long_be_234"] = function() {  return Module["asm"]["_long_be_234"].apply(null, arguments) };
var _long_be_25 = Module["_long_be_25"] = function() {  return Module["asm"]["_long_be_25"].apply(null, arguments) };
var _long_be_258 = Module["_long_be_258"] = function() {  return Module["asm"]["_long_be_258"].apply(null, arguments) };
var _long_be_331 = Module["_long_be_331"] = function() {  return Module["asm"]["_long_be_331"].apply(null, arguments) };
var _long_be_344 = Module["_long_be_344"] = function() {  return Module["asm"]["_long_be_344"].apply(null, arguments) };
var _long_from = Module["_long_from"] = function() {  return Module["asm"]["_long_from"].apply(null, arguments) };
var _long_from_18 = Module["_long_from_18"] = function() {  return Module["asm"]["_long_from_18"].apply(null, arguments) };
var _main = Module["_main"] = function() {  return Module["asm"]["_main"].apply(null, arguments) };
var _malloc = Module["_malloc"] = function() {  return Module["asm"]["_malloc"].apply(null, arguments) };
var _mcast_aggr_validate = Module["_mcast_aggr_validate"] = function() {  return Module["asm"]["_mcast_aggr_validate"].apply(null, arguments) };
var _mcast_filter_cmp = Module["_mcast_filter_cmp"] = function() {  return Module["asm"]["_mcast_filter_cmp"].apply(null, arguments) };
var _mcast_filter_cmp_ipv6 = Module["_mcast_filter_cmp_ipv6"] = function() {  return Module["asm"]["_mcast_filter_cmp_ipv6"].apply(null, arguments) };
var _mcast_get_listen_tree = Module["_mcast_get_listen_tree"] = function() {  return Module["asm"]["_mcast_get_listen_tree"].apply(null, arguments) };
var _mcast_get_src_tree = Module["_mcast_get_src_tree"] = function() {  return Module["asm"]["_mcast_get_src_tree"].apply(null, arguments) };
var _mcast_group_update = Module["_mcast_group_update"] = function() {  return Module["asm"]["_mcast_group_update"].apply(null, arguments) };
var _mcast_group_update_ipv6 = Module["_mcast_group_update_ipv6"] = function() {  return Module["asm"]["_mcast_group_update_ipv6"].apply(null, arguments) };
var _mcast_parameters_cmp = Module["_mcast_parameters_cmp"] = function() {  return Module["asm"]["_mcast_parameters_cmp"].apply(null, arguments) };
var _mcast_set_listen_tree_p_null = Module["_mcast_set_listen_tree_p_null"] = function() {  return Module["asm"]["_mcast_set_listen_tree_p_null"].apply(null, arguments) };
var _mcast_socket_cmp = Module["_mcast_socket_cmp"] = function() {  return Module["asm"]["_mcast_socket_cmp"].apply(null, arguments) };
var _mcast_sources_cmp = Module["_mcast_sources_cmp"] = function() {  return Module["asm"]["_mcast_sources_cmp"].apply(null, arguments) };
var _mcast_sources_cmp_ipv6 = Module["_mcast_sources_cmp_ipv6"] = function() {  return Module["asm"]["_mcast_sources_cmp_ipv6"].apply(null, arguments) };
var _memchr = Module["_memchr"] = function() {  return Module["asm"]["_memchr"].apply(null, arguments) };
var _memcmp = Module["_memcmp"] = function() {  return Module["asm"]["_memcmp"].apply(null, arguments) };
var _memcpy = Module["_memcpy"] = function() {  return Module["asm"]["_memcpy"].apply(null, arguments) };
var _memset = Module["_memset"] = function() {  return Module["asm"]["_memset"].apply(null, arguments) };
var _mld_discard = Module["_mld_discard"] = function() {  return Module["asm"]["_mld_discard"].apply(null, arguments) };
var _mld_mrsrrt = Module["_mld_mrsrrt"] = function() {  return Module["asm"]["_mld_mrsrrt"].apply(null, arguments) };
var _mld_rtimrtct = Module["_mld_rtimrtct"] = function() {  return Module["asm"]["_mld_rtimrtct"].apply(null, arguments) };
var _mld_sources_cmp = Module["_mld_sources_cmp"] = function() {  return Module["asm"]["_mld_sources_cmp"].apply(null, arguments) };
var _mld_srsf = Module["_mld_srsf"] = function() {  return Module["asm"]["_mld_srsf"].apply(null, arguments) };
var _mld_srsfst = Module["_mld_srsfst"] = function() {  return Module["asm"]["_mld_srsfst"].apply(null, arguments) };
var _mld_srst = Module["_mld_srst"] = function() {  return Module["asm"]["_mld_srst"].apply(null, arguments) };
var _mld_stcl = Module["_mld_stcl"] = function() {  return Module["asm"]["_mld_stcl"].apply(null, arguments) };
var _mld_stsdifs = Module["_mld_stsdifs"] = function() {  return Module["asm"]["_mld_stsdifs"].apply(null, arguments) };
var _mld_timer_cmp = Module["_mld_timer_cmp"] = function() {  return Module["asm"]["_mld_timer_cmp"].apply(null, arguments) };
var _mldparm_group_compare = Module["_mldparm_group_compare"] = function() {  return Module["asm"]["_mldparm_group_compare"].apply(null, arguments) };
var _mldparm_link_compare = Module["_mldparm_link_compare"] = function() {  return Module["asm"]["_mldparm_link_compare"].apply(null, arguments) };
var _mldt_group_compare = Module["_mldt_group_compare"] = function() {  return Module["asm"]["_mldt_group_compare"].apply(null, arguments) };
var _mldt_link_compare = Module["_mldt_link_compare"] = function() {  return Module["asm"]["_mldt_link_compare"].apply(null, arguments) };
var _mldt_type_compare = Module["_mldt_type_compare"] = function() {  return Module["asm"]["_mldt_type_compare"].apply(null, arguments) };
var _mrsrrt = Module["_mrsrrt"] = function() {  return Module["asm"]["_mrsrrt"].apply(null, arguments) };
var _nat_cmp_address = Module["_nat_cmp_address"] = function() {  return Module["asm"]["_nat_cmp_address"].apply(null, arguments) };
var _nat_cmp_inbound = Module["_nat_cmp_inbound"] = function() {  return Module["asm"]["_nat_cmp_inbound"].apply(null, arguments) };
var _nat_cmp_natport = Module["_nat_cmp_natport"] = function() {  return Module["asm"]["_nat_cmp_natport"].apply(null, arguments) };
var _nat_cmp_outbound = Module["_nat_cmp_outbound"] = function() {  return Module["asm"]["_nat_cmp_outbound"].apply(null, arguments) };
var _nat_cmp_proto = Module["_nat_cmp_proto"] = function() {  return Module["asm"]["_nat_cmp_proto"].apply(null, arguments) };
var _nat_cmp_srcport = Module["_nat_cmp_srcport"] = function() {  return Module["asm"]["_nat_cmp_srcport"].apply(null, arguments) };
var _nd_options = Module["_nd_options"] = function() {  return Module["asm"]["_nd_options"].apply(null, arguments) };
var _neigh_adv_checks = Module["_neigh_adv_checks"] = function() {  return Module["asm"]["_neigh_adv_checks"].apply(null, arguments) };
var _neigh_adv_mcast_validity_check = Module["_neigh_adv_mcast_validity_check"] = function() {  return Module["asm"]["_neigh_adv_mcast_validity_check"].apply(null, arguments) };
var _neigh_adv_option_len_validity_check = Module["_neigh_adv_option_len_validity_check"] = function() {  return Module["asm"]["_neigh_adv_option_len_validity_check"].apply(null, arguments) };
var _neigh_adv_process = Module["_neigh_adv_process"] = function() {  return Module["asm"]["_neigh_adv_process"].apply(null, arguments) };
var _neigh_adv_process_incomplete = Module["_neigh_adv_process_incomplete"] = function() {  return Module["asm"]["_neigh_adv_process_incomplete"].apply(null, arguments) };
var _neigh_adv_reconfirm = Module["_neigh_adv_reconfirm"] = function() {  return Module["asm"]["_neigh_adv_reconfirm"].apply(null, arguments) };
var _neigh_adv_reconfirm_no_tlla = Module["_neigh_adv_reconfirm_no_tlla"] = function() {  return Module["asm"]["_neigh_adv_reconfirm_no_tlla"].apply(null, arguments) };
var _neigh_adv_reconfirm_router_option = Module["_neigh_adv_reconfirm_router_option"] = function() {  return Module["asm"]["_neigh_adv_reconfirm_router_option"].apply(null, arguments) };
var _neigh_adv_validity_checks = Module["_neigh_adv_validity_checks"] = function() {  return Module["asm"]["_neigh_adv_validity_checks"].apply(null, arguments) };
var _neigh_options = Module["_neigh_options"] = function() {  return Module["asm"]["_neigh_options"].apply(null, arguments) };
var _neigh_sol_detect_dad = Module["_neigh_sol_detect_dad"] = function() {  return Module["asm"]["_neigh_sol_detect_dad"].apply(null, arguments) };
var _neigh_sol_mcast_validity_check = Module["_neigh_sol_mcast_validity_check"] = function() {  return Module["asm"]["_neigh_sol_mcast_validity_check"].apply(null, arguments) };
var _neigh_sol_process = Module["_neigh_sol_process"] = function() {  return Module["asm"]["_neigh_sol_process"].apply(null, arguments) };
var _neigh_sol_unicast_validity_check = Module["_neigh_sol_unicast_validity_check"] = function() {  return Module["asm"]["_neigh_sol_unicast_validity_check"].apply(null, arguments) };
var _neigh_sol_validate_unspec = Module["_neigh_sol_validate_unspec"] = function() {  return Module["asm"]["_neigh_sol_validate_unspec"].apply(null, arguments) };
var _neigh_sol_validity_checks = Module["_neigh_sol_validity_checks"] = function() {  return Module["asm"]["_neigh_sol_validity_checks"].apply(null, arguments) };
var _next_ping = Module["_next_ping"] = function() {  return Module["asm"]["_next_ping"].apply(null, arguments) };
var _next_segment = Module["_next_segment"] = function() {  return Module["asm"]["_next_segment"].apply(null, arguments) };
var _out_28 = Module["_out_28"] = function() {  return Module["asm"]["_out_28"].apply(null, arguments) };
var _pad_669 = Module["_pad_669"] = function() {  return Module["asm"]["_pad_669"].apply(null, arguments) };
var _peek_segment = Module["_peek_segment"] = function() {  return Module["asm"]["_peek_segment"].apply(null, arguments) };
var _pico_aodv_collector = Module["_pico_aodv_collector"] = function() {  return Module["asm"]["_pico_aodv_collector"].apply(null, arguments) };
var _pico_aodv_expired = Module["_pico_aodv_expired"] = function() {  return Module["asm"]["_pico_aodv_expired"].apply(null, arguments) };
var _pico_aodv_init = Module["_pico_aodv_init"] = function() {  return Module["asm"]["_pico_aodv_init"].apply(null, arguments) };
var _pico_aodv_lookup = Module["_pico_aodv_lookup"] = function() {  return Module["asm"]["_pico_aodv_lookup"].apply(null, arguments) };
var _pico_aodv_parse = Module["_pico_aodv_parse"] = function() {  return Module["asm"]["_pico_aodv_parse"].apply(null, arguments) };
var _pico_aodv_refresh = Module["_pico_aodv_refresh"] = function() {  return Module["asm"]["_pico_aodv_refresh"].apply(null, arguments) };
var _pico_aodv_set_dev = Module["_pico_aodv_set_dev"] = function() {  return Module["asm"]["_pico_aodv_set_dev"].apply(null, arguments) };
var _pico_aodv_socket_callback = Module["_pico_aodv_socket_callback"] = function() {  return Module["asm"]["_pico_aodv_socket_callback"].apply(null, arguments) };
var _pico_arp_add_entry = Module["_pico_arp_add_entry"] = function() {  return Module["asm"]["_pico_arp_add_entry"].apply(null, arguments) };
var _pico_arp_check_conflict = Module["_pico_arp_check_conflict"] = function() {  return Module["asm"]["_pico_arp_check_conflict"].apply(null, arguments) };
var _pico_arp_check_flooding = Module["_pico_arp_check_flooding"] = function() {  return Module["asm"]["_pico_arp_check_flooding"].apply(null, arguments) };
var _pico_arp_check_incoming_hdr = Module["_pico_arp_check_incoming_hdr"] = function() {  return Module["asm"]["_pico_arp_check_incoming_hdr"].apply(null, arguments) };
var _pico_arp_check_incoming_hdr_type = Module["_pico_arp_check_incoming_hdr_type"] = function() {  return Module["asm"]["_pico_arp_check_incoming_hdr_type"].apply(null, arguments) };
var _pico_arp_create_entry = Module["_pico_arp_create_entry"] = function() {  return Module["asm"]["_pico_arp_create_entry"].apply(null, arguments) };
var _pico_arp_get = Module["_pico_arp_get"] = function() {  return Module["asm"]["_pico_arp_get"].apply(null, arguments) };
var _pico_arp_init = Module["_pico_arp_init"] = function() {  return Module["asm"]["_pico_arp_init"].apply(null, arguments) };
var _pico_arp_lookup = Module["_pico_arp_lookup"] = function() {  return Module["asm"]["_pico_arp_lookup"].apply(null, arguments) };
var _pico_arp_lookup_entry = Module["_pico_arp_lookup_entry"] = function() {  return Module["asm"]["_pico_arp_lookup_entry"].apply(null, arguments) };
var _pico_arp_postpone = Module["_pico_arp_postpone"] = function() {  return Module["asm"]["_pico_arp_postpone"].apply(null, arguments) };
var _pico_arp_process_in = Module["_pico_arp_process_in"] = function() {  return Module["asm"]["_pico_arp_process_in"].apply(null, arguments) };
var _pico_arp_queued_trigger = Module["_pico_arp_queued_trigger"] = function() {  return Module["asm"]["_pico_arp_queued_trigger"].apply(null, arguments) };
var _pico_arp_receive = Module["_pico_arp_receive"] = function() {  return Module["asm"]["_pico_arp_receive"].apply(null, arguments) };
var _pico_arp_reply_on_request = Module["_pico_arp_reply_on_request"] = function() {  return Module["asm"]["_pico_arp_reply_on_request"].apply(null, arguments) };
var _pico_arp_request = Module["_pico_arp_request"] = function() {  return Module["asm"]["_pico_arp_request"].apply(null, arguments) };
var _pico_arp_request_xmit = Module["_pico_arp_request_xmit"] = function() {  return Module["asm"]["_pico_arp_request_xmit"].apply(null, arguments) };
var _pico_arp_retry = Module["_pico_arp_retry"] = function() {  return Module["asm"]["_pico_arp_retry"].apply(null, arguments) };
var _pico_arp_unreachable = Module["_pico_arp_unreachable"] = function() {  return Module["asm"]["_pico_arp_unreachable"].apply(null, arguments) };
var _pico_check_socket = Module["_pico_check_socket"] = function() {  return Module["asm"]["_pico_check_socket"].apply(null, arguments) };
var _pico_check_timers = Module["_pico_check_timers"] = function() {  return Module["asm"]["_pico_check_timers"].apply(null, arguments) };
var _pico_checksum = Module["_pico_checksum"] = function() {  return Module["asm"]["_pico_checksum"].apply(null, arguments) };
var _pico_checksum_adder = Module["_pico_checksum_adder"] = function() {  return Module["asm"]["_pico_checksum_adder"].apply(null, arguments) };
var _pico_checksum_finalize = Module["_pico_checksum_finalize"] = function() {  return Module["asm"]["_pico_checksum_finalize"].apply(null, arguments) };
var _pico_datalink_receive = Module["_pico_datalink_receive"] = function() {  return Module["asm"]["_pico_datalink_receive"].apply(null, arguments) };
var _pico_datalink_send = Module["_pico_datalink_send"] = function() {  return Module["asm"]["_pico_datalink_send"].apply(null, arguments) };
var _pico_dequeue = Module["_pico_dequeue"] = function() {  return Module["asm"]["_pico_dequeue"].apply(null, arguments) };
var _pico_dequeue_29 = Module["_pico_dequeue_29"] = function() {  return Module["asm"]["_pico_dequeue_29"].apply(null, arguments) };
var _pico_dequeue_384 = Module["_pico_dequeue_384"] = function() {  return Module["asm"]["_pico_dequeue_384"].apply(null, arguments) };
var _pico_dequeue_49 = Module["_pico_dequeue_49"] = function() {  return Module["asm"]["_pico_dequeue_49"].apply(null, arguments) };
var _pico_dev_cmp = Module["_pico_dev_cmp"] = function() {  return Module["asm"]["_pico_dev_cmp"].apply(null, arguments) };
var _pico_dev_roundrobin_end = Module["_pico_dev_roundrobin_end"] = function() {  return Module["asm"]["_pico_dev_roundrobin_end"].apply(null, arguments) };
var _pico_dev_roundrobin_start = Module["_pico_dev_roundrobin_start"] = function() {  return Module["asm"]["_pico_dev_roundrobin_start"].apply(null, arguments) };
var _pico_device_broadcast = Module["_pico_device_broadcast"] = function() {  return Module["asm"]["_pico_device_broadcast"].apply(null, arguments) };
var _pico_device_init = Module["_pico_device_init"] = function() {  return Module["asm"]["_pico_device_init"].apply(null, arguments) };
var _pico_device_ipv6_random_ll = Module["_pico_device_ipv6_random_ll"] = function() {  return Module["asm"]["_pico_device_ipv6_random_ll"].apply(null, arguments) };
var _pico_device_link_state = Module["_pico_device_link_state"] = function() {  return Module["asm"]["_pico_device_link_state"].apply(null, arguments) };
var _pico_devices_loop = Module["_pico_devices_loop"] = function() {  return Module["asm"]["_pico_devices_loop"].apply(null, arguments) };
var _pico_discard_segment = Module["_pico_discard_segment"] = function() {  return Module["asm"]["_pico_discard_segment"].apply(null, arguments) };
var _pico_dns_client_add_ns = Module["_pico_dns_client_add_ns"] = function() {  return Module["asm"]["_pico_dns_client_add_ns"].apply(null, arguments) };
var _pico_dns_client_del_ns = Module["_pico_dns_client_del_ns"] = function() {  return Module["asm"]["_pico_dns_client_del_ns"].apply(null, arguments) };
var _pico_dns_client_init = Module["_pico_dns_client_init"] = function() {  return Module["asm"]["_pico_dns_client_init"].apply(null, arguments) };
var _pico_dns_client_nameserver = Module["_pico_dns_client_nameserver"] = function() {  return Module["asm"]["_pico_dns_client_nameserver"].apply(null, arguments) };
var _pico_dualbuffer_checksum = Module["_pico_dualbuffer_checksum"] = function() {  return Module["asm"]["_pico_dualbuffer_checksum"].apply(null, arguments) };
var _pico_endpoint_free = Module["_pico_endpoint_free"] = function() {  return Module["asm"]["_pico_endpoint_free"].apply(null, arguments) };
var _pico_enqueue = Module["_pico_enqueue"] = function() {  return Module["asm"]["_pico_enqueue"].apply(null, arguments) };
var _pico_enqueue_108 = Module["_pico_enqueue_108"] = function() {  return Module["asm"]["_pico_enqueue_108"].apply(null, arguments) };
var _pico_enqueue_17 = Module["_pico_enqueue_17"] = function() {  return Module["asm"]["_pico_enqueue_17"].apply(null, arguments) };
var _pico_enqueue_200 = Module["_pico_enqueue_200"] = function() {  return Module["asm"]["_pico_enqueue_200"].apply(null, arguments) };
var _pico_enqueue_22 = Module["_pico_enqueue_22"] = function() {  return Module["asm"]["_pico_enqueue_22"].apply(null, arguments) };
var _pico_enqueue_276 = Module["_pico_enqueue_276"] = function() {  return Module["asm"]["_pico_enqueue_276"].apply(null, arguments) };
var _pico_enqueue_377 = Module["_pico_enqueue_377"] = function() {  return Module["asm"]["_pico_enqueue_377"].apply(null, arguments) };
var _pico_enqueue_and_wakeup_if_needed = Module["_pico_enqueue_and_wakeup_if_needed"] = function() {  return Module["asm"]["_pico_enqueue_and_wakeup_if_needed"].apply(null, arguments) };
var _pico_enqueue_segment = Module["_pico_enqueue_segment"] = function() {  return Module["asm"]["_pico_enqueue_segment"].apply(null, arguments) };
var _pico_eth_check_bcast = Module["_pico_eth_check_bcast"] = function() {  return Module["asm"]["_pico_eth_check_bcast"].apply(null, arguments) };
var _pico_eth_receive = Module["_pico_eth_receive"] = function() {  return Module["asm"]["_pico_eth_receive"].apply(null, arguments) };
var _pico_ethernet_alloc = Module["_pico_ethernet_alloc"] = function() {  return Module["asm"]["_pico_ethernet_alloc"].apply(null, arguments) };
var _pico_ethernet_ipv6_dst = Module["_pico_ethernet_ipv6_dst"] = function() {  return Module["asm"]["_pico_ethernet_ipv6_dst"].apply(null, arguments) };
var _pico_ethernet_mcast6_translate = Module["_pico_ethernet_mcast6_translate"] = function() {  return Module["asm"]["_pico_ethernet_mcast6_translate"].apply(null, arguments) };
var _pico_ethernet_mcast_translate = Module["_pico_ethernet_mcast_translate"] = function() {  return Module["asm"]["_pico_ethernet_mcast_translate"].apply(null, arguments) };
var _pico_ethernet_process_in = Module["_pico_ethernet_process_in"] = function() {  return Module["asm"]["_pico_ethernet_process_in"].apply(null, arguments) };
var _pico_ethernet_process_out = Module["_pico_ethernet_process_out"] = function() {  return Module["asm"]["_pico_ethernet_process_out"].apply(null, arguments) };
var _pico_ethernet_receive = Module["_pico_ethernet_receive"] = function() {  return Module["asm"]["_pico_ethernet_receive"].apply(null, arguments) };
var _pico_ethernet_send = Module["_pico_ethernet_send"] = function() {  return Module["asm"]["_pico_ethernet_send"].apply(null, arguments) };
var _pico_ethsend_bcast = Module["_pico_ethsend_bcast"] = function() {  return Module["asm"]["_pico_ethsend_bcast"].apply(null, arguments) };
var _pico_ethsend_dispatch = Module["_pico_ethsend_dispatch"] = function() {  return Module["asm"]["_pico_ethsend_dispatch"].apply(null, arguments) };
var _pico_ethsend_local = Module["_pico_ethsend_local"] = function() {  return Module["asm"]["_pico_ethsend_local"].apply(null, arguments) };
var _pico_frag_expire = Module["_pico_frag_expire"] = function() {  return Module["asm"]["_pico_frag_expire"].apply(null, arguments) };
var _pico_fragments_check_complete = Module["_pico_fragments_check_complete"] = function() {  return Module["asm"]["_pico_fragments_check_complete"].apply(null, arguments) };
var _pico_fragments_complete = Module["_pico_fragments_complete"] = function() {  return Module["asm"]["_pico_fragments_complete"].apply(null, arguments) };
var _pico_fragments_empty_tree = Module["_pico_fragments_empty_tree"] = function() {  return Module["asm"]["_pico_fragments_empty_tree"].apply(null, arguments) };
var _pico_fragments_get_header_length = Module["_pico_fragments_get_header_length"] = function() {  return Module["asm"]["_pico_fragments_get_header_length"].apply(null, arguments) };
var _pico_fragments_get_more_flag = Module["_pico_fragments_get_more_flag"] = function() {  return Module["asm"]["_pico_fragments_get_more_flag"].apply(null, arguments) };
var _pico_fragments_get_offset = Module["_pico_fragments_get_offset"] = function() {  return Module["asm"]["_pico_fragments_get_offset"].apply(null, arguments) };
var _pico_fragments_reassemble = Module["_pico_fragments_reassemble"] = function() {  return Module["asm"]["_pico_fragments_reassemble"].apply(null, arguments) };
var _pico_fragments_send_notify = Module["_pico_fragments_send_notify"] = function() {  return Module["asm"]["_pico_fragments_send_notify"].apply(null, arguments) };
var _pico_frame_alloc = Module["_pico_frame_alloc"] = function() {  return Module["asm"]["_pico_frame_alloc"].apply(null, arguments) };
var _pico_frame_alloc_skeleton = Module["_pico_frame_alloc_skeleton"] = function() {  return Module["asm"]["_pico_frame_alloc_skeleton"].apply(null, arguments) };
var _pico_frame_copy = Module["_pico_frame_copy"] = function() {  return Module["asm"]["_pico_frame_copy"].apply(null, arguments) };
var _pico_frame_discard = Module["_pico_frame_discard"] = function() {  return Module["asm"]["_pico_frame_discard"].apply(null, arguments) };
var _pico_frame_do_alloc = Module["_pico_frame_do_alloc"] = function() {  return Module["asm"]["_pico_frame_do_alloc"].apply(null, arguments) };
var _pico_frame_dst_is_unicast = Module["_pico_frame_dst_is_unicast"] = function() {  return Module["asm"]["_pico_frame_dst_is_unicast"].apply(null, arguments) };
var _pico_frame_grow_head = Module["_pico_frame_grow_head"] = function() {  return Module["asm"]["_pico_frame_grow_head"].apply(null, arguments) };
var _pico_frame_new_buffer = Module["_pico_frame_new_buffer"] = function() {  return Module["asm"]["_pico_frame_new_buffer"].apply(null, arguments) };
var _pico_frame_skeleton_set_buffer = Module["_pico_frame_skeleton_set_buffer"] = function() {  return Module["asm"]["_pico_frame_skeleton_set_buffer"].apply(null, arguments) };
var _pico_frame_update_pointers = Module["_pico_frame_update_pointers"] = function() {  return Module["asm"]["_pico_frame_update_pointers"].apply(null, arguments) };
var _pico_generic_port_in_use = Module["_pico_generic_port_in_use"] = function() {  return Module["asm"]["_pico_generic_port_in_use"].apply(null, arguments) };
var _pico_get_device = Module["_pico_get_device"] = function() {  return Module["asm"]["_pico_get_device"].apply(null, arguments) };
var _pico_get_sockport = Module["_pico_get_sockport"] = function() {  return Module["asm"]["_pico_get_sockport"].apply(null, arguments) };
var _pico_hash = Module["_pico_hash"] = function() {  return Module["asm"]["_pico_hash"].apply(null, arguments) };
var _pico_hash_393 = Module["_pico_hash_393"] = function() {  return Module["asm"]["_pico_hash_393"].apply(null, arguments) };
var _pico_hold_segment_make = Module["_pico_hold_segment_make"] = function() {  return Module["asm"]["_pico_hold_segment_make"].apply(null, arguments) };
var _pico_icmp4_checksum = Module["_pico_icmp4_checksum"] = function() {  return Module["asm"]["_pico_icmp4_checksum"].apply(null, arguments) };
var _pico_icmp4_dest_unreachable = Module["_pico_icmp4_dest_unreachable"] = function() {  return Module["asm"]["_pico_icmp4_dest_unreachable"].apply(null, arguments) };
var _pico_icmp4_frag_expired = Module["_pico_icmp4_frag_expired"] = function() {  return Module["asm"]["_pico_icmp4_frag_expired"].apply(null, arguments) };
var _pico_icmp4_mtu_exceeded = Module["_pico_icmp4_mtu_exceeded"] = function() {  return Module["asm"]["_pico_icmp4_mtu_exceeded"].apply(null, arguments) };
var _pico_icmp4_notify = Module["_pico_icmp4_notify"] = function() {  return Module["asm"]["_pico_icmp4_notify"].apply(null, arguments) };
var _pico_icmp4_param_problem = Module["_pico_icmp4_param_problem"] = function() {  return Module["asm"]["_pico_icmp4_param_problem"].apply(null, arguments) };
var _pico_icmp4_ping = Module["_pico_icmp4_ping"] = function() {  return Module["asm"]["_pico_icmp4_ping"].apply(null, arguments) };
var _pico_icmp4_port_unreachable = Module["_pico_icmp4_port_unreachable"] = function() {  return Module["asm"]["_pico_icmp4_port_unreachable"].apply(null, arguments) };
var _pico_icmp4_process_in = Module["_pico_icmp4_process_in"] = function() {  return Module["asm"]["_pico_icmp4_process_in"].apply(null, arguments) };
var _pico_icmp4_process_out = Module["_pico_icmp4_process_out"] = function() {  return Module["asm"]["_pico_icmp4_process_out"].apply(null, arguments) };
var _pico_icmp4_proto_unreachable = Module["_pico_icmp4_proto_unreachable"] = function() {  return Module["asm"]["_pico_icmp4_proto_unreachable"].apply(null, arguments) };
var _pico_icmp4_send_echo = Module["_pico_icmp4_send_echo"] = function() {  return Module["asm"]["_pico_icmp4_send_echo"].apply(null, arguments) };
var _pico_icmp4_ttl_expired = Module["_pico_icmp4_ttl_expired"] = function() {  return Module["asm"]["_pico_icmp4_ttl_expired"].apply(null, arguments) };
var _pico_icmp6_address_to_prefix = Module["_pico_icmp6_address_to_prefix"] = function() {  return Module["asm"]["_pico_icmp6_address_to_prefix"].apply(null, arguments) };
var _pico_icmp6_checksum = Module["_pico_icmp6_checksum"] = function() {  return Module["asm"]["_pico_icmp6_checksum"].apply(null, arguments) };
var _pico_icmp6_dest_unreachable = Module["_pico_icmp6_dest_unreachable"] = function() {  return Module["asm"]["_pico_icmp6_dest_unreachable"].apply(null, arguments) };
var _pico_icmp6_frag_expired = Module["_pico_icmp6_frag_expired"] = function() {  return Module["asm"]["_pico_icmp6_frag_expired"].apply(null, arguments) };
var _pico_icmp6_neigh_sol_prep = Module["_pico_icmp6_neigh_sol_prep"] = function() {  return Module["asm"]["_pico_icmp6_neigh_sol_prep"].apply(null, arguments) };
var _pico_icmp6_neighbor_advertisement = Module["_pico_icmp6_neighbor_advertisement"] = function() {  return Module["asm"]["_pico_icmp6_neighbor_advertisement"].apply(null, arguments) };
var _pico_icmp6_neighbor_solicitation = Module["_pico_icmp6_neighbor_solicitation"] = function() {  return Module["asm"]["_pico_icmp6_neighbor_solicitation"].apply(null, arguments) };
var _pico_icmp6_notify = Module["_pico_icmp6_notify"] = function() {  return Module["asm"]["_pico_icmp6_notify"].apply(null, arguments) };
var _pico_icmp6_parameter_problem = Module["_pico_icmp6_parameter_problem"] = function() {  return Module["asm"]["_pico_icmp6_parameter_problem"].apply(null, arguments) };
var _pico_icmp6_ping_recv_reply = Module["_pico_icmp6_ping_recv_reply"] = function() {  return Module["asm"]["_pico_icmp6_ping_recv_reply"].apply(null, arguments) };
var _pico_icmp6_pkt_too_big = Module["_pico_icmp6_pkt_too_big"] = function() {  return Module["asm"]["_pico_icmp6_pkt_too_big"].apply(null, arguments) };
var _pico_icmp6_port_unreachable = Module["_pico_icmp6_port_unreachable"] = function() {  return Module["asm"]["_pico_icmp6_port_unreachable"].apply(null, arguments) };
var _pico_icmp6_process_in = Module["_pico_icmp6_process_in"] = function() {  return Module["asm"]["_pico_icmp6_process_in"].apply(null, arguments) };
var _pico_icmp6_process_out = Module["_pico_icmp6_process_out"] = function() {  return Module["asm"]["_pico_icmp6_process_out"].apply(null, arguments) };
var _pico_icmp6_proto_unreachable = Module["_pico_icmp6_proto_unreachable"] = function() {  return Module["asm"]["_pico_icmp6_proto_unreachable"].apply(null, arguments) };
var _pico_icmp6_provide_llao = Module["_pico_icmp6_provide_llao"] = function() {  return Module["asm"]["_pico_icmp6_provide_llao"].apply(null, arguments) };
var _pico_icmp6_router_advertisement = Module["_pico_icmp6_router_advertisement"] = function() {  return Module["asm"]["_pico_icmp6_router_advertisement"].apply(null, arguments) };
var _pico_icmp6_router_solicitation = Module["_pico_icmp6_router_solicitation"] = function() {  return Module["asm"]["_pico_icmp6_router_solicitation"].apply(null, arguments) };
var _pico_icmp6_send_echoreply = Module["_pico_icmp6_send_echoreply"] = function() {  return Module["asm"]["_pico_icmp6_send_echoreply"].apply(null, arguments) };
var _pico_icmp6_ttl_expired = Module["_pico_icmp6_ttl_expired"] = function() {  return Module["asm"]["_pico_icmp6_ttl_expired"].apply(null, arguments) };
var _pico_igmp_analyse_packet = Module["_pico_igmp_analyse_packet"] = function() {  return Module["asm"]["_pico_igmp_analyse_packet"].apply(null, arguments) };
var _pico_igmp_compatibility_mode = Module["_pico_igmp_compatibility_mode"] = function() {  return Module["asm"]["_pico_igmp_compatibility_mode"].apply(null, arguments) };
var _pico_igmp_delete_parameter = Module["_pico_igmp_delete_parameter"] = function() {  return Module["asm"]["_pico_igmp_delete_parameter"].apply(null, arguments) };
var _pico_igmp_find_parameter = Module["_pico_igmp_find_parameter"] = function() {  return Module["asm"]["_pico_igmp_find_parameter"].apply(null, arguments) };
var _pico_igmp_find_timer = Module["_pico_igmp_find_timer"] = function() {  return Module["asm"]["_pico_igmp_find_timer"].apply(null, arguments) };
var _pico_igmp_generate_report = Module["_pico_igmp_generate_report"] = function() {  return Module["asm"]["_pico_igmp_generate_report"].apply(null, arguments) };
var _pico_igmp_is_checksum_valid = Module["_pico_igmp_is_checksum_valid"] = function() {  return Module["asm"]["_pico_igmp_is_checksum_valid"].apply(null, arguments) };
var _pico_igmp_process_event = Module["_pico_igmp_process_event"] = function() {  return Module["asm"]["_pico_igmp_process_event"].apply(null, arguments) };
var _pico_igmp_process_in = Module["_pico_igmp_process_in"] = function() {  return Module["asm"]["_pico_igmp_process_in"].apply(null, arguments) };
var _pico_igmp_process_out = Module["_pico_igmp_process_out"] = function() {  return Module["asm"]["_pico_igmp_process_out"].apply(null, arguments) };
var _pico_igmp_report_expired = Module["_pico_igmp_report_expired"] = function() {  return Module["asm"]["_pico_igmp_report_expired"].apply(null, arguments) };
var _pico_igmp_send_report = Module["_pico_igmp_send_report"] = function() {  return Module["asm"]["_pico_igmp_send_report"].apply(null, arguments) };
var _pico_igmp_state_change = Module["_pico_igmp_state_change"] = function() {  return Module["asm"]["_pico_igmp_state_change"].apply(null, arguments) };
var _pico_igmp_timer_expired = Module["_pico_igmp_timer_expired"] = function() {  return Module["asm"]["_pico_igmp_timer_expired"].apply(null, arguments) };
var _pico_igmp_timer_is_running = Module["_pico_igmp_timer_is_running"] = function() {  return Module["asm"]["_pico_igmp_timer_is_running"].apply(null, arguments) };
var _pico_igmp_timer_reset = Module["_pico_igmp_timer_reset"] = function() {  return Module["asm"]["_pico_igmp_timer_reset"].apply(null, arguments) };
var _pico_igmp_timer_start = Module["_pico_igmp_timer_start"] = function() {  return Module["asm"]["_pico_igmp_timer_start"].apply(null, arguments) };
var _pico_igmp_timer_stop = Module["_pico_igmp_timer_stop"] = function() {  return Module["asm"]["_pico_igmp_timer_stop"].apply(null, arguments) };
var _pico_igmp_v2querier_expired = Module["_pico_igmp_v2querier_expired"] = function() {  return Module["asm"]["_pico_igmp_v2querier_expired"].apply(null, arguments) };
var _pico_igmpv2_generate_report = Module["_pico_igmpv2_generate_report"] = function() {  return Module["asm"]["_pico_igmpv2_generate_report"].apply(null, arguments) };
var _pico_igmpv3_generate_filter = Module["_pico_igmpv3_generate_filter"] = function() {  return Module["asm"]["_pico_igmpv3_generate_filter"].apply(null, arguments) };
var _pico_igmpv3_generate_report = Module["_pico_igmpv3_generate_report"] = function() {  return Module["asm"]["_pico_igmpv3_generate_report"].apply(null, arguments) };
var _pico_ipv4_alloc = Module["_pico_ipv4_alloc"] = function() {  return Module["asm"]["_pico_ipv4_alloc"].apply(null, arguments) };
var _pico_ipv4_checksum = Module["_pico_ipv4_checksum"] = function() {  return Module["asm"]["_pico_ipv4_checksum"].apply(null, arguments) };
var _pico_ipv4_compare = Module["_pico_ipv4_compare"] = function() {  return Module["asm"]["_pico_ipv4_compare"].apply(null, arguments) };
var _pico_ipv4_crc_check = Module["_pico_ipv4_crc_check"] = function() {  return Module["asm"]["_pico_ipv4_crc_check"].apply(null, arguments) };
var _pico_ipv4_ethernet_receive = Module["_pico_ipv4_ethernet_receive"] = function() {  return Module["asm"]["_pico_ipv4_ethernet_receive"].apply(null, arguments) };
var _pico_ipv4_forward = Module["_pico_ipv4_forward"] = function() {  return Module["asm"]["_pico_ipv4_forward"].apply(null, arguments) };
var _pico_ipv4_forward_check_dev = Module["_pico_ipv4_forward_check_dev"] = function() {  return Module["asm"]["_pico_ipv4_forward_check_dev"].apply(null, arguments) };
var _pico_ipv4_frag_compare = Module["_pico_ipv4_frag_compare"] = function() {  return Module["asm"]["_pico_ipv4_frag_compare"].apply(null, arguments) };
var _pico_ipv4_frag_match = Module["_pico_ipv4_frag_match"] = function() {  return Module["asm"]["_pico_ipv4_frag_match"].apply(null, arguments) };
var _pico_ipv4_frag_timer_on = Module["_pico_ipv4_frag_timer_on"] = function() {  return Module["asm"]["_pico_ipv4_frag_timer_on"].apply(null, arguments) };
var _pico_ipv4_fragments_complete = Module["_pico_ipv4_fragments_complete"] = function() {  return Module["asm"]["_pico_ipv4_fragments_complete"].apply(null, arguments) };
var _pico_ipv4_frame_push = Module["_pico_ipv4_frame_push"] = function() {  return Module["asm"]["_pico_ipv4_frame_push"].apply(null, arguments) };
var _pico_ipv4_frame_sock_push = Module["_pico_ipv4_frame_sock_push"] = function() {  return Module["asm"]["_pico_ipv4_frame_sock_push"].apply(null, arguments) };
var _pico_ipv4_get_default_mcastlink = Module["_pico_ipv4_get_default_mcastlink"] = function() {  return Module["asm"]["_pico_ipv4_get_default_mcastlink"].apply(null, arguments) };
var _pico_ipv4_is_broadcast = Module["_pico_ipv4_is_broadcast"] = function() {  return Module["asm"]["_pico_ipv4_is_broadcast"].apply(null, arguments) };
var _pico_ipv4_is_invalid_loopback = Module["_pico_ipv4_is_invalid_loopback"] = function() {  return Module["asm"]["_pico_ipv4_is_invalid_loopback"].apply(null, arguments) };
var _pico_ipv4_is_loopback = Module["_pico_ipv4_is_loopback"] = function() {  return Module["asm"]["_pico_ipv4_is_loopback"].apply(null, arguments) };
var _pico_ipv4_is_multicast = Module["_pico_ipv4_is_multicast"] = function() {  return Module["asm"]["_pico_ipv4_is_multicast"].apply(null, arguments) };
var _pico_ipv4_is_unicast = Module["_pico_ipv4_is_unicast"] = function() {  return Module["asm"]["_pico_ipv4_is_unicast"].apply(null, arguments) };
var _pico_ipv4_is_valid_src = Module["_pico_ipv4_is_valid_src"] = function() {  return Module["asm"]["_pico_ipv4_is_valid_src"].apply(null, arguments) };
var _pico_ipv4_link_add = Module["_pico_ipv4_link_add"] = function() {  return Module["asm"]["_pico_ipv4_link_add"].apply(null, arguments) };
var _pico_ipv4_link_by_dev = Module["_pico_ipv4_link_by_dev"] = function() {  return Module["asm"]["_pico_ipv4_link_by_dev"].apply(null, arguments) };
var _pico_ipv4_link_find = Module["_pico_ipv4_link_find"] = function() {  return Module["asm"]["_pico_ipv4_link_find"].apply(null, arguments) };
var _pico_ipv4_link_get = Module["_pico_ipv4_link_get"] = function() {  return Module["asm"]["_pico_ipv4_link_get"].apply(null, arguments) };
var _pico_ipv4_mcast_filter = Module["_pico_ipv4_mcast_filter"] = function() {  return Module["asm"]["_pico_ipv4_mcast_filter"].apply(null, arguments) };
var _pico_ipv4_mcast_join = Module["_pico_ipv4_mcast_join"] = function() {  return Module["asm"]["_pico_ipv4_mcast_join"].apply(null, arguments) };
var _pico_ipv4_mcast_leave = Module["_pico_ipv4_mcast_leave"] = function() {  return Module["asm"]["_pico_ipv4_mcast_leave"].apply(null, arguments) };
var _pico_ipv4_mcast_print_groups = Module["_pico_ipv4_mcast_print_groups"] = function() {  return Module["asm"]["_pico_ipv4_mcast_print_groups"].apply(null, arguments) };
var _pico_ipv4_nat_add = Module["_pico_ipv4_nat_add"] = function() {  return Module["asm"]["_pico_ipv4_nat_add"].apply(null, arguments) };
var _pico_ipv4_nat_find = Module["_pico_ipv4_nat_find"] = function() {  return Module["asm"]["_pico_ipv4_nat_find"].apply(null, arguments) };
var _pico_ipv4_nat_find_tuple = Module["_pico_ipv4_nat_find_tuple"] = function() {  return Module["asm"]["_pico_ipv4_nat_find_tuple"].apply(null, arguments) };
var _pico_ipv4_nat_generate_tuple = Module["_pico_ipv4_nat_generate_tuple"] = function() {  return Module["asm"]["_pico_ipv4_nat_generate_tuple"].apply(null, arguments) };
var _pico_ipv4_nat_inbound = Module["_pico_ipv4_nat_inbound"] = function() {  return Module["asm"]["_pico_ipv4_nat_inbound"].apply(null, arguments) };
var _pico_ipv4_nat_is_enabled = Module["_pico_ipv4_nat_is_enabled"] = function() {  return Module["asm"]["_pico_ipv4_nat_is_enabled"].apply(null, arguments) };
var _pico_ipv4_nat_outbound = Module["_pico_ipv4_nat_outbound"] = function() {  return Module["asm"]["_pico_ipv4_nat_outbound"].apply(null, arguments) };
var _pico_ipv4_nat_set_tcp_flags = Module["_pico_ipv4_nat_set_tcp_flags"] = function() {  return Module["asm"]["_pico_ipv4_nat_set_tcp_flags"].apply(null, arguments) };
var _pico_ipv4_nat_sniff_session = Module["_pico_ipv4_nat_sniff_session"] = function() {  return Module["asm"]["_pico_ipv4_nat_sniff_session"].apply(null, arguments) };
var _pico_ipv4_pre_forward_checks = Module["_pico_ipv4_pre_forward_checks"] = function() {  return Module["asm"]["_pico_ipv4_pre_forward_checks"].apply(null, arguments) };
var _pico_ipv4_process_bcast_in = Module["_pico_ipv4_process_bcast_in"] = function() {  return Module["asm"]["_pico_ipv4_process_bcast_in"].apply(null, arguments) };
var _pico_ipv4_process_finally_try_forward = Module["_pico_ipv4_process_finally_try_forward"] = function() {  return Module["asm"]["_pico_ipv4_process_finally_try_forward"].apply(null, arguments) };
var _pico_ipv4_process_frag = Module["_pico_ipv4_process_frag"] = function() {  return Module["asm"]["_pico_ipv4_process_frag"].apply(null, arguments) };
var _pico_ipv4_process_in = Module["_pico_ipv4_process_in"] = function() {  return Module["asm"]["_pico_ipv4_process_in"].apply(null, arguments) };
var _pico_ipv4_process_local_unicast_in = Module["_pico_ipv4_process_local_unicast_in"] = function() {  return Module["asm"]["_pico_ipv4_process_local_unicast_in"].apply(null, arguments) };
var _pico_ipv4_process_mcast_in = Module["_pico_ipv4_process_mcast_in"] = function() {  return Module["asm"]["_pico_ipv4_process_mcast_in"].apply(null, arguments) };
var _pico_ipv4_process_out = Module["_pico_ipv4_process_out"] = function() {  return Module["asm"]["_pico_ipv4_process_out"].apply(null, arguments) };
var _pico_ipv4_rebound = Module["_pico_ipv4_rebound"] = function() {  return Module["asm"]["_pico_ipv4_rebound"].apply(null, arguments) };
var _pico_ipv4_rebound_large = Module["_pico_ipv4_rebound_large"] = function() {  return Module["asm"]["_pico_ipv4_rebound_large"].apply(null, arguments) };
var _pico_ipv4_route_add = Module["_pico_ipv4_route_add"] = function() {  return Module["asm"]["_pico_ipv4_route_add"].apply(null, arguments) };
var _pico_ipv4_route_del = Module["_pico_ipv4_route_del"] = function() {  return Module["asm"]["_pico_ipv4_route_del"].apply(null, arguments) };
var _pico_ipv4_route_get_gateway = Module["_pico_ipv4_route_get_gateway"] = function() {  return Module["asm"]["_pico_ipv4_route_get_gateway"].apply(null, arguments) };
var _pico_ipv4_route_set_bcast_link = Module["_pico_ipv4_route_set_bcast_link"] = function() {  return Module["asm"]["_pico_ipv4_route_set_bcast_link"].apply(null, arguments) };
var _pico_ipv4_source_dev_find = Module["_pico_ipv4_source_dev_find"] = function() {  return Module["asm"]["_pico_ipv4_source_dev_find"].apply(null, arguments) };
var _pico_ipv4_source_find = Module["_pico_ipv4_source_find"] = function() {  return Module["asm"]["_pico_ipv4_source_find"].apply(null, arguments) };
var _pico_ipv4_to_string = Module["_pico_ipv4_to_string"] = function() {  return Module["asm"]["_pico_ipv4_to_string"].apply(null, arguments) };
var _pico_ipv4_unreachable = Module["_pico_ipv4_unreachable"] = function() {  return Module["asm"]["_pico_ipv4_unreachable"].apply(null, arguments) };
var _pico_ipv6_alloc = Module["_pico_ipv6_alloc"] = function() {  return Module["asm"]["_pico_ipv6_alloc"].apply(null, arguments) };
var _pico_ipv6_check_aligned = Module["_pico_ipv6_check_aligned"] = function() {  return Module["asm"]["_pico_ipv6_check_aligned"].apply(null, arguments) };
var _pico_ipv6_check_headers_sequence = Module["_pico_ipv6_check_headers_sequence"] = function() {  return Module["asm"]["_pico_ipv6_check_headers_sequence"].apply(null, arguments) };
var _pico_ipv6_check_lifetime_expired = Module["_pico_ipv6_check_lifetime_expired"] = function() {  return Module["asm"]["_pico_ipv6_check_lifetime_expired"].apply(null, arguments) };
var _pico_ipv6_cleanup_routes = Module["_pico_ipv6_cleanup_routes"] = function() {  return Module["asm"]["_pico_ipv6_cleanup_routes"].apply(null, arguments) };
var _pico_ipv6_compare = Module["_pico_ipv6_compare"] = function() {  return Module["asm"]["_pico_ipv6_compare"].apply(null, arguments) };
var _pico_ipv6_dec_to_char = Module["_pico_ipv6_dec_to_char"] = function() {  return Module["asm"]["_pico_ipv6_dec_to_char"].apply(null, arguments) };
var _pico_ipv6_do_link_add = Module["_pico_ipv6_do_link_add"] = function() {  return Module["asm"]["_pico_ipv6_do_link_add"].apply(null, arguments) };
var _pico_ipv6_ethernet_receive = Module["_pico_ipv6_ethernet_receive"] = function() {  return Module["asm"]["_pico_ipv6_ethernet_receive"].apply(null, arguments) };
var _pico_ipv6_extension_headers = Module["_pico_ipv6_extension_headers"] = function() {  return Module["asm"]["_pico_ipv6_extension_headers"].apply(null, arguments) };
var _pico_ipv6_forward = Module["_pico_ipv6_forward"] = function() {  return Module["asm"]["_pico_ipv6_forward"].apply(null, arguments) };
var _pico_ipv6_forward_check_dev = Module["_pico_ipv6_forward_check_dev"] = function() {  return Module["asm"]["_pico_ipv6_forward_check_dev"].apply(null, arguments) };
var _pico_ipv6_frag_compare = Module["_pico_ipv6_frag_compare"] = function() {  return Module["asm"]["_pico_ipv6_frag_compare"].apply(null, arguments) };
var _pico_ipv6_frag_match = Module["_pico_ipv6_frag_match"] = function() {  return Module["asm"]["_pico_ipv6_frag_match"].apply(null, arguments) };
var _pico_ipv6_frag_timer_on = Module["_pico_ipv6_frag_timer_on"] = function() {  return Module["asm"]["_pico_ipv6_frag_timer_on"].apply(null, arguments) };
var _pico_ipv6_fragments_complete = Module["_pico_ipv6_fragments_complete"] = function() {  return Module["asm"]["_pico_ipv6_fragments_complete"].apply(null, arguments) };
var _pico_ipv6_frame_push = Module["_pico_ipv6_frame_push"] = function() {  return Module["asm"]["_pico_ipv6_frame_push"].apply(null, arguments) };
var _pico_ipv6_frame_sock_push = Module["_pico_ipv6_frame_sock_push"] = function() {  return Module["asm"]["_pico_ipv6_frame_sock_push"].apply(null, arguments) };
var _pico_ipv6_get_default_mcastlink = Module["_pico_ipv6_get_default_mcastlink"] = function() {  return Module["asm"]["_pico_ipv6_get_default_mcastlink"].apply(null, arguments) };
var _pico_ipv6_get_neighbor = Module["_pico_ipv6_get_neighbor"] = function() {  return Module["asm"]["_pico_ipv6_get_neighbor"].apply(null, arguments) };
var _pico_ipv6_global_get = Module["_pico_ipv6_global_get"] = function() {  return Module["asm"]["_pico_ipv6_global_get"].apply(null, arguments) };
var _pico_ipv6_hex_to_dec = Module["_pico_ipv6_hex_to_dec"] = function() {  return Module["asm"]["_pico_ipv6_hex_to_dec"].apply(null, arguments) };
var _pico_ipv6_is_allhosts_multicast = Module["_pico_ipv6_is_allhosts_multicast"] = function() {  return Module["asm"]["_pico_ipv6_is_allhosts_multicast"].apply(null, arguments) };
var _pico_ipv6_is_global = Module["_pico_ipv6_is_global"] = function() {  return Module["asm"]["_pico_ipv6_is_global"].apply(null, arguments) };
var _pico_ipv6_is_linklocal = Module["_pico_ipv6_is_linklocal"] = function() {  return Module["asm"]["_pico_ipv6_is_linklocal"].apply(null, arguments) };
var _pico_ipv6_is_localhost = Module["_pico_ipv6_is_localhost"] = function() {  return Module["asm"]["_pico_ipv6_is_localhost"].apply(null, arguments) };
var _pico_ipv6_is_multicast = Module["_pico_ipv6_is_multicast"] = function() {  return Module["asm"]["_pico_ipv6_is_multicast"].apply(null, arguments) };
var _pico_ipv6_is_null_address = Module["_pico_ipv6_is_null_address"] = function() {  return Module["asm"]["_pico_ipv6_is_null_address"].apply(null, arguments) };
var _pico_ipv6_is_sitelocal = Module["_pico_ipv6_is_sitelocal"] = function() {  return Module["asm"]["_pico_ipv6_is_sitelocal"].apply(null, arguments) };
var _pico_ipv6_is_solnode_multicast = Module["_pico_ipv6_is_solnode_multicast"] = function() {  return Module["asm"]["_pico_ipv6_is_solnode_multicast"].apply(null, arguments) };
var _pico_ipv6_is_unicast = Module["_pico_ipv6_is_unicast"] = function() {  return Module["asm"]["_pico_ipv6_is_unicast"].apply(null, arguments) };
var _pico_ipv6_is_uniquelocal = Module["_pico_ipv6_is_uniquelocal"] = function() {  return Module["asm"]["_pico_ipv6_is_uniquelocal"].apply(null, arguments) };
var _pico_ipv6_is_unspecified = Module["_pico_ipv6_is_unspecified"] = function() {  return Module["asm"]["_pico_ipv6_is_unspecified"].apply(null, arguments) };
var _pico_ipv6_lifetime_set = Module["_pico_ipv6_lifetime_set"] = function() {  return Module["asm"]["_pico_ipv6_lifetime_set"].apply(null, arguments) };
var _pico_ipv6_link_add = Module["_pico_ipv6_link_add"] = function() {  return Module["asm"]["_pico_ipv6_link_add"].apply(null, arguments) };
var _pico_ipv6_link_add_local = Module["_pico_ipv6_link_add_local"] = function() {  return Module["asm"]["_pico_ipv6_link_add_local"].apply(null, arguments) };
var _pico_ipv6_link_by_dev = Module["_pico_ipv6_link_by_dev"] = function() {  return Module["asm"]["_pico_ipv6_link_by_dev"].apply(null, arguments) };
var _pico_ipv6_link_by_dev_next = Module["_pico_ipv6_link_by_dev_next"] = function() {  return Module["asm"]["_pico_ipv6_link_by_dev_next"].apply(null, arguments) };
var _pico_ipv6_link_del = Module["_pico_ipv6_link_del"] = function() {  return Module["asm"]["_pico_ipv6_link_del"].apply(null, arguments) };
var _pico_ipv6_link_find = Module["_pico_ipv6_link_find"] = function() {  return Module["asm"]["_pico_ipv6_link_find"].apply(null, arguments) };
var _pico_ipv6_link_get = Module["_pico_ipv6_link_get"] = function() {  return Module["asm"]["_pico_ipv6_link_get"].apply(null, arguments) };
var _pico_ipv6_link_istentative = Module["_pico_ipv6_link_istentative"] = function() {  return Module["asm"]["_pico_ipv6_link_istentative"].apply(null, arguments) };
var _pico_ipv6_linklocal_get = Module["_pico_ipv6_linklocal_get"] = function() {  return Module["asm"]["_pico_ipv6_linklocal_get"].apply(null, arguments) };
var _pico_ipv6_mcast_filter = Module["_pico_ipv6_mcast_filter"] = function() {  return Module["asm"]["_pico_ipv6_mcast_filter"].apply(null, arguments) };
var _pico_ipv6_mcast_join = Module["_pico_ipv6_mcast_join"] = function() {  return Module["asm"]["_pico_ipv6_mcast_join"].apply(null, arguments) };
var _pico_ipv6_mcast_leave = Module["_pico_ipv6_mcast_leave"] = function() {  return Module["asm"]["_pico_ipv6_mcast_leave"].apply(null, arguments) };
var _pico_ipv6_nd_dad = Module["_pico_ipv6_nd_dad"] = function() {  return Module["asm"]["_pico_ipv6_nd_dad"].apply(null, arguments) };
var _pico_ipv6_nd_init = Module["_pico_ipv6_nd_init"] = function() {  return Module["asm"]["_pico_ipv6_nd_init"].apply(null, arguments) };
var _pico_ipv6_nd_postpone = Module["_pico_ipv6_nd_postpone"] = function() {  return Module["asm"]["_pico_ipv6_nd_postpone"].apply(null, arguments) };
var _pico_ipv6_nd_queued_trigger = Module["_pico_ipv6_nd_queued_trigger"] = function() {  return Module["asm"]["_pico_ipv6_nd_queued_trigger"].apply(null, arguments) };
var _pico_ipv6_nd_ra_timer_callback = Module["_pico_ipv6_nd_ra_timer_callback"] = function() {  return Module["asm"]["_pico_ipv6_nd_ra_timer_callback"].apply(null, arguments) };
var _pico_ipv6_nd_recv = Module["_pico_ipv6_nd_recv"] = function() {  return Module["asm"]["_pico_ipv6_nd_recv"].apply(null, arguments) };
var _pico_ipv6_nd_timer_callback = Module["_pico_ipv6_nd_timer_callback"] = function() {  return Module["asm"]["_pico_ipv6_nd_timer_callback"].apply(null, arguments) };
var _pico_ipv6_nd_timer_elapsed = Module["_pico_ipv6_nd_timer_elapsed"] = function() {  return Module["asm"]["_pico_ipv6_nd_timer_elapsed"].apply(null, arguments) };
var _pico_ipv6_nd_unreachable = Module["_pico_ipv6_nd_unreachable"] = function() {  return Module["asm"]["_pico_ipv6_nd_unreachable"].apply(null, arguments) };
var _pico_ipv6_neighbor_compare = Module["_pico_ipv6_neighbor_compare"] = function() {  return Module["asm"]["_pico_ipv6_neighbor_compare"].apply(null, arguments) };
var _pico_ipv6_neighbor_compare_stored = Module["_pico_ipv6_neighbor_compare_stored"] = function() {  return Module["asm"]["_pico_ipv6_neighbor_compare_stored"].apply(null, arguments) };
var _pico_ipv6_neighbor_from_sol_new = Module["_pico_ipv6_neighbor_from_sol_new"] = function() {  return Module["asm"]["_pico_ipv6_neighbor_from_sol_new"].apply(null, arguments) };
var _pico_ipv6_neighbor_from_unsolicited = Module["_pico_ipv6_neighbor_from_unsolicited"] = function() {  return Module["asm"]["_pico_ipv6_neighbor_from_unsolicited"].apply(null, arguments) };
var _pico_ipv6_neighbor_update = Module["_pico_ipv6_neighbor_update"] = function() {  return Module["asm"]["_pico_ipv6_neighbor_update"].apply(null, arguments) };
var _pico_ipv6_pre_forward_checks = Module["_pico_ipv6_pre_forward_checks"] = function() {  return Module["asm"]["_pico_ipv6_pre_forward_checks"].apply(null, arguments) };
var _pico_ipv6_prefix_configured = Module["_pico_ipv6_prefix_configured"] = function() {  return Module["asm"]["_pico_ipv6_prefix_configured"].apply(null, arguments) };
var _pico_ipv6_process_destopt = Module["_pico_ipv6_process_destopt"] = function() {  return Module["asm"]["_pico_ipv6_process_destopt"].apply(null, arguments) };
var _pico_ipv6_process_frag = Module["_pico_ipv6_process_frag"] = function() {  return Module["asm"]["_pico_ipv6_process_frag"].apply(null, arguments) };
var _pico_ipv6_process_hopbyhop = Module["_pico_ipv6_process_hopbyhop"] = function() {  return Module["asm"]["_pico_ipv6_process_hopbyhop"].apply(null, arguments) };
var _pico_ipv6_process_in = Module["_pico_ipv6_process_in"] = function() {  return Module["asm"]["_pico_ipv6_process_in"].apply(null, arguments) };
var _pico_ipv6_process_mcast_in = Module["_pico_ipv6_process_mcast_in"] = function() {  return Module["asm"]["_pico_ipv6_process_mcast_in"].apply(null, arguments) };
var _pico_ipv6_process_out = Module["_pico_ipv6_process_out"] = function() {  return Module["asm"]["_pico_ipv6_process_out"].apply(null, arguments) };
var _pico_ipv6_process_routing = Module["_pico_ipv6_process_routing"] = function() {  return Module["asm"]["_pico_ipv6_process_routing"].apply(null, arguments) };
var _pico_ipv6_route_add = Module["_pico_ipv6_route_add"] = function() {  return Module["asm"]["_pico_ipv6_route_add"].apply(null, arguments) };
var _pico_ipv6_route_del = Module["_pico_ipv6_route_del"] = function() {  return Module["asm"]["_pico_ipv6_route_del"].apply(null, arguments) };
var _pico_ipv6_route_find = Module["_pico_ipv6_route_find"] = function() {  return Module["asm"]["_pico_ipv6_route_find"].apply(null, arguments) };
var _pico_ipv6_route_get_gateway = Module["_pico_ipv6_route_get_gateway"] = function() {  return Module["asm"]["_pico_ipv6_route_get_gateway"].apply(null, arguments) };
var _pico_ipv6_router_down = Module["_pico_ipv6_router_down"] = function() {  return Module["asm"]["_pico_ipv6_router_down"].apply(null, arguments) };
var _pico_ipv6_sitelocal_get = Module["_pico_ipv6_sitelocal_get"] = function() {  return Module["asm"]["_pico_ipv6_sitelocal_get"].apply(null, arguments) };
var _pico_ipv6_source_dev_find = Module["_pico_ipv6_source_dev_find"] = function() {  return Module["asm"]["_pico_ipv6_source_dev_find"].apply(null, arguments) };
var _pico_ipv6_source_find = Module["_pico_ipv6_source_find"] = function() {  return Module["asm"]["_pico_ipv6_source_find"].apply(null, arguments) };
var _pico_ipv6_to_string = Module["_pico_ipv6_to_string"] = function() {  return Module["asm"]["_pico_ipv6_to_string"].apply(null, arguments) };
var _pico_ipv6_unreachable = Module["_pico_ipv6_unreachable"] = function() {  return Module["asm"]["_pico_ipv6_unreachable"].apply(null, arguments) };
var _pico_is_digit = Module["_pico_is_digit"] = function() {  return Module["asm"]["_pico_is_digit"].apply(null, arguments) };
var _pico_is_hex = Module["_pico_is_hex"] = function() {  return Module["asm"]["_pico_is_hex"].apply(null, arguments) };
var _pico_is_port_free = Module["_pico_is_port_free"] = function() {  return Module["asm"]["_pico_is_port_free"].apply(null, arguments) };
var _pico_js_create = Module["_pico_js_create"] = function() {  return Module["asm"]["_pico_js_create"].apply(null, arguments) };
var _pico_js_poll = Module["_pico_js_poll"] = function() {  return Module["asm"]["_pico_js_poll"].apply(null, arguments) };
var _pico_js_send = Module["_pico_js_send"] = function() {  return Module["asm"]["_pico_js_send"].apply(null, arguments) };
var _pico_mcast_filter_excl_excl = Module["_pico_mcast_filter_excl_excl"] = function() {  return Module["asm"]["_pico_mcast_filter_excl_excl"].apply(null, arguments) };
var _pico_mcast_filter_excl_incl = Module["_pico_mcast_filter_excl_incl"] = function() {  return Module["asm"]["_pico_mcast_filter_excl_incl"].apply(null, arguments) };
var _pico_mcast_filter_incl_excl = Module["_pico_mcast_filter_incl_excl"] = function() {  return Module["asm"]["_pico_mcast_filter_incl_excl"].apply(null, arguments) };
var _pico_mcast_filter_incl_incl = Module["_pico_mcast_filter_incl_incl"] = function() {  return Module["asm"]["_pico_mcast_filter_incl_incl"].apply(null, arguments) };
var _pico_mcast_generate_filter = Module["_pico_mcast_generate_filter"] = function() {  return Module["asm"]["_pico_mcast_generate_filter"].apply(null, arguments) };
var _pico_mcast_src_filtering_cleanup = Module["_pico_mcast_src_filtering_cleanup"] = function() {  return Module["asm"]["_pico_mcast_src_filtering_cleanup"].apply(null, arguments) };
var _pico_mcast_src_filtering_excl_excl = Module["_pico_mcast_src_filtering_excl_excl"] = function() {  return Module["asm"]["_pico_mcast_src_filtering_excl_excl"].apply(null, arguments) };
var _pico_mcast_src_filtering_excl_inc = Module["_pico_mcast_src_filtering_excl_inc"] = function() {  return Module["asm"]["_pico_mcast_src_filtering_excl_inc"].apply(null, arguments) };
var _pico_mcast_src_filtering_inc_excl = Module["_pico_mcast_src_filtering_inc_excl"] = function() {  return Module["asm"]["_pico_mcast_src_filtering_inc_excl"].apply(null, arguments) };
var _pico_mcast_src_filtering_inc_inc = Module["_pico_mcast_src_filtering_inc_inc"] = function() {  return Module["asm"]["_pico_mcast_src_filtering_inc_inc"].apply(null, arguments) };
var _pico_mld_analyse_packet = Module["_pico_mld_analyse_packet"] = function() {  return Module["asm"]["_pico_mld_analyse_packet"].apply(null, arguments) };
var _pico_mld_check_hopbyhop = Module["_pico_mld_check_hopbyhop"] = function() {  return Module["asm"]["_pico_mld_check_hopbyhop"].apply(null, arguments) };
var _pico_mld_checksum = Module["_pico_mld_checksum"] = function() {  return Module["asm"]["_pico_mld_checksum"].apply(null, arguments) };
var _pico_mld_compatibility_mode = Module["_pico_mld_compatibility_mode"] = function() {  return Module["asm"]["_pico_mld_compatibility_mode"].apply(null, arguments) };
var _pico_mld_delete_parameter = Module["_pico_mld_delete_parameter"] = function() {  return Module["asm"]["_pico_mld_delete_parameter"].apply(null, arguments) };
var _pico_mld_fill_hopbyhop = Module["_pico_mld_fill_hopbyhop"] = function() {  return Module["asm"]["_pico_mld_fill_hopbyhop"].apply(null, arguments) };
var _pico_mld_find_parameter = Module["_pico_mld_find_parameter"] = function() {  return Module["asm"]["_pico_mld_find_parameter"].apply(null, arguments) };
var _pico_mld_find_timer = Module["_pico_mld_find_timer"] = function() {  return Module["asm"]["_pico_mld_find_timer"].apply(null, arguments) };
var _pico_mld_generate_report = Module["_pico_mld_generate_report"] = function() {  return Module["asm"]["_pico_mld_generate_report"].apply(null, arguments) };
var _pico_mld_is_checksum_valid = Module["_pico_mld_is_checksum_valid"] = function() {  return Module["asm"]["_pico_mld_is_checksum_valid"].apply(null, arguments) };
var _pico_mld_process_event = Module["_pico_mld_process_event"] = function() {  return Module["asm"]["_pico_mld_process_event"].apply(null, arguments) };
var _pico_mld_process_in = Module["_pico_mld_process_in"] = function() {  return Module["asm"]["_pico_mld_process_in"].apply(null, arguments) };
var _pico_mld_report_expired = Module["_pico_mld_report_expired"] = function() {  return Module["asm"]["_pico_mld_report_expired"].apply(null, arguments) };
var _pico_mld_send_done = Module["_pico_mld_send_done"] = function() {  return Module["asm"]["_pico_mld_send_done"].apply(null, arguments) };
var _pico_mld_send_report = Module["_pico_mld_send_report"] = function() {  return Module["asm"]["_pico_mld_send_report"].apply(null, arguments) };
var _pico_mld_state_change = Module["_pico_mld_state_change"] = function() {  return Module["asm"]["_pico_mld_state_change"].apply(null, arguments) };
var _pico_mld_timer_expired = Module["_pico_mld_timer_expired"] = function() {  return Module["asm"]["_pico_mld_timer_expired"].apply(null, arguments) };
var _pico_mld_timer_is_running = Module["_pico_mld_timer_is_running"] = function() {  return Module["asm"]["_pico_mld_timer_is_running"].apply(null, arguments) };
var _pico_mld_timer_reset = Module["_pico_mld_timer_reset"] = function() {  return Module["asm"]["_pico_mld_timer_reset"].apply(null, arguments) };
var _pico_mld_timer_start = Module["_pico_mld_timer_start"] = function() {  return Module["asm"]["_pico_mld_timer_start"].apply(null, arguments) };
var _pico_mld_timer_stop = Module["_pico_mld_timer_stop"] = function() {  return Module["asm"]["_pico_mld_timer_stop"].apply(null, arguments) };
var _pico_mld_v1querier_expired = Module["_pico_mld_v1querier_expired"] = function() {  return Module["asm"]["_pico_mld_v1querier_expired"].apply(null, arguments) };
var _pico_mldv1_generate_report = Module["_pico_mldv1_generate_report"] = function() {  return Module["asm"]["_pico_mldv1_generate_report"].apply(null, arguments) };
var _pico_mldv2_generate_filter = Module["_pico_mldv2_generate_filter"] = function() {  return Module["asm"]["_pico_mldv2_generate_filter"].apply(null, arguments) };
var _pico_mldv2_generate_report = Module["_pico_mldv2_generate_report"] = function() {  return Module["asm"]["_pico_mldv2_generate_report"].apply(null, arguments) };
var _pico_multicast_delete = Module["_pico_multicast_delete"] = function() {  return Module["asm"]["_pico_multicast_delete"].apply(null, arguments) };
var _pico_nat_generate_tuple_trans = Module["_pico_nat_generate_tuple_trans"] = function() {  return Module["asm"]["_pico_nat_generate_tuple_trans"].apply(null, arguments) };
var _pico_nd_add = Module["_pico_nd_add"] = function() {  return Module["asm"]["_pico_nd_add"].apply(null, arguments) };
var _pico_nd_discover = Module["_pico_nd_discover"] = function() {  return Module["asm"]["_pico_nd_discover"].apply(null, arguments) };
var _pico_nd_find_neighbor = Module["_pico_nd_find_neighbor"] = function() {  return Module["asm"]["_pico_nd_find_neighbor"].apply(null, arguments) };
var _pico_nd_get = Module["_pico_nd_get"] = function() {  return Module["asm"]["_pico_nd_get"].apply(null, arguments) };
var _pico_nd_get_neighbor = Module["_pico_nd_get_neighbor"] = function() {  return Module["asm"]["_pico_nd_get_neighbor"].apply(null, arguments) };
var _pico_nd_neigh_adv_recv = Module["_pico_nd_neigh_adv_recv"] = function() {  return Module["asm"]["_pico_nd_neigh_adv_recv"].apply(null, arguments) };
var _pico_nd_neigh_sol_recv = Module["_pico_nd_neigh_sol_recv"] = function() {  return Module["asm"]["_pico_nd_neigh_sol_recv"].apply(null, arguments) };
var _pico_nd_new_expire_time = Module["_pico_nd_new_expire_time"] = function() {  return Module["asm"]["_pico_nd_new_expire_time"].apply(null, arguments) };
var _pico_nd_redirect_recv = Module["_pico_nd_redirect_recv"] = function() {  return Module["asm"]["_pico_nd_redirect_recv"].apply(null, arguments) };
var _pico_nd_router_adv_recv = Module["_pico_nd_router_adv_recv"] = function() {  return Module["asm"]["_pico_nd_router_adv_recv"].apply(null, arguments) };
var _pico_nd_router_sol_recv = Module["_pico_nd_router_sol_recv"] = function() {  return Module["asm"]["_pico_nd_router_sol_recv"].apply(null, arguments) };
var _pico_network_receive = Module["_pico_network_receive"] = function() {  return Module["asm"]["_pico_network_receive"].apply(null, arguments) };
var _pico_network_send = Module["_pico_network_send"] = function() {  return Module["asm"]["_pico_network_send"].apply(null, arguments) };
var _pico_notify_dest_unreachable = Module["_pico_notify_dest_unreachable"] = function() {  return Module["asm"]["_pico_notify_dest_unreachable"].apply(null, arguments) };
var _pico_notify_frag_expired = Module["_pico_notify_frag_expired"] = function() {  return Module["asm"]["_pico_notify_frag_expired"].apply(null, arguments) };
var _pico_notify_pkt_too_big = Module["_pico_notify_pkt_too_big"] = function() {  return Module["asm"]["_pico_notify_pkt_too_big"].apply(null, arguments) };
var _pico_notify_proto_unreachable = Module["_pico_notify_proto_unreachable"] = function() {  return Module["asm"]["_pico_notify_proto_unreachable"].apply(null, arguments) };
var _pico_notify_socket_unreachable = Module["_pico_notify_socket_unreachable"] = function() {  return Module["asm"]["_pico_notify_socket_unreachable"].apply(null, arguments) };
var _pico_notify_ttl_expired = Module["_pico_notify_ttl_expired"] = function() {  return Module["asm"]["_pico_notify_ttl_expired"].apply(null, arguments) };
var _pico_paws = Module["_pico_paws"] = function() {  return Module["asm"]["_pico_paws"].apply(null, arguments) };
var _pico_port_in_use_by_nat = Module["_pico_port_in_use_by_nat"] = function() {  return Module["asm"]["_pico_port_in_use_by_nat"].apply(null, arguments) };
var _pico_port_in_use_ipv4 = Module["_pico_port_in_use_ipv4"] = function() {  return Module["asm"]["_pico_port_in_use_ipv4"].apply(null, arguments) };
var _pico_port_in_use_ipv6 = Module["_pico_port_in_use_ipv6"] = function() {  return Module["asm"]["_pico_port_in_use_ipv6"].apply(null, arguments) };
var _pico_port_in_use_with_this_ipv4_address = Module["_pico_port_in_use_with_this_ipv4_address"] = function() {  return Module["asm"]["_pico_port_in_use_with_this_ipv4_address"].apply(null, arguments) };
var _pico_port_in_use_with_this_ipv6_address = Module["_pico_port_in_use_with_this_ipv6_address"] = function() {  return Module["asm"]["_pico_port_in_use_with_this_ipv6_address"].apply(null, arguments) };
var _pico_proto_cmp = Module["_pico_proto_cmp"] = function() {  return Module["asm"]["_pico_proto_cmp"].apply(null, arguments) };
var _pico_protocol_datalink_loop = Module["_pico_protocol_datalink_loop"] = function() {  return Module["asm"]["_pico_protocol_datalink_loop"].apply(null, arguments) };
var _pico_protocol_generic_loop = Module["_pico_protocol_generic_loop"] = function() {  return Module["asm"]["_pico_protocol_generic_loop"].apply(null, arguments) };
var _pico_protocol_init = Module["_pico_protocol_init"] = function() {  return Module["asm"]["_pico_protocol_init"].apply(null, arguments) };
var _pico_protocol_network_loop = Module["_pico_protocol_network_loop"] = function() {  return Module["asm"]["_pico_protocol_network_loop"].apply(null, arguments) };
var _pico_protocol_socket_loop = Module["_pico_protocol_socket_loop"] = function() {  return Module["asm"]["_pico_protocol_socket_loop"].apply(null, arguments) };
var _pico_protocol_transport_loop = Module["_pico_protocol_transport_loop"] = function() {  return Module["asm"]["_pico_protocol_transport_loop"].apply(null, arguments) };
var _pico_queue_peek = Module["_pico_queue_peek"] = function() {  return Module["asm"]["_pico_queue_peek"].apply(null, arguments) };
var _pico_queue_peek_30 = Module["_pico_queue_peek_30"] = function() {  return Module["asm"]["_pico_queue_peek_30"].apply(null, arguments) };
var _pico_rand = Module["_pico_rand"] = function() {  return Module["asm"]["_pico_rand"].apply(null, arguments) };
var _pico_rand_feed = Module["_pico_rand_feed"] = function() {  return Module["asm"]["_pico_rand_feed"].apply(null, arguments) };
var _pico_sendto_dev = Module["_pico_sendto_dev"] = function() {  return Module["asm"]["_pico_sendto_dev"].apply(null, arguments) };
var _pico_seq_compare = Module["_pico_seq_compare"] = function() {  return Module["asm"]["_pico_seq_compare"].apply(null, arguments) };
var _pico_socket_accept = Module["_pico_socket_accept"] = function() {  return Module["asm"]["_pico_socket_accept"].apply(null, arguments) };
var _pico_socket_adapt_mss_to_proto = Module["_pico_socket_adapt_mss_to_proto"] = function() {  return Module["asm"]["_pico_socket_adapt_mss_to_proto"].apply(null, arguments) };
var _pico_socket_add = Module["_pico_socket_add"] = function() {  return Module["asm"]["_pico_socket_add"].apply(null, arguments) };
var _pico_socket_aggregate_mcastfilters = Module["_pico_socket_aggregate_mcastfilters"] = function() {  return Module["asm"]["_pico_socket_aggregate_mcastfilters"].apply(null, arguments) };
var _pico_socket_alter_state = Module["_pico_socket_alter_state"] = function() {  return Module["asm"]["_pico_socket_alter_state"].apply(null, arguments) };
var _pico_socket_bind = Module["_pico_socket_bind"] = function() {  return Module["asm"]["_pico_socket_bind"].apply(null, arguments) };
var _pico_socket_check_empty_sockport = Module["_pico_socket_check_empty_sockport"] = function() {  return Module["asm"]["_pico_socket_check_empty_sockport"].apply(null, arguments) };
var _pico_socket_clone = Module["_pico_socket_clone"] = function() {  return Module["asm"]["_pico_socket_clone"].apply(null, arguments) };
var _pico_socket_clone_assign_address = Module["_pico_socket_clone_assign_address"] = function() {  return Module["asm"]["_pico_socket_clone_assign_address"].apply(null, arguments) };
var _pico_socket_close = Module["_pico_socket_close"] = function() {  return Module["asm"]["_pico_socket_close"].apply(null, arguments) };
var _pico_socket_connect = Module["_pico_socket_connect"] = function() {  return Module["asm"]["_pico_socket_connect"].apply(null, arguments) };
var _pico_socket_del = Module["_pico_socket_del"] = function() {  return Module["asm"]["_pico_socket_del"].apply(null, arguments) };
var _pico_socket_deliver = Module["_pico_socket_deliver"] = function() {  return Module["asm"]["_pico_socket_deliver"].apply(null, arguments) };
var _pico_socket_final_xmit = Module["_pico_socket_final_xmit"] = function() {  return Module["asm"]["_pico_socket_final_xmit"].apply(null, arguments) };
var _pico_socket_frame_alloc = Module["_pico_socket_frame_alloc"] = function() {  return Module["asm"]["_pico_socket_frame_alloc"].apply(null, arguments) };
var _pico_socket_get_mss = Module["_pico_socket_get_mss"] = function() {  return Module["asm"]["_pico_socket_get_mss"].apply(null, arguments) };
var _pico_socket_high_port = Module["_pico_socket_high_port"] = function() {  return Module["asm"]["_pico_socket_high_port"].apply(null, arguments) };
var _pico_socket_listen = Module["_pico_socket_listen"] = function() {  return Module["asm"]["_pico_socket_listen"].apply(null, arguments) };
var _pico_socket_mcast_filter = Module["_pico_socket_mcast_filter"] = function() {  return Module["asm"]["_pico_socket_mcast_filter"].apply(null, arguments) };
var _pico_socket_mcast_filter_exclude = Module["_pico_socket_mcast_filter_exclude"] = function() {  return Module["asm"]["_pico_socket_mcast_filter_exclude"].apply(null, arguments) };
var _pico_socket_mcast_filter_include = Module["_pico_socket_mcast_filter_include"] = function() {  return Module["asm"]["_pico_socket_mcast_filter_include"].apply(null, arguments) };
var _pico_socket_mcast_filter_link_get = Module["_pico_socket_mcast_filter_link_get"] = function() {  return Module["asm"]["_pico_socket_mcast_filter_link_get"].apply(null, arguments) };
var _pico_socket_mcast_source_filtering = Module["_pico_socket_mcast_source_filtering"] = function() {  return Module["asm"]["_pico_socket_mcast_source_filtering"].apply(null, arguments) };
var _pico_socket_open = Module["_pico_socket_open"] = function() {  return Module["asm"]["_pico_socket_open"].apply(null, arguments) };
var _pico_socket_read = Module["_pico_socket_read"] = function() {  return Module["asm"]["_pico_socket_read"].apply(null, arguments) };
var _pico_socket_recvfrom_extended = Module["_pico_socket_recvfrom_extended"] = function() {  return Module["asm"]["_pico_socket_recvfrom_extended"].apply(null, arguments) };
var _pico_socket_sendto = Module["_pico_socket_sendto"] = function() {  return Module["asm"]["_pico_socket_sendto"].apply(null, arguments) };
var _pico_socket_sendto_dest_check = Module["_pico_socket_sendto_dest_check"] = function() {  return Module["asm"]["_pico_socket_sendto_dest_check"].apply(null, arguments) };
var _pico_socket_sendto_destination = Module["_pico_socket_sendto_destination"] = function() {  return Module["asm"]["_pico_socket_sendto_destination"].apply(null, arguments) };
var _pico_socket_sendto_destination_ipv4 = Module["_pico_socket_sendto_destination_ipv4"] = function() {  return Module["asm"]["_pico_socket_sendto_destination_ipv4"].apply(null, arguments) };
var _pico_socket_sendto_destination_ipv6 = Module["_pico_socket_sendto_destination_ipv6"] = function() {  return Module["asm"]["_pico_socket_sendto_destination_ipv6"].apply(null, arguments) };
var _pico_socket_sendto_extended = Module["_pico_socket_sendto_extended"] = function() {  return Module["asm"]["_pico_socket_sendto_extended"].apply(null, arguments) };
var _pico_socket_sendto_get_ip4_src = Module["_pico_socket_sendto_get_ip4_src"] = function() {  return Module["asm"]["_pico_socket_sendto_get_ip4_src"].apply(null, arguments) };
var _pico_socket_sendto_get_ip6_src = Module["_pico_socket_sendto_get_ip6_src"] = function() {  return Module["asm"]["_pico_socket_sendto_get_ip6_src"].apply(null, arguments) };
var _pico_socket_sendto_get_src = Module["_pico_socket_sendto_get_src"] = function() {  return Module["asm"]["_pico_socket_sendto_get_src"].apply(null, arguments) };
var _pico_socket_sendto_initial_checks = Module["_pico_socket_sendto_initial_checks"] = function() {  return Module["asm"]["_pico_socket_sendto_initial_checks"].apply(null, arguments) };
var _pico_socket_sendto_set_dport = Module["_pico_socket_sendto_set_dport"] = function() {  return Module["asm"]["_pico_socket_sendto_set_dport"].apply(null, arguments) };
var _pico_socket_sendto_set_localport = Module["_pico_socket_sendto_set_localport"] = function() {  return Module["asm"]["_pico_socket_sendto_set_localport"].apply(null, arguments) };
var _pico_socket_sendto_transport_offset = Module["_pico_socket_sendto_transport_offset"] = function() {  return Module["asm"]["_pico_socket_sendto_transport_offset"].apply(null, arguments) };
var _pico_socket_set_family = Module["_pico_socket_set_family"] = function() {  return Module["asm"]["_pico_socket_set_family"].apply(null, arguments) };
var _pico_socket_set_info = Module["_pico_socket_set_info"] = function() {  return Module["asm"]["_pico_socket_set_info"].apply(null, arguments) };
var _pico_socket_shutdown = Module["_pico_socket_shutdown"] = function() {  return Module["asm"]["_pico_socket_shutdown"].apply(null, arguments) };
var _pico_socket_tcp_cleanup = Module["_pico_socket_tcp_cleanup"] = function() {  return Module["asm"]["_pico_socket_tcp_cleanup"].apply(null, arguments) };
var _pico_socket_tcp_delete = Module["_pico_socket_tcp_delete"] = function() {  return Module["asm"]["_pico_socket_tcp_delete"].apply(null, arguments) };
var _pico_socket_tcp_deliver = Module["_pico_socket_tcp_deliver"] = function() {  return Module["asm"]["_pico_socket_tcp_deliver"].apply(null, arguments) };
var _pico_socket_tcp_open = Module["_pico_socket_tcp_open"] = function() {  return Module["asm"]["_pico_socket_tcp_open"].apply(null, arguments) };
var _pico_socket_tcp_read = Module["_pico_socket_tcp_read"] = function() {  return Module["asm"]["_pico_socket_tcp_read"].apply(null, arguments) };
var _pico_socket_transport_deliver = Module["_pico_socket_transport_deliver"] = function() {  return Module["asm"]["_pico_socket_transport_deliver"].apply(null, arguments) };
var _pico_socket_transport_open = Module["_pico_socket_transport_open"] = function() {  return Module["asm"]["_pico_socket_transport_open"].apply(null, arguments) };
var _pico_socket_transport_read = Module["_pico_socket_transport_read"] = function() {  return Module["asm"]["_pico_socket_transport_read"].apply(null, arguments) };
var _pico_socket_udp_deliver = Module["_pico_socket_udp_deliver"] = function() {  return Module["asm"]["_pico_socket_udp_deliver"].apply(null, arguments) };
var _pico_socket_udp_deliver_ipv4 = Module["_pico_socket_udp_deliver_ipv4"] = function() {  return Module["asm"]["_pico_socket_udp_deliver_ipv4"].apply(null, arguments) };
var _pico_socket_udp_deliver_ipv4_mcast = Module["_pico_socket_udp_deliver_ipv4_mcast"] = function() {  return Module["asm"]["_pico_socket_udp_deliver_ipv4_mcast"].apply(null, arguments) };
var _pico_socket_udp_deliver_ipv4_mcast_initial_checks = Module["_pico_socket_udp_deliver_ipv4_mcast_initial_checks"] = function() {  return Module["asm"]["_pico_socket_udp_deliver_ipv4_mcast_initial_checks"].apply(null, arguments) };
var _pico_socket_udp_deliver_ipv4_unicast = Module["_pico_socket_udp_deliver_ipv4_unicast"] = function() {  return Module["asm"]["_pico_socket_udp_deliver_ipv4_unicast"].apply(null, arguments) };
var _pico_socket_udp_deliver_ipv6 = Module["_pico_socket_udp_deliver_ipv6"] = function() {  return Module["asm"]["_pico_socket_udp_deliver_ipv6"].apply(null, arguments) };
var _pico_socket_udp_deliver_ipv6_mcast = Module["_pico_socket_udp_deliver_ipv6_mcast"] = function() {  return Module["asm"]["_pico_socket_udp_deliver_ipv6_mcast"].apply(null, arguments) };
var _pico_socket_udp_open = Module["_pico_socket_udp_open"] = function() {  return Module["asm"]["_pico_socket_udp_open"].apply(null, arguments) };
var _pico_socket_update_tcp_state = Module["_pico_socket_update_tcp_state"] = function() {  return Module["asm"]["_pico_socket_update_tcp_state"].apply(null, arguments) };
var _pico_socket_write = Module["_pico_socket_write"] = function() {  return Module["asm"]["_pico_socket_write"].apply(null, arguments) };
var _pico_socket_write_attempt = Module["_pico_socket_write_attempt"] = function() {  return Module["asm"]["_pico_socket_write_attempt"].apply(null, arguments) };
var _pico_socket_write_check_state = Module["_pico_socket_write_check_state"] = function() {  return Module["asm"]["_pico_socket_write_check_state"].apply(null, arguments) };
var _pico_socket_xmit = Module["_pico_socket_xmit"] = function() {  return Module["asm"]["_pico_socket_xmit"].apply(null, arguments) };
var _pico_socket_xmit_avail_space = Module["_pico_socket_xmit_avail_space"] = function() {  return Module["asm"]["_pico_socket_xmit_avail_space"].apply(null, arguments) };
var _pico_socket_xmit_first_fragment_setup = Module["_pico_socket_xmit_first_fragment_setup"] = function() {  return Module["asm"]["_pico_socket_xmit_first_fragment_setup"].apply(null, arguments) };
var _pico_socket_xmit_fragments = Module["_pico_socket_xmit_fragments"] = function() {  return Module["asm"]["_pico_socket_xmit_fragments"].apply(null, arguments) };
var _pico_socket_xmit_next_fragment_setup = Module["_pico_socket_xmit_next_fragment_setup"] = function() {  return Module["asm"]["_pico_socket_xmit_next_fragment_setup"].apply(null, arguments) };
var _pico_socket_xmit_one = Module["_pico_socket_xmit_one"] = function() {  return Module["asm"]["_pico_socket_xmit_one"].apply(null, arguments) };
var _pico_sockets_loop = Module["_pico_sockets_loop"] = function() {  return Module["asm"]["_pico_sockets_loop"].apply(null, arguments) };
var _pico_sockets_loop_tcp = Module["_pico_sockets_loop_tcp"] = function() {  return Module["asm"]["_pico_sockets_loop_tcp"].apply(null, arguments) };
var _pico_sockets_loop_udp = Module["_pico_sockets_loop_udp"] = function() {  return Module["asm"]["_pico_sockets_loop_udp"].apply(null, arguments) };
var _pico_source_is_local = Module["_pico_source_is_local"] = function() {  return Module["asm"]["_pico_source_is_local"].apply(null, arguments) };
var _pico_stack_init = Module["_pico_stack_init"] = function() {  return Module["asm"]["_pico_stack_init"].apply(null, arguments) };
var _pico_stack_recv = Module["_pico_stack_recv"] = function() {  return Module["asm"]["_pico_stack_recv"].apply(null, arguments) };
var _pico_stack_recv_new_frame = Module["_pico_stack_recv_new_frame"] = function() {  return Module["asm"]["_pico_stack_recv_new_frame"].apply(null, arguments) };
var _pico_stack_recv_zerocopy = Module["_pico_stack_recv_zerocopy"] = function() {  return Module["asm"]["_pico_stack_recv_zerocopy"].apply(null, arguments) };
var _pico_stack_tick = Module["_pico_stack_tick"] = function() {  return Module["asm"]["_pico_stack_tick"].apply(null, arguments) };
var _pico_store_network_origin = Module["_pico_store_network_origin"] = function() {  return Module["asm"]["_pico_store_network_origin"].apply(null, arguments) };
var _pico_string_check_null_args = Module["_pico_string_check_null_args"] = function() {  return Module["asm"]["_pico_string_check_null_args"].apply(null, arguments) };
var _pico_string_to_ipv4 = Module["_pico_string_to_ipv4"] = function() {  return Module["asm"]["_pico_string_to_ipv4"].apply(null, arguments) };
var _pico_string_to_ipv6 = Module["_pico_string_to_ipv6"] = function() {  return Module["asm"]["_pico_string_to_ipv6"].apply(null, arguments) };
var _pico_tcp_check_listen_close = Module["_pico_tcp_check_listen_close"] = function() {  return Module["asm"]["_pico_tcp_check_listen_close"].apply(null, arguments) };
var _pico_tcp_checksum = Module["_pico_tcp_checksum"] = function() {  return Module["asm"]["_pico_tcp_checksum"].apply(null, arguments) };
var _pico_tcp_checksum_ipv4 = Module["_pico_tcp_checksum_ipv4"] = function() {  return Module["asm"]["_pico_tcp_checksum_ipv4"].apply(null, arguments) };
var _pico_tcp_checksum_ipv6 = Module["_pico_tcp_checksum_ipv6"] = function() {  return Module["asm"]["_pico_tcp_checksum_ipv6"].apply(null, arguments) };
var _pico_tcp_cleanup_queues = Module["_pico_tcp_cleanup_queues"] = function() {  return Module["asm"]["_pico_tcp_cleanup_queues"].apply(null, arguments) };
var _pico_tcp_flags_update = Module["_pico_tcp_flags_update"] = function() {  return Module["asm"]["_pico_tcp_flags_update"].apply(null, arguments) };
var _pico_tcp_get_socket_mss = Module["_pico_tcp_get_socket_mss"] = function() {  return Module["asm"]["_pico_tcp_get_socket_mss"].apply(null, arguments) };
var _pico_tcp_initconn = Module["_pico_tcp_initconn"] = function() {  return Module["asm"]["_pico_tcp_initconn"].apply(null, arguments) };
var _pico_tcp_input = Module["_pico_tcp_input"] = function() {  return Module["asm"]["_pico_tcp_input"].apply(null, arguments) };
var _pico_tcp_keepalive = Module["_pico_tcp_keepalive"] = function() {  return Module["asm"]["_pico_tcp_keepalive"].apply(null, arguments) };
var _pico_tcp_notify_closing = Module["_pico_tcp_notify_closing"] = function() {  return Module["asm"]["_pico_tcp_notify_closing"].apply(null, arguments) };
var _pico_tcp_open = Module["_pico_tcp_open"] = function() {  return Module["asm"]["_pico_tcp_open"].apply(null, arguments) };
var _pico_tcp_output = Module["_pico_tcp_output"] = function() {  return Module["asm"]["_pico_tcp_output"].apply(null, arguments) };
var _pico_tcp_overhead = Module["_pico_tcp_overhead"] = function() {  return Module["asm"]["_pico_tcp_overhead"].apply(null, arguments) };
var _pico_tcp_process_out = Module["_pico_tcp_process_out"] = function() {  return Module["asm"]["_pico_tcp_process_out"].apply(null, arguments) };
var _pico_tcp_push = Module["_pico_tcp_push"] = function() {  return Module["asm"]["_pico_tcp_push"].apply(null, arguments) };
var _pico_tcp_push_nagle_enqueue = Module["_pico_tcp_push_nagle_enqueue"] = function() {  return Module["asm"]["_pico_tcp_push_nagle_enqueue"].apply(null, arguments) };
var _pico_tcp_push_nagle_hold = Module["_pico_tcp_push_nagle_hold"] = function() {  return Module["asm"]["_pico_tcp_push_nagle_hold"].apply(null, arguments) };
var _pico_tcp_push_nagle_on = Module["_pico_tcp_push_nagle_on"] = function() {  return Module["asm"]["_pico_tcp_push_nagle_on"].apply(null, arguments) };
var _pico_tcp_queue_in_is_empty = Module["_pico_tcp_queue_in_is_empty"] = function() {  return Module["asm"]["_pico_tcp_queue_in_is_empty"].apply(null, arguments) };
var _pico_tcp_read = Module["_pico_tcp_read"] = function() {  return Module["asm"]["_pico_tcp_read"].apply(null, arguments) };
var _pico_tcp_reply_rst = Module["_pico_tcp_reply_rst"] = function() {  return Module["asm"]["_pico_tcp_reply_rst"].apply(null, arguments) };
var _pico_timer_add = Module["_pico_timer_add"] = function() {  return Module["asm"]["_pico_timer_add"].apply(null, arguments) };
var _pico_timer_cancel = Module["_pico_timer_cancel"] = function() {  return Module["asm"]["_pico_timer_cancel"].apply(null, arguments) };
var _pico_timer_create = Module["_pico_timer_create"] = function() {  return Module["asm"]["_pico_timer_create"].apply(null, arguments) };
var _pico_timer_ref_add = Module["_pico_timer_ref_add"] = function() {  return Module["asm"]["_pico_timer_ref_add"].apply(null, arguments) };
var _pico_transport_crc_check = Module["_pico_transport_crc_check"] = function() {  return Module["asm"]["_pico_transport_crc_check"].apply(null, arguments) };
var _pico_transport_error = Module["_pico_transport_error"] = function() {  return Module["asm"]["_pico_transport_error"].apply(null, arguments) };
var _pico_transport_error_set_picoerr = Module["_pico_transport_error_set_picoerr"] = function() {  return Module["asm"]["_pico_transport_error_set_picoerr"].apply(null, arguments) };
var _pico_transport_process_in = Module["_pico_transport_process_in"] = function() {  return Module["asm"]["_pico_transport_process_in"].apply(null, arguments) };
var _pico_transport_receive = Module["_pico_transport_receive"] = function() {  return Module["asm"]["_pico_transport_receive"].apply(null, arguments) };
var _pico_tree_delete = Module["_pico_tree_delete"] = function() {  return Module["asm"]["_pico_tree_delete"].apply(null, arguments) };
var _pico_tree_delete_check_switch = Module["_pico_tree_delete_check_switch"] = function() {  return Module["asm"]["_pico_tree_delete_check_switch"].apply(null, arguments) };
var _pico_tree_delete_implementation = Module["_pico_tree_delete_implementation"] = function() {  return Module["asm"]["_pico_tree_delete_implementation"].apply(null, arguments) };
var _pico_tree_delete_node = Module["_pico_tree_delete_node"] = function() {  return Module["asm"]["_pico_tree_delete_node"].apply(null, arguments) };
var _pico_tree_empty = Module["_pico_tree_empty"] = function() {  return Module["asm"]["_pico_tree_empty"].apply(null, arguments) };
var _pico_tree_findKey = Module["_pico_tree_findKey"] = function() {  return Module["asm"]["_pico_tree_findKey"].apply(null, arguments) };
var _pico_tree_findNode = Module["_pico_tree_findNode"] = function() {  return Module["asm"]["_pico_tree_findNode"].apply(null, arguments) };
var _pico_tree_first = Module["_pico_tree_first"] = function() {  return Module["asm"]["_pico_tree_first"].apply(null, arguments) };
var _pico_tree_firstNode = Module["_pico_tree_firstNode"] = function() {  return Module["asm"]["_pico_tree_firstNode"].apply(null, arguments) };
var _pico_tree_insert = Module["_pico_tree_insert"] = function() {  return Module["asm"]["_pico_tree_insert"].apply(null, arguments) };
var _pico_tree_insert_implementation = Module["_pico_tree_insert_implementation"] = function() {  return Module["asm"]["_pico_tree_insert_implementation"].apply(null, arguments) };
var _pico_tree_insert_node = Module["_pico_tree_insert_node"] = function() {  return Module["asm"]["_pico_tree_insert_node"].apply(null, arguments) };
var _pico_tree_lastNode = Module["_pico_tree_lastNode"] = function() {  return Module["asm"]["_pico_tree_lastNode"].apply(null, arguments) };
var _pico_tree_next = Module["_pico_tree_next"] = function() {  return Module["asm"]["_pico_tree_next"].apply(null, arguments) };
var _pico_tree_prev = Module["_pico_tree_prev"] = function() {  return Module["asm"]["_pico_tree_prev"].apply(null, arguments) };
var _pico_udp_checksum_ipv4 = Module["_pico_udp_checksum_ipv4"] = function() {  return Module["asm"]["_pico_udp_checksum_ipv4"].apply(null, arguments) };
var _pico_udp_checksum_ipv6 = Module["_pico_udp_checksum_ipv6"] = function() {  return Module["asm"]["_pico_udp_checksum_ipv6"].apply(null, arguments) };
var _pico_udp_get_mc_ttl = Module["_pico_udp_get_mc_ttl"] = function() {  return Module["asm"]["_pico_udp_get_mc_ttl"].apply(null, arguments) };
var _pico_udp_get_msginfo = Module["_pico_udp_get_msginfo"] = function() {  return Module["asm"]["_pico_udp_get_msginfo"].apply(null, arguments) };
var _pico_udp_open = Module["_pico_udp_open"] = function() {  return Module["asm"]["_pico_udp_open"].apply(null, arguments) };
var _pico_udp_process_out = Module["_pico_udp_process_out"] = function() {  return Module["asm"]["_pico_udp_process_out"].apply(null, arguments) };
var _pico_udp_push = Module["_pico_udp_push"] = function() {  return Module["asm"]["_pico_udp_push"].apply(null, arguments) };
var _pico_udp_recv = Module["_pico_udp_recv"] = function() {  return Module["asm"]["_pico_udp_recv"].apply(null, arguments) };
var _pico_xmit_frame_set_nofrag = Module["_pico_xmit_frame_set_nofrag"] = function() {  return Module["asm"]["_pico_xmit_frame_set_nofrag"].apply(null, arguments) };
var _ping_recv_reply = Module["_ping_recv_reply"] = function() {  return Module["asm"]["_ping_recv_reply"].apply(null, arguments) };
var _ping_timeout = Module["_ping_timeout"] = function() {  return Module["asm"]["_ping_timeout"].apply(null, arguments) };
var _pop_arg = Module["_pop_arg"] = function() {  return Module["asm"]["_pop_arg"].apply(null, arguments) };
var _printf = Module["_printf"] = function() {  return Module["asm"]["_printf"].apply(null, arguments) };
var _printf_core = Module["_printf_core"] = function() {  return Module["asm"]["_printf_core"].apply(null, arguments) };
var _proto_layer_rr_reset = Module["_proto_layer_rr_reset"] = function() {  return Module["asm"]["_proto_layer_rr_reset"].apply(null, arguments) };
var _proto_loop = Module["_proto_loop"] = function() {  return Module["asm"]["_proto_loop"].apply(null, arguments) };
var _proto_loop_in = Module["_proto_loop_in"] = function() {  return Module["asm"]["_proto_loop_in"].apply(null, arguments) };
var _proto_loop_out = Module["_proto_loop_out"] = function() {  return Module["asm"]["_proto_loop_out"].apply(null, arguments) };
var _pthread_self = Module["_pthread_self"] = function() {  return Module["asm"]["_pthread_self"].apply(null, arguments) };
var _puts = Module["_puts"] = function() {  return Module["asm"]["_puts"].apply(null, arguments) };
var _radv_process = Module["_radv_process"] = function() {  return Module["asm"]["_radv_process"].apply(null, arguments) };
var _release_all_until = Module["_release_all_until"] = function() {  return Module["asm"]["_release_all_until"].apply(null, arguments) };
var _release_until = Module["_release_until"] = function() {  return Module["asm"]["_release_until"].apply(null, arguments) };
var _rotateToLeft = Module["_rotateToLeft"] = function() {  return Module["asm"]["_rotateToLeft"].apply(null, arguments) };
var _rotateToRight = Module["_rotateToRight"] = function() {  return Module["asm"]["_rotateToRight"].apply(null, arguments) };
var _roundrobin_end = Module["_roundrobin_end"] = function() {  return Module["asm"]["_roundrobin_end"].apply(null, arguments) };
var _roundrobin_init = Module["_roundrobin_init"] = function() {  return Module["asm"]["_roundrobin_init"].apply(null, arguments) };
var _route_find = Module["_route_find"] = function() {  return Module["asm"]["_route_find"].apply(null, arguments) };
var _router_adv_validity_checks = Module["_router_adv_validity_checks"] = function() {  return Module["asm"]["_router_adv_validity_checks"].apply(null, arguments) };
var _rtimrtct = Module["_rtimrtct"] = function() {  return Module["asm"]["_rtimrtct"].apply(null, arguments) };
var _rto_set = Module["_rto_set"] = function() {  return Module["asm"]["_rto_set"].apply(null, arguments) };
var _sbrk = Module["_sbrk"] = function() {  return Module["asm"]["_sbrk"].apply(null, arguments) };
var _segment_compare = Module["_segment_compare"] = function() {  return Module["asm"]["_segment_compare"].apply(null, arguments) };
var _segment_from_frame = Module["_segment_from_frame"] = function() {  return Module["asm"]["_segment_from_frame"].apply(null, arguments) };
var _send_ping = Module["_send_ping"] = function() {  return Module["asm"]["_send_ping"].apply(null, arguments) };
var _short_be = Module["_short_be"] = function() {  return Module["asm"]["_short_be"].apply(null, arguments) };
var _short_be_1 = Module["_short_be_1"] = function() {  return Module["asm"]["_short_be_1"].apply(null, arguments) };
var _short_be_10 = Module["_short_be_10"] = function() {  return Module["asm"]["_short_be_10"].apply(null, arguments) };
var _short_be_158 = Module["_short_be_158"] = function() {  return Module["asm"]["_short_be_158"].apply(null, arguments) };
var _short_be_16 = Module["_short_be_16"] = function() {  return Module["asm"]["_short_be_16"].apply(null, arguments) };
var _short_be_208 = Module["_short_be_208"] = function() {  return Module["asm"]["_short_be_208"].apply(null, arguments) };
var _short_be_21 = Module["_short_be_21"] = function() {  return Module["asm"]["_short_be_21"].apply(null, arguments) };
var _short_be_232 = Module["_short_be_232"] = function() {  return Module["asm"]["_short_be_232"].apply(null, arguments) };
var _short_be_257 = Module["_short_be_257"] = function() {  return Module["asm"]["_short_be_257"].apply(null, arguments) };
var _short_be_263 = Module["_short_be_263"] = function() {  return Module["asm"]["_short_be_263"].apply(null, arguments) };
var _short_be_277 = Module["_short_be_277"] = function() {  return Module["asm"]["_short_be_277"].apply(null, arguments) };
var _short_be_351 = Module["_short_be_351"] = function() {  return Module["asm"]["_short_be_351"].apply(null, arguments) };
var _short_be_37 = Module["_short_be_37"] = function() {  return Module["asm"]["_short_be_37"].apply(null, arguments) };
var _short_be_66 = Module["_short_be_66"] = function() {  return Module["asm"]["_short_be_66"].apply(null, arguments) };
var _short_from = Module["_short_from"] = function() {  return Module["asm"]["_short_from"].apply(null, arguments) };
var _slifs = Module["_slifs"] = function() {  return Module["asm"]["_slifs"].apply(null, arguments) };
var _socket_clean_queues = Module["_socket_clean_queues"] = function() {  return Module["asm"]["_socket_clean_queues"].apply(null, arguments) };
var _socket_cmp = Module["_socket_cmp"] = function() {  return Module["asm"]["_socket_cmp"].apply(null, arguments) };
var _socket_cmp_addresses = Module["_socket_cmp_addresses"] = function() {  return Module["asm"]["_socket_cmp_addresses"].apply(null, arguments) };
var _socket_cmp_family = Module["_socket_cmp_family"] = function() {  return Module["asm"]["_socket_cmp_family"].apply(null, arguments) };
var _socket_cmp_ipv4 = Module["_socket_cmp_ipv4"] = function() {  return Module["asm"]["_socket_cmp_ipv4"].apply(null, arguments) };
var _socket_cmp_ipv6 = Module["_socket_cmp_ipv6"] = function() {  return Module["asm"]["_socket_cmp_ipv6"].apply(null, arguments) };
var _socket_cmp_remotehost = Module["_socket_cmp_remotehost"] = function() {  return Module["asm"]["_socket_cmp_remotehost"].apply(null, arguments) };
var _socket_garbage_collect = Module["_socket_garbage_collect"] = function() {  return Module["asm"]["_socket_garbage_collect"].apply(null, arguments) };
var _socket_tcp_deliver_ipv4 = Module["_socket_tcp_deliver_ipv4"] = function() {  return Module["asm"]["_socket_tcp_deliver_ipv4"].apply(null, arguments) };
var _socket_tcp_deliver_ipv6 = Module["_socket_tcp_deliver_ipv6"] = function() {  return Module["asm"]["_socket_tcp_deliver_ipv6"].apply(null, arguments) };
var _socket_tcp_do_deliver = Module["_socket_tcp_do_deliver"] = function() {  return Module["asm"]["_socket_tcp_do_deliver"].apply(null, arguments) };
var _sockport_cmp = Module["_sockport_cmp"] = function() {  return Module["asm"]["_sockport_cmp"].apply(null, arguments) };
var _srsf = Module["_srsf"] = function() {  return Module["asm"]["_srsf"].apply(null, arguments) };
var _srsfst = Module["_srsfst"] = function() {  return Module["asm"]["_srsfst"].apply(null, arguments) };
var _srst = Module["_srst"] = function() {  return Module["asm"]["_srst"].apply(null, arguments) };
var _st = Module["_st"] = function() {  return Module["asm"]["_st"].apply(null, arguments) };
var _stcl = Module["_stcl"] = function() {  return Module["asm"]["_stcl"].apply(null, arguments) };
var _strcmp = Module["_strcmp"] = function() {  return Module["asm"]["_strcmp"].apply(null, arguments) };
var _strerror = Module["_strerror"] = function() {  return Module["asm"]["_strerror"].apply(null, arguments) };
var _strlen = Module["_strlen"] = function() {  return Module["asm"]["_strlen"].apply(null, arguments) };
var _stslifs = Module["_stslifs"] = function() {  return Module["asm"]["_stslifs"].apply(null, arguments) };
var _swapc = Module["_swapc"] = function() {  return Module["asm"]["_swapc"].apply(null, arguments) };
var _switchNodes = Module["_switchNodes"] = function() {  return Module["asm"]["_switchNodes"].apply(null, arguments) };
var _tcp_ack = Module["_tcp_ack"] = function() {  return Module["asm"]["_tcp_ack"].apply(null, arguments) };
var _tcp_ack_advance_una = Module["_tcp_ack_advance_una"] = function() {  return Module["asm"]["_tcp_ack_advance_una"].apply(null, arguments) };
var _tcp_action_by_flags = Module["_tcp_action_by_flags"] = function() {  return Module["asm"]["_tcp_action_by_flags"].apply(null, arguments) };
var _tcp_action_call = Module["_tcp_action_call"] = function() {  return Module["asm"]["_tcp_action_call"].apply(null, arguments) };
var _tcp_add_header = Module["_tcp_add_header"] = function() {  return Module["asm"]["_tcp_add_header"].apply(null, arguments) };
var _tcp_add_options = Module["_tcp_add_options"] = function() {  return Module["asm"]["_tcp_add_options"].apply(null, arguments) };
var _tcp_add_options_frame = Module["_tcp_add_options_frame"] = function() {  return Module["asm"]["_tcp_add_options_frame"].apply(null, arguments) };
var _tcp_add_sack_option = Module["_tcp_add_sack_option"] = function() {  return Module["asm"]["_tcp_add_sack_option"].apply(null, arguments) };
var _tcp_attempt_closewait = Module["_tcp_attempt_closewait"] = function() {  return Module["asm"]["_tcp_attempt_closewait"].apply(null, arguments) };
var _tcp_closeconn = Module["_tcp_closeconn"] = function() {  return Module["asm"]["_tcp_closeconn"].apply(null, arguments) };
var _tcp_closewait = Module["_tcp_closewait"] = function() {  return Module["asm"]["_tcp_closewait"].apply(null, arguments) };
var _tcp_closing_ack = Module["_tcp_closing_ack"] = function() {  return Module["asm"]["_tcp_closing_ack"].apply(null, arguments) };
var _tcp_congestion_control = Module["_tcp_congestion_control"] = function() {  return Module["asm"]["_tcp_congestion_control"].apply(null, arguments) };
var _tcp_data_in = Module["_tcp_data_in"] = function() {  return Module["asm"]["_tcp_data_in"].apply(null, arguments) };
var _tcp_data_in_expected = Module["_tcp_data_in_expected"] = function() {  return Module["asm"]["_tcp_data_in_expected"].apply(null, arguments) };
var _tcp_data_in_high_segment = Module["_tcp_data_in_high_segment"] = function() {  return Module["asm"]["_tcp_data_in_high_segment"].apply(null, arguments) };
var _tcp_data_in_send_ack = Module["_tcp_data_in_send_ack"] = function() {  return Module["asm"]["_tcp_data_in_send_ack"].apply(null, arguments) };
var _tcp_deltcb = Module["_tcp_deltcb"] = function() {  return Module["asm"]["_tcp_deltcb"].apply(null, arguments) };
var _tcp_discard_all_segments = Module["_tcp_discard_all_segments"] = function() {  return Module["asm"]["_tcp_discard_all_segments"].apply(null, arguments) };
var _tcp_do_send_rst = Module["_tcp_do_send_rst"] = function() {  return Module["asm"]["_tcp_do_send_rst"].apply(null, arguments) };
var _tcp_fill_rst_header = Module["_tcp_fill_rst_header"] = function() {  return Module["asm"]["_tcp_fill_rst_header"].apply(null, arguments) };
var _tcp_fill_rst_payload = Module["_tcp_fill_rst_payload"] = function() {  return Module["asm"]["_tcp_fill_rst_payload"].apply(null, arguments) };
var _tcp_finack = Module["_tcp_finack"] = function() {  return Module["asm"]["_tcp_finack"].apply(null, arguments) };
var _tcp_finwaitack = Module["_tcp_finwaitack"] = function() {  return Module["asm"]["_tcp_finwaitack"].apply(null, arguments) };
var _tcp_finwaitfin = Module["_tcp_finwaitfin"] = function() {  return Module["asm"]["_tcp_finwaitfin"].apply(null, arguments) };
var _tcp_first_ack = Module["_tcp_first_ack"] = function() {  return Module["asm"]["_tcp_first_ack"].apply(null, arguments) };
var _tcp_first_timeout = Module["_tcp_first_timeout"] = function() {  return Module["asm"]["_tcp_first_timeout"].apply(null, arguments) };
var _tcp_force_closed = Module["_tcp_force_closed"] = function() {  return Module["asm"]["_tcp_force_closed"].apply(null, arguments) };
var _tcp_halfopencon = Module["_tcp_halfopencon"] = function() {  return Module["asm"]["_tcp_halfopencon"].apply(null, arguments) };
var _tcp_is_allowed_to_send = Module["_tcp_is_allowed_to_send"] = function() {  return Module["asm"]["_tcp_is_allowed_to_send"].apply(null, arguments) };
var _tcp_lastackwait = Module["_tcp_lastackwait"] = function() {  return Module["asm"]["_tcp_lastackwait"].apply(null, arguments) };
var _tcp_linger = Module["_tcp_linger"] = function() {  return Module["asm"]["_tcp_linger"].apply(null, arguments) };
var _tcp_next_zerowindow_probe = Module["_tcp_next_zerowindow_probe"] = function() {  return Module["asm"]["_tcp_next_zerowindow_probe"].apply(null, arguments) };
var _tcp_nosync_rst = Module["_tcp_nosync_rst"] = function() {  return Module["asm"]["_tcp_nosync_rst"].apply(null, arguments) };
var _tcp_options_size = Module["_tcp_options_size"] = function() {  return Module["asm"]["_tcp_options_size"].apply(null, arguments) };
var _tcp_options_size_frame = Module["_tcp_options_size_frame"] = function() {  return Module["asm"]["_tcp_options_size_frame"].apply(null, arguments) };
var _tcp_parse_option_mss = Module["_tcp_parse_option_mss"] = function() {  return Module["asm"]["_tcp_parse_option_mss"].apply(null, arguments) };
var _tcp_parse_option_sack_ok = Module["_tcp_parse_option_sack_ok"] = function() {  return Module["asm"]["_tcp_parse_option_sack_ok"].apply(null, arguments) };
var _tcp_parse_option_timestamp = Module["_tcp_parse_option_timestamp"] = function() {  return Module["asm"]["_tcp_parse_option_timestamp"].apply(null, arguments) };
var _tcp_parse_option_ws = Module["_tcp_parse_option_ws"] = function() {  return Module["asm"]["_tcp_parse_option_ws"].apply(null, arguments) };
var _tcp_parse_options = Module["_tcp_parse_options"] = function() {  return Module["asm"]["_tcp_parse_options"].apply(null, arguments) };
var _tcp_process_sack = Module["_tcp_process_sack"] = function() {  return Module["asm"]["_tcp_process_sack"].apply(null, arguments) };
var _tcp_rcv_sack = Module["_tcp_rcv_sack"] = function() {  return Module["asm"]["_tcp_rcv_sack"].apply(null, arguments) };
var _tcp_rcvfin = Module["_tcp_rcvfin"] = function() {  return Module["asm"]["_tcp_rcvfin"].apply(null, arguments) };
var _tcp_read_check_segment_done = Module["_tcp_read_check_segment_done"] = function() {  return Module["asm"]["_tcp_read_check_segment_done"].apply(null, arguments) };
var _tcp_read_finish = Module["_tcp_read_finish"] = function() {  return Module["asm"]["_tcp_read_finish"].apply(null, arguments) };
var _tcp_read_in_frame_len = Module["_tcp_read_in_frame_len"] = function() {  return Module["asm"]["_tcp_read_in_frame_len"].apply(null, arguments) };
var _tcp_retrans = Module["_tcp_retrans"] = function() {  return Module["asm"]["_tcp_retrans"].apply(null, arguments) };
var _tcp_retrans_timeout = Module["_tcp_retrans_timeout"] = function() {  return Module["asm"]["_tcp_retrans_timeout"].apply(null, arguments) };
var _tcp_retrans_timeout_check_queue = Module["_tcp_retrans_timeout_check_queue"] = function() {  return Module["asm"]["_tcp_retrans_timeout_check_queue"].apply(null, arguments) };
var _tcp_rst = Module["_tcp_rst"] = function() {  return Module["asm"]["_tcp_rst"].apply(null, arguments) };
var _tcp_rto_xmit = Module["_tcp_rto_xmit"] = function() {  return Module["asm"]["_tcp_rto_xmit"].apply(null, arguments) };
var _tcp_rtt = Module["_tcp_rtt"] = function() {  return Module["asm"]["_tcp_rtt"].apply(null, arguments) };
var _tcp_sack_marker = Module["_tcp_sack_marker"] = function() {  return Module["asm"]["_tcp_sack_marker"].apply(null, arguments) };
var _tcp_sack_prepare = Module["_tcp_sack_prepare"] = function() {  return Module["asm"]["_tcp_sack_prepare"].apply(null, arguments) };
var _tcp_send = Module["_tcp_send"] = function() {  return Module["asm"]["_tcp_send"].apply(null, arguments) };
var _tcp_send_ack = Module["_tcp_send_ack"] = function() {  return Module["asm"]["_tcp_send_ack"].apply(null, arguments) };
var _tcp_send_add_tcpflags = Module["_tcp_send_add_tcpflags"] = function() {  return Module["asm"]["_tcp_send_add_tcpflags"].apply(null, arguments) };
var _tcp_send_empty = Module["_tcp_send_empty"] = function() {  return Module["asm"]["_tcp_send_empty"].apply(null, arguments) };
var _tcp_send_fin = Module["_tcp_send_fin"] = function() {  return Module["asm"]["_tcp_send_fin"].apply(null, arguments) };
var _tcp_send_probe = Module["_tcp_send_probe"] = function() {  return Module["asm"]["_tcp_send_probe"].apply(null, arguments) };
var _tcp_send_rst = Module["_tcp_send_rst"] = function() {  return Module["asm"]["_tcp_send_rst"].apply(null, arguments) };
var _tcp_send_synack = Module["_tcp_send_synack"] = function() {  return Module["asm"]["_tcp_send_synack"].apply(null, arguments) };
var _tcp_send_try_enqueue = Module["_tcp_send_try_enqueue"] = function() {  return Module["asm"]["_tcp_send_try_enqueue"].apply(null, arguments) };
var _tcp_set_init_point = Module["_tcp_set_init_point"] = function() {  return Module["asm"]["_tcp_set_init_point"].apply(null, arguments) };
var _tcp_set_space = Module["_tcp_set_space"] = function() {  return Module["asm"]["_tcp_set_space"].apply(null, arguments) };
var _tcp_set_space_check_winupdate = Module["_tcp_set_space_check_winupdate"] = function() {  return Module["asm"]["_tcp_set_space_check_winupdate"].apply(null, arguments) };
var _tcp_split_segment = Module["_tcp_split_segment"] = function() {  return Module["asm"]["_tcp_split_segment"].apply(null, arguments) };
var _tcp_syn = Module["_tcp_syn"] = function() {  return Module["asm"]["_tcp_syn"].apply(null, arguments) };
var _tcp_synack = Module["_tcp_synack"] = function() {  return Module["asm"]["_tcp_synack"].apply(null, arguments) };
var _tcp_synrecv_syn = Module["_tcp_synrecv_syn"] = function() {  return Module["asm"]["_tcp_synrecv_syn"].apply(null, arguments) };
var _tcp_wakeup_pending = Module["_tcp_wakeup_pending"] = function() {  return Module["asm"]["_tcp_wakeup_pending"].apply(null, arguments) };
var _tcpopt_len_check = Module["_tcpopt_len_check"] = function() {  return Module["asm"]["_tcpopt_len_check"].apply(null, arguments) };
var _time_diff = Module["_time_diff"] = function() {  return Module["asm"]["_time_diff"].apply(null, arguments) };
var _transport_flags_update = Module["_transport_flags_update"] = function() {  return Module["asm"]["_transport_flags_update"].apply(null, arguments) };
var _update_max_arp_reqs = Module["_update_max_arp_reqs"] = function() {  return Module["asm"]["_update_max_arp_reqs"].apply(null, arguments) };
var _vfprintf = Module["_vfprintf"] = function() {  return Module["asm"]["_vfprintf"].apply(null, arguments) };
var _wcrtomb = Module["_wcrtomb"] = function() {  return Module["asm"]["_wcrtomb"].apply(null, arguments) };
var _wctomb = Module["_wctomb"] = function() {  return Module["asm"]["_wctomb"].apply(null, arguments) };
var establishStackSpace = Module["establishStackSpace"] = function() {  return Module["asm"]["establishStackSpace"].apply(null, arguments) };
var runPostSets = Module["runPostSets"] = function() {  return Module["asm"]["runPostSets"].apply(null, arguments) };
var setThrew = Module["setThrew"] = function() {  return Module["asm"]["setThrew"].apply(null, arguments) };
var stackAlloc = Module["stackAlloc"] = function() {  return Module["asm"]["stackAlloc"].apply(null, arguments) };
var stackRestore = Module["stackRestore"] = function() {  return Module["asm"]["stackRestore"].apply(null, arguments) };
var stackSave = Module["stackSave"] = function() {  return Module["asm"]["stackSave"].apply(null, arguments) };
var dynCall_ii = Module["dynCall_ii"] = function() {  return Module["asm"]["dynCall_ii"].apply(null, arguments) };
var dynCall_iii = Module["dynCall_iii"] = function() {  return Module["asm"]["dynCall_iii"].apply(null, arguments) };
var dynCall_iiii = Module["dynCall_iiii"] = function() {  return Module["asm"]["dynCall_iiii"].apply(null, arguments) };
var dynCall_vi = Module["dynCall_vi"] = function() {  return Module["asm"]["dynCall_vi"].apply(null, arguments) };
var dynCall_vii = Module["dynCall_vii"] = function() {  return Module["asm"]["dynCall_vii"].apply(null, arguments) };
var dynCall_viiii = Module["dynCall_viiii"] = function() {  return Module["asm"]["dynCall_viiii"].apply(null, arguments) };
var dynCall_vji = Module["dynCall_vji"] = function() {  return Module["asm"]["dynCall_vji"].apply(null, arguments) };
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;



Module["ccall"] = ccall;
Module["cwrap"] = cwrap;


















































Module["addFunction"] = addFunction;
Module["removeFunction"] = removeFunction;


















// Modularize mode returns a function, which can be called to
// create instances. The instances provide a then() method,
// must like a Promise, that receives a callback. The callback
// is called when the module is ready to run, with the module
// as a parameter. (Like a Promise, it also returns the module
// so you can use the output of .then(..)).
Module['then'] = function(func) {
  // We may already be ready to run code at this time. if
  // so, just queue a call to the callback.
  if (Module['calledRun']) {
    func(Module);
  } else {
    // we are not ready to call then() yet. we must call it
    // at the same time we would call onRuntimeInitialized.
    var old = Module['onRuntimeInitialized'];
    Module['onRuntimeInitialized'] = function() {
      if (old) old();
      func(Module);
    };
  }
  return Module;
};

/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  var argv = stackAlloc((argc + 1) * 4);
  HEAP32[argv >> 2] = allocateUTF8OnStack(Module['thisProgram']);
  for (var i = 1; i < argc; i++) {
    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
  }
  HEAP32[(argv >> 2) + argc] = 0;


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
      exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      err('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = run;


function exit(status, implicit) {

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  throw 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';
}
Module['abort'] = abort;

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}

  Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}





  return Module;
}
);
})();
if (typeof exports === 'object' && typeof module === 'object')
    module.exports = Module;
  else if (typeof define === 'function' && define['amd'])
    define([], function() { return Module; });
  else if (typeof exports === 'object')
    exports["Module"] = Module;
  // HACK: Work around <https://github.com/kripken/emscripten/issues/5820>.
const _Module = new Proxy(Module, {
    apply(target, thisArg, args) {
        return new Promise(resolve => Reflect.apply(target, thisArg, args)
            .then(m => {
                delete m.then;
                resolve(m);
            }));
    }
});
export { _Module as default };

class SyncWritableReadableStream extends ReadableStream {
    constructor(...args) {
        let controller;
        super({
            start: _controller => controller = _controller,
        }, ...args);
        this.controller = controller;
    }
    _write(...args) {
        this.controller.enqueue(...args);
    }
    _close() {
        if (this.isClosed) return;
        this.controller.close();
        this.isClosed = true;
    }
}

const EOF = Symbol("EOF");

class SyncSink {
    constructor({size = () => 1, highWaterMark = 1} = {}) {
        this._queue = [];
        this._queueTotalSize = 0;
        this._strategyHWM = highWaterMark;
        this._strategySizeAlgorithm = size;
        this._ready = Promise.resolve();
        this._readyResolve = () => {};
        this._readyReject = () => {};
        this._isAborted = false;
    }
    write(chunk, controller) {
        if (chunk === EOF) return;
        const size = this._strategySizeAlgorithm(chunk);
        this._queueTotalSize += size;
        this._queue.push([chunk, size]);
        if (this._queueTotalSize < this._strategyHWM) return;
        this._ready = new Promise((resolve, reject) => {
            this._readyResolve = resolve;
            this._readyReject = reject;
        });
        if (this._onData) {
            this._onData();
            this._onData = null;
        }
        return this._ready;
    }
    close() {
        this._queue.push([EOF, 0]);
    }
    abort(reason) {
        this._isAborted = reason;
        this._queue = [];
    }
    read() {
        if (this._queue.length === 0) return [];
        const [chunk, size] = this._queue.shift();
        this._queueTotalSize -= size;
        if (this._queueTotalSize < 0) this._queueTotalSize = 0;
        if (this._queueTotalSize < this._strategyHWM) this._readyResolve();
        return [chunk];
    }
}

class SyncReadableWritableStream extends WritableStream {
    constructor(sinkArgs, ...args) {
        const sink = new SyncSink(sinkArgs);
        super(sink, ...args);
        this._sink = sink;
    }
    _read() {
        return this._sink.read()[0];
    }
    get EOF() {
        return EOF;
    }
    get isAborted() {
        return this._sink.isAborted;
    }
    get ready() {
        return this._sink._ready;
    }
    set _onData(val) {
        this._sink._onData = val;
    }
    *[Symbol.iterator]() {
        for (let v; v = this._sink.read();) {
            if (v.length === 0) break;
            yield v[0];
        }
    }
}

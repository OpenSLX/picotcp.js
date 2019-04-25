Module["locateFile"] = function(path) {
  let url = import.meta.url;
  url = url.replace(/^file:\/\//, "");
  // HACK: Special case for Node.js on Windows
  // (`url` will look like "file:///C:/...").
  // Would properly use `require("url").fileURLToPath(url)`
  // on all Node.js platforms, which is not avaible
  // on older Node.js versions, though.
  try {
    if (process.platform === "win32") url = url.replace(/^\/+/, "");
  } catch {}
  return url + "/../" + path;
};
Module["noExitRuntime"] = true;

// HACK: Work around https://github.com/emscripten-core/emscripten/issues/7855
// for Node.js: turn process.on("uncaughtException" | "unhandledRejection", ...)
// into no-op.
let process;
try {
  process = new Proxy(global.process, {
    get(target, key, receiver) {
      const ret = Reflect.get(target, key, receiver);
      if (key !== "on") return ret;
      return new Proxy(ret, {
        apply(target, thisArg, args) {
          if (args[0] !== "uncaughtException"
            && args[0] !== "unhandledRejection") {
            return Reflect.apply(target, thisArg, args);
          }
        }
      });
    }
  });
} catch {}

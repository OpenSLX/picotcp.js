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

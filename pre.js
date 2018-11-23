Module["locateFile"] = function(path) {
  return import.meta.url + "/../" + path;
};
Module["noExitRuntime"] = true;

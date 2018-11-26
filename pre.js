Module["locateFile"] = function(path) {
  let url = import.meta.url;
  url = url.replace(/^file:\/\//, "");
  return url + "/../" + path;
};
Module["noExitRuntime"] = true;

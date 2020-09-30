var wind = null ,requestingWindow = null;
var fs = null;

function onWindowLoaded() {
  wind = this;
  if (fs) {
    this.onCreatedFileSystem(fs);
  } else {
    requestingWindow = wind;
  }
}

chrome.app.runtime.onLaunched.addListener(function () {
  chrome.app.window.create("index.html", {
//    singleton: true,
//    resizable: true,
//    frame: 'none',
    state: "fullscreen",
    id: "index",
    width: 800,
    height: 600
  }, function(newWindow) {
    if (newWindow.contentWindow != wind) {
      newWindow.contentWindow.onload = onWindowLoaded;
      newWindow.onClosed.addListener(function() {
        wind = null;
      });
    }
  });
});

chrome.syncFileSystem.requestFileSystem(function(syncFS) {
  fs = syncFS;
  if (requestingWindow) {
    requestingWindow.onCreatedFileSystem(fs);
  }
});

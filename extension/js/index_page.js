// this port is available as soon as popup is opened
var popupPort = chrome.runtime.connect({name: 'POPUPCHANNEL'});

// DOM element for appending log messages
var loggerList = document.getElementById('logger');

// Options which are shared with Background Page.
var appOptions = {
  toggleSwitchState: false,
  filterRequestUrl: '.*'
}

// long-lived connection to the background channel 
chrome.runtime.onConnect.addListener(function(port){
  console.assert(port.name === 'BACKGROUNDCHANNEL');
  console.log("Connected to background");

  port.onMessage.addListener(function(msg) {
    if (msg.logcache) {
      showLogs(msg.logcache.items, loggerList); // msg is a array of log messages
    } else if (msg.options) {
      setOptions(msg.options);
    }
  });

});

// takes an array of log messages and appends in the container
// items is of Deque type
function showLogs(items, container) {
  container.innerHTML = ""; // clear it first
  for (var i = 0; i < items.length; i++) {
    var entry = document.createElement('li');
    var node = document.createElement('div');
    node.innerHTML = items[i];
    entry.appendChild(node);
    container.appendChild(entry);
  }
}

function setOptions(options) {
  if (options.isCaptureStateEnabled !== appOptions.toggleSwitchState) {
    toggleSwitch.checked = appOptions.toggleSwitchState = options.isCaptureStateEnabled;
    filterUrlInput.value = options.filterRequestUrl;
  }
};

var toggleSwitch = document.getElementById('postManSwitch');
var filterUrlInput = document.getElementById('filterRequest');

toggleSwitch.addEventListener('click', function() {
  appOptions.toggleSwitchState = !appOptions.toggleSwitchState;
  popupPort.postMessage({options: appOptions});
}, false);

filterUrlInput.addEventListener('input', function() {
  appOptions.filterRequestUrl = filterUrlInput.value;
  popupPort.postMessage({options: appOptions});
}, false);
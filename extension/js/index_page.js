// DOM elements in popup
var toggleSwitch = document.getElementById('postManSwitch');
var filterUrlInput = document.getElementById('filterRequest');
var deleteBtn = document.getElementById('delete-log');
var tickIcon = document.getElementById('tick-icon');

// this port is available as soon as popup is opened
var popupPort = chrome.runtime.connect({name: 'POPUPCHANNEL'});

// get the value from localStorage and sets it
toggleSwitch.checked = localStorage.getItem("toggleSwitchState") === "true";

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

function setTickIconVisibility(){
    var domain = filterUrlInput.value;
    if (domain.length && domain != ".*") {
        tickIcon.className = "show";
    } else {
        tickIcon.className = "hide";
    }
}

function setOptions(options) {
  if (options.isCaptureStateEnabled !== appOptions.toggleSwitchState) {
    toggleSwitch.checked = appOptions.toggleSwitchState = options.isCaptureStateEnabled;
    filterUrlInput.value = options.filterRequestUrl;
    console.log("setting localStorage value");
    localStorage.setItem('toggleSwitchState', toggleSwitch.checked);
  }
};

toggleSwitch.addEventListener('click', function() {
    appOptions.toggleSwitchState = !appOptions.toggleSwitchState;
    popupPort.postMessage({options: appOptions});
    localStorage.setItem('toggleSwitchState', appOptions.toggleSwitchState);
}, false);

filterUrlInput.addEventListener('input', function() {
    var domain = filterUrlInput.value;
    appOptions.filterRequestUrl = filterUrlInput.value;
    setTickIconVisibility();
    popupPort.postMessage({options: appOptions});
}, false);

deleteBtn.addEventListener('click', function() {
    loggerList.innerHTML = "";
    popupPort.postMessage({reset: "logCache"});
});


// DOM elements in popup
var toggleSwitch = document.getElementById('myonoffswitch');
var filterUrlInput = document.getElementById('filterRequest');
var filterUrlConfirm = document.getElementById('apply-filter');
var deleteBtn = document.getElementById('delete-log');
var tickIcon = document.getElementById('tick-icon');
var filteredRequests = document.getElementById('filtered-requests');
var isPostmanOpenMessage = document.getElementById('postman-not-open');
var isPostmanEnabledMessage = document.getElementById('postman-not-enabled');

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

var isPostmanOpen = true;
isPostmanOpenMessage.style.display = "none";

// long-lived connection to the background channel 
chrome.runtime.onConnect.addListener(function(port){
  console.assert(port.name === 'BACKGROUNDCHANNEL');
  console.log("Connected to background");

  port.onMessage.addListener(function(msg) {
    if (msg.logcache) {
      showLogs(msg.logcache.items, loggerList); // msg is a array of log messages
    } else if (msg.options) {
      setOptions(msg.options);

      console.log("Received message options", msg.options);
    }
    if(msg.isPostmanOpen===true) {
      isPostmanOpen = true;
    }
    else if(msg.isPostmanOpen === false) { 
      isPostmanOpen = false;
    }

    if(msg.isPostmanEnabledWarning === true) {
      isPostmanEnabledMessage.style.display = "block";
    }
    else if(msg.isPostmanEnabledWarning === false) {
      isPostmanEnabledMessage.style.display = "none";
    }
    setPostmanMessage();
  });

});


function setPostmanMessage() {
  if(isPostmanOpen) {
    isPostmanOpenMessage.style.display = "none";
  }
  else {
    isPostmanOpenMessage.style.display = "block";
  }
}

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

function setTickIconVisibility() {
    var domain = filterUrlInput.value;
    tickIcon.className = "show";

    setInterval(function() {
      tickIcon.className = "hide";
    }, 2000);    
}

function setOptions(options) {
  if (options.isCaptureStateEnabled) {
    filteredRequests.className = 'show';
  } 
  else {
    filteredRequests.className = 'hide';
  }
 
  toggleSwitch.checked = appOptions.toggleSwitchState = options.isCaptureStateEnabled;
  filterUrlInput.value = options.filterRequestUrl;        

  localStorage.setItem('toggleSwitchState', toggleSwitch.checked);  
};

toggleSwitch.addEventListener('click', function() {
    appOptions.toggleSwitchState = !appOptions.toggleSwitchState;
    popupPort.postMessage({options: appOptions});

    if (appOptions.toggleSwitchState) {
      filteredRequests.className = 'show';
    } 
    else {
      filteredRequests.className = 'hide';
    }

    localStorage.setItem('toggleSwitchState', appOptions.toggleSwitchState);
}, false);

var wait;


filterUrlConfirm.addEventListener('click', function() {
  var domain = filterUrlInput.value;
  appOptions.filterRequestUrl = filterUrlInput.value;
  setTickIconVisibility();
  popupPort.postMessage({options: appOptions});      
});


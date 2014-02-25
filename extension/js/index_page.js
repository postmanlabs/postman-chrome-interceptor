// this port is available as soon as popup is opened
var popupPort = chrome.runtime.connect({name: 'POPUPCHANNEL'});

// DOM element for appending log messages
var loggerList = document.getElementById('logger');

// long-lived connection to the background channel 
chrome.runtime.onConnect.addListener(function(port){
  console.assert(port.name === 'BACKGROUNDCHANNEL');
  console.log("Connected to background");

  port.onMessage.addListener(function(msg) {
    showLogs(msg.items, loggerList); // msg is a array of log messages
  });
});

// takes an array of log messages and appends in the container
// items is of Deque type
function showLogs(items, container) {
  container.innerHTML = ""; // clear it first

  for (var i = 0; i < items.length; i++) {
    var entry = document.createElement('li');
    entry.appendChild(document.createTextNode(items[i]));
    container.appendChild(entry);
  }
}


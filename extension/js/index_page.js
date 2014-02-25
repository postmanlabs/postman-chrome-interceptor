// this port is available as soon as popup is opened
var popupPort = chrome.runtime.connect({name: 'POPUPCHANNEL'});

// DOM element for appending log messages
var loggerList = document.getElementById('logger');

// long-lived connection to the background channel 
chrome.runtime.onConnect.addListener(function(port){
  console.assert(port.name === 'BACKGROUNDCHANNEL');
  console.log("Connected to background");

  port.onMessage.addListener(function(msg) {
    logRequest(msg);
  });
});

// manipulates DOM to add log msgs
function logRequest(msg) {
  var entry = document.createElement('li');
  var textMsg = "[" + msg.method + "] " +  msg.url;
  entry.appendChild(document.createTextNode(textMsg));
  loggerList.appendChild(entry);
}

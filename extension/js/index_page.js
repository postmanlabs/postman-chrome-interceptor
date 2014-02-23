chrome.runtime.onConnect.addListener(function(port){
  console.assert(port.name == "requestLogger");
  port.onMessage.addListener(function(msg){
    console.log(msg);
  });
});

var blacklistedIds = ["none"];
var currentRequest;
var cookies;

// enum for postman message types
var postmanMessageTypes = {
  xhrError: "xhrError",
  xhrResponse: "xhrResponse",
  captureStatus: "captureStatus",
  capturedRequest: "capturedRequest"
};

// indicates status of popup connected
var popupConnected = false;

// placeholder for the background page port object for transferring log msgs
var BackgroundPort;

// object store to cache captured requests
var requestCache = {};

// storing last N (maxItems) log messages
var maxItems = 10;
var logCache = new Deque(maxItems);

var queue = [];

var toAddHeaders = false;

var background = this;

// Options which are shared with Extension Popup.
var appOptions = {
	isCaptureStateEnabled: false,
	filterRequestUrl: '.*'
}

var restrictedChromeHeaders = [
    "ACCEPT-CHARSET",
    "ACCEPT-ENCODING",
    "ACCESS-CONTROL-REQUEST-HEADERS",
    "ACCESS-CONTROL-REQUEST-METHOD",
    "CONTENT-LENGTHNECTION",
    "CONTENT-LENGTH",
    "COOKIE",
    "CONTENT-TYPE",
    "CONTENT-TRANSFER-ENCODING",
    "DATE",
    "EXPECT",
    "HOST",
    "KEEP-ALIVE",
    "ORIGIN",
    "REFERER",
    "TE",
    "TRAILER",
    "TRANSFER-ENCODING",
    "UPGRADE",
    "USER-AGENT",
    "VIA"
];

function getBase64FromArrayBuffer(responseData) {
    var uInt8Array = new Uint8Array(responseData);
    var i = uInt8Array.length;
    var binaryString = new Array(i);
    while (i--)
    {
      binaryString[i] = String.fromCharCode(uInt8Array[i]);
    }
    var data = binaryString.join('');

    var base64 = window.btoa(data);

    return base64;
}

// returns an object from the xhr.getAllReponseHeaders text-only version
function unpackHeaders(data) {
    if (data === null || data === "") {
        return [];
    }
    var vars = {}, hash;
    var hashes = data.split('\n');
    var header;

    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i];
        if (!hash) {
            continue;
        }

        var loc = hash.search(':');

        if (loc !== -1) {
            var name = hash.substr(0, loc);
            var value = hash.substr(loc + 1);
            
            vars[name] = value;
        }
    }

    return vars;
}

// returns true if Content-Type header has image
function isContentTypeImage(headers, contentType) {
	if ("Content-Type" in headers) {
		var contentType = headers["Content-Type"];
		return (contentType.search(/image/i) >= 0);
	}
  else {
  }
  return false;
}

//Usage arrayObjectIndexOf(items, "Washington", "city");
function arrayObjectIndexOf(myArray, searchTerm, property) {
    for(var i = 0, len = myArray.length; i < len; i++) {
        if (myArray[i][property] === searchTerm) return i;
    }
    return -1;
}

// uses the FormData API to deal with form data / file data (if any)
function getFormData(body) {	
	var paramsBodyData = new FormData();
	for(var i = 0, len = body.length; i < len; i++) {
		if (body[i].type === "text") {
			paramsBodyData.append(body[i].name, body[i].value);
		}
		else if (body[i].type === "file") {
			var files = body[i].value;			
			var newBuffer;
			var buffers = [];
			for(var j = 0; j < files.length; j++) {
				newBuffer = ArrayBufferEncoderDecoder.decode(files[j]);	
				buffers.push(newBuffer);
			}

			var blobs = new Blob(buffers);			
			paramsBodyData.append(body[i].name, blobs);
		}		

	}

	return paramsBodyData;
}

// sends any errors to postman encountered when XHR was loaded
function sendErrorToPostman(error) {
	var guid = queue[0].postmanMessage.guid;
	queue.splice(0, 1);

	//console.log(queue);

	chrome.runtime.sendMessage(
		postmanAppId, 
		{	
			"postmanMessage": {
				"guid": guid,
				//"type": "xhrError",
        "type": postmanMessageTypes.xhrError,
				"error": error
			}			
		}, 
		function(response) {
			console.log("Received response", response);
		}
	);
	
	if (queue.length > 0) {
		sendXhrRequest(queue[0].postmanMessage.request);
	}
}

// called after the XHR has loaded. Sends the reponse to Postman
// also triggers the XHR for the next item in the QUEUE
function sendResponseToPostman(response, cookies) {
	var guid = queue[0].postmanMessage.guid;
	queue.splice(0, 1);	

	//console.log("QUEUE", queue);

	chrome.runtime.sendMessage(
		postmanAppId, 
		{	
			"postmanMessage": {
				"guid": guid,
				//"type": "xhrResponse",
        "type": postmanMessageTypes.xhrResponse,
				"response": response,
				"cookies": cookies
			}			
		}, 
		function(response) {
			//console.log("Received response", response);
		}
	);

	if (queue.length > 0) {
		sendXhrRequest(queue[0].postmanMessage.request);
	}
}

// the workhorse function - sends the XHR on behalf of postman
function sendXhrRequest(request) {

	currentRequest = request;

	// TODO Set restricted headers
	var headers = currentRequest.headers;
	var found;

    // Adds the prefix: Postman- before all restricted headers
	for(var i = 0, len = headers.length; i < len; i++) {	
		found = restrictedChromeHeaders.indexOf(headers[i].name.toUpperCase()) >= 0;
		if (found) {
			headers[i].name = "Postman-" + headers[i].name;			
		}
	}	

	var url = request.url;
	var dataMode = request.dataMode; // what is this for?
	var xhrTimeout = request.xhrTimeout;

    // Called when the XHR reuqest gets an error
	function onXhrError(event) {
		var error = {
			"status": event.target.status,
			"statusText": event.target.statusText
		};

		sendErrorToPostman(error);
	}

	// Call back function when XHR is loaded - calls sendResponseToPostman with response 
	// and cookies
	function onXhrLoad() {
		toAddHeaders = false;

		var r = this;
		var response;
		// RESPONSE HEADERS
		var unpackedHeaders = unpackHeaders(this.getAllResponseHeaders());
		var rawHeaders = this.getAllResponseHeaders();
		var toGetCookies = true;

		if (this.responseType === "arraybuffer") {			
			response = {
				"readyState": this.readyState,
				"response": getBase64FromArrayBuffer(this.response),
				// "responseText": this.responseText,
				"responseType": this.responseType,
				"status": this.status,
				"statusText": this.statusText,
				"timeout": this.timeout,
				"withCredentials": this.withCredentials,
				"rawHeaders": rawHeaders,
				"headers": unpackedHeaders
			};

			//console.log("Received arraybuffer response", response);
		}
		else {
			if (isContentTypeImage(unpackedHeaders)) {
				toGetCookies = false;
				request.responseType = "arraybuffer";
				sendXhrRequest(request);
			}
			else {				
				response = {
					"readyState": this.readyState,
					"response": this.response,
					"responseText": this.responseText,
					"responseType": this.responseType,
					"status": this.status,
					"statusText": this.statusText,
					"timeout": this.timeout,
					"withCredentials": this.withCredentials,
					"rawHeaders": rawHeaders,
					"headers": unpackedHeaders
				};
			}			
		}

		if (toGetCookies) {
			chrome.cookies.getAll({url:url}, function (cookies) {
				//console.log("Sending response to Postman", response);
	            sendResponseToPostman(response, cookies);
	        });
		}			
	}

	// bootstrapping XHR and setting up callbacks
	var xhr = new XMLHttpRequest();
	xhr.onload = onXhrLoad;
	xhr.onerror = onXhrError;
	xhr.ontimeout = onXhrError;
	
	if (xhrTimeout !== 0) {
		xhr.timeout = xhrTimeout;
	}

	xhr.responseType = request.responseType;
	xhr.open(request.method, url, true);	

	for (var i = 0; i < headers.length; i++) {
		// sets the headers on XHR with Postman- prefix
		// at which point the onBeforeSendHeaders removes the Postman- prefix
	    xhr.setRequestHeader(headers[i].name, headers[i].value);
	}

	toAddHeaders = true;

	if ("body" in request) {
		var body = request.body;
		if (dataMode === "binary") {
			body = ArrayBufferEncoderDecoder.decode(request.body);			
			//console.log("Decoded body", body);
		}
		else if (dataMode === "params") {
			body = getFormData(request.body);
		}

		xhr.send(body);	
	} else {
		xhr.send();
	}	
}

// finds a header with a name in an array of headars
function getHeader(headers, name) {
	for(var i = 0; i < headers.length; i++) {
		if (headers[i].name.toUpperCase() === name.toUpperCase()) {
			return i;
		}
	}
	return -1;
}

// returns an edited header object with retained postman headers
function onBeforeSendHeaders(details) {
	var tokenHeaderIndex = getHeader(details.requestHeaders, "Postman-Token");
	var requestHeaders = details.requestHeaders;
	var index;
	var name;
	var prefix = "Postman-";
	var prefixLength = prefix.length;
	var newHeaders = [];                // array to hold all headers sent by postman
	var n;
	var os = [];
	var ds = [];
	var i = 0, j = 0;
	var bckHeaders = [];

	// runs only if Postman-token is present
	if (tokenHeaderIndex >= 0) {
		for(i = 0, len = requestHeaders.length; i < len; i++) {
			name = requestHeaders[i].name;
      
      // for all headers that are being sent by Postman
			if (name.search(prefix) === 0 && name !== "Postman-Token") {
				n = requestHeaders[i].name.substr(prefixLength);

        // push them in newHeaders
				newHeaders.push({
					"name": n,
					"value": requestHeaders[i].value
				})

				ds.push( arrayObjectIndexOf(requestHeaders, n, "name") );
			}
		}

	    // retains the postman headers that are repeated
		for(j = 0; j < ds.length; j++) {
			requestHeaders.splice( ds[j], 1 );
		}

		i = 0;

		if (requestHeaders[i]) {
			while(requestHeaders[i]) {				
				name = requestHeaders[i].name;
				if (name.search(prefix) === 0 && name !== "Postman-Token") {
					requestHeaders.splice(i, 1);
					i--;
				}

				i++;
			}			
		}
		
		for(var k = 0; k < newHeaders.length; k++) {
			requestHeaders.push(newHeaders[k]);
		}
	}	

	return {requestHeaders: requestHeaders};
}

// adds a postman-received request in the QUEUE 
// sends the XHR if length is 1
function addToQueue(request) {
	queue.push(request);

	if (queue.length === 1) {		
		sendXhrRequest(queue[0].postmanMessage.request);
	}	
}

// responds to a message from postman - adds the XHR from postman to queue
function onExternalMessage(request, sender, sendResponse) {
    if (sender.id in blacklistedIds) {
      sendResponse({"result":"sorry, could not process your message"});
      return;
    } 
    else if (request.postmanMessage) {
      sendResponse({"result":"Ok, got your message"});
      var type = request.postmanMessage.type;
      if (type === "xhrRequest") {
        addToQueue(request);
      }
      else if (type === "detectExtension") {
        sendResponse({"result": true});	
      }
    } 
    else {
  		sendResponse({"result":"Ops, I don't understand this message"});
    }
}

// filters requests before sending it to postman
function filterCapturedRequest(request) {
    var patt = new RegExp(appOptions.filterRequestUrl, "gi");
    var validRequestTypes = ["xmlhttprequest", "main_frame", "sub_frame"];
    return (_.contains(validRequestTypes, request.type) && request.url.match(patt))
}

// for filtered requests sets a key in requestCache
function onBeforeRequest(details) {
  //if (filterCapturedRequest(details)) {
  if (filterCapturedRequest(details) && !isPostmanRequest(details) && appOptions.isCaptureStateEnabled) {
    requestCache[details.requestId] = details;
  }
}

// returns boolean to indicate whether request is from Postman 
function isPostmanRequest(request) {
  return (_.chain(request.requestHeaders)
          .pluck('name')
          .contains('Postman-Token')
          .value())
}

// for filtered requests it sets the headers on the request in requestcache
function onSendHeaders(details) {
  if (filterCapturedRequest(details) && !isPostmanRequest(details) && appOptions.isCaptureStateEnabled) {
    if (details.requestId in requestCache) {
      var req = requestCache[details.requestId];
      req.requestHeaders = details.requestHeaders;
      sendCapturedRequestToPostman(details.requestId);
    } else {
      console.log("Error - Key not found ", details.requestId, details.method, details.url);
    }
  }
}

// sends the captured request to postman with id as reqId (using the requestCache)
// then clears the cache
function sendCapturedRequestToPostman(reqId){
  var loggerMsg = "<span class=\"" + addClassForRequest(requestCache[reqId].method) + "\">" + requestCache[reqId].method + "</span><span>" + (requestCache[reqId].url).substring(0, 150) + "</span>";

  var request = requestCache[reqId];
  var isPost = request.method === "POST";
  var requestBodyType;
  var rawEncodedData;

  if (isPost && request.requestBody) {
    requestBodyType = _.has(request.requestBody, 'formData') ? 'formData' : 'rawData';
    request.requestBodyType = requestBodyType;

    // encode raw data if exists
    if (requestBodyType === "rawData") {
        if(request.requestBody.raw && request.requestBody.raw[0]) {
            var rawEncodedData = getBase64FromArrayBuffer(request.requestBody.raw[0].bytes);
            request.requestBody["rawData"] = rawEncodedData;
            delete request.requestBody["raw"] // strip out existing raw requestBody
        } 
        else {
            // if no raw data or bytes set rawData as null
            request.requestBody["rawData"] = null; 
        }
    }
  }

  chrome.runtime.sendMessage(
      postmanAppId,
      {
        "postmanMessage": {
          "reqId": reqId,
          "request": requestCache[reqId],
          "type": postmanMessageTypes.capturedRequest
        }
      },
      function response(resp) {
          console.log("Request sent to postman for request:", reqId);
          sendCapturedRequestToFrontend(loggerMsg);
          delete requestCache[reqId];
      }
  );
}

// sends the captured request to popup.html
function sendCapturedRequestToFrontend(loggerObject) {
  logCache.push(loggerObject);
  if (popupConnected) {
    BackgroundPort.postMessage({logcache: logCache});
  }
}

// adds class for the span tag for styling in popup
function addClassForRequest(methods) {
	var color = '';
	switch (methods) {
		case "GET":
			color = " label-success";
			break;
		case "POST":
			color = " label-warning";
			break;
		case "PUT":
			color = " label-primary";
			break;
		case "DELETE":
			color = " label-danger";
			break;
		default:
			color = " label-default";
			break;
	}
	return 'label' + color;
}

// long-lived connection to the popupchannel (as popup is opened)
// notifies when popup can start listening
chrome.runtime.onConnect.addListener(function(port){
  console.assert(port.name === 'POPUPCHANNEL');
  BackgroundPort = chrome.runtime.connect({name: 'BACKGROUNDCHANNEL'});
  popupConnected = true;

  port.onMessage.addListener(function(msg) {
    if (msg.options) {
      appOptions.isCaptureStateEnabled = msg.options.toggleSwitchState;
      if (msg.options.filterRequestUrl === "") {
          appOptions.filterRequestUrl = ".*";
      } else {
          appOptions.filterRequestUrl = msg.options.filterRequestUrl || appOptions.filterRequestUrl;
      }
    }
    if(msg.reset) {
        logCache.clear();
    }
  });

  BackgroundPort.postMessage({options: appOptions});
  BackgroundPort.postMessage({logcache: logCache});

  // when the popup has been turned off - no longer send messages
  port.onDisconnect.addListener(function(){
    popupConnected = false;
  });

});

// adds an event listener to the onBeforeSendHeaders
chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders,
	{ urls: ["<all_urls>"] },
	[ "blocking", "requestHeaders" ]
);

// event listener called when postman sends a request (in the form of a message)
chrome.runtime.onMessageExternal.addListener(onExternalMessage);

// event listener called for each request to intercept - used to intercept request data
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, 
    { urls: ["<all_urls>"] }, 
    [ "requestBody" ]
);

//event listener called just before sending - used for getting headers
chrome.webRequest.onSendHeaders.addListener(onSendHeaders, 
    { urls: ["<all_urls>"] }, 
    [ "requestHeaders" ]
);

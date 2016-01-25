//TODO:
//chrome.management.get("fhbjgbiflinjbdggehcddcbncdddomop", function(a) {console.log(a)})
//chrome.management.launchApp("fhbjgbiflinjbdggehcddcbncdddomop", function(a) {console.log(a)}) to open the app

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

var followRedirect = true;
var sendNextResponseToPostman = true;
var redirectUrlToBlock = "";

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

var postmanCheckTimeout = null;
var isPostmanOpen = true;
setInterval(function() {
	clearTimeout(postmanCheckTimeout);
	chrome.runtime.sendMessage(postmanAppId, {}, function (extResponse) {
		clearTimeout(postmanCheckTimeout);
		if(typeof extResponse === "undefined") {
			//Postman is not open
			isPostmanOpen = false;
		}
		setPostmanOpenStatus(isPostmanOpen);
	});
	postmanCheckTimeout = setTimeout(function() {
		isPostmanOpen = true;
		setPostmanOpenStatus(isPostmanOpen);
	}, 300);
}, 1000);

function setPostmanOpenStatus(isOpen) {
	if(isOpen) {
		popupConnected && BackgroundPort.postMessage({isPostmanOpen: true});
	}
	else {
		popupConnected && BackgroundPort.postMessage({isPostmanOpen: false});
	}
}

function setBlueIcon() {
	chrome.browserAction.setIcon({path:'interceptor_48x48_blue.png'});
}

function setOrangeIcon() {
	chrome.browserAction.setIcon({path:'interceptor_48x48.png'});
}

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
		if (body[i].enabled === false) {
			continue;
		}
		if(!body[i].hasOwnProperty("name") && body[i].hasOwnProperty("key")) {
			body[i].name = body[i].key;
		}
		if (body[i].type === "text") {
			paramsBodyData.append(body[i].name, body[i].value);
		}
		else if (body[i].type === "file") {
			var files = body[i].value;	
			var fileName = body[i].fileName;		
			var newBuffer;
			var buffers = [];
			for(var j = 0; j < files.length; j++) {
				newBuffer = ArrayBufferEncoderDecoder.decode(files[j]);	
				buffers.push(newBuffer);
			}

			//Zendesk 2322 - Interceptor not respecting mime types of files
			var blobs = null;
			if(body[i].hasOwnProperty("mimeType")) {
				blobs = new Blob(buffers, {type: body[i].mimeType});
			}
			else {
				blobs = new Blob(buffers);
			}

			paramsBodyData.append(body[i].name, blobs, fileName);
		}
		else {
			//no type specified
			//assume text
			paramsBodyData.append(body[i].name, body[i].value);
		}

	}

	return paramsBodyData;
}

// sends any errors to postman encountered when XHR was loaded
function sendErrorToPostman(error) {
	var guid = queue[0].postmanMessage.guid;
	
	var customAppId = queue[0].postmanMessage.postmanAppId;
	if(!customAppId) {
		customAppId = postmanAppId;
	}
	
	queue.splice(0, 1);

	//console.log(queue);


	chrome.runtime.sendMessage(
		customAppId, 
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

	var customAppId = queue[0].postmanMessage.postmanAppId;
	if(!customAppId) {
		customAppId = postmanAppId;
	}
	
	queue.splice(0, 1);	

	//console.log("QUEUE", queue);

	chrome.runtime.sendMessage(
		customAppId, 
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

function setCookiesFromHeader(cookieHeader, url) {
	var cookies = cookieHeader.split(";");
	var numCookies = cookies.length;
	var retVal = [];
	for(var i=0;i<numCookies;i++) {
		var thisCookie = cookies[i].trim().split("=");
		if(thisCookie.length>=1) {
			//Added this to allow cookie values to have '='
			//Zendesk 1344
			try {
				var cName = thisCookie.splice(0,1)[0]; //this is the part before the first =
				var cValue = thisCookie.join("="); //part after the first =
				chrome.cookies.set({
					url: url,
					name: cName,
					value: cValue
				});
			}
			catch(e) {
				console.log("Error setting cookie: " + e);
			}
		}
	}
}


// the workhorse function - sends the XHR on behalf of postman
function sendXhrRequest(request) {

	currentRequest = request;

	// TODO Set restricted headers
	var headers = currentRequest.headers;
	var cookies = [];
	var found;

    // Adds the prefix: Postman- before all restricted headers
	for(var i = 0, len = headers.length; i < len; i++) {
		var upperCasedHeader = headers[i].name.toUpperCase();
		if(upperCasedHeader==="COOKIE") {
			cookies = setCookiesFromHeader(headers[i].value, request.url);
		}
		else {
			found = restrictedChromeHeaders.indexOf(upperCasedHeader) >= 0;
			if (found) {
				headers[i].name = "Postman-" + headers[i].name;
			}
			else if (upperCasedHeader.indexOf("PROXY-") === 0 || upperCasedHeader.indexOf("SEC-") === 0) {
				headers[i].name = "Postman-" + headers[i].name;
			}
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
		if(sendNextResponseToPostman === false && (queue.length==0 || redirectUrlToBlock===queue[0].postmanMessage.request.url)) {
			sendNextResponseToPostman = true;
			return;
		}

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
			//if contenttype is image, there's no need to send the request again, with contenttype=arraybuffer
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
		if(headers[i].enabled === false) {
			continue;
		}
		try {
			xhr.setRequestHeader(headers[i].name, headers[i].value);
		}
		catch(e) {
			console.error(e);
			console.log("Continuing after header failure");
		}
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
	var term;	

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
				});
				
				var term = prefix + n;

				ds.push(arrayObjectIndexOf(requestHeaders, term, "name") );
			}
		}

	    // retains the postman headers that are repeated
		for(j = 0; j < ds.length; j++) {
			requestHeaders.splice(ds[j], 1);
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

		delete requestCache[details.requestId];
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
      if(request.postmanMessage.hasOwnProperty("autoRedirect")) {
   	  	followRedirect = request.postmanMessage.autoRedirect;
  	  }

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

//
function onBeforeRedirect(details) {
	//if followRedirects = false
	//send this response to Postman
	//set request.sendResponse for this request in cache to fals
	if(followRedirect === false) {
		var responseForPostman = convertRedirectResponse(details);
		sendNextResponseToPostman = false;
		redirectUrlToBlock = details.url;
		chrome.cookies.getAll({url:details.url}, function (cookies) {
			console.log("Sending redirect response to Postman", responseForPostman);
            sendResponseToPostman(responseForPostman, cookies);
            followRedirect = true;
        });
	}
}

function getHeadersObjectAndStringFromArray(headerArray) {
	var numHeaders = headerArray.length;
	var rawHeaders = "";
	var headers = {};
	for(var i=0;i<numHeaders;i++) {
		rawHeaders += headerArray[i].name+": "+headerArray[i].value+"\n";
		headers[headerArray[i].name] = headerArray[i].value;
	}
	return {
		"raw": rawHeaders,
		"obj": headers
	};
}

function convertRedirectResponse(details) {
	var headerTypes = getHeadersObjectAndStringFromArray(details.responseHeaders);
	var response = {
		headers: headerTypes.obj,
		rawHeaders: headerTypes.raw,
		readyState: 4,
		response: "",
		responseText: "",
		status: details.statusCode,
		statusText: details.statusLine.split(" ").slice(2).join(" "), //or take from a map
		timeout: 0,
		withCredentials: false
	};
	return response;
}

// for filtered requests sets a key in requestCache
function onBeforeRequest(details) {
  //if (filterCapturedRequest(details)) {
  if (filterCapturedRequest(details) && !isPostmanRequest(details) && appOptions.isCaptureStateEnabled) {
    requestCache[details.requestId] = details;
    console.log("Request " + details.requestId+" added to cache");
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
  //console.log("Checking headers for request: " + details.requestId);
  //console.log(requestCache);
  if (filterCapturedRequest(details) && !isPostmanRequest(details) && appOptions.isCaptureStateEnabled) {
    if (requestCache.hasOwnProperty(details.requestId)) {
      var req = requestCache[details.requestId];
      req.requestHeaders = details.requestHeaders;
      sendCapturedRequestToPostman(details.requestId);
    } else {
      console.log("Error - Key not found ", details.requestId, details.method, details.url);
      console.log(requestCache);
    }
  }
}

function isMethodWithBody(method) {
    var methodsWithBody = ["POST", "PUT", "PATCH", "DELETE", "LINK", "UNLINK", "LOCK", "PROPFIND", "OPTIONS"];
    method = method.toUpperCase();
    return methodsWithBody.indexOf(method)!==-1;
}

// sends the captured request to postman with id as reqId (using the requestCache)
// then clears the cache
function sendCapturedRequestToPostman(reqId){
  var loggerMsg = "<span class=\"" + addClassForRequest(requestCache[reqId].method) + "\">" + requestCache[reqId].method + "</span><span>" + (requestCache[reqId].url).substring(0, 150) + "</span>";

  var request = requestCache[reqId];
  var methodWithBody = isMethodWithBody(request.method);
  var requestBodyType;
  var rawEncodedData;

  if (methodWithBody && request.requestBody) {
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

  var requestNotReceived = setTimeout(function() {
  	showPostmanNotEnabledWarning();
  }, 500);

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
          clearTimeout(requestNotReceived);
          hidePostmanNotEnabledWarning();
      }
  );
}

function showPostmanNotEnabledWarning() {
  if (popupConnected) {
    BackgroundPort.postMessage({isPostmanEnabledWarning: true});
  }
}

function hidePostmanNotEnabledWarning() {
  if (popupConnected) {
    BackgroundPort.postMessage({isPostmanEnabledWarning: false});
  }
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

      if(appOptions.isCaptureStateEnabled) {
      	setBlueIcon();
      }
      else {
      	setOrangeIcon();
      }
    }
    if(msg.reset) {
        logCache.clear();
    }
  });

  BackgroundPort.postMessage({options: appOptions});
  BackgroundPort.postMessage({logcache: logCache});
  console.log("Sending isPostman Open: " , isPostmanOpen);
  BackgroundPort.postMessage({isPostmanOpen: isPostmanOpen});

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

chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, 
    { urls: ["<all_urls>"] }, 
    [ "responseHeaders" ]
);

//event listener called just before sending - used for getting headers
chrome.webRequest.onSendHeaders.addListener(onSendHeaders, 
    { urls: ["<all_urls>"] }, 
    [ "requestHeaders" ]
);

//creates a context menu link to import curl
chrome.contextMenus.create({
    "title": "Import CURL in Postman",
    "contexts": ["selection"],
    "onclick" : function(a,b) {
 		var selection = a.selectionText;
 		sendToPostman(selection);
    }
});

var sendToPostman = function(selection) {
	if(!selection) return;

	var message =  {
			"curlImportMessage": {
            	"curlText": selection.trim()
        	}
    };

    chrome.runtime.sendMessage(postmanAppId, message, function(extResponse) {});
}

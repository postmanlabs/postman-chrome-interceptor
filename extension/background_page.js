var blacklistedIds = ["none"];
var currentRequest;
var cookies;

var queue = [];

var toAddHeaders = false;

var background = this;

var restrictedChromeHeaders = [
    "ACCEPT-CHARSET",
    "ACCEPT-ENCODING",
    "ACCESS-CONTROL-REQUEST-HEADERS",
    "ACCESS-CONTROL-REQUEST-METHOD",
    "CONNECTION",
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

function unpackHeaders(data) {
    if (data === null || data === "") {
        return [];
    }
    else {
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
}

function isContentTypeImage(headers, contentType) {
	if ("Content-Type" in headers) {
		var contentType = headers["Content-Type"];
		return (contentType.search(/image/i) >= 0);
	}
	else {
		return false;
	}
}

//Usage arrayObjectIndexOf(items, "Washington", "city");
function arrayObjectIndexOf(myArray, searchTerm, property) {
    for(var i = 0, len = myArray.length; i < len; i++) {
        if (myArray[i][property] === searchTerm) return i;
    }
    return -1;
}

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

function sendErrorToPostman(error) {
	var guid = queue[0].postmanMessage.guid;
	queue.splice(0, 1);

	console.log(queue);

	if (queue.length > 0) {
		sendXhrRequest(queue[0].postmanMessage.request);
	}

	chrome.runtime.sendMessage(
		postmanAppId, 
		{	
			"postmanMessage": {
				"guid": guid,
				"type": "xhrError",
				"error": error
			}			
		}, 
		function(response) {
			console.log("Received response", response);
		}
	);
}

function sendResponseToPostman(response, cookies) {
	var guid = queue[0].postmanMessage.guid;
	queue.splice(0, 1);	

	console.log("QUEUE", queue);

	if (queue.length > 0) {
		sendXhrRequest(queue[0].postmanMessage.request);
	}

	chrome.runtime.sendMessage(
		postmanAppId, 
		{	
			"postmanMessage": {
				"guid": guid,
				"type": "xhrResponse",
				"response": response,
				"cookies": cookies
			}			
		}, 
		function(response) {
			console.log("Received response", response);
		}
	);
}

function sendXhrRequest(request) {
	console.log("Firing XHR request", request);

	currentRequest = request;

	// TODO Set restricted headers
	var headers = currentRequest.headers;
	var found;

	console.log(headers);

	for(var i = 0, len = headers.length; i < len; i++) {		
		found = restrictedChromeHeaders.indexOf(headers[i].name.toUpperCase()) >= 0;

		console.log(found, headers[i].name.toUpperCase());

		if (found) {
			headers[i].name = "Postman-" + headers[i].name;			
		}
	}	

	var url = request.url;
	var dataMode = request.dataMode;
	var xhrTimeout = request.xhrTimeout;

	function onXhrError(event) {
		console.log("Error " + event.target.status + " occurred while receiving the document.", event.target);
		var error = {
			"status": event.target.status,
			"statusText": event.target.statusText
		};

		sendErrorToPostman(error);
	}

	function onXhrLoad() {
		toAddHeaders = false;

		var r = this;
		var response;
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

			console.log("Received arraybuffer response", response);
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
				console.log("Sending response to Postman", response);
	            sendResponseToPostman(response, cookies);
	        });
		}			
	}

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
	    xhr.setRequestHeader(headers[i].name, headers[i].value);
	}

	toAddHeaders = true;

	if ("body" in request) {
		var body = request.body;
		if (dataMode === "binary") {
			body = ArrayBufferEncoderDecoder.decode(request.body);			
			console.log("Decoded body", body);
		}
		else if (dataMode === "params") {
			body = getFormData(request.body);
		}

		xhr.send(body);	
		
	}
	else {
		xhr.send();
	}	
}

function getHeader(headers, name) {
	for(var i = 0; i < headers.length; i++) {
		if (headers[i].name.toUpperCase() === name.toUpperCase()) {
			return i;
		}
	}

	return -1;
}

function onBeforeSendHeaders(details) {
	// TODO Send this only if requestHeaders have Postman-Token
	// console.log("onBeforeSendHeaders", details);	
	var tokenHeaderIndex = getHeader(details.requestHeaders, "Postman-Token");
	var requestHeaders = details.requestHeaders;
	var index;
	var name;

	var prefix = "Postman-";
	var prefixLength = prefix.length;
	var newHeaders = [];
	var n;
	var os = [];
	var ds = [];
	var i = 0, j = 0;
	var bckHeaders = [];

	if (tokenHeaderIndex >= 0) {
		for(i = 0, len = requestHeaders.length; i < len; i++) {
			name = requestHeaders[i].name;
			if (name.search(prefix) === 0 && name !== "Postman-Token") {
				n = requestHeaders[i].name.substr(prefixLength);
				console.log(n);

				newHeaders.push({
					"name": n,
					"value": requestHeaders[i].value
				})

				f = arrayObjectIndexOf(requestHeaders, n, "name");

				ds.push(f);
			}
		}

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
					console.log(name);
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

function addToQueue(request) {
	queue.push(request);
	console.log("addToQueue: QUEUE", queue);

	if (queue.length === 1) {		
		sendXhrRequest(queue[0].postmanMessage.request);
	}	
}

function onExternalMessage(request, sender, sendResponse) {
    if (sender.id in blacklistedIds) {
		sendResponse({"result":"sorry, could not process your message"});
		return;  // don't allow this extension access
    } else if (request.postmanMessage) {
		sendResponse({"result":"Ok, got your message"});
		var type = request.postmanMessage.type;

		if (type === "xhrRequest") {
			addToQueue(request);			
		}
		else if (type === "detectExtension") {
			sendResponse({"result": true});	
		}
    } else {
  		sendResponse({"result":"Ops, I don't understand this message"});
    }
}

chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders,
	{
		urls: ["<all_urls>"]
	},
	[
		"blocking", 
		"requestHeaders"
	]
);

chrome.runtime.onMessageExternal.addListener(onExternalMessage);


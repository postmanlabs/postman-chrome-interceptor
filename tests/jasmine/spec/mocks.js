postmanAppId = 'POSTMAN';

var getNewRequest = function() {
    return {
        type: 'xmlhttprequest',
        method: "get",
        url: 'localhost:8000',
        requestId: '1',
        requestBody: { },
        requestHeaders: [ ]
    }
};

var postmanMessage = function() {
    return { 
        "reqId": "10891",
        "request": {
            "frameId": 2, "method": "POST",
            "parentFrameId": 0, "requestBodyType": "formData", //formData or rawData
            "requestBody": {},
            "requestId": "10891",
            "tabId": 161, "timestamp": 1393432789060.789,
            "type": "xmlhttprequest",
            "url": "",
            "requestHeaders": [ ],
        },
        "type": "capturedRequest"
    }
}

chrome.runtime = {
    sendMessage: function() {
    },
    onConnect: {
        addListener: function(){}
    },
    onMessageExternal: {
        addListener: function(){}
    }
};


chrome.webRequest = {
	onBeforeSendHeaders: {
		addListener : function(){}
	},
	onBeforeRequest: {
		addListener : function(){}
	},
	onSendHeaders: {
		addListener : function(){}
	}
};

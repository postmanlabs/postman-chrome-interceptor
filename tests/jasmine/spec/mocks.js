var postmanAppId = 'POSTMAN';

var noop = function() {}; // this is cute :D

var getNewRequest = function(id) {
    return {
        type: 'xmlhttprequest',
        method: "get",
        url: 'localhost:8000',
        requestId: id,
        requestBody: { },
        requestHeaders: [ ]
    }
};

// mock a message from postman
// type takes 2 values -> detectExtension or xhrRequest
var getPostmanMessage = function(type) {
    var message = { postmanMessage: { type: type } };
    if (type === "xhrRequest") {
        message.postmanMessage.request = {
            dataMode: "",
            headers: [ { key: "Postman-Token", value: "100" } ],
            method: "GET",
            responseType: "text",
            url: "localhost:8000",
        }
    }
    return message;
};

var chrome = {
    runtime: {
        sendMessage: noop,
        onConnect: {
            addListener: noop
        },
        onMessageExternal: {
            addListener: noop
        }
    },
    webRequest: {
        onBeforeSendHeaders: {
            addListener : noop
        },
        onBeforeRequest: {
            addListener : noop
        },
        onSendHeaders: {
            addListener : noop
        }
    }
};

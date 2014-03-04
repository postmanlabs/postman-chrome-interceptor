var postmanAppId = 'POSTMAN';

var noop = function() {};

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

var chrome = {
    runtime: {
        sendMessage: noop,
        onConnect: {
            addListener: noop
        },
        onMessageExternal: {
            addListener: fnoop
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
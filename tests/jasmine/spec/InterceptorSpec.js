describe('When Interceptor sends a captured request to Postman', function() {
	
	beforeEach(function() {
		this.chromeEventOrder = function(args) {
			onBeforeRequest(args);
			onBeforeSendHeaders(args);
			onSendHeaders(args);
		}
		sinon.stub(chrome.runtime ,'sendMessage');
	});

	it("By Default no request should be returned to Postman.", function() {
        var request = getNewRequest(1);
		this.chromeEventOrder(request);
		expect(chrome.runtime.sendMessage.called).toBe(false);
	});

	it("Should Return a request, back to postman.", function() {
		appOptions.isCaptureStateEnabled = true;
        var request = getNewRequest(1);
		this.chromeEventOrder(request);

		expect(chrome.runtime.sendMessage.args[0][0]).toBe('POSTMAN');
		expect(chrome.runtime.sendMessage.args[0][1].postmanMessage.reqId).toBe(1);
		expect(chrome.runtime.sendMessage.args[0][1].postmanMessage.request).toBe(request);

		appOptions.isCaptureStateEnabled = false;
	});

    it("Filter should allow all domains by default", function() {
        appOptions.isCaptureStateEnabled = true;
        expect(appOptions.filterRequestUrl).toBe(".*");
        var request = getNewRequest(1);
        this.chromeEventOrder(request);

        expect(chrome.runtime.sendMessage.called).toBe(true);
        expect(chrome.runtime.sendMessage.args[0][1].postmanMessage.reqId).toBe(1);
    });


    it("Filter should block incorrect domains when enabled", function() {
        appOptions.isCaptureStateEnabled = true;
        appOptions.filterRequestUrl = "google";
        var request = getNewRequest(1);
        this.chromeEventOrder(request);

        expect(chrome.runtime.sendMessage.called).toBe(false);
    });

    it("Filter should allow correct domains when enabled", function() {
        appOptions.isCaptureStateEnabled = true;
        appOptions.filterRequestUrl = "google";
        var request = getNewRequest(2);
        request.url = "www.google.com/someXHR";
        this.chromeEventOrder(request);

        expect(chrome.runtime.sendMessage.called).toBe(true);
        expect(chrome.runtime.sendMessage.args[0][1].postmanMessage.reqId).toBe(2);
    });

	afterEach(function() {
		this.chromeEventOrder = null;
		chrome.runtime.sendMessage.restore();
	});

});

describe("When Postman sends a message to Interceptor", function() {

    it("Toggle should send correct message to interceptor", function() {
        var postmanMessage = getPostmanMessage("detectExtension");
        console.log(postmanMessage);
        var sender = { id: 1 };
        var sendResponse = sinon.stub();
        onExternalMessage(postmanMessage, sender, sendResponse);

        expect(sendResponse.called).toBe(true);
        expect(sendResponse.callCount).toBe(2);
        expect(sendResponse.args[0][0].result).toBe("Ok, got your message");
    });

    it("Interceptor should recieve XHR request from Postman", function() {
        var postmanMessage = getPostmanMessage("xhrRequest");
        console.log(postmanMessage);
        var sender = { id: 1 };
        var sendResponse = sinon.stub();
        sinon.stub(window, 'sendXhrRequest');
        onExternalMessage(postmanMessage, sender, sendResponse);

        expect(sendResponse.called).toBe(true);
        expect(sendResponse.calledOnce).toBe(true);
        expect(sendResponse.args[0][0].result).toBe("Ok, got your message");
        expect(sendXhrRequest.called).toBe(true);
        expect(sendXhrRequest.args[0][0].headers[0]["key"]).toBe("Postman-Token");
    });

});

/*
 * Sample response returned from the Interceptor,
 * {
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
 */

describe('Interceptor Library', function() {
	
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

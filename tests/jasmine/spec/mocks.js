postmanAppId = 'POSTMAN';
chrome.runtime.onConnect = {
	addListener : function(){}
};

chrome.runtime.onMessageExternal = {
	addListener : function(){}
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
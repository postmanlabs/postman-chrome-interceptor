<a href="https://www.getpostman.com" target="_blank"><img src="https://s3.amazonaws.com/web-artefacts/postman-logo%2Btext-197x68.png" /></a>

# Postman Interceptor

Postman Interceptor is helper extension for the [Postman packaged app](http://www.getpostman.com/). 

It allows you to

1. Use browser cookies
2. Use all headers (even the ones restricted by XHR) like User-Agent, Content-Type etc.
3. Capture requests and send them to Postman!

Here are [a](http://blog.getpostman.com/index.php/2014/02/11/postman-v0-9-6-access-cookies-and-restricted-headers-plus-better-testing/) [few](http://blog.getpostman.com/index.php/2014/03/03/postman-v0-9-8-capture-requests-and-improved-response-rendering/) relevant blog posts on the Postman blog to help you get started with Interceptor.

## Installing the extension from Chrome WebStore

Open the [Postman Interceptor on WebStore](https://chrome.google.com/webstore/detail/postman-interceptor/aicmkgpgakddgnaphhhpliifpcfhicfo) using Google Chrome browser and click on the "Add to Chrome" button to begin installation.

## Build Extension from Source

1. Install the grunt tasks

```terminal
npm install;
```

2. Run Grunt

```terminal
grunt;
```

3. For misc. grunt tasks, look at `grunt.js`

### Testing the build

Tests are written in `Jasmine` and can be run using the `SpecRunner.html`.


[![Analytics](https://ga-beacon.appspot.com/UA-43979731-9/postman-chrome-interceptor/readme)](https://www.getpostman.com)
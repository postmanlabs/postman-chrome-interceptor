Postman Interceptor
==================

Postman Interceptor is helper extension for the [Postman packaged app](http://www.getpostman.com/). 

It allows you to - 

1. Use browser cookies
2. Use all headers (even the ones restricted by XHR) like User-Agent, Content-Type etc.
3. Capture requests and send them to Postman!

Here are [a](http://blog.getpostman.com/index.php/2014/02/11/postman-v0-9-6-access-cookies-and-restricted-headers-plus-better-testing/) [few](http://blog.getpostman.com/index.php/2014/03/03/postman-v0-9-8-capture-requests-and-improved-response-rendering/) relevant blog posts on the Postman blog to help you getting started with Interceptor.

### Build

1. Install the grunt tasks
<pre>
   npm install
</pre>

2. Run Grunt
<pre>
   grunt
</pre>

### Tests

Tests are written in `Jasmine` and can be run using the `SpecRunner.html`.

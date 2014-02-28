/* A simple deque [double-ended queue] library in Javascript
 * 
 * Constructor uses an optional max-size
 * 
 * Methods: 
 * push(item) -> Adds an item in the queue
 * dequeue -> Pops the last item from the back and return it
 */
function Deque(N) {
  this._maxlength = N;
  this.items = new Array();
  this.clear = function() {
      this.items = [];
  }
}

Deque.prototype.dequeue = function() {
  return this.items.pop();
}

Deque.prototype.push = function(item) {
  this.items.unshift(item);
  if (this.items.length > this._maxlength) {
    this.dequeue();
  }
}

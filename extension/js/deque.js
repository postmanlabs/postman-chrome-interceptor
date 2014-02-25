/* A simple deque [double-ended queue] library in Javascript
 * 
 * Constructor uses an optional max-size
 * 
 * Methods: 
 * push(item) -> Adds an item in the queue
 * dequeue -> Pops the last item from the back and return it
 * getItems -> returns an array of items with most recently 
 * added item at the front
 */
function Deque(N) {
  this._maxlength = N;
  this._items = new Array();
}

Deque.prototype.dequeue = function() {
  return this._items.pop();
}

Deque.prototype.push = function(item) {
  this._items.unshift(item);
  if (this._items.length > this._maxlength) {
    this.dequeue();
  }
}

Deque.prototype.getItems = function() {
  return this._items;
}

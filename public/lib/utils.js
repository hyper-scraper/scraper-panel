/**
 * Extend Child with Parent
 *
 * @param {Function} Child
 *    Recipient of prototype
 * @param {Function} Parent
 *    Donor of prototype
 */
function inherits(Child, Parent) {
  var F = function() {
  };
  F.prototype = Parent.prototype;
  Child.prototype = new F();
  Child.prototype.constructor = Child;
  Child._super = Parent.prototype;
}

module.exports = function(db) {
    var person = db.define('person', {
        id: String,
        Name: String,
        password: String,
        access:Number
    });
    return person;
}

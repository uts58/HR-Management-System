module.exports = function(db) {
    var Users = db.define('position', {
        id: Number,
        positionName:String
    });
    return Users;
}

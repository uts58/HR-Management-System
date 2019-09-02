module.exports = function(db) {
    var Users = db.define('message', {
        id: Number,
        from: Number,
        to: Number,
        msg:String,
        date: String,
        read:Number
        // email: { type: String, index: true },
    });
    return Users;
}

module.exports = function(db) {
    var Users = db.define('empLeave', {
        id: Number,
        empid:String,
        leaveType: String,
        leaveStart: String,
        leaveEnd: String,
        description: String,
        status:Number,
        read: Number
        // email: { type: String, index: true },
    });
    return Users;
}

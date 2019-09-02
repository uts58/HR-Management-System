module.exports = function(db) {
    var Users = db.define('employee', {
        id: {
            type : Number,
            index : true
        },
        firstName:String,
        middleName:String,
        lastName:String,
        department:Number,
        position:Number,
        country: String,
        homeTown: String,
        contactNo: String,
        email: String,
        gender: Number,
        maritalStatus: String,
        dateofBirth: String
        // email: { type: String, index: true },
    });
    return Users;
}

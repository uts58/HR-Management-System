module.exports = function(db) {
    var Users = db.define('department', {
        id: Number,
        departmentName:String
    });
    return Users;
}

module.exports = function(db) {
    var Users = db.define('performance', {

        empId:Number,
        project_name:String,
        project_begin:String,
        project_end:String,
        rating:Number

    });
    return Users;
}

module.exports = function(db) {
    var notice = db.define('notice', {
        title: String,
        type: Number,
        notice: String,
        date: String
    });
    return notice;
};
var express = require('express');
var router = express.Router();
var Schema = require('jugglingdb').Schema;
var db = new Schema('mysql', {
    database: 'node',
    username: 'root'
});
var userCheck=require("../models/person")(db);
var notice = require("../models/notice")(db);
var leave =  require("../models/leave")(db);

router.get('/', function(req, res) {
    notice.all(function(err, notice) {
        res.render("index",{title:'Home', notices:notice });
    });
});



router.get('/home',function (req, res) {

    var user={
        username: req.body.txtUsername,
        password:req.body.txtPassword
    };

    if(req.session.name!=null){
        userCheck.findOne({where:{id:req.session.idno}},function(err, userCheck) {
            notice.all(function (err, notice) {
                leave.count({status:0},function (err,leave) {
                    if(userCheck['access']==1){
                        res.render("welcome",{title:"hr",useracc:req.session.name,userid:req.session.idno, leave:leave, notices:notice})
                    }
                    else {
                        db.client.query("SELECT COUNT(*) AS count FROM `empleave` WHERE empid='"+req.session.idno+"' AND `read`='0' AND `status`!='0'", function(err, user){
                            console.log("emp");
                            res.render("welcome",{title:"emp",useracc:req.session.name,userid:req.session.idno, leave:user[0]['count'], notices:notice})
                        });
                    }
                })
            })
        })
    }
    else {

        res.redirect("/");
    }


});


router.post("/actAdmin",function (req,res) {
    var postData = {
        username: req.body.username,
        password: req.body.password
    };
    userCheck.count({Name:postData.username, password:postData.password},function(err,counter){
        if(counter==1){
            userCheck.all(function(err,result){
                for(var row in result){
                    if(result[row]['Name']==postData.username){
                        var id= result[row]['id'];
                        break;
                    }
                }
                req.session.idno=id;
                req.session.name=postData.username;
                res.send(true);
            })
        }
        else{
            res.send(false);
        }

    });
});

router.get("/logout",function(req,res){
    if(req.session.name!=null){
        req.session.destroy();
        res.redirect("/");
    }
    else{
        res.redirect('/');
    }
});

module.exports = router;





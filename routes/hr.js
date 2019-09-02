var express = require('express');
var router = express.Router();
var Schema = require('jugglingdb').Schema;
var db = new Schema('mysql', {
    database: 'node',
    username: 'root'
});
var insertaccess = require("../models/person")(db);
var dep = require("../models/department")(db);
var pos = require("../models/position")(db);
var usercheck = require("../models/employee")(db);
var insertdata = require("../models/department")(db);

router.get("/addEmployee", function (req, res) {
    if(req.session.name!=null){
        dep.all(function(err,depName){
            pos.all(function(erro,posName){
                db.client.query('SELECT id from employee ORDER BY id DESC', function(err, idno){
                    var id=idno[0]['id']+1;
                    res.render("addEmployee",{title:"hr",useracc:req.session.name,userid:req.session.idno,data:'',edit:'',department:depName,position:posName,idno:id, saved:0})
                })
            })
        });
    }
    else {
        res.redirect("/");
    }
});

router.get("/editEmployee", function (req, res) {
    if(req.session.name!=null){
        var query = require('url').parse(req.url,true).query;
        var id=query.id;
        //console.log(id)
        if(id!=''){
            usercheck.find(id,function(err,result){
                dep.all(function(err,depName){
                    pos.all(function(erro,posName){
                        res.render("addEmployee",{title:"hr",useracc:req.session.name,userid:req.session.idno,data:result,edit:'1',department:depName,position:posName})

                    })
                })
            })
        }
    }
    else{
        res.redirect('/');
    }

});

router.get("/viewDetails", function (req, res) {
    if(req.session.name!=null){
        var query = require('url').parse(req.url,true).query;
        var id=query.id;
        //console.log(id)
        if(id!=''){

            usercheck.find(id,function(err,result){
                dep.all(function(err,depName){
                    pos.all(function(erro,posName){
                        res.render("addEmployee",{title:"hr",useracc:req.session.name,userid:req.session.idno,data:result,edit:'0',department:depName,position:posName})
                    })
                })
            })
        }
    }
    else{
        res.redirect('/');
    }

});

router.get("/viewProfile", function (req, res) {
    if(req.session.name!=null){

        var id = req.session.idno;

        usercheck.find(id,function(err,result){
            dep.all(function(err,depName){
                pos.all(function(erro,posName){
                    //console.log(result['firstName'])
                    res.render("addEmployee",{title:"emp",useracc:req.session.name,userid:req.session.idno,data:result,edit:'0',department:depName,position:posName})
                })
            })
        })
    }
    else{
        res.redirect('/');
    }

});

router.get("/viewEmployee", function (req, res) {
    if(req.session.name!=null){
        usercheck.all(function(err, results) {
            pos.all(function(erro,posName){
                insertaccess.all(function(erro,pass){
                    res.render("viewEmployee",{title:"hr", useracc:req.session.name,userid:req.session.idno, user:results,data:posName,log:pass})
                })

            })
        })

    }
    else {

        res.redirect("/");
    }
});

router.get("/deleteEmployee", function (req, res) {
    if(req.session.name!=null){
        var query = require('url').parse(req.url,true).query;
        var id=query.id;
        //console.log(id)
        if(id!=''){
            db.client.query('DELETE FROM employee WHERE id='+id, function(err, user){
            });
            db.client.query('DELETE FROM person WHERE id='+id, function(err, user){
            });

            res.redirect('/viewEmployee');
        }
    }
    else{
        res.redirect('/viewEmployee');
    }

});

router.post("/editEmp", function(req,res){
    if(req.session.name!=null){
        var posData = {
            firstName: req.body.txtFirst,
            middleName:req.body.txtMiddle,
            lastName: req.body.txtLast,
            empId: req.body.txtEmpId,
            dep:req.body.department,
            pos:req.body.position,
            country:req.body.country,
            homeTown:req.body.txtHomeTown,
            contact:req.body.txtContact,
            email:req.body.txtEmail,
            gender: req.body.sex,
            maritalStatus:req.body.maritalStatus,
            dob: req.body.date
        };

        usercheck.update({where:{id:posData.empId},update:{
                firstName:posData.firstName,
                middleName:posData.middleName,
                lastName:posData.lastName,
                department:posData.dep,
                position:posData.pos,
                country:posData.country,
                homeTown:posData.homeTown,
                contactNo:posData.contact,
                email:posData.email,
                gender:posData.gender,
                maritalStatus:posData.maritalStatus,
                dateofBirth:posData.dob }},function(err,cb){
            if(!err){

                res.redirect('/viewEmployee')

            }
            else{
                console.log(err);
                res.redirect('/viewEmployee')
            }

        })
        insertaccess.update({where:{id:posData.empId},update:{Name:posData.firstName}},function(erro,cbd){
        })
    }
    else{
        res.redirect('/');
    }
});

router.post("/saveEmp", function(req,res){
    if(req.session.name!=null){

        var posData = {
            firstName: req.body.txtFirst,
            middleName:req.body.txtMiddle,
            lastName: req.body.txtLast,
            empId: req.body.txtEmpId,
            dep:req.body.department,
            pos:req.body.position,
            country:req.body.country,
            homeTown:req.body.txtHomeTown,
            contact:req.body.txtContact,
            email:req.body.txtEmail,
            gender: req.body.sex,
            maritalStatus:req.body.maritalStatus,
            dob: req.body.date,
           //photo: req.files.inpFile.path

        };
        console.log(posData.firstName);
        console.log(req.body.txtContact);

        usercheck.create({
            id:posData.empId,
            firstName:posData.firstName,
            middleName:posData.middleName,
            lastName:posData.lastName,
            department:posData.dep,
            position:posData.pos,
            country:posData.country,
            homeTown:posData.homeTown,
            contactNo:posData.contact,
            email:posData.email,
            gender:posData.gender,
            maritalStatus:posData.maritalStatus,
            dateofBirth:posData.dob }, function(err,result){
            // console.log('Successfully Saved');
            if(!err){
                //   res.redirect('/viewEmployee')
                dep.all(function(err,depName){
                    pos.all(function(erro,posName){
                        db.client.query('SELECT id from employee ORDER BY id DESC', function(err, idno){
                            var id=idno[0]['id']+1;
                            res.render("addEmployee",{title:"hr",useracc:req.session.name,userid:req.session.idno,data:'',edit:'',department:depName,position:posName,idno:id, saved:1})
                        })
                    })
                });
            }
            else{
                //console.log(err);
                res.redirect('viewEmployee')
            }
        });

        function randomString() {
            var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
            var string_length = 8;
            var randomstring = '';
            for (var i=0; i<string_length; i++) {
                var rnum = Math.floor(Math.random() * chars.length);
                randomstring += chars.substring(rnum,rnum+1);
            }
            //document.randform.randomfield.value = randomstring;
            return randomstring;
        }

        var acc=0;
        insertaccess.create({
            id:posData.empId,
            Name:posData.firstName,
            password:randomString(),
            access:acc  }, function(err,result){
            // console.log('Successfully Saved');
            if(!err){
            }
            else{
                console.log(err)
            }
        })
    }
    else{
        res.redirect('/');
    }

});


module.exports = router;
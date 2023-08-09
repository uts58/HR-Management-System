var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser 		= require('body-parser');
var exSession 		= require('express-session');
var cookieParser 	= require('cookie-parser');
var methodOverride 		= require('method-override');
var index=require('./routes/index');
var hr=require('./routes/hr');
var app = express();



var Schema = require('jugglingdb').Schema;
var db = new Schema('mysql', {
  database: 'node',
  username: 'root'
});


// all environments

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(exSession({secret: 'my top secret', saveUninitialized: true, resave: false}));
app.use(cookieParser());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
//app.use('/public', express.static('public'));

//routes
app.use('/',index);
app.use('/hr',hr);

//require('./routes/index')(app,db);
// require('./routes/manageEmployeeLogin')(app,db);
// require('./routes/manageEmployee')(app,db);
// require('./routes/manageNotice')(app,db);
// require('./routes/password')(app,db);
// require('./routes/manageLeave')(app,db);
// require('./routes/message')(app,db);
// require('./routes/manageDepartment')(app,db);
// require('./routes/position')(app,db);
// require('./routes/managePerformance')(app,db);
app.set('port', process.env.PORT || 3000);
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser    = require('body-parser');
var exSession     = require('express-session');
var cookieParser  = require('cookie-parser');
var methodOverride = require('method-override');
var index = require('./routes/index');
var hr    = require('./routes/hr');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(exSession({ secret: 'my top secret', saveUninitialized: true, resave: false }));
app.use(cookieParser());
app.use(methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/hr', hr);

app.set('port', process.env.PORT || 3000);
http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser    = require('body-parser');
var exSession     = require('express-session');
var sessionDb     = require('./lib/session');
var helmet       = require('helmet');
var { csrfSync }  = require('csrf-sync');
var index = require('./routes/index');
var hr    = require('./routes/hr');

var isProduction = process.env.NODE_ENV === 'production';

if (!process.env.SESSION_SECRET) {
    if (isProduction) {
        console.error('FATAL: SESSION_SECRET must be set when NODE_ENV=production.');
        process.exit(1);
    }
    console.warn('WARNING: SESSION_SECRET is not set; using an insecure development default.');
}

// COOKIE_SECURE: "true" | "false" | "auto" (default). "auto" marks the cookie
// Secure whenever the request arrived over HTTPS (needs TRUST_PROXY behind a
// TLS-terminating proxy).
function cookieSecureSetting() {
    var v = (process.env.COOKIE_SECURE || 'auto').toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return 'auto';
}

// TRUST_PROXY: passed to Express's "trust proxy". Use the exact number of
// proxy hops in front of the app (e.g. 1), or a subnet list. Never "true":
// that trusts any client-supplied X-Forwarded-For, which defeats the per-IP
// login rate limit.
function trustProxySetting() {
    var v = process.env.TRUST_PROXY;
    if (!v) {
        if (isProduction) {
            console.warn('WARNING: TRUST_PROXY is not set. If the app runs behind a reverse proxy or load ' +
                'balancer, set it to the exact hop count (e.g. 1); otherwise HTTPS is not detected and ' +
                'every client shares one rate-limit bucket (the proxy IP).');
        }
        return false;
    }
    if (v === 'true') {
        console.error('FATAL: TRUST_PROXY=true is not allowed (it lets clients spoof their IP). ' +
            'Set the exact proxy hop count, e.g. TRUST_PROXY=1.');
        process.exit(1);
    }
    if (v === 'false') return false;
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    return v;
}

var SESSION_COOKIE_NAME = 'hrms.sid';
var SESSION_MAX_AGE_MS = (parseInt(process.env.SESSION_MAX_AGE_HOURS, 10) || 8) * 60 * 60 * 1000;
var cookieSecure = cookieSecureSetting();

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('trust proxy', trustProxySetting());
app.set('session cookie name', SESSION_COOKIE_NAME);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            // The legacy views use inline event handlers (onclick/onsubmit);
            // inline <script> blocks stay blocked.
            scriptSrcAttr: ["'unsafe-inline'"],
            // Only ask browsers to upgrade subresources when we know we're on HTTPS.
            upgradeInsecureRequests: cookieSecure === true ? [] : null
        }
    }
}));

// Liveness probe for the Docker HEALTHCHECK: no session, no DB.
app.get('/healthz', function(req, res) {
    res.type('text/plain').send('ok');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/jquery', express.static(path.dirname(require.resolve('jquery'))));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Sessions live in Postgres, in their own schema so Prisma (which manages the
// "public" schema) never sees the table or tries to drop it on `db push`.
app.use(exSession({
    store: sessionDb.createStore(exSession),
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure,
        maxAge: SESSION_MAX_AGE_MS
    }
}));

// CSRF: synchronizer token kept in the session. Forms send it as "_csrf",
// jQuery AJAX sends it in the X-CSRF-Token header (see public/js/ajax.js).
var csrf = csrfSync({
    getTokenFromRequest: function(req) {
        return (req.body && req.body._csrf) || req.headers['x-csrf-token'];
    }
});
app.use(csrf.csrfSynchronisedProtection);
// Lazy: the token (and therefore a session row) is only created when a view
// actually renders it. Redirects, 404s, static files and the health check
// never create a session.
app.use(function(req, res, next) {
    Object.defineProperty(res.locals, 'csrfToken', {
        enumerable: true,
        configurable: true,
        get: function() { return csrf.generateToken(req); }
    });
    next();
});

app.use('/', index);
app.use('/hr', hr);

app.use(function(req, res) {
    res.status(404).send('Not found');
});

// Never send stack traces or internal error details to the client.
app.use(function(err, req, res, next) { // eslint-disable-line no-unused-vars
    if (err && err.code === 'EBADCSRFTOKEN') {
        // Almost always an expired session. AJAX callers (the login form)
        // get a 403 and reload; normal form posts go back to the login page.
        if (req.xhr) return res.status(403).send('Invalid or missing CSRF token.');
        return res.redirect('/');
    }
    console.error(err);
    var status = (err && (err.status || err.statusCode)) || 500;
    if (status < 400 || status > 599) status = 500;
    res.status(status).send(status === 500 ? 'Server error' : (http.STATUS_CODES[status] || 'Error'));
});

app.set('port', process.env.PORT || 3000);
function listen() {
    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express server listening on port ' + app.get('port'));
    });
}

sessionDb.ensureSessionTable().then(function(ok) {
    if (!ok) {
        console.error('FATAL: session table ' + sessionDb.SESSION_SCHEMA + '.session does not exist. ' +
            'Create it before deploying with prisma/legacy-session-table.sql (see README), ' +
            'or set SESSION_TABLE_AUTO_CREATE=true if the app may create it.');
        process.exit(1);
    }
    listen();
}, function(err) {
    if (process.env.SESSION_TABLE_AUTO_CREATE === 'true') {
        console.error('FATAL: could not create the session table:', err.message);
        process.exit(1);
    }
    // Could not check (e.g. database not reachable yet). Start anyway; session
    // operations will fail until the database is available.
    console.error('WARNING: could not verify the session table:', err.message);
    listen();
});

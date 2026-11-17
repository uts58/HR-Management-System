var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser    = require('body-parser');
var exSession     = require('express-session');
var PgSession     = require('connect-pg-simple')(exSession);
var { Pool }      = require('pg');
var helmet        = require('helmet');
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

// TRUST_PROXY: passed to Express's "trust proxy" (e.g. 1, "loopback", "10.0.0.0/8").
function trustProxySetting() {
    var v = process.env.TRUST_PROXY;
    if (!v) return false;
    if (v === 'true') return true;
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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/jquery', express.static(path.dirname(require.resolve('jquery'))));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Sessions live in Postgres, in their own schema so Prisma (which manages the
// "public" schema) never sees the table or tries to drop it on `db push`.
var SESSION_SCHEMA = process.env.SESSION_SCHEMA || 'legacy_session';
if (!/^[a-z_][a-z0-9_]*$/.test(SESSION_SCHEMA)) {
    console.error('FATAL: SESSION_SCHEMA must be a plain lower-case identifier.');
    process.exit(1);
}
var pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

function ensureSessionSchema() {
    return pgPool.query('SELECT to_regnamespace($1) AS ns', [SESSION_SCHEMA]).then(function(r) {
        if (r.rows[0].ns === null) {
            return pgPool.query('CREATE SCHEMA IF NOT EXISTS "' + SESSION_SCHEMA + '"');
        }
    });
}

app.use(exSession({
    store: new PgSession({
        pool: pgPool,
        schemaName: SESSION_SCHEMA,
        tableName: 'session',
        createTableIfMissing: true
    }),
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
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
app.use(function(req, res, next) {
    if (req.method === 'GET') res.locals.csrfToken = csrf.generateToken(req);
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
        return res.status(403).send('Invalid or missing CSRF token. Reload the page and try again.');
    }
    console.error(err);
    var status = (err && (err.status || err.statusCode)) || 500;
    if (status < 400 || status > 599) status = 500;
    res.status(status).send(status === 500 ? 'Server error' : (http.STATUS_CODES[status] || 'Error'));
});

app.set('port', process.env.PORT || 3000);
ensureSessionSchema().then(function() {
    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express server listening on port ' + app.get('port'));
    });
}).catch(function(err) {
    console.error('FATAL: could not prepare the session store schema "' + SESSION_SCHEMA + '":', err.message);
    process.exit(1);
});

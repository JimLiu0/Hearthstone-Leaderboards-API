var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const axios = require('axios').default;
const cron = require('node-cron');
const mongoClient = require('mongodb').MongoClient;

const dbUrl = 'mongodb://localhost:27017';
const dbName = 'hs-leaderboards-snapshots';
const dbClient = new mongoClient(dbUrl, { useUnifiedTopology: true });

function connectToDb(dbName) {
  return dbClient.connect((err) => {
    if (err) {
      console.log(err);
    } else {
      console.log('Connected to db');
      let database = dbClient.db(dbName);

      cron.schedule('0 * * * *', () => {
        getLeaderboards(database);
      });
    }
  });
}

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function getLeaderboards(db) {
  axios.get('https://owen-public-production-bucket.s3.amazonaws.com/hearthstone-leaderboard/current-leaderboard.json').then(response => {
    const currentDate = new Date();
    addSnapshotToDB(db, currentDate, response.data, 'hourly');
  }).catch((error) => {
    console.log(error);
  });
}

function addSnapshotToDB(db, date, data, collectionName) {
  const snapshot = {
    'date': date,
    'data': data
  };

  db.collection(collectionName).insertOne(snapshot, (err, result) => {
    if (err) {
      console.log('DB insertion error: ' + err);
    } else {
      console.log('Snapshot added');
    }
  });
}

connectToDb(dbName);
let MongoClient = require('mongodb').MongoClient;
let _db;
let config = require('./config/database');

module.exports = {

    connect: (callback) => {
        MongoClient.connect( config.mongodb, { useNewUrlParser: true },function( err, db ) {
            _db = db.db(config.db);
            return callback( err );
        } );
    },

    getDb: () => {
        return _db
    }
};


'use strict'

const MongoClient = require('mongodb').MongoClient;

let atlasConnectionUri = null;
let cachedDb = null;

exports.handler = (event, context, callback) => {
    const uri = process.env['MONGODB_ATLAS_CLUSTER_URI'];
    atlasConnectionUri = atlasConnectionUri === null ? uri : atlasConnectionUri;
    console.info(`=> Atlas connection string, ${atlasConnectionUri}`);
    processEvent(event, context, callback);
};

function processEvent(event, context, callback) {
    console.info(`=> Calling MongoDB Atlas from AWS Lambda with event: ${JSON.stringify(event)}`);
    const jsonContents = JSON.parse(JSON.stringify(event));

    //date conversion for grades array
    if (jsonContents.grades != null) {
        for (let i = 0, len = jsonContents.grades.length; i < len; i++) {
            //use the following line if you want to preserve the original dates
            //jsonContents.grades[i].date = new Date(jsonContents.grades[i].date);

            //the following line assigns the current date so we can more easily differentiate between similar records
            jsonContents.grades[i].date = new Date();
        }
    }

    //the following line is critical for performance reasons to allow re-use of database connections across calls to this Lambda function and avoid closing the database connection. The first call to this lambda function takes about 5 seconds to complete, while subsequent, close calls will only take a few hundred milliseconds.
    context.callbackWaitsForEmptyEventLoop = false;

    try {
        if (cachedDb == null) {
            console.log('=> Connecting to database');
            MongoClient.connect(atlasConnectionUri, (err, db) => {
                cachedDb = db.db('ClusterX');
                return createDoc(cachedDb, jsonContents, callback);
            });
        } else {
            createDoc(cachedDb, jsonContents, callback);
        }
    } catch (err) {
        console.error('an error occurred', err);
    }
}

function createDoc(db, json, callback) {
    db.collection('restaurants').insertOne(json, (err, result) => {
        if (err != null) {
            console.error("=> An error occurred in createDoc", err);
            callback(null, JSON.stringify(err));
        } else {
            console.info(`=> Entry created into the restaurants collection with id: ${result.insertedId}`);
            callback(null, "SUCCESS");
        }
        //we don't need to close the connection thanks to context.callbackWaitsForEmptyEventLoop = false (above)
        //this will let our function re-use the connection on the next called (if it can re-use the same Lambda container)
        //db.close();
    });
};
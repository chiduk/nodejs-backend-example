let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
const bcrypt = require('bcrypt');
let multer = require('multer');
let shortid = require('shortid');
let saltRounds = 10
let fs = require('fs')
let getUid = require('get-uid');
let sizeOf = require('image-size');
let secret = require('../config/secret.js');
let Cryptr = require('cryptr');
let cryptr = new Cryptr(secret.key);
let util = require('../util/constants');

let profileImageStorage =  multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, util.FILE_PATH.PROFILE)
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

let profileUpload = multer({storage: profileImageStorage});

router.get('/add/user', (req, res) => {
    let db = database.getDb();
    let firstName = req.query.firstName;
    let lastName = req.query.lastName;
    let fullName = req.query.fullName;
    let email = req.query.email;

    let password = req.query.password;
    let userId = req.query.userId;
    let facebookId = req.query.facebookId;
    let googleId = req.query.googleId;
    let kakaoId = req.query.kakaoId;
    let naverId = req.query.naverId;


    let agreeEULA = req.query.agreeEULA;
    let agreePrivacyPolicy = req.query.agreePrivacyPolicy;
    let receiveEmail = req.query.receiveEmail;
    let receiveSMS = req.query.receiveSMS;


    let birthDate = req.query.birthDate;
    let gender = req.query.gender;
    let nationalInfo = req.query.nationalInfo;
    let mobileNo = req.query.mobileNo;
    let mobileCo = req.query.mobileCo;

    let userCollection = db.collection('USER');


    userCollection.findOne({email: email})
        .then(result => {
            if (result === null) {

                let user = {
                        userUID: 'U'+getUid(),
                        firstName: firstName,
                        lastName: lastName,
                        fullName: fullName,
                        email: email,
                        userId: userId,
                        date: new Date(),

                        password: cryptr.encrypt(password),
                        facebookId: facebookId,
                        googleId: googleId,
                        naverId: naverId,
                        kakaoId: kakaoId,

                        agreeEULA: agreeEULA,
                        agreePrivacyPolicy: agreePrivacyPolicy,
                        receiveEmail: receiveEmail,
                        receiveSMS: receiveSMS,
                        isInfluencer: false,
                        isSeller: false,
                        isAdmin: false,
                        isActive: true,

                        birthDate: birthDate,
                        gender: gender,
                        nationalInfo: nationalInfo,
                        mobileCo: mobileCo,
                        mobileNo: mobileNo
                    }

                    userCollection.insertOne(user)
                        .then( result => {
                            let uniqueId = result.insertedId;
                            res.json({uniqueId: uniqueId, userId: userId})
                        })
                        .catch( err => {
                            logger.error(err)
                        })

            }else{
                res.status(201).send()
            }
        })
        .catch(err => {
            logger.error('error', err);
        })


});

router.post('/upload/profile/pic',  profileUpload.any(), (req, res) => {
    let uniqueId = req.body.uniqueId;

    let isBase64 = req.body.isBase64;


    if(isBase64 !== 'undefined' && isBase64 !== 'null' && isBase64 !== undefined ){
        let imageFileBase64 = req.body.profileImageBase64.replace(/^data:image\/png;base64,/, "");

        let buf = Buffer.from(imageFileBase64, 'base64');

        fs.writeFile(util.FILE_PATH.PROFILE + uniqueId + '.png', buf, 'base64', function(err) {

            if(err){
                throw err;
            }

            res.status(200).send()
        });

    }else{
        res.status(500).send()
    }

})

router.get('/logIn', (req, res) => {
    let password = req.query.password;
    let email = req.query.email;
    let db = database.getDb();
    let userCollection = db.collection('USER');

    userCollection.findOne({email: email})
        .then( user => {
            if(user !== null){

                let decryptedPassword = cryptr.decrypt(user.password);

                if(password === decryptedPassword){
                    let obj = {
                        uniqueId: user._id,
                        userId: user.userId,
                        status: 200
                    }

                    res.json(obj)
                }else{
                    res.json({status: 402}) // incorrect password
                }


                // bcrypt.compare(password, user.password, function (e, result) {
                //     if(e){
                //         throw e;
                //     }
                //
                //     if(result){
                //         let obj = {
                //             uniqueId: user._id,
                //             userId: user.userId,
                //             status: 200
                //         }
                //
                //         res.json(obj)
                //     }else{
                //         res.json({status: 402}) // incorrect password
                //     }
                // })
            }else{
                res.json({status: 401}) // email not exists
            }
        })
        .catch(err => {
            logger.error(err)
        })
});

router.get('/facebookLogin', (req, res) => {
    let facebookId = req.query.facebookId;
    let name = req.query.name;
    let email = req.query.email;
    let lastName = req.query.lastName;
    let firstName = req.query.firstName;

    let db = database.getDb();
    let userCollection = db.collection('USER');


    userCollection.findOne({facebookId: facebookId})
        .then(result => {
            if (result !== null){
                res.json({uniqueId: result._id, name: result.name, email:result.email, userId: result.userId})
            }else{


                res.json({uniqueId: null})

            }
        })
        .catch(err => {
            logger.error(err)
        })

});

router.get('/googleLogIn', (req, res) => {
    let googleId = req.query.googleId;

    let db = database.getDb();
    let userCollection = db.collection('USER');

    userCollection.findOne({googleId: googleId})
        .then(result => {
            if(result !== null){
                res.json({uniqueId: result._id, userId: result.userId})
            }else{
                res.json({uniqueId: null})
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/kakaoLogIn', (req, res) => {
    let kakaoId = req.query.kakaoId;
    let db = database.getDb();
    let userCollection = db.collection('USER');

    userCollection.findOne({kakaoId: kakaoId})
        .then(result => {
            if(result !== null){
                res.json({uniqueId: result._id, userId: result.userId})
            }else{
                res.json({uniqueId: null})
            }
        })
        .catch(err => {
            logger.error(err)
        })
});

router.get('/naverLogIn', (req, res) => {
    let naverId = req.query.naverId;
    let email = req.query.email;
    let db = database.getDb();
    let userCollection = db.collection('USER');

    userCollection.findOne({naverId: naverId})
        .then(result => {
            if(result !== null){
                res.json({uniqueId: result._id, userId: result.userId})
            }else{
                res.json({uniqueId: null})
            }
        })
        .catch(err => {
            logger.error(err)
        })
});

router.get('/check/userId', (req, res) => {
    let userId = req.query.userId;

    let db = database.getDb();

    let userCollection = db.collection('USER');

    let regex = new RegExp( ['^', userId, '$'].join(""), 'i')

    userCollection.aggregate([
        {
            $match: { userId: {$regex: regex}}
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            if(docs.length > 0){
                res.json({isTaken: true})
            }else{
                res.json({isTaken: false})
            }
        })
    })
})

router.get('/check/email', (req, res) => {
   let email = req.query.email;

   let db = database.getDb();

   let userCollection = db.collection('USER');

   let regex = new RegExp( ['^', email, '$'].join(""), 'i')

    userCollection.aggregate([
        {
            $match: { email: {$regex: regex}}
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            if(docs.length > 0){
                res.json({isTaken: true})
            }else{
                res.json({isTaken: false})
            }
        })
    })

});

module.exports = router;

let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
const objectId = require('mongodb').ObjectID;
const multer = require('multer');
const shortid = require('shortid');
const util = require('../util/constants');
let sizeOf = require('image-size');

let jointPurchaseImageStorage =  multer.diskStorage({
    destination: function(req, file, cb){

        cb(null, util.FILE_PATH.FEED)
    },
    filename: function (req, file, cb) {
        let extension = file.originalname.split('.').pop()

        if(file.mimetype === 'video/mp4'){
            cb(null, shortid.generate() + '.mp4');
        }else{
            cb(null, shortid.generate() + '.jpg');
        }

    }
});

let jointPurchaseUpload = multer({storage: jointPurchaseImageStorage});

router.post('/feed/get/following', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTags = req.body.hashTags;
    let skip = req.body.skip;

    let hashTagQuery = {}

    if(hashTags !== undefined && hashTags !== null){
        if(hashTags.length > 0){
            hashTagQuery = { hashTags: { $in : hashTags} }
        }
    }

    if(typeof skip === 'undefined'){
        skip = 0;
    }else{
        skip = parseInt(skip);
    }

    let db = database.getDb();

    let followCollection = db.collection('FOLLOW');

    followCollection.aggregate([
        {
            $match: {followerId: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from : 'FEED',
                localField: 'followeeId',
                foreignField: 'uniqueId',
                as: 'feeds'
            }
        },
        {
            $unwind: '$feeds'
        },
        {
            $match: { 'feeds.feedType' : util.FEED_TYPE.PROMOTION}
        },
        {
            $lookup: {
                from:'HASH_TAG',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'hashTags'
            }
        },
        {
            $unwind: {
                path: '$hashTags',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as:'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'feeds.uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'FEED_PINNED',
                localField: 'uniqueId',
                foreignField: 'uniqueId',
                as:'pinnedFeed'
            }
        },
        {
            $unwind: {
                path: '$pinnedFeed',
                preserveNullAndEmptyArrays: true

            }
        },
        {
            $lookup: {
                from: 'FEED_REPORT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'blockedFeed'
            }
        },
        {
            $unwind: {
                path: '$blockedFeed',
                preserveNullAndEmptyArrays: true

            }
        },
        {
            $group: {
                _id: '$feeds._id',
                uniqueId: {$first: '$feeds.uniqueId'},
                user: {$first: '$user'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$feeds.title'},
                description: {$first: '$feeds.description'},
                productId: {$first: '$feeds.productId'},
                images: {$addToSet: '$images.filename'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                pinnedFeedId: {$addToSet:'$pinnedFeed.feedId'},
                blockedFeed:{$first: '$blockedFeed'},
                blockFeedUniqueId: {$addToSet: '$blockedFeed.uniqueId'}
            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                user: 1,
                hashTags:1,
                title: 1,
                description: 1,
                productId: 1,
                images:1,
                likeCount: {$size: '$likes'},
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'},
                pinnedFeed: 1,
                blockFeedUniqueId: 1,
                blockedFeed:1,
                isBlocked: {$cond: [{$in: [new objectId(uniqueId), '$blockFeedUniqueId']}, true, false ]},
                isPinned: {$cond: [{$in: ['$_id', '$pinnedFeedId']}, true, false ]}

            }
        },
        {
            $sort: {_id : -1}
        },
        {
            $skip: skip
        },
        {
            $match: hashTagQuery
        },
        {
            $limit: util.PROMOTION_FEED_LIMIT_COUNT
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let feeds = [];
            let pinnedFeeds = [];

            docs.forEach(doc => {

                let images = [];

                doc.images.forEach(image => {
                    images.push(image.filename)
                })

                let obj =  {
                    feedId: doc._id,
                    uniqueId: doc.uniqueId,
                    user: {},
                    title: doc.title,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    images: doc.images,
                    likeCount: doc.likeCount,
                    commentCount: doc.commentCount + doc.commentCommentCount,
                    pinnedFeed: doc.pinnedFeed,
                    blockFeedUniqueId: doc.blockFeedUniqueId,
                    isBlocked: doc.isBlocked,
                    isPinned: doc.isPinned
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                if(obj.isPinned){
                    if(!obj.isBlocked){
                        pinnedFeeds.push(obj)
                    }

                }else{
                    if(!obj.isBlocked){
                        feeds.push(obj)
                    }
                }


            })



            let result = pinnedFeeds.concat(feeds)

            res.json(result);
        })
    })
});

router.post('/feed/get', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTags = req.body.hashTags;
    let skip = req.body.skip;



    let hashTagQuery = {}

    if(hashTags !== undefined && hashTags !== null){
        if(hashTags.length > 0){
            hashTagQuery = { hashTags: { $in : hashTags} }
        }
    }

    if(typeof skip === 'undefined'){
        skip = 0;
    }else{
        skip = parseInt(skip);
    }

    let db = database.getDb();

    let feedCollection = db.collection('FEED');

    feedCollection.aggregate([
        {
            $match: {feedType: util.FEED_TYPE.PROMOTION}
        },
        {
            $lookup: {
                from:'HASH_TAG',
                localField: '_id',
                foreignField: 'feedId',
                as: 'hashTags'
            }
        },
        {
            $unwind: {
                path: '$hashTags',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as:'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'FEED_PINNED',
                localField: 'uniqueId',
                foreignField: 'uniqueId',
                as:'pinnedFeed'
            }
        },
        {
            $unwind: {
                path: '$pinnedFeed',
                preserveNullAndEmptyArrays: true

            }
        },
        {
            $lookup: {
                from: 'FEED_REPORT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'blockedFeed'
            }
        },
        {
            $unwind: {
                path: '$blockedFeed',
                preserveNullAndEmptyArrays: true

            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                user: {$first: '$user'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$title'},
                description: {$first: '$description'},
                productId: {$first: '$productId'},
                images: {$addToSet: '$images.filename'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                pinnedFeedId: {$addToSet:'$pinnedFeed.feedId'},
                blockedFeed:{$first: '$blockedFeed'},
                blockFeedUniqueId: {$addToSet: '$blockedFeed.uniqueId'}
            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                user: 1,
                hashTags:1,
                title: 1,
                description: 1,
                productId: 1,
                images:1,
                likeCount: {$size: '$likes'},
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'},
                pinnedFeed: 1,
                blockFeedUniqueId: 1,
                blockedFeed:1,
                isBlocked: {$cond: [{$in: [new objectId(uniqueId), '$blockFeedUniqueId']}, true, false ]},
                isPinned: {$cond: [{$in: ['$_id', '$pinnedFeedId']}, true, false ]}

            }
        },
        {
            $sort: {_id : -1}
        },
        {
            $skip: skip
        },

        {
            $match: hashTagQuery
        },
        {
            $limit: util.PROMOTION_FEED_LIMIT_COUNT
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let feeds = [];

            let pinnedFeeds = [];

            docs.forEach(doc => {

                let images = [];

                doc.images.forEach(image => {
                    images.push(image.filename)
                });

                let obj =  {
                    feedId: doc._id,
                    uniqueId: doc.uniqueId,
                    user: {},
                    title: doc.title,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    images: doc.images,
                    likeCount: doc.likeCount,
                    commentCount: doc.commentCount + doc.commentCommentCount,
                    pinnedFeed: doc.pinnedFeed,
                    blockFeedUniqueId: doc.blockFeedUniqueId,
                    isBlocked: doc.isBlocked,
                    isPinned: doc.isPinned
                };

                obj.user.userId = doc.user.userId;
                obj.user.uniqueId = doc.user._id;

                if(obj.isPinned){
                    if(!obj.isBlocked){
                        pinnedFeeds.push(obj)
                    }

                }else{
                    if(!obj.isBlocked){
                        feeds.push(obj)
                    }
                }
            })

            let result = pinnedFeeds.concat(feeds)

            res.json(result);
        })
    })

})

router.post('/jp/edit', jointPurchaseUpload.any(), async (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;
    let feedType = req.body.feedType;
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    let title = req.body.title;
    let subtitle = req.body.subtitle;
    let description = req.body.description;
    let hashTags = JSON.parse(req.body.hashTags);
    let products = JSON.parse(req.body.products);
    let images = req.files;
    let additionalContents = JSON.parse(req.body.additionalContents);
    let prevFeedImages = JSON.parse(req.body.prevFeedImages);

    let db = database.getDb();

    let feedCollection = db.collection('FEED');
    let hashTagCollection = db.collection('HASH_TAG');
    let imageCollection = db.collection('IMAGE');
    let feedProductCollection = db.collection('FEED_PRODUCT');

    console.log(uniqueId,feedId, title, subtitle, description, hashTags, products, images, additionalContents, prevFeedImages)

    let imageUpdate = () => {
        return new Promise((resolve, reject) => {
            imageCollection.deleteMany({feedId: new objectId(feedId)})
                .then(result => {
                    prevFeedImages.forEach(filename => {
                        let obj = {
                            feedId: new objectId(feedId),
                            filename: filename,
                            isAdditionalImage: false
                        };

                        let filepath = util.FILE_PATH.FEED + filename;

                        if(filename.endsWith('.mp4')){

                        }else{
                            obj.dimensions = sizeOf(filepath)
                        }

                        imageCollection.insertOne(obj)
                    })
                })
                .catch(err => {
                    reject(err);
                    throw err;
                })

            images.forEach(image => {


                let obj = {
                    feedId : new objectId(feedId),
                    filename: image.filename,
                    isAdditionalImage: false
                }

                let filepath = util.FILE_PATH.FEED + image.filename;

                if(image.filename.endsWith('.mp4')){

                }else{
                    obj.dimensions = sizeOf(filepath)
                }


                imageCollection.insertOne(obj)
            })

            return resolve('OK')
        })
    }

    let hashTagUpdate = () => {
        return new Promise((resolve, reject) => {
            hashTagCollection.deleteMany({feedId: new objectId(feedId)})
                .then(result => {
                    hashTags.forEach(tag => {


                        let obj = {
                            feedId: new objectId(feedId),
                            hashTag: tag
                        }

                        hashTagCollection.insertOne(obj)
                    })

                    return resolve('OK')
                })
                .catch(err => {
                    reject(err);
                    throw err;
                })
        })
    }



    let feedProductionUpdate = () => {
        return new Promise((resolve, reject) => {
            feedProductCollection.deleteMany({feedId: new objectId(feedId)})
                .then(result => {
                    products.forEach(productId => {

                        let obj = {
                            feedId: new objectId(feedId),
                            productId: new objectId(productId)
                        }

                        feedProductCollection.insertOne(obj)
                    })

                    return resolve('OK')
                })
                .catch(err => {
                    reject(err)
                    throw err;
                })

        })
    }



    let additionContentsUpdate = () => {
        return new Promise((resolve, reject) => {
            let additions = []

            feedCollection.updateOne({_id: new objectId(feedId)}, {$set: {additionalContents: []}}, {upsert: true})
                .then(result => {
                    additionalContents.forEach(addition => {
                        if(addition.type === util.FEED_ADDITIONAL_CONTENTS_TYPE.IMAGE){


                            if(addition.isExistingImage){
                                console.log(addition)

                                let imageObj = {
                                    feedId: new objectId(feedId),
                                    filename: addition.filename,
                                    isAdditionalImage: true
                                }

                                let filepath = util.FILE_PATH.FEED + addition.filename;

                                if(addition.filename.endsWith('.mp4')){

                                }else{
                                    imageObj.dimensions = sizeOf(filepath)
                                }

                                imageCollection.insertOne(imageObj)

                                let obj = {
                                    type: util.FEED_ADDITIONAL_CONTENTS_TYPE.IMAGE,
                                    filename: addition.filename
                                }

                                additions.push(obj)


                            }else{
                                let id = addition.id.split(/[:/]/)


                                let obj = {}

                                if(id.length > 0){
                                    req.files.forEach(file => {
                                        if(file.originalname === id[id.length-1]){
                                            let filename = file.filename;

                                            obj.type = util.FEED_ADDITIONAL_CONTENTS_TYPE.IMAGE;
                                            obj.filename = filename;

                                            additions.push(obj)

                                            let imageObj = {
                                                feedId: feedId,
                                                filename: filename,
                                                isAdditionalImage: true
                                            };

                                            let filepath = util.FILE_PATH.FEED + filename;

                                            if(filename.endsWith('.mp4')){

                                            }else{
                                                imageObj.dimensions = sizeOf(filepath)
                                            }


                                            imageCollection.deleteOne({filename: filename})
                                                .then(result => {
                                                    imageCollection.insertOne(imageObj)
                                                })



                                        }
                                    })
                                }
                            }

                        }else{
                            additions.push(addition)
                        }


                    })

                    feedCollection.updateOne({_id: new objectId(feedId)}, {$set:{additionalContents: additions}}, {upsert: true})
                })
                .catch(err => {

                    throw err;
                })





            return resolve('OK')
        })
    };

    let feedUpdate = () => {
        return new Promise((resolve, reject) => {

            feedCollection.updateOne({_id: new objectId(feedId)}, {$set: {feedType: feedType, startDate: new Date(startDate), endDate: new Date(endDate), title: title, subtitle: subtitle, description: description}})
                .then(result => {
                    return resolve('OK')
                })
                .catch(err => {
                    reject(err);
                    throw err;
                })
        })
    };

    let imageUpdateResult = await imageUpdate();
    let hashTagUpdateResult = await hashTagUpdate();
    let feedProductUpdateResult = await feedProductionUpdate();
    let additionalContentsUpdateResult = await additionContentsUpdate();
    let feedUpdateResult = await feedUpdate();

    if(imageUpdateResult === 'OK' && hashTagUpdateResult === 'OK' && feedProductUpdateResult === 'OK' && additionalContentsUpdateResult === 'OK' && feedUpdateResult === 'OK'){
        res.status(200).send()
    }else{
        res.status(500).send()
    }


} )

router.get('/jp/get/following', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json([])
        return
    }

    let uniqueIdMatchObj = ''

    if(uniqueId !== 'null' && uniqueId !== 'undefined' && uniqueId !== null && uniqueId !== undefined){
        uniqueIdMatchObj = new objectId(uniqueId)
    }

    let skip = parseInt(req.query.skip);
    let db = database.getDb();

    let currDateISOString = new Date().toISOString();


    let followCollection = db.collection('FOLLOW');


    followCollection.aggregate([
        {
            $match: {followerId: new objectId(uniqueId)}
        },

        {
            $lookup: {
                from : 'FEED',
                localField: 'followeeId',
                foreignField: 'uniqueId',
                as: 'feeds'
            }
        },
        {
            $unwind: '$feeds'
        },
        {
            $match: { $and : [{'feeds.startDate':{$lte: new Date(currDateISOString) }}, {'feeds.endDate': {$gte: new Date(currDateISOString) }}]}
        },
        {
            $match: { 'feeds.feedType' : 'JOINT_PURCHASE'}
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from:'HASH_TAG',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'hashTags'
            }
        },
        {
            $unwind: {
                path: '$hashTags',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup:{
                from: 'IMAGE',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField:'feeds.uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'products'
            }

        },
        {
            $unwind: {
                path: '$products',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup:{
                from: 'PRODUCT',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: {
                path: '$product',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                let: { 'purchasedProductId': '$product._id', 'influencerUniqueId': '$user._id' },
                pipeline: [
                    {
                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                    }
                ],
                as: 'match'
            }
        },
        {
            $unwind: '$match'
        },
        {
            $lookup:{
                from:'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }

        },
        {
            $unwind: '$productImages'
        },

        {
            $match: {'productImages.productImageType' : 'PRODUCT'}
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'BOOKMARKED_FEED',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }
        },
        {
            $group: {
                _id: '$feeds._id',
                uniqueId: {$first: '$feeds.uniqueId'},
                title: {$first: '$feeds.title'},
                startDate: {$first: '$feeds.startDate'},
                endDate: {$first: '$feeds.endDate'},
                description : {$first: '$feeds.description'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                discountRate: {$first: '$feeds.discountRate'},
                price: {$first: '$feeds.price'},
                currency: {$first: '$feeds.currency'},
                productId: {$first: '$feeds.productId'},
                images: {$addToSet: {imageId: '$images._id', image: '$images.filename'} },
                productImages: {$addToSet: {imageId: '$productImages._id', productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                user: {$first: '$user'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                products: {$addToSet: '$product'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                match: {$first: '$match'}
            }
        },
        {
            $unwind: '$likedFeeds'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $unwind: '$productImages'
        },
        {
            $unwind: '$images'
        },
        {
            $sort: {'productImages.imageId': 1}
        },
        {
            $sort: {'images.imageId': 1}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},

                user: {$first: '$user'},
                products: {$first: '$products'},
                images: {$first: '$images'},
                productImages: {$first: '$productImages'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                title: 1,
                startDate: 1,
                endDate: 1,
                description : 1,
                hashTags: 1,
                images: 1,
                user: 1,
                products: 1,
                productImages: 1,
                likes: {$size: '$likes'},
                comments: {$size: '$comments'},
                commentComments: {$size: '$commentComments'},
                isLiked: {$cond: [{$in: [uniqueIdMatchObj, '$likedFeeds']}, true, false ]},
                additionalContents: {$cond: [  { $eq: ['$additionalContents', null] }, [], '$additionalContents']},
                isSaved: {$cond: [{$in: [uniqueIdMatchObj, '$savedFeeds']}, true, false]},
                match: 1
            }
        },
        {
            $sort: {startDate: -1}
        },
        {
            $skip: skip
        },
        {
            $limit: util.JOINT_PURCHASE_FEED_LIMIT_COUNT
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let feeds = [];

            docs.forEach(doc => {
                let obj = {
                    productId: doc.productId,
                    uniqueId: doc.user._id,
                    name: doc.user.name,
                    feedId: doc._id,
                    title: doc.title,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    discountRate: doc.discountRate,
                    price: doc.price,
                    currency: doc.currency,
                    images: [doc.images.image],
                    products: doc.products,
                    productImages: [{productId: doc.productImages.productId, image: doc.productImages.image}],
                    user: {},
                    isSaved: doc.isSaved,
                    isLiked: doc.isLiked
                };

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                // let productImages = []
                //
                // doc.productImages.forEach(image => {
                //     if(image.type === undefined || image.type === null){
                //         let imageObj = {
                //             productId: image.productId,
                //             image: image.image
                //         }
                //
                //         productImages.push(imageObj)
                //     }else{
                //         if(image.type === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                //             let imageObj = {
                //                 productId: image.productId,
                //                 image: image.image
                //             }
                //
                //             productImages.push(imageObj)
                //         }
                //
                //
                //     }
                // })
                //
                // obj.productImages = productImages;

                if(doc.match.isConfirmed){
                    feeds.push(obj)
                }


            });

            res.json(feeds)
        })
    })
});

router.get('/jp/get', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let skip = parseInt(req.query.skip);
    let db = database.getDb();

    let feedCollection = db.collection('FEED');
    let followCollection = db.collection('FOLLOW');

    let uniqueIdMatchObj = ''

    if(uniqueId !== 'null' && uniqueId !== 'undefined' && uniqueId !== null && uniqueId !== undefined){
        uniqueIdMatchObj = new objectId(uniqueId)
    }

    let currDateISOString = new Date().toISOString();

    feedCollection.aggregate([
        {
            $match: {feedType: util.FEED_TYPE.JOINT_PURCHASE}
        },
        {
            $match: { $and : [{startDate:{$lte: new Date(currDateISOString) }}, {endDate: {$gte: new Date(currDateISOString) }}]}
        },
        {
            $lookup:{
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField:'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'products'
            }

        },
        {
            $unwind: '$products'
        },
        {
            $lookup:{
                from: 'PRODUCT',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                let: { 'purchasedProductId': '$product._id', 'influencerUniqueId': '$user._id' },
                pipeline: [
                    {
                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                    }
                ],
                as: 'match'
            }
        },
        {
            $unwind: '$match'
        },
        {
            $lookup: {
                from: 'CART',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'cart'
            }

        },
        {
            $lookup:{
                from:'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }

        },

        {
            $unwind: '$productImages'
        },

        {
            $match: {'productImages.productImageType' : 'PRODUCT'}
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'JOINT_PURCHASE_ALARM',
                localField: '_id',
                foreignField: 'feedId',
                as: 'alarms'
            }
        },
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
                foreignField: 'feedId',
                as: 'hashTags'
            }
        },
        {
            $lookup: {
                from: 'BOOKMARKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                images: {$addToSet: {imageId: '$images._id', image: '$images.filename'} },
                user: {$first: '$user'},
                products: {$addToSet: '$product'},
                productImages: {$addToSet: {imageId: '$productImages._id', productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },
        {
            $unwind: '$likedFeeds'
        },
        {
            $unwind: '$alarmUniqueIds'
        },
        {
            $unwind: '$hashTags'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $unwind: '$productImages'
        },
        {
            $unwind: '$images'
        },
        {
            $sort: {'productImages.imageId': 1}
        },
        {
            $sort: {'images.imageId': 1}
        },

        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                images: {$first: '$images'},
                user: {$first: '$user'},
                products: {$first: '$products'},

                productImages: {$first: '$productImages'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },

        {
            $project: {
                _id: 1,
                uniqueId: 1,
                title: 1,
                startDate: 1,
                endDate: 1,
                description : 1,
                hashTags: 1,
                images: 1,
                user: 1,
                products: 1,

                productImages: 1,
                likedFeeds: 1,

                comments: 1,
                commentComments: 1,
                savedFeeds: 1,
                alarms: 1,
                alarmUniqueIds: 1,
                additionalContents: 1,
                likes: {$size: '$likes'},
                match: 1

            }
        },
        {
            $sort: {startDate: -1}
        },
        {
            $skip: skip
        },

        {
            $sort: {_id: -1}
        }
    ] , (err, cursor) => {
        if(err){
            throw err;
        }

        let events = [];

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            docs.forEach(doc => {
                let obj = {
                    productId: doc.productId,
                    uniqueId: doc.user._id,
                    name: doc.user.name,
                    feedId: doc._id,
                    title: doc.title,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    additionalContents: doc.additionalContents,

                    products: doc.products,
                    images: [doc.images.image],
                    productImages: [{productId: doc.productImages.productId, image: doc.productImages.image}],
                    user: {},
                    likeCount: doc.likes,
                    commentCount: doc.comments + doc.commentComments,
                    isLiked: doc.isLiked,
                    alarmCount: 0,
                    isAlarmOn: false,
                    isFollowing: false,
                    isSaved: doc.isSaved
                };

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;
                obj.alarmCount = doc.alarms.length;

                for(let index = 0; index < doc.alarmUniqueIds.length ; index++){
                    if(doc.alarmUniqueIds[index].toString() === uniqueId){
                        obj.isAlarmOn = true;
                        break;
                    }
                }

                if(doc.match.isConfirmed){
                    events.push(obj)
                }

            });

            res.json(events);

        })


    })
});



router.get('/jp/get/all', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let skip = parseInt(req.query.skip);
    let db = database.getDb();

    let feedCollection = db.collection('FEED');
    let followCollection = db.collection('FOLLOW');

    let uniqueIdMatchObj = ''

    if(uniqueId !== 'null' && uniqueId !== 'undefined' && uniqueId !== null && uniqueId !== undefined){
        uniqueIdMatchObj = new objectId(uniqueId)
    }

    feedCollection.aggregate([
        {
            $match: {feedType: util.FEED_TYPE.JOINT_PURCHASE}
        },

        {
            $lookup:{
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField:'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'products'
            }

        },
        {
            $unwind: '$products'
        },
        {
            $lookup:{
                from: 'PRODUCT',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                let: { 'purchasedProductId': '$product._id', 'influencerUniqueId': '$user._id' },
                pipeline: [
                    {
                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                    }
                ],
                as: 'match'
            }
        },
        {
            $unwind: '$match'
        },
        {
            $lookup: {
                from: 'CART',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'cart'
            }

        },
        {
            $lookup:{
                from:'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }

        },
        {
            $unwind: '$productImages'
        },

        {
            $match: {'productImages.productImageType' : 'PRODUCT'}
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'JOINT_PURCHASE_ALARM',
                localField: '_id',
                foreignField: 'feedId',
                as: 'alarms'
            }
        },
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
                foreignField: 'feedId',
                as: 'hashTags'
            }
        },
        {
            $lookup: {
                from: 'BOOKMARKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                user: {$first: '$user'},
                products: {$addToSet: '$product'},
                images: {$addToSet: {imageId: '$images._id', image: '$images.filename'} },
                productImages: {$addToSet: {imageId: '$productImages._id', productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },
        {
            $unwind: '$likedFeeds'
        },
        {
            $unwind: '$alarmUniqueIds'
        },
        {
            $unwind: '$hashTags'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $unwind: '$productImages'
        },
        {
            $unwind: '$images'
        },
        {
            $sort: {'productImages.imageId': 1}
        },
        {
            $sort: {'images.imageId': 1}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                images: {$first: '$images'},
                user: {$first: '$user'},
                products: {$first: '$products'},

                productImages: {$first: '$productImages'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },

        {
            $project: {
                _id: 1,
                uniqueId: 1,
                title: 1,
                startDate: 1,
                endDate: 1,
                description : 1,
                hashTags: 1,
                images: 1,
                user: 1,
                products: 1,
                productImages: 1,
                likes: {$size: '$likes'},
                comments: {$size: '$comments'},
                commentComments: {$size: '$commentComments'},
                isLiked: {$cond: [{$in: [uniqueIdMatchObj, '$likedFeeds']}, true, false ]},
                alarms: 1,
                alarmUniqueIds: 1,
                alarmCount: {$size: '$alarms'},
                isAlarmOn: {$cond: [{$in: [uniqueIdMatchObj, '$alarmUniqueIds']}, true, false ]},
                additionalContents: {$cond: [  { $eq: ['$additionalContents', null] },   [],   '$additionalContents'  ]},
                isSaved: {$cond: [{$in: [uniqueIdMatchObj, '$savedFeeds']}, true, false]},
                match: 1
            }
        },
        {
            $sort: {startDate: -1}
        },
        {
            $skip: skip
        },
        {
            $limit: util.JOINT_PURCHASE_FEED_LIMIT_COUNT
        }
    ] , (err, cursor) => {
        if(err){
            throw err;
        }

        let events = [];

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            docs.forEach(doc => {
                let obj = {
                    productId: doc.productId,
                    uniqueId: doc.user._id,
                    name: doc.user.name,
                    feedId: doc._id,
                    title: doc.title,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    additionalContents: doc.additionalContents,
                    products: doc.products,
                    images: [doc.images.image],
                    productImages: [{productId: doc.productImages.productId, image: doc.productImages.image}],
                    user: {},
                    likeCount: doc.likes,
                    commentCount: doc.comments + doc.commentComments,
                    isLiked: doc.isLiked,
                    alarmCount: 0,
                    isAlarmOn: false,
                    isFollowing: false,
                    isSaved: doc.isSaved
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;




                obj.alarmCount = doc.alarms.length;

                for(let index = 0; index < doc.alarmUniqueIds.length ; index++){



                    if(doc.alarmUniqueIds[index].toString() === uniqueId){
                        obj.isAlarmOn = true;
                        break;
                    }
                }

                if(doc.match.isConfirmed){
                    events.push(obj)
                }

            });

            res.json(events);

        })


    })
});

router.get('/jp/get/for/sale', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let skip = parseInt(req.query.skip);
    let db = database.getDb();

    let uniqueIdMatchObj = '';

    if(uniqueId !== 'null' && uniqueId !== 'undefined' && uniqueId !== null && uniqueId !== undefined){
        uniqueIdMatchObj = new objectId(uniqueId)
    }

    let feedCollection = db.collection('FEED');

    let currDate = new Date(new Date().toISOString());


    feedCollection.aggregate([
        {
            $match: {feedType: util.FEED_TYPE.JOINT_PURCHASE}
        },
        {
            $match: { $and : [{startDate:{$lte: currDate }}, {endDate: {$gte: currDate}}]}
        },
        {
            $lookup:{
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField:'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'products'
            }

        },
        {
            $unwind: '$products'
        },

        {
            $lookup:{
                from: 'PRODUCT',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                let: { 'purchasedProductId': '$product._id', 'influencerUniqueId': '$user._id' },
                pipeline: [
                    {
                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                    }
                ],
                as: 'match'
            }
        },
        {
            $unwind: '$match'
        },
        {
            $lookup:{
                from:'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }

        },
        {
            $unwind: '$productImages'
        },

        {
            $match: {'productImages.productImageType' : 'PRODUCT'}
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'JOINT_PURCHASE_ALARM',
                localField: '_id',
                foreignField: 'feedId',
                as: 'alarms'
            }
        },
        {
            $lookup: {
                from: 'BOOKMARKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                user: {$first: '$user'},
                products: {$addToSet: '$product'},
                images: {$addToSet: {imageId: '$images._id', image: '$images.filename'} },
                productImages: {$addToSet: {imageId: '$productImages._id', productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                match: {$first: '$match'}
            }
        },
        {
            $unwind: '$likedFeeds'
        },
        {
            $unwind: '$alarmUniqueIds'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $unwind: '$productImages'
        },
        {
            $unwind: '$images'
        },
        {
            $sort: {'productImages.imageId': 1}
        },
        {
            $sort: {'images.imageId': 1}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                images: {$first: '$images'},
                user: {$first: '$user'},
                products: {$first: '$products'},

                productImages: {$first: '$productImages'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                title: 1,
                startDate: 1,
                endDate: 1,
                description : 1,
                hashTags: 1,
                images: 1,
                user: 1,
                products: 1,
                productImages: 1,
                likes: {$size: '$likes'},
                comments: {$size: '$comments'},
                commentComments: {$size: '$commentComments'},
                isLiked: {$cond: [{$in: [uniqueIdMatchObj, '$likedFeeds']}, true, false ]},
                alarmCount: {$size: '$alarms'},
                alarms: 1,
                alarmUniqueIds: 1,
                isAlarmOn: {$cond: [{$in: [uniqueIdMatchObj, '$alarmUniqueIds']}, true, false ]},
                additionalContents: {$cond: [  { $eq: ['$additionalContents', null] },   [],   '$additionalContents'  ]},
                isSaved: {$cond: [{$in: [uniqueIdMatchObj, '$savedFeeds']}, true, false]},
                match: 1
            }
        },
        {
            $skip: skip
        },
        {
            $sort: {_id : -1}
        }
    ] , (err, cursor) => {
        if(err){
            throw err;
        }

        let events = [];

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            docs.forEach(doc => {
                let obj = {
                    productId: doc.productId,
                    uniqueId: doc.user._id,
                    name: doc.user.name,
                    feedId: doc._id,
                    title: doc.title,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    products: doc.products,
                    images: [doc.images.image],
                    productImages: [{productId: doc.productImages.productId, image: doc.productImages.image}],
                    user: {},
                    likeCount: doc.likes,
                    commentCount: doc.comments + doc.commentComments,
                    isLiked: doc.isLiked,
                    alarmCount: doc.alaramCount,
                    isAlarmOn: doc.isAlarmOn,
                    isSaved: doc.isSaved
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                obj.alarmCount = doc.alarms.length;

                for(let index = 0; index < doc.alarmUniqueIds.length ; index++){



                    if(doc.alarmUniqueIds[index].toString() === uniqueId){
                        obj.isAlarmOn = true;
                        break;
                    }
                }


                if(doc.match.isConfirmed){
                    events.push(obj)
                }
            });

            res.json(events);
        })


    })
});

router.get('/jp/get/finished', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let skip = parseInt(req.query.skip);
    let db = database.getDb();

    let uniqueIdMatchObj = '';

    if(uniqueId !== 'null' && uniqueId !== 'undefined' && uniqueId !== null && uniqueId !== undefined){
        uniqueIdMatchObj = new objectId(uniqueId)
    }

    let feedCollection = db.collection('FEED');

    let currDate = new Date(new Date().toISOString());

    feedCollection.aggregate([
        {
            $match: {feedType: util.FEED_TYPE.JOINT_PURCHASE}
        },
        {
            $match: {endDate: {$lt: currDate}}
        },
        {
            $lookup:{
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField:'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'products'
            }
        },
        {
            $unwind: '$products'
        },

        {
            $lookup:{
                from: 'PRODUCT',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                let: { 'purchasedProductId': '$product._id', 'influencerUniqueId': '$user._id' },
                pipeline: [
                    {
                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                    }
                ],
                as: 'match'
            }
        },
        {
            $unwind: '$match'
        },
        {
            $lookup:{
                from:'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }
        },
        {
            $unwind: '$productImages'
        },

        {
            $match: {'productImages.productImageType' : 'PRODUCT'}
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'JOINT_PURCHASE_ALARM',
                localField: '_id',
                foreignField: 'feedId',
                as: 'alarms'
            }
        },
        {
            $lookup: {
                from: 'BOOKMARKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                user: {$first: '$user'},
                products: {$addToSet: '$product'},
                images: {$addToSet: {imageId: '$images._id', image: '$images.filename'} },
                productImages: {$addToSet: {imageId: '$productImages._id', productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                match: {$first: '$match'}
            }
        },
        {
            $unwind: '$likedFeeds'
        },
        {
            $unwind: '$alarmUniqueIds'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $unwind: '$productImages'
        },
        {
            $unwind: '$images'
        },
        {
            $sort: {'productImages.imageId': 1}
        },
        {
            $sort: {'images.imageId': 1}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                images: {$first: '$images'},
                user: {$first: '$user'},
                products: {$first: '$products'},

                productImages: {$first: '$productImages'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                title: 1,
                startDate: 1,
                endDate: 1,
                description : 1,
                hashTags: 1,
                images: 1,
                user: 1,
                products: 1,
                productImages: 1,
                likes: {$size: '$likes'},
                comments: {$size: '$comments'},
                commentComments: {$size: '$commentComments'},
                isLiked: {$cond: [{$in: [uniqueIdMatchObj, '$likedFeeds']}, true, false ]},
                alarmCount: {$size: '$alarms'},
                alarms: 1,
                alarmUniqueIds: 1,
                isAlarmOn: {$cond: [{$in: [uniqueIdMatchObj, '$alarmUniqueIds']}, true, false ]},
                additionalContents: {$cond: [  { $eq: ['$additionalContents', null] },   [],   '$additionalContents'  ]},
                isSaved: {$cond: [{$in: [uniqueIdMatchObj, '$savedFeeds']}, true, false]},
                match: 1
            }
        },
        {
            $skip: skip
        }
    ] , (err, cursor) => {
        if(err){
            throw err;
        }

        let events = [];

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            docs.forEach(doc => {
                let obj = {
                    productId: doc.productId,
                    uniqueId: doc.user._id,
                    name: doc.user.name,
                    feedId: doc._id,
                    title: doc.title,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    products: doc.products,
                    images: [doc.images.image],
                    productImages: [{productId: doc.productImages.productId, image: doc.productImages.image}],
                    user: {},
                    likeCount: doc.likes,
                    commentCount: doc.comments + doc.commentComments,
                    isLiked: doc.isLiked,
                    alarmCount: doc.alaramCount,
                    isAlarmOn: doc.isAlarmOn,
                    isSaved: doc.isSaved
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                obj.alarmCount = doc.alarms.length;

                for(let index = 0; index < doc.alarmUniqueIds.length ; index++){



                    if(doc.alarmUniqueIds[index].toString() === uniqueId){
                        obj.isAlarmOn = true;
                        break;
                    }
                }


                if(doc.match.isConfirmed){
                    events.push(obj)
                }
            });

            res.json(events);
        })


    })
});

router.get('/jp/get/will/start', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let skip = parseInt(req.query.skip);
    let db = database.getDb();

    let uniqueIdMatchObj = ''

    if(uniqueId !== 'null' && uniqueId !== 'undefined' && uniqueId !== null && uniqueId !== undefined){
        uniqueIdMatchObj = new objectId(uniqueId)
    }

    let feedCollection = db.collection('FEED');

    let currDate = new Date(new Date().toISOString());


    feedCollection.aggregate([
        {
            $match: {feedType: util.FEED_TYPE.JOINT_PURCHASE}
        },
        {
            $match: {startDate: {$gt: currDate}}
        },
        {
            $lookup:{
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $lookup: {
                from: 'USER',
                localField:'uniqueId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'products'
            }

        },
        {
            $unwind: '$products'
        },

        {
            $lookup:{
                from: 'PRODUCT',
                localField: 'products.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'MATCH_PRODUCT',
                let: { 'purchasedProductId': '$product._id', 'influencerUniqueId': '$user._id' },
                pipeline: [
                    {
                        $match: { $expr: { $and: [  { $eq: ['$productId', '$$purchasedProductId'] }, {$eq : ['$uniqueId', '$$influencerUniqueId']   }  ] }   }
                    }
                ],
                as: 'match'
            }
        },
        {
            $unwind: '$match'
        },
        {
            $lookup:{
                from:'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }

        },
        {
            $unwind: '$productImages'
        },

        {
            $match: {'productImages.productImageType' : 'PRODUCT'}
        },
        {
            $lookup: {
                from: 'LIKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FEED',
                localField: 'comments._id',
                foreignField: 'commentFeedId',
                as: 'commentComments'
            }
        },
        {
            $lookup: {
                from: 'JOINT_PURCHASE_ALARM',
                localField: '_id',
                foreignField: 'feedId',
                as: 'alarms'
            }
        },
        {
            $lookup: {
                from: 'BOOKMARKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                user: {$first: '$user'},
                products: {$addToSet: '$product'},
                images: {$addToSet: {imageId: '$images._id', image: '$images.filename'} },
                productImages: {$addToSet: {imageId: '$productImages._id', productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                match: {$first: '$match'}
            }
        },
        {
            $unwind: '$likedFeeds'
        },
        {
            $unwind: '$alarmUniqueIds'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $unwind: '$productImages'
        },
        {
            $unwind: '$images'
        },
        {
            $sort: {'productImages.imageId': 1}
        },
        {
            $sort: {'images.imageId': 1}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first: '$title'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                description : {$first: '$description'},
                hashTags: {$first: '$hashTags'},
                images: {$first: '$images'},
                user: {$first: '$user'},
                products: {$first: '$products'},

                productImages: {$first: '$productImages'},
                likedFeeds: {$addToSet: '$likes.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                alarms: {$first: '$alarms'},
                alarmUniqueIds: {$addToSet: '$alarms.uniqueId'},
                additionalContents: {$first: '$additionalContents'},
                match: {$first: '$match'}
            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                title: 1,
                startDate: 1,
                endDate: 1,
                description : 1,
                hashTags: 1,
                images: 1,
                user: 1,
                products: 1,
                productImages: 1,
                likes: {$size: '$likes'},
                comments: {$size: '$comments'},
                commentComments: {$size: '$commentComments'},
                isLiked: {$cond: [{$in: [uniqueIdMatchObj, '$likedFeeds']}, true, false ]},
                alarmCount: {$size: '$alarms'},
                alarms: 1,
                alarmUniqueIds: 1,
                isAlarmOn: {$cond: [{$in: [uniqueIdMatchObj, '$alarmUniqueIds']}, true, false ]},
                additionalContents: {$cond: [  { $eq: ['$additionalContents', null] },   [],   '$additionalContents'  ]},
                isSaved: {$cond: [{$in: [uniqueIdMatchObj, '$savedFeeds']}, true, false]},
                match: 1
            }
        },
        {
            $skip: skip
        }
    ] , (err, cursor) => {
        if(err){
            throw err;
        }

        let events = [];

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            docs.forEach(doc => {
                let obj = {
                    productId: doc.productId,
                    uniqueId: doc.user._id,
                    name: doc.user.name,
                    feedId: doc._id,
                    title: doc.title,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    products: doc.products,
                    images: [doc.images.image],
                    productImages: [{productId: doc.productImages.productId, image: doc.productImages.image}],
                    user: {},
                    likeCount: doc.likes,
                    commentCount: doc.comments + doc.commentComments,
                    isLiked: doc.isLiked,
                    alarmCount: doc.alaramCount,
                    isAlarmOn: doc.isAlarmOn,
                    isSaved: doc.isSaved
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                obj.alarmCount = doc.alarms.length;

                for(let index = 0; index < doc.alarmUniqueIds.length ; index++){


                    if(doc.alarmUniqueIds[index].toString() === uniqueId){
                        obj.isAlarmOn = true;
                        break;
                    }
                }


                if(doc.match.isConfirmed){
                    events.push(obj)
                }


            });

            res.json(events);
        })
    })
});

router.post('/jp/upload', jointPurchaseUpload.any() , (req, res) => {

    let db = database.getDb();
    let imageFiles = req.files;
    let uniqueId = req.body.uniqueId;
    let title = req.body.title;
    let startDate = req.body.startDate;
    let endDate = req.body.endDate;
    let products = JSON.parse(req.body.products);


    let hashTags = JSON.parse(req.body.hashTags);
    let description = req.body.description;


    let additionalContents = JSON.parse(req.body.additionalContents);

    let feedCollection = db.collection('FEED');
    let imageCollection = db.collection('IMAGE');
    let feedProductCollection = db.collection('FEED_PRODUCT')
    let hashTagCollection = db.collection('HASH_TAG');
    let influencerCollection = db.collection('INFLUENCER');

    influencerCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(influencer => {
            if(influencer !== null) {

                let obj = {
                    feedType: util.FEED_TYPE.JOINT_PURCHASE,
                    uniqueId: new objectId(uniqueId),
                    title: title,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    description: description,
                    additionalContents: additionalContents
                }


                feedCollection.insertOne(obj)
                    .then(result => {
                        let feedId = result.insertedId;

                        products.forEach(productId => {
                            let obj = {
                                feedId: feedId,
                                productId: new objectId(productId)
                            };

                            feedProductCollection.insertOne(obj)
                        });

                        imageFiles.forEach(image => {
                            let imageObj = {
                                feedId : feedId,
                                filename: image.filename,
                                date: new Date()
                            };

                            let filepath = util.FILE_PATH.FEED + image.filename;

                            if(image.filename.endsWith('.mp4')){

                            }else{
                                imageObj.dimensions = sizeOf(filepath);
                            }



                            imageCollection.insertOne(imageObj)


                        });

                        hashTags.forEach(tag => {
                            let obj = {
                                feedId: feedId,
                                hashTag: tag
                            };
                            hashTagCollection.insertOne(obj)
                        });

                        let additions = [];

                        additionalContents.forEach(addition => {
                            if(addition.type === util.FEED_ADDITIONAL_CONTENTS_TYPE.IMAGE){


                                let id = addition.id.split(/[:/]/)


                                let obj = {}

                                if(id.length > 0){
                                    req.files.forEach(file => {
                                        if(file.originalname === id[id.length-1]){
                                            let filename = file.filename;

                                            obj.type = util.FEED_ADDITIONAL_CONTENTS_TYPE.IMAGE;
                                            obj.filename = filename;

                                            additions.push(obj)

                                            let imageObj = {
                                                feedId: feedId,
                                                filename: filename,
                                                isAdditionalImage: true
                                            };

                                            let filepath = util.FILE_PATH.FEED + filename

                                            if(filename.endsWith('.mp4')){

                                            }else{
                                                imageObj.dimensions = sizeOf(filepath);
                                            }




                                            imageCollection.deleteOne({filename: filename})
                                                .then(result => {
                                                    imageCollection.insertOne(imageObj)
                                                })



                                        }
                                    })
                                }


                            }else{
                                additions.push(addition)
                            }
                        })

                        feedCollection.updateOne({_id: feedId}, {$set:{additionalContents: additions}}, {upsert: true})


                        res.status(200).send();
                    })
                    .catch( err => {
                        res.status(500).send();
                        throw err;
                    })


            }else{

                res.status(600).send()
            }
        })



});

router.get('/get/hashTags', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    let savedHashTagCollection = db.collection('FEED_SAVED_HASH_TAG');



    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null'){

        res.json([]);
        return;
    }

    savedHashTagCollection.aggregate([
        {
            $match: {
                uniqueId: new objectId(uniqueId)
            }
        }
    ],(err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let hashTags = [];

            docs.forEach(doc => {
                hashTags.push(doc.hashTag);
            })

            res.json(hashTags)
        })
    })
})

router.post('/add/hashTag', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTag = req.body.hashTag;

    let db = database.getDb();

    let savedHashTagCollection = db.collection('FEED_SAVED_HASH_TAG');

    savedHashTagCollection.findOne({uniqueId: new objectId(uniqueId), hashTag: hashTag})
        .then(result => {
            if(result === null){
                savedHashTagCollection.insertOne({uniqueId: new objectId(uniqueId), hashTag: hashTag})
                    .then(r => {

                    })
                    .catch(e => {

                    })

            }

            res.status(200).send()

        })
        .catch(err => {
            if(err){
                res.status(500).send()
                throw err;
            }
        })
});

router.post('/delete/hashTag', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let hashTag = req.body.hashTag;

    let db = database.getDb();

    let savedHashTagCollection = db.collection('FEED_SAVED_HASH_TAG');

    savedHashTagCollection.deleteOne({uniqueId: new objectId(uniqueId), hashTag: hashTag})
        .then(result => {
            res.status(200).send()
        })
        .catch( err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/get/hashTag/influencer', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === null || uniqueId === undefined || uniqueId === 'null' || uniqueId === 'undefined'){

        res.json([]);
        return;
    }

    let db = database.getDb();

    let savedFeedHashTagCollection = db.collection('FEED_SAVED_HASH_TAG');

    savedFeedHashTagCollection.aggregate([//5d47fb9a223606e99418f0c8
        {$match: {uniqueId: new objectId(uniqueId)}},
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: 'hashTag',
                foreignField: 'hashTag',
                as: 'feedHashTags'
            }
        },
        {
            $unwind: '$feedHashTags'
        },
        {
            $match: {'feedHashTags.feedId': {$exists: true}}
        },
        {
            $group: {
                _id: '$hashTag',
                feeds: {$addToSet: '$feedHashTags.feedId'}
            }
        },
        {
            $lookup: {
                from : 'FEED',
                localField: 'feeds',
                foreignField: '_id',
                as: 'hashTagFeeds'
            }
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'hashTagFeeds.uniqueId',
                foreignField: '_id',
                as: 'influencers'
            }
        },
        {
            $unwind: '$influencers'
        },
        {
            $lookup: {
                from: 'FOLLOW',
                localField: 'influencers._id',
                foreignField: 'followeeId',
                as: 'followers'
            }
        },

        {
            $project: {
                _id: 1,
                influencers: 1,
                followerCount: {$size: '$followers'}
            }
        },
        {
            $group: {

                _id: '$_id',
                influencer: {$push: {info: '$influencers', followerCount: '$followerCount'}}
            }
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let data = [];

            docs.forEach(doc => {
                let obj = {
                    hashTag: doc._id,
                    influencers: []
                }

                doc.influencer.forEach(influencer => {

                    if(influencer.info._id.toString() !== uniqueId){
                        let infObj = {
                            uniqueId: influencer.info._id,
                            userId: influencer.info.userId
                        }

                        obj.influencers.push(infObj)

                    }

                })

                data.push(obj)
            });

            res.json(data)
        })
    })
});


module.exports = router;
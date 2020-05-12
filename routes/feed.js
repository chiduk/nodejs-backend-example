let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
const objectId = require('mongodb').ObjectID;
const multer = require('multer');
const shortid = require('shortid');
const util = require('../util/constants');
let sizeOf = require('image-size');

let feedImageStorage =  multer.diskStorage({
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

let feedUpload = multer({storage: feedImageStorage});

router.get('/like/count', (req, res) => {
    let feedId = req.query.feedId;

    let db = database.getDb();

    let likedFeedCollection = db.collection('LIKED_FEED')

    likedFeedCollection.countDocuments({feedId: new objectId(feedId)})
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/comment/count', (req, res) => {
    let feedId = req.query.feedId;

    let db = database.getDb();

    let feedCollection = db.collection('FEED');

    feedCollection.aggregate([
        {
            $match: { _id: new objectId(feedId)}
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
            $group: {
                _id: '$_id',
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'}

            }
        },
        {
            $project: {
                _id: 1,
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'}
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

            let result = {count: 0}
            docs.forEach(doc => {


                result.count = doc.commentCount + doc.commentCommentCount
            })

            res.json(result)
        })
    })
})

router.post('/add/comment/comment', (req, res) => {
    let uniqueId = req.body.uniqueId; //reviewer id
    let comment = req.body.comment;
    let feedId = req.body.feedId;
    let commentFeedId = req.body.commentFeedId;
    let lastCommentCommentFeedId = req.body.lastCommentCommentFeedId;
    let mentionUser = req.body.mentionUser;

    let reviewerUniqueId = uniqueId;

    let db = database.getDb();

    let commentCommentFeedCollection = db.collection('COMMENT_COMMENT_FEED');
    let notificationCollection = db.collection('NOTIFICATION');
    let feedCollection = db.collection('FEED');

    let users = {};

    if( typeof mentionUser !== 'undefined'){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0];
            users[name] = new objectId(user[name]);
        })
    }

    let commentComment = {
        uniqueId: new objectId(uniqueId),

        commentFeedId: new objectId(commentFeedId),
        comment: comment,
        mentionUser: users
    }

    commentCommentFeedCollection.insertOne(commentComment)
        .then(result => {

            let feedCommentCommentId = result.insertedId;


            feedCollection.findOne({_id: new objectId(feedId)})
                .then(result => {

                    if(result !== null){
                        let ownerUniqueId = result.uniqueId;

                        let notiObj = {
                            feedId: new objectId(feedId),
                            // ownerUniqueId: ownerUniqueId,
                            feedCommentCommentId: feedCommentCommentId,
                            reviewerUniqueId: new objectId(reviewerUniqueId)

                        };

                        // notificationCollection.insertOne(notiObj)
                        //     .then(r2 => {
                        //
                        //     })
                        //     .catch(err => {
                        //
                        //
                        //
                        //         throw err;
                        //     })

                    }
                });



            if(lastCommentCommentFeedId !== null && lastCommentCommentFeedId !== undefined){

                commentCommentFeedCollection.aggregate([
                    {
                        $match: {commentFeedId: new objectId(commentFeedId)}
                    },
                    {
                        $match:
                            {$and: [ { _id: {$gt: new objectId(lastCommentCommentFeedId) }}, {_id: {$lte: result.insertedId}}]}
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
                    }
                ], (err, cursor) => {
                    if(err){
                        throw err;
                    }

                    cursor.toArray((e2, docs) => {
                        if(e2){
                            throw e2;
                        }

                        let comments = [];
                        docs.forEach( doc => {
                            let user = doc.user;
                            user.uniqueId = doc.user._id;
                            let obj = {
                                commentCommentFeedId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: user
                            }

                            comments.push(obj)
                        })

                        res.json(comments)
                    })
                })



            }else{

                commentCommentFeedCollection.aggregate([
                    {
                        $match: { _id: result.insertedId}
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
                    }
                ], (err, cursor) => {
                    if(err){
                        return err;
                    }

                    cursor.toArray((e2, docs) => {
                        if(e2){
                            throw e2;
                        }

                        let comments = [];
                        docs.forEach( doc => {
                            let user = doc.user;
                            user.uniqueId = doc.user._id;

                            let obj = {
                                commentCommentFeedId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: user
                            }

                            comments.push(obj)
                        })

                        res.json(comments)
                    })
                })

            }

        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/add/comment', (req, res) => {
    let uniqueId = req.body.uniqueId; //reviewer id
    let comment = req.body.comment;
    let feedId = req.body.feedId;

    let reviewerUniqueId = uniqueId;

    let db = database.getDb();

    let commentFeedCollection = db.collection('COMMENT_FEED');
    let notificationCollection = db.collection('NOTIFICATION');
    let feedCollection = db.collection('FEED');
    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');


    let commentObj = {
        uniqueId: new objectId(uniqueId),
        feedId: new objectId(feedId),
        comment: comment
    };



    commentFeedCollection.insertOne(commentObj)
        .then( result => {

            let commentId = result.insertedId;

            feedCollection.aggregate([
                {
                    $match: {_id: new objectId(feedId)}
                },
                {
                    $lookup: {
                        from: 'USER',
                        localField: 'uniqueId',
                        foreignField: '_id',
                        as:'feedOwner'
                    }
                },
                {

                    $unwind: '$feedOwner'
                }
            ], (err ,cursor) => {
                if(err){
                    res.status(500).send();
                    throw err;
                }

                cursor.toArray((e2, docs) => {
                    if(e2){
                        res.status(500).send();
                        throw e2;
                    }

                    docs.forEach(doc => {
                        let feedOnwerUniqueId = doc.feedOwner._id;

                        if(feedOnwerUniqueId.toString() === reviewerUniqueId){

                        }else{
                            let notiObj = {
                                notificationType: util.NOTIFICATION_TYPE.FEED_COMMENT,
                                feedCommentId: commentId,
                                feedId: new objectId(feedId),
                                ownerUniqueId: feedOnwerUniqueId,
                                reviewerUniqueId: new objectId(reviewerUniqueId)
                            }

                            notificationCollection.insertOne(notiObj)
                                .then(r2 => {
                                    notificationCountCollection.updateOne({uniqueId: feedOnwerUniqueId}, {$inc: {count: 1}}, {upsert: true} )
                                })
                                .catch(err => {
                                    throw err;
                                })
                        }
                    })
                })
            })


            res.json({commentFeedId: result.insertedId})
        })
        .catch( err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        });

})

router.post('/delete/comment', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let commentFeedId = req.body.commentFeedId;

    let db = database.getDb();

    let commentFeedCollection = db.collection('COMMENT_FEED')

    commentFeedCollection.deleteOne({_id: new objectId(commentFeedId)})
        .then( result => {

            res.status(200).send()
        })
        .catch( err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })

});

router.post('/edit/comment', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let comment = req.body.comment;
    let commentFeedId = req.body.commentFeedId;

    let db = database.getDb();

    let commentFeedCollection = db.collection('COMMENT_FEED');

    commentFeedCollection.updateOne({_id: new objectId(commentFeedId)}, {$set: {comment: comment}}, {upsert: true})
        .then( result => {
            res.status(200).send()
        })
        .catch( err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/getFeedComments', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let feedId = req.query.feedId;
    let skip = parseInt(req.query.skip);

    let db = database.getDb();
    let commentFeedCollection = db.collection('COMMENT_FEED');

    commentFeedCollection.aggregate([
        {
            $match: {feedId: new objectId(feedId)}
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
            $skip: skip
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }


        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let comments = []

            docs.forEach(doc => {
                let comment = {
                    commentFeedId: doc._id,
                    uniqueId: doc.uniqueId,
                    comment: doc.comment,
                    user: {}
                };

                comment.user.uniqueId = doc.user._id;
                comment.user.userId = doc.user.userId;

                comments.push(comment)
            });

            res.json(comments)
        })
    })
});

router.get('/get/comment/comment', (req, res) => {
    let commentFeedId = req.query.commentFeedId;
    let db = database.getDb();

    let commentCommentFeedCollection = db.collection('COMMENT_COMMENT_FEED');

    commentCommentFeedCollection.aggregate([
        {
            $match: { commentFeedId: new objectId(commentFeedId)}
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'uniqueId',
                foreignField: '_id',
                as:'user'
            }
        },
        {
            $unwind: '$user'
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let replies = [];

            docs.forEach(doc => {

                let obj = {
                    commentCommentFeedId: doc._id,
                    comment: doc.comment,
                    mentionUser: doc.mentionUser,
                    user: {}
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                replies.push(obj)
            })

            res.json(replies)
        })
    })
})

router.post('/request/alarm', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;

    let db = database.getDb();

    let jointPurchaseAlarmCollection = db.collection('JOINT_PURCHASE_ALARM')

    let obj = {
        uniqueId: new objectId(uniqueId),
        feedId: new objectId(feedId)
    }

    jointPurchaseAlarmCollection.findOne(obj)
        .then(result => {
            if(result === null){
                jointPurchaseAlarmCollection.insertOne(obj)
                    .then(result => {
                        jointPurchaseAlarmCollection.countDocuments({feedId: new objectId(feedId)})
                            .then(count => {
                                res.json({count: count})
                            })
                            .catch(err => {
                                logger.error(err);
                                res.status(500).send();
                                throw err;
                            })
                    })
            }else{
                jointPurchaseAlarmCollection.countDocuments({feedId: new objectId(feedId)})
                    .then(count => {
                        res.json({count: count})
                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })
            }
        })
        .catch(err => {

            res.status(500).send()
            throw err;
        })
})

router.post('/unrequest/alarm', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;

    let db = database.getDb()

    let jointPurchaseAlarmCollection = db.collection('JOINT_PURCHASE_ALARM')

    let obj = {
        uniqueId: new objectId(uniqueId),
        feedId: new objectId(feedId)
    }

    jointPurchaseAlarmCollection.deleteOne(obj)
        .then(result => {
            jointPurchaseAlarmCollection.countDocuments({feedId: new objectId(feedId)})
                .then(count => {
                    res.json({count: count})
                })
                .catch(err => {
                    logger.error(err);
                    res.status(500).send();
                    throw err;
                })

        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
})


router.get('/getDetail', (req, res) => {
    let feedId = req.query.feedId;
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    let feedCollection = db.collection('FEED');

    feedCollection.aggregate([
        {

            $match: {_id: new objectId(feedId)}
        },

        {
            $lookup: {
                from: 'FEED_PRODUCT',
                localField: '_id',
                foreignField: 'feedId',
                as: 'feedProduct'
            }

        },
        {
            $unwind: {
                path: '$feedProduct',
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: 'PRODUCT',
                localField: 'feedProduct.productId',
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
                from: 'IMAGE',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'productImages'
            }
        },
        {
            $unwind: {
                path: '$productImages',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: '_id',
                foreignField: 'feedId',
                as: 'feedImages'
            }
        },
        {
            $unwind: '$feedImages'
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
            $unwind:{
                path: '$hashTags',
                preserveNullAndEmptyArrays: true
            }
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
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                feedType: {$first: '$feedType'},
                title: {$first: '$title'},
                subtitle: {$first: '$subtitle'},
                description: {$first: '$description'},
                productImages: {$addToSet: {productId: '$product._id', image: '$productImages.filename', type: '$productImages.productImageType' }},
                feedImages: {$addToSet: '$feedImages'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                user: {$first: '$user'},
                discountRate: {$first: '$discountRate'},
                products: {$addToSet: '$product'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                additionalContents: {$first: '$additionalContents'}

            }
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                feedType: 1,
                title: 1,
                subtitle:1,
                description: 1,
                products: 1,
                productImages: 1,
                feedImages: 1,
                hashTags: 1,
                user: 1,
                discountRate: 1,
                likeCount: {$size: '$likes'},
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'},
                startDate:1,
                endDate: 1,
                additionalContents:1
            }
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }


        cursor.toArray((e2, docs) => {
            let result = {};
            docs.forEach( doc => {


                let products = doc.products;

                products.forEach(item => {
                    let index = products.indexOf(item);

                    products[index].productId = item._id


                })


                let feedImages = [];


                doc.feedImages.forEach(image => {


                    if(image.isAdditionalImage === undefined){

                        feedImages.push(image.filename)
                    }else{
                        if(image.isAdditionalImage){



                        }else{

                            feedImages.push(image.filename)
                        }

                    }
                })

                result = {
                    feedId: doc._id,
                    uniqueId: doc.uniqueId,
                    feedType: doc.feedType,
                    title: doc.title,
                    subtitle: doc.subtitle,
                    description: doc.description,
                    products: products,
                    productImages: doc.productImages,
                    feedImages: feedImages,
                    hashTags: doc.hashTags,
                    user: {},
                    discountRate: doc.discountRate,
                    likeCount: doc.likeCount,
                    commentCount: doc.commentCount + doc.commentCommentCount,
                    startDate: doc.startDate,
                    endDate: doc.endDate,
                    additionalContents: doc.additionalContents

                };

                result.user.uniqueId = doc.user._id;
                result.user.userId = doc.user.userId;


                let productImages = []

                doc.productImages.forEach(image => {
                    if(image.type === undefined || image.type === null){
                        let imageObj = {
                            productId: image.productId,
                            image: image.image
                        }

                        productImages.push(imageObj)
                    }else{
                        if(image.type === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                            let imageObj = {
                                productId: image.productId,
                                image: image.image
                            }

                            productImages.push(imageObj)
                        }


                    }
                })

                result.productImages = productImages;

            })



            res.json(result)

        })
    })

})


router.post('/like', (req, res) => {
    let feedId = req.body.feedId;
    let uniqueId = req.body.uniqueId;



    let db = database.getDb();
    let likedFeedCollection = db.collection('LIKED_FEED');

    let obj = {
        feedId: new objectId(feedId),
        uniqueId: new objectId(uniqueId)
    }

    likedFeedCollection.findOne(obj)
        .then(result => {
            if( result === null){
                likedFeedCollection.insertOne(obj)
                    .then(inserted => {
                        if(inserted.result.ok){

                            likedFeedCollection.countDocuments({feedId: new objectId(feedId)})
                                .then(count => {

                                    res.json({count: count})
                                })
                                .catch(err => {
                                    logger.error(err);
                                    res.status(500).send();
                                    throw err;
                                })
                        }else{
                            res.status(500).send()
                        }
                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })
            }else{

            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/unlike', (req, res) => {
    let feedId = req.body.feedId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();
    let likedFeedCollection = db.collection('LIKED_FEED');

    let obj = {
        feedId: new objectId(feedId),
        uniqueId: new objectId(uniqueId)
    };

    likedFeedCollection.deleteOne(obj)
        .then(result => {
            if(result.result.ok){
                likedFeedCollection.countDocuments({feedId: new objectId(feedId)})
                    .then(count => {

                        res.json({count: count})
                    })
                    .catch(err => {

                        res.status(500).send();
                        throw err;
                    })
            }else{
                res.status(500).send()
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/isLiked', (req, res) => {
    let feedId = req.query.feedId;
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json({isLiked: false})
        return
    }

    let db = database.getDb();
    let likedFeedCollection = db.collection('LIKED_FEED')

    likedFeedCollection.findOne({feedId: new objectId(feedId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            if(result === null){
                res.json({isLiked: false})
            }else{
                res.json({isLiked: true})
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/save', (req, res) => {
    let feedId = req.body.feedId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();
    let bookmarkedFeedCollection = db.collection('BOOKMARKED_FEED');

    let obj = {
        feedId: new objectId(feedId),
        uniqueId: new objectId(uniqueId)
    }

    bookmarkedFeedCollection.findOne(obj)
        .then(result => {
            if(result === null){
                bookmarkedFeedCollection.insertOne(obj)
                    .then(inserted => {
                        if(inserted.result.ok){
                            res.status(200).send()
                        }else{
                            res.status(500).send()
                        }
                    })
                    .catch(err => {
                        logger.error(err);
                        res.status(500).send();
                        throw err;
                    })
            }else{
                res.status(200).send()
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })

});

router.post('/unsave', (req, res) => {
    let feedId = req.body.feedId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();
    let bookmarkedFeedCollection = db.collection('BOOKMARKED_FEED');

    let obj = {
        feedId: new objectId(feedId),
        uniqueId: new objectId(uniqueId)
    }

    bookmarkedFeedCollection.deleteOne(obj)
        .then(result => {
            if(result.result.ok){
                res.status(200).send()
            }else{
                res.status(500).send()
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })


});

router.get('/isSaved', (req, res) => {
    let feedId = req.query.feedId;
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json({isSaved: false})
        return
    }

    let db = database.getDb();
    let bookmarkedFeedCollection = db.collection('BOOKMARKED_FEED');

    let obj = {
        feedId: new objectId(feedId),
        uniqueId: new objectId(uniqueId)
    }

    bookmarkedFeedCollection.findOne(obj)
        .then(result => {
            if(result === null){
                res.json({isSaved: false})
            }else{
                res.json({isSaved: true})
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
})

router.post('/upload', feedUpload.any(), (req, res) => {
    let uniqueId = req.body.uniqueId;
    let title = req.body.title;
    let subtitle = req.body.subtitle;
    let description = req.body.description;
    let hashTags = JSON.parse(req.body.hashTags);
    let products = JSON.parse(req.body.products);
    let images = req.files;
    let additionalContents = JSON.parse(req.body.additionalContents);
    let db = database.getDb();

    let feedCollection = db.collection('FEED');
    let imageCollection = db.collection('IMAGE');
    let hashTagCollection = db.collection('HASH_TAG');
    let feedProductCollection = db.collection('FEED_PRODUCT');
    let influencerCollection = db.collection('INFLUENCER');

    influencerCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(influencer => {
            if(influencer !== null) {
                let feed = {
                    feedType: util.FEED_TYPE.PROMOTION,
                    uniqueId: new objectId(uniqueId),
                    title: title,
                    subtitle: subtitle,
                    description: description,
                }

                feedCollection.insertOne(feed)
                    .then(result => {
                        if(result !== null){
                            let feedId = result.insertedId;

                            images.forEach(image => {


                                let obj = {
                                    feedId : feedId,
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

                            hashTags.forEach(tag => {


                                let obj = {
                                    feedId: feedId,
                                    hashTag: tag
                                }

                                hashTagCollection.insertOne(obj)
                            })

                            products.forEach(productId => {


                                let obj = {
                                    feedId: feedId,
                                    productId: new objectId(productId)
                                }

                                feedProductCollection.insertOne(obj)
                            })

                            let additions = []

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

                                                let filepath = util.FILE_PATH.FEED + filename;

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

                            res.status(200).send()
                        }
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err;
                    })
            }else{

                res.status(600).send()
            }
        })

});

router.get('/get/suggested', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let uniqueIdObj = '';

    if(uniqueId === 'null'){

    }else{
        uniqueIdObj = new objectId(uniqueId)
    }


    let feedId = req.query.feedId;
    let db = database.getDb();
    let feedCollection = db.collection('FEED');

    feedCollection.aggregate([
        {
            $match: {_id: new objectId(feedId)}
        },
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
                foreignField: 'feedId',
                as:'hashTags'
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
                from: 'HASH_TAG',
                localField: 'hashTags.hashTag',
                foreignField: 'hashTag',
                as: 'feeds'
            }
        },
        {
            $unwind: {
                path: '$feeds',
                preserveNullAndEmptyArrays: true
            }

        },
        {
            $group: {
                _id: '$feeds.feedId'
            }
        },
        {
            $lookup: {
                from: 'FEED',
                localField: '_id',
                foreignField: '_id',
                as: 'similarFeeds'

            }
        },
        {
            $unwind: '$similarFeeds'
        },
        {
            $group: {
                _id: '$_id',
                feed: {$first: '$similarFeeds'}
            }
        },
        {
            $project: {
                result: {$cond: [ {$ne: ['$feed._id', new objectId(feedId)] } , '$feed', {} ]   }

            }
        },
        {
            $lookup: {
                from:'HASH_TAG',
                localField: 'result._id',
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
                localField: 'result._id',
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
                localField: 'result.uniqueId',
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
                localField: 'result._id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: 'result._id',
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
                from: 'BOOKMARKED_FEED',
                localField: 'result._id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }

        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$result.uniqueId'},
                user: {$first: '$user'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$result.title'},
                description: {$first: '$result.description'},
                productId: {$first: '$result.productId'},
                images: {$addToSet: '$images.filename'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                myLikedFeed: {$addToSet: '$likes.uniqueId'},
            }
        },
        {
            $unwind: '$myLikedFeed'
        },
        {
            $unwind: '$savedFeeds'
        },
        {
            $project: {
                _id: 1,
                uniqueId: 1,
                user: 1,
                hashTags: 1,
                title: 1,
                description: 1,
                productId: 1,
                images: 1,
                likeCount: {$size: '$likes'},
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'},
                savedFeeds: 1,
                isLiked: {$cond: [{$in: [uniqueIdObj, '$myLikedFeed']}, true, false]},
                isSaved: {$cond: [{$in: [uniqueIdObj, '$savedFeeds']}, true, false]}

            }
        },
        {
            $limit: 10
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
                    feedId: doc._id,
                    uniqueId: doc.uniqueId,
                    user: doc.user,
                    title: doc.title,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    images: doc.images,
                    likeCount: doc.likeCount,
                    commentCount: doc.commentCount + doc.commentCommentCount,
                    isLiked: doc.isLiked,
                    isSaved: doc.isSaved
                }

                feeds.push(obj)
            })

            res.json(feeds)
        })
    })
});

router.post('/edit', feedUpload.any(), async (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;
    let feedType = req.body.feedType;
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
                        }

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

                                imageCollection.insertOne(imageObj)

                                let obj = {
                                    type: util.FEED_ADDITIONAL_CONTENTS_TYPE.IMAGE,
                                    filename: addition.filename
                                }

                                additions.push(obj)


                            }else{
                                let id = addition.id.split(/[:/]/)
                                console.log('ID', id)

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

            feedCollection.updateOne({_id: new objectId(feedId)}, {$set: {feedType: feedType, title: title, subtitle: subtitle, description: description}})
                .then(result => {
                    feedCollection.updateOne({_id: new objectId(feedId)}, {$unset: {startDate: '', endDate: ''}})

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


} );

router.post('/delete', async (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;

    let db = database.getDb();

    let feedCollection = db.collection('FEED');
    let hashTagCollection = db.collection('HASH_TAG');
    let imageCollection = db.collection('IMAGE');
    let commentFeedCollection = db.collection('COMMENT_FEED');
    let commentCommentFeedCollection = db.collection('COMMENT_COMMENT_FEED');

    let deleteHashTag = () => {
        return new Promise((resolve, reject) => {
            hashTagCollection.deleteMany({feedId: new objectId(feedId)})
                .then(result => {
                    return resolve('OK')
                })
                .catch(err => {
                    reject(err)
                    throw err;
                })
        });
    };

    let deleteImages = () => {
        return new Promise((resolve, reject) => {
            imageCollection.deleteMany({feedId: new objectId(feedId)})
                .then(result => {
                    return resolve('OK')
                })
                .catch(err => {
                    reject(err)
                    throw err;
                })
        });
    };

    let deleteComments = () => {
        return new Promise((resolve, reject) => {
            commentFeedCollection.find({feedId: new objectId(feedId)}).toArray((err, docs) => {
                if(err){
                    reject(err);
                    throw err;
                }

                docs.forEach(doc => {
                    commentCommentFeedCollection.deleteMany({commentFeedId: doc._id})
                        .then(result => {

                        })
                        .catch(err => {
                            reject(err);
                            throw err;
                        })
                })

                commentFeedCollection.deleteMany({feedId: new objectId(feedId)})
                    .then(() => {
                        return resolve('OK')
                    })
                    .catch(err => {
                        reject(err);
                        throw err;
                    })
            })
        })
    };

    let deleteFeed = () => {

        return new Promise((resolve, reject) => {
            feedCollection.deleteOne({_id: new objectId(feedId)})
                .then(() => {
                    return resolve('OK');
                })
                .catch(err => {
                    reject(err);
                    throw err;
                })

        });
    }

    let deleteHashTagResult = await deleteHashTag();
    let deleteImagesResult = await deleteImages();
    let deleteCommentsResult = await deleteComments();
    let deleteFeedResult = await deleteFeed()

    if(deleteHashTagResult === 'OK' && deleteImagesResult === 'OK' && deleteCommentsResult === 'OK' && deleteFeedResult === 'OK'){
        res.status(200).send()
    }else{
        res.status(500).send()
    }



});

router.post('/report', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;
    let report = req.body.report;

    let db = database.getDb();

    let obj = {
        uniqueId: new objectId(uniqueId),
        feedId: new objectId(feedId),
        report: report
    }

    let feedReportCollection = db.collection('FEED_REPORT');

    feedReportCollection.insertOne(obj)
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.post('/pin', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;

    let db = database.getDb();

    let feedPinCollection = db.collection('FEED_PINNED')

    let obj = {
        uniqueId : new objectId(uniqueId),
        feedId: new objectId(feedId)
    }

    feedPinCollection.findOne(obj)
        .then(result => {
            if(result === null){
                feedPinCollection.insertOne(obj)

            }

            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })

})

router.post('/unpin', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let feedId = req.body.feedId;

    let db = database.getDb();

    let feedPinCollection = db.collection('FEED_PINNED')

    let obj = {
        uniqueId : new objectId(uniqueId),
        feedId: new objectId(feedId)
    }

    feedPinCollection.deleteOne(obj)
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })

});

router.get('/get/similar', (req, res) => {
    let feedOwnerUniqueId = req.query.feedOwnerUniqueId;
    let feedId = req.query.feedId;

    let db = database.getDb();

    let feedCollection = db.collection('FEED');
    let sellerCollection = db.collection('SELLER');
    let productCollection = db.collection('PRODUCT');

    sellerCollection.findOne({uniqueId: new objectId(feedOwnerUniqueId)})
        .then(seller => {
            if(seller !== null){
                let sellerId = seller._id;

                productCollection.aggregate([
                    {
                        $match: {sellerId: sellerId}
                    },
                    {
                        $lookup: {
                            from: 'SELLER',
                            localField: 'sellerId',
                            foreignField: '_id',
                            as:'seller'
                        }
                    },
                    {
                        $unwind: '$seller'
                    },
                    {
                        $lookup: {
                            from:'FEED_PRODUCT',
                            localField: '_id',
                            foreignField: 'productId',
                            as: 'productFeeds'
                        }
                    },
                    {
                        $unwind: {
                            path: '$productFeeds'
                        }
                    },
                    {
                        $lookup: {
                            from: 'FEED',
                            localField: 'productFeeds.feedId',
                            foreignField: '_id',
                            as: 'feeds'
                        }
                    },
                    {
                        $unwind: {
                            path: '$feeds'
                        }
                    },
                    {
                        $lookup: {
                            from: 'USER',
                            localField: 'feeds.uniqueId',
                            foreignField: '_id',
                            as: 'feedUser'
                        }
                    },
                    {
                        $unwind: '$feedUser'
                    },
                    {
                        $lookup: {
                            from:'IMAGE',
                            localField: 'feeds._id',
                            foreignField: 'feedId',
                            as: 'feedImages'
                        }
                    },
                    {
                        $lookup: {
                            from: 'IMAGE',
                            localField: '_id',
                            foreignField: 'productId',
                            as: 'productImages'
                        }
                    },
                    {
                        $lookup: {
                            from: 'HASH_TAG',
                            localField: 'feeds._id',
                            foreignField: 'feedId',
                            as: 'hashTags'
                        }
                    }
                ], (err, cursor) => {
                    if(err){
                        res.status(500).send()
                        throw err;
                    }

                    cursor.toArray((e2, docs) => {
                        if(e2){
                            res.status(500).send()
                            throw e2;
                        }

                        let feeds = []
                        docs.forEach(doc => {

                            if(feedId === doc.feeds._id.toString()){
                                return;
                            }


                            let obj = {
                                feed:{
                                    feedId: doc.feeds._id,
                                    feedType: doc.feeds.feedType,
                                    title: doc.feeds.title,
                                    description: doc.feeds.description,
                                    images: [],
                                    user: {
                                        uniqueId: doc.feedUser._id,
                                        userId: doc.feedUser.userId
                                    },
                                    hashTags: []
                                },
                                product: {
                                    productId: doc._id,
                                    title: doc.title,
                                    price: doc.price,
                                    description: doc.description,
                                    discountRate : doc.discountRate,
                                    currency: doc.currency,
                                    images: []
                                },
                                seller: {
                                    sellerId: doc.seller._id,
                                    sellerName: doc.seller.sellerName
                                }
                            }

                            if(doc.feeds.feedType === util.FEED_TYPE.JOINT_PURCHASE){
                                obj.feed.startDate = doc.feeds.startDate;
                                obj.feed.endDate = doc.feeds.endDate;
                            }

                            doc.feedImages.forEach(image => {
                                obj.feed.images.push(image.filename)
                            })

                            doc.productImages.forEach(image => {
                                if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                                    obj.product.images.push(image.filename)
                                }

                            })


                            doc.hashTags.forEach(hashTag => {


                                obj.feed.hashTags.push(hashTag.hashTag)
                            });

                            if(obj.feed.images.length > 0){
                                feeds.push(obj)
                            }

                        })

                        res.json(feeds);
                    })
                })

            }else{
                res.json([])
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
})

module.exports = router;
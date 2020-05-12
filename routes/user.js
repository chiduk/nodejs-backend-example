let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
let bcrypt = require('bcrypt');
let saltRounds = 10;
let secret = require('../config/secret.js');
let Cryptr = require('cryptr');
let cryptr = new Cryptr(secret.key);
let util = require('../util/constants');
let nodemailer = require('nodemailer');

router.post('/follow', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let followeeId = req.body.followeeId;

    let db = database.getDb();

    let followCollection = db.collection('FOLLOW');

    let obj = {
        followerId: new objectId(uniqueId),
        followeeId: new objectId(followeeId)
    }

    followCollection.findOne(obj)
        .then( result => {
            if(result === null){
                followCollection.insertOne(obj)
                    .then(result => {
                        if(result.result.ok){
                            res.status(200).send()
                        }else{
                            res.status(500).send()
                        }
                    })
            }else{
                res.status(200).send()
            }
        })
        .catch( err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })

});

router.post('/unfollow', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let followeeId = req.body.followeeId;

    let db = database.getDb();

    let followCollection = db.collection('FOLLOW');

    let obj = {
        followerId: new objectId(uniqueId),
        followeeId: new objectId(followeeId)
    }

    followCollection.deleteOne(obj)
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

router.get('/isFollowing', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let followeeId = req.query.followeeId;

    if(uniqueId === 'null'){
        res.json({isFollowing: false})
        return
    }

    let db = database.getDb();

    let followCollection = db.collection('FOLLOW');

    let obj = {
        followerId: new objectId(uniqueId),
        followeeId: new objectId(followeeId)
    }

    followCollection.findOne(obj)
        .then(result => {
            if( result === null){
                res.json({isFollowing: false});
            }else{
                res.json({isFollowing: true});
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/getFollowerCount', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();

    let followCollection = db.collection('FOLLOW');


    followCollection.find({followeeId: new objectId( uniqueId)}).count()
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })

});

router.get('/getFollowingCount', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();
    let followCollection = db.collection('FOLLOW');

    followCollection.find({followerId: new objectId( uniqueId)}).count()
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send()
            throw err;
        })
});

router.get('/getFollower', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();
    let followCollection = db.collection('FOLLOW');

    followCollection.aggregate([
        {
            $match: { followeeId: new objectId(uniqueId) }
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'followerId',
                foreignField: '_id',
                as:'followers'
            }
        },
        {
            $unwind: '$followers'
        },
        {
            $group: {
                _id: '$followeeId',
                followers: {$addToSet: '$followers'}
            }
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {

            let followers = [];

            docs.forEach(doc => {
                doc.followers.forEach(follower => {
                    let obj = {
                        uniqueId: follower._id,
                        name: follower.name
                    }

                    followers.push(obj);
                })
            })

            res.json(followers);
        })
    })
});

router.get('/getFollowing', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();
    let followCollection = db.collection('FOLLOW');

    followCollection.aggregate([
        {
            $match: { followerId: new objectId(uniqueId) }
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'followeeId',
                foreignField: '_id',
                as:'followees'
            }
        },
        {
            $unwind: '$followees'
        },
        {
            $group: {
                _id: '$followerId',
                followees: {$addToSet: '$followees'}
            }
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {

            let followees = [];

            docs.forEach(doc => {
                doc.followees.forEach(followee => {
                    let obj = {
                        uniqueId: followee._id,
                        name: followee.name
                    };

                    followees.push(obj);
                })
            });

            res.json(followees)
        })
    })
});

router.get('/get/forum', (req, res) => {

    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined'){
        res.json([])
        return
    }


    let db = database.getDb();

    let forumCollection = db.collection('FORUM')

    forumCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
                foreignField: 'forumId',
                as: 'hashTags'
            }
        },
        {
            $lookup: {
                from: 'LIKED_FORUM',
                localField: '_id',
                foreignField: 'forumId',
                as: 'likedForums'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FORUM',
                localField: '_id',
                foreignField: 'forumId',
                as: 'comments'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_COMMENT_FORUM',
                localField: 'comments._id',
                foreignField: 'commentForumId',
                as: 'commentComments'
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
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                title: {$first:'$title'},
                article: {$first: '$article'},
                date: {$first: '$date'},
                user: {$first: '$user'},
                likedForums: {$addToSet: '$likedForums'},
                myLikedForums: {$addToSet: '$likedForums.uniqueId'},
                comments: {$addToSet: '$comments'},
                commentComments: {$addToSet: '$commentComments'},
                mentionUser: {$first: '$mentionUser'},
                hashTags: {$addToSet: '$hashTags.hashTag'}
            }
        },
        {
            $unwind: '$likedForums'
        },
        {
            $unwind: '$comments'
        },
        {
            $unwind: '$commentComments'
        },
        {
            $unwind: '$hashTags'
        },
        {
            $unwind: '$user'
        },
        {
            $unwind: '$myLikedForums'
        },
        {
            $project: {
                uniqueId:1,
                title: 1,
                article:1,
                date: 1,
                user: 1,
                mentionUser:1,
                hashTags:1,
                myLikedForums: 1,
                numOfLikes: {$size:'$likedForums'},
                numOfComments: {$size: '$comments'},
                numOfCommentComments: {$size: '$commentComments'},
                isLiked: {$cond: [{$in: [new objectId(uniqueId), '$myLikedForums']}, true, false ]}
            }
        },
        {
            $sort: {_id: -1}

        }
    ], (err2, cursor2) => {
        if(err2){
            throw err2;
        }

        cursor2.toArray((e2, docs2) => {
            if(e2){
                throw e2;
            }

            let forums = [];

            docs2.forEach(doc2 => {
                let obj = {
                    forumId: doc2._id,
                    uniqueId: doc2.uniqueId,
                    title: doc2.title,
                    article: doc2.article,
                    date: doc2.date,
                    user: doc2.user,
                    mentionUser: doc2.mentionUser,
                    isLiked: doc2.isLiked,
                    hashTags: doc2.hashTags,
                    numOfLikes: doc2.numOfLikes,
                    numOfComments: doc2.numOfComments + doc2.numOfCommentComments
                }

                forums.push(obj);
            });

            res.json(forums);
        })
    })
})

router.get('/get/feed', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let viewMode = req.query.viewMode;


    if(uniqueId === 'undefined' || uniqueId === 'null'){
        res.json([]);
        return;
    }

    let db = database.getDb();

    let feedCollection = db.collection('FEED');


    let promotionFeedFilter = {$match: {}};
    let jpFeedFilter = {$match: {}};
    let currDateISOString = new Date().toISOString();
    //let currDate = new Date(currDateUTCString);



    if(viewMode === util.PROFILE_SOCIAL_VIEW_MODE.VIEW_ALL){

    }else if(viewMode === util.PROFILE_SOCIAL_VIEW_MODE.VIEW_FOR_SALE){


    }else{

    }

    feedCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
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
            $unwind: '$hashTags'
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
                from: 'BOOKMARKED_FEED',
                localField: '_id',
                foreignField: 'feedId',
                as:'savedFeeds'
            }

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
            $group: {
                _id: '$_id',
                feedType: {$first: '$feedType'},
                uniqueId: {$first: '$uniqueId'},
                user: {$first: '$user'},
                startDate: {$first: '$startDate'},
                endDate: {$first: '$endDate'},
                feedProduct: {$addToSet: '$feedProduct'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$title'},
                description: {$first: '$description'},
                productId: {$first: '$productId'},
                images: {$addToSet: '$images.filename'},
                myLikes: {$addToSet: '$likes'},
                myLikedFeed: {$addToSet: '$likes.uniqueId'},
                savedFeeds: {$addToSet: '$savedFeeds.uniqueId'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'}
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
                feedType: 1,
                uniqueId: 1,
                user: 1,
                hashTags:1,
                startDate: 1,
                endDate: 1,
                feedProduct: 1,
                title: 1,
                description: 1,
                productId: 1,
                images:1,
                myLikes:1,
                myLikedFeed:1,
                likeCount: {$size: '$likes'},
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'},
                savedFeeds:1,
                isLiked: {$cond: [{$in: [new objectId(uniqueId), '$myLikedFeed']}, true, false ]},
                isSaved: {$cond: [{$in: [new objectId(uniqueId), '$savedFeeds']}, true, false ]},
                isJPForSale: {$and:  [ { $lt: [ "$startDate", new Date(currDateISOString) ] }, { $gt: [ "$endDate", new Date(currDateISOString) ] } ]  }
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

            let feeds = [];

            docs.forEach(doc => {


                if(viewMode === util.PROFILE_SOCIAL_VIEW_MODE.VIEW_FOR_SALE){
                    if(doc.feedType === util.FEED_TYPE.JOINT_PURCHASE){
                        if(doc.isJPForSale){
                            let obj = {
                                feedId: doc._id,
                                uniqueId: doc.uniqueId,
                                user: {},
                                title: doc.title,
                                description: doc.description,
                                hashTags: doc.hashTags,
                                images: doc.images,
                                likeCount: doc.likeCount,
                                isLiked: doc.isLiked,
                                isSaved: doc.isSaved,
                                commentCount: doc.commentCount + doc.commentCommentCount

                            };

                            obj.user.userId = doc.user.userId;
                            obj.user.uniqueId = doc.user._id;

                            feeds.push(obj);
                        }
                    }else{
                        if(doc.feedProduct.length > 0 ){
                            let obj = {
                                feedId: doc._id,
                                uniqueId: doc.uniqueId,
                                user: {},
                                title: doc.title,
                                description: doc.description,
                                hashTags: doc.hashTags,
                                images: doc.images,
                                likeCount: doc.likeCount,
                                isLiked: doc.isLiked,
                                isSaved: doc.isSaved,
                                commentCount: doc.commentCount + doc.commentCommentCount

                            };

                            obj.user.userId = doc.user.userId;
                            obj.user.uniqueId = doc.user._id;

                            feeds.push(obj);
                        }
                    }
                }else if(viewMode === util.PROFILE_SOCIAL_VIEW_MODE.VIEW_ALL){
                    let obj = {
                        feedId: doc._id,
                        uniqueId: doc.uniqueId,
                        user: {},
                        title: doc.title,
                        description: doc.description,
                        hashTags: doc.hashTags,
                        images: doc.images,
                        likeCount: doc.likeCount,
                        isLiked: doc.isLiked,
                        isSaved: doc.isSaved,
                        commentCount: doc.commentCount + doc.commentCommentCount

                    };

                    obj.user.userId = doc.user.userId;
                    obj.user.uniqueId = doc.user._id;

                    feeds.push(obj);
                }

            });

            console.log(feeds)

            res.json(feeds)
        })
    })
});

router.get('/get/review', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    if(uniqueId === 'null' || uniqueId === 'undefined'){
        res.json([])
        return
    }

    let commentProductCollection = db.collection('COMMENT_PRODUCT')

    commentProductCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
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
                from: 'PRODUCT',
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'

        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'productId',
                foreignField: 'productId',
                as: 'images'
            }

        },
        {
            $group: {
                _id: '$_id',
                productId: {$first: '$productId'},
                feedId: {$first: '$feedId'},
                comment: {$first: '$comment'},
                user: {$first: '$user'},
                product: {$first: '$product'},
                images: {$addToSet: '$images.filename'}
            }

        },
        {
            $unwind: '$images'
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send();
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }

            let comments = []

            docs.forEach(doc => {
                doc.commentId = doc._id;

                let obj = {

                    commentId : doc._id,
                    comment: doc.comment,
                    images: doc.images,
                    product: doc.product,
                    feedId: doc.feedId,
                    user: {}
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                obj.product.productId = doc.product._id;


                comments.push(obj)
            })

            res.json(comments)
        })
    })
});


router.get('/get/saved', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'undefined' || uniqueId === 'null'){
        res.json([]);
        return;
    }

    let db = database.getDb();

    let bookmarkedFeedCollection = db.collection('BOOKMARKED_FEED');

    bookmarkedFeedCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from: 'FEED',
                localField: 'feedId',
                foreignField: '_id',
                as: 'savedFeeds'
            }
        },
        {
            $lookup: {
                from:'HASH_TAG',
                localField: 'savedFeeds._id',
                foreignField: 'feedId',
                as: 'hashTags'
            }
        },
        {
            $unwind: '$hashTags'
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'savedFeeds._id',
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
                localField: 'savedFeeds.uniqueId',
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
                localField: 'savedFeeds._id',
                foreignField: 'feedId',
                as: 'likes'
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: 'savedFeeds._id',
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
            $unwind: '$savedFeeds'
        },
        {
            $group: {
                _id: '$_id',
                feedId: {$first: '$feedId'},
                uniqueId: {$first: '$uniqueId'},
                user: {$first: '$user'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$savedFeeds.title'},
                description: {$first: '$savedFeeds.description'},
                productId: {$first: '$savedFeeds.productId'},
                images: {$addToSet: '$images.filename'},
                likes: {$first: '$likes'},
                myLikedFeed: {$addToSet: '$likes.uniqueId'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'}
            }
        },
        {
            $project: {
                _id: 1,
                feedId:1,
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
                isLiked: {$cond: [{$in: [new objectId(uniqueId), '$myLikedFeed']}, true, false ]}

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

            let feeds = [];

            docs.forEach(doc => {


                let obj = {
                    bookmarkId: doc._id,
                    feedId: doc.feedId,
                    uniqueId: doc.uniqueId,
                    user: {},
                    title: doc.title,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    images: doc.images,
                    likeCount: doc.likeCount,
                    isSaved: true,
                    isLiked: doc.isLiked,
                    commentCount: doc.commentCount + doc.commentCommentCount

                };

                obj.user.userId = doc.user.userId;
                obj.user.uniqueId = doc.user._id;

                feeds.push(obj);
            });

            res.json(feeds)
        })
    })

})

router.get('/get/following/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === undefined || uniqueId === 'null'){
        res.json({count: 0});
        return;
    }

    let db = database.getDb();



    let followCollection = db.collection('FOLLOW')

    followCollection.countDocuments({followerId: new objectId(uniqueId)})
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.get('/get/follow/count', (req, res)=> {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    if(uniqueId === undefined || uniqueId === 'null'){
        res.json({count: 0});
        return;
    }

    let followCollection = db.collection('FOLLOW');

    followCollection.countDocuments({followeeId: new objectId(uniqueId)})
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/get/forum/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    let forumCollection = db.collection('FORUM');

    forumCollection.countDocuments({uniqueId: new objectId(uniqueId)})
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/get/product/comment/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null'){
        res.json({count: 0});
        return;
    }

    let db = database.getDb();

    let commentProductCollection = db.collection('COMMENT_PRODUCT');

    commentProductCollection.countDocuments({uniqueId: new objectId(uniqueId)})
        .then(count => {
            res.json({count: count})
        })
        .catch(err => {
            res.status(500).send();
        })

});

router.get('/get/info', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.status(500).send()
        return
    }


    let db = database.getDb();

    let userCollection = db.collection('USER');


    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(result => {
            if( result !== null ){
                let user = {
                    userId: result.userId,
                    // firstName: result.firstName,
                    // lastName: result.lastName,
                    // email: result.email,
                    instagram: result.instagram,
                    youtube: result.youtube,
                    blog: result.blog
                };

                res.json(user)
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/get/my/info', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' || uniqueId === undefined || uniqueId === null){
        res.status(500).send()
        return
    }

    let db = database.getDb();

    let userCollection = db.collection('USER');

    userCollection.aggregate([
        {
            $match: {_id: new objectId(uniqueId)}
        },
        {
            $lookup: {
                from: 'INFLUENCER_APPLICATION',
                localField: '_id',
                foreignField: 'uniqueId',
                as: 'influencerApplication'
            }
        },
        {

            $unwind: {
                path: '$influencerApplication',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'SELLER_APPLICATION',
                localField: '_id',
                foreignField: 'uniqueId',
                as: 'sellerApplication'
            }
        },
        {

            $unwind: {
                path: '$sellerApplication',
                preserveNullAndEmptyArrays: true
            }
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send();
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }

            let result = {};

            docs.forEach(doc => {
                result = {
                    userId: doc.userId,
                    firstName: doc.fullName,
                    lastName: '',
                    fullName: doc.fullName,
                    email: doc.email,
                    instagram: doc.instagram,
                    youtube: doc.youtube,
                    blog: doc.blog,
                    isInfluencerApplied: false,
                    isSellerApplied: false,
                    isSeller: false,
                    isInfluencer: false,
                    isAdmin: doc.isAdmin
                };

                if(doc.influencerApplication !== undefined){
                    result.isInfluencerApplied = true;

                    if(doc.influencerApplication.isApproved){
                        result.isInfluencer = true;
                    }
                }

                if(doc.sellerApplication !== undefined){
                    result.isSellerApplied = true;

                    if(doc.sellerApplication.isApproved){
                        result.isSeller = true;
                    }
                }




            });

            res.json(result)
        })
    });


});


router.post('/save/address', (req, res) => {
    let uniqueId = req.body.uniqueId;
    let addressId = req.body.addressId;
    let content = req.body.content;
    let isDefaultAddress = req.body.isDefaultAddress;



    let db = database.getDb();

    let addressCollection = db.collection('ADDRESS');

    let obj = {
        uniqueId: new objectId(uniqueId),
        content: content
    };

    if(addressId === undefined || addressId === null){
        addressCollection.insertOne(obj)
            .then(result => {
                if(isDefaultAddress){
                    setDefaultAddress(uniqueId, result.insertedId.toString(), res);
                }else{


                    res.json({addressId: result.insertedId})
                }
            })
            .catch(err => {
                res.status(500).send();
                throw err;
            })
    }else{
        addressCollection.updateOne({_id: new objectId(addressId)}, {$set: {isDefaultAddress: isDefaultAddress, content: content}}, {upsert: true})
            .then( () => {
                if(isDefaultAddress){
                    setDefaultAddress(uniqueId, addressId, res);
                }else{


                    res.json({addressId: addressId})
                }


            })
            .catch(err => {
                res.status(500).send();
                throw err;
            })
    }
});

function setDefaultAddress(uniqueId, addressId, res) {
    let db = database.getDb();
    let addressCollection = db.collection('ADDRESS');

    addressCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId)}
        }
    ], (err, cursor) => {
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
                if(doc._id.toString() === addressId){
                    addressCollection.updateOne({_id: doc._id}, {$set: {isDefaultAddress: true}})
                }else{
                    addressCollection.updateOne({_id: doc._id}, {$set: {isDefaultAddress: false}})
                }
            })



            res.json({addressId: addressId})
        });

    })

}

router.get('/get/address', (req, res) => {
   let uniqueId = req.query.uniqueId;

   if(uniqueId === 'null'){
       res.json([]);
       return;
   }

   let db = database.getDb();



   let addressCollection = db.collection('ADDRESS');

   addressCollection.aggregate([
       {$match: {uniqueId: new objectId(uniqueId)}}
   ], (err, cursor) => {
       if(err){
           throw err;
       }

       cursor.toArray((e2, docs) => {
           if(e2){
               throw e2;
           }

           let addresses = [];

           docs.forEach(doc => {
               let address = doc;

               address.addressId = doc._id;
               addresses.push(address)
           })

           res.json(addresses);
       })
   })
});

router.post('/delete/address', (req, res) => {
    let addressId = req.body.addressId;
    let uniqueId = req.body.uniqueId;

    let db = database.getDb();
    let addressCollection = db.collection('ADDRESS');

    addressCollection.deleteOne({_id: new objectId(addressId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.post('/update/info', async (req, res) => {
   let uniqueId = req.body.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' ||uniqueId === undefined || uniqueId === null){


        res.status(500).send()

        return
    }

    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let userId = req.body.userId;
    let email = req.body.email;
    let updatePassword = req.body.updatePassword;
    let currentPassword = req.body.currentPassword;
    let applyForInfluencer = req.body.applyForInfluencer;
    let applyForSeller = req.body.applyForSeller;
    let newPassword = req.body.newPassword;
    let instagram = req.body.instagram;
    let youtube =  req.body.youtube;
    let blog = req.body.blog;



    let db = database.getDb();

    let userCollection = db.collection('USER');
    let influencerApplicationCollection = db.collection('INFLUENCER_APPLICATION');
    let sellerApplicationCollection = db.collection('SELLER_APPLICATION');



    let newInfo = {
        firstName: firstName,
        lastName: lastName,
        fullName: lastName + firstName,
        userId: userId,
        email: email,
        instagram: instagram,
        youtube: youtube,
        blog: blog
    }


    let passwordUpdate = () => {
        return new Promise((resolve, reject) => {
            if(updatePassword === '1'){


                userCollection.updateOne({_id: new objectId(uniqueId)}, {$set: {password: cryptr.encrypt(newPassword)}}, {upsert: true})
                    .then( result => {


                        return resolve('OK');

                    })
                    .catch( err => {
                        // res.status(500).send();
                        reject(err);
                        throw err;
                    })

            }else{

                return resolve('OK');

            }
        })
    };

    let userInfoUpdate = () => {
        return new Promise((resolve, reject) => {
            userCollection.updateOne({_id: new objectId(uniqueId)}, {$set: newInfo}, {upsert: true})
                .then(result => {

                    return resolve('OK')

                })
                .catch(err => {
                    reject(err);

                    throw err;
                })
        })

    };

    let submitInfluencerApplication = () => {
        return new Promise(((resolve, reject) => {
            if(applyForInfluencer === '1'){
                let application = req.body.influencerApplication;

                application.uniqueId = new objectId(uniqueId);
                application.isApproved = false;
                application.isDenied = false;

                application.personalIDNumber = cryptr.encrypt(application.personalIDNumber);

                influencerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
                    .then(result => {
                        if(result === null){
                            influencerApplicationCollection.insertOne(application)
                                .then(r3 => {

                                })
                                .catch(err => {
                                    reject(err);
                                    throw err;
                                })
                        }else{
                            influencerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
                                .then(application => {
                                    if(application.isApproved){

                                    }else{

                                    }
                                })
                                .catch(err => {
                                    reject(err);
                                    throw err;
                                })
                        }

                        return resolve('OK')
                    })
            }else(
                resolve('OK')
            )
        }))


    };

    let submitSellerApplication = () => {
        return new Promise(((resolve, reject) => {
            if(applyForSeller === '1'){


                let application = req.body.sellerApplication;

                application.uniqueId = new objectId(uniqueId);
                application.isApproved = false;
                application.isDenied = false;

                sellerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
                    .then(result => {
                        if(result === null){
                            sellerApplicationCollection.insertOne(application)
                                .then(r3 => {

                                })
                                .catch(err => {
                                    reject(err);
                                    throw err;
                                })
                        }else{
                            sellerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
                                .then(application => {
                                    if(application.isApproved){

                                    }else{

                                    }
                                })
                                .catch(err => {
                                    reject(err);
                                    throw err;
                                })
                        }

                        return resolve('OK')
                    })


            }else{
                return resolve('OK')
            }
        }))


    }

    let infoUpdateResult = await userInfoUpdate();
    let passwordUpdateResult = await passwordUpdate();
    let influencerApplyResult = await submitInfluencerApplication();
    let sellerApplyResult = await submitSellerApplication();



    res.json({infoUpdateResult: infoUpdateResult, passwordUpdateResult: passwordUpdateResult, influencerApplyResult: influencerApplyResult, sellerApplyResult: sellerApplyResult})

});

router.get('/influencer/isApplied', (req, res) => {
    let uniqueId = req.query.uniqueId

    let db = database.getDb();

    let influencerApplicationCollection = db.collection('INFLUENCER_APPLICATION');

    influencerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(result => {
            if(result === null){
                res.json({isApplied: false})
            }else{
                res.json({isApplied: true})
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })

});

router.get('/influencer/isApproved', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb()

    let influencerApplicationCollection = db.collection('INFLUENCER_APPLICATION')

    influencerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(result => {
            if(result === null){
                res.json({isApproved: false})
            }else{
                if(result.isApproved){
                    res.json({isApplied: true})
                }else{
                    res.json({isApplied: false})
                }


            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/seller/isApproved', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb()

    let sellerApplicationCollection = db.collection('SELLER_APPLICATION');

    sellerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(result => {
            if(result === null){
                res.json({isApproved: false})
            }else{
                if(result.isApproved){
                    res.json({isApplied: true})
                }else{
                    res.json({isApplied: false})
                }
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.get('/seller/isApplied', (req, res) => {
    let uniqueId = req.query.uniqueId;

    let db = database.getDb();

    let sellerApplicationCollection = db.collection('SELLER_APPLICATION');

    sellerApplicationCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(result => {
            if(result === null){
                res.json({isApplied: false})
            }else{
                res.json({isApplied: true})
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })
});

router.post('/get/email', (req, res) => {
    let name = req.body.name;
    let userId = req.body.userId;

    let db = database.getDb();

    let userCollection = db.collection('USER');

    userCollection.findOne({fullName: name, userId: userId})
        .then(user => {
            if(user !== null){
                res.json({status: 200, email: user.email})
            }else{
                res.json({status: 201})
            }
        })
});

router.get('/get/password', (req, res) => {
    let name = req.query.name;
    let lastName = req.query.lastName;
    let userId = req.query.userId;
    let email = req.query.email;

    let db = database.getDb();
    let userCollection = db.collection('USER')

    userCollection.findOne({fullName: name, userId: userId, email: email})
        .then(user => {
            if(user !== null){

                let poolConfig = {
                    pool: true,
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true, // use SSL
                    auth: {
                        user:'earnit2222@gmail.com',
                        pass: 'zbqmflr1!'
                    }
                };

                let smtpTransport = nodemailer.createTransport(poolConfig);

                let mailOptions = {
                    from: 'earnit2222@gmail.com',
                    to: email,
                    subject: 'Earn-it 비밀번호 안내',
                    html:'<html> ' +
                        '<meta charset="UTF-8"> ' +
                        '<p> ' +
                        '<font size="3">' +
                        '비밀번호: ' +
                        '<b>' +
                        cryptr.decrypt(user.password) +
                        '</b> ' +
                        '</font> ' +
                        '</p> ' +
                        '</html>'
                };
                smtpTransport.sendMail(mailOptions, function (error, response) {

                    if (error) {
                        res.status(500).send()
                        throw error;
                    } else {


                    }

                });

                res.status(200).send();


            }else{

                res.status(204).send()

            }
        })
        .catch(err => {
            res.status(500).send()
            throw err;
        })
});

router.get('/get/matched/product', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();

    let matchProductCollection = db.collection('MATCH_PRODUCT');

    matchProductCollection.aggregate([
        {$match: {uniqueId: new objectId(uniqueId), isConfirmed: true}},
        {
            $lookup: {
                from: 'PRODUCT',
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: 'product._id',
                foreignField: 'productId',
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
                localField: 'product._id',
                foreignField: 'productId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {
            $group: {
                _id: '$_id',
                productId: {$first: '$product._id'},
                uniqueId: {$first: '$uniqueId'},
                commissionRate: {$first: '$commissionRate'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$product.title'},
                subtitle: {$first: '$product.subtitle'},
                images: {$addToSet: {productId: '$_id', filename: '$images.filename', productImageType: '$images.productImageType'}},
                price: {$first: '$product.price'},
                currency: {$first: '$product.currency'},
                discountRate: {$first: '$product.discountRate'}
            }
        },
        {
            $project: {
                _id: 1,
                productId: 1,
                commissionRate: 1,
                hashTags:1,
                title: 1,
                images:1,
                subtitle: 1,
                price: 1,
                currency: 1,
                discountRate: 1
            }
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send();
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }

            let products = [];

            docs.forEach(doc => {

                let images = [];

                doc.images.forEach(image => {


                    if(image.productImageType === undefined){
                        images.push(image.filename)
                    }else{
                        if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                            images.push(image.filename)
                        }
                    }
                });

                let obj = {
                    _id: doc._id,
                    productId: doc.productId,
                    commissionRate: doc.commissionRate,
                    hashTags: doc.hashTags,
                    title: doc.title,
                    subtitle: doc.subtitle,
                    images: [],
                    price: doc.price,
                    currency: doc.currency,
                    discountRate: doc.discountRate

                };

                obj.images = images;

                products.push(obj)

            });

            res.json(products)
        })

    })
});

router.post('/get/bank', (req, res) => {
    res.json(util.BANK)
})



module.exports = router;


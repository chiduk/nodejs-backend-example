let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
let util  = require('../util/constants');

router.get('/product', (req, res) => {
    let db = database.getDb();
    let keyword = req.query.keyword;
    let keywords = keyword.split(/[\s,"]+/);

    let productCollection = db.collection('PRODUCT');

    let inArray = [];

    keywords.forEach(word => {
        let regex = new RegExp([word].join(''), 'i');
        inArray.push(regex)
    });

    productCollection.aggregate([
        {
            $lookup: {
                from: 'HASH_TAG',
                localField: '_id',
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
                localField: '_id',
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
                uniqueId: {$first: '$uniqueId'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$title'},
                subtitle: {$first: '$subtitle'},
                images: {$addToSet: {productId: '$_id', filename: '$images.filename', productImageType: '$images.productImageType'}},
                price: {$first: '$price'},
                currency: {$first: '$currency'},
                discountRate: {$first: '$discountRate'}
            }
        },
        {
            $project: {
                _id: 1,

                hashTags:1,
                title: 1,

                images:1,
                subtitle: 1,
                price: 1,
                currency: 1,
                discountRate: 1

            }
        },
        {
            $match: {$or: [{subtitle: {$in : inArray}}, {title: {$in: inArray}}, {hashTags: {$in: inArray}} ]}
        }
    ], (err, cursor) => {
        if(err){
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let products = [];

            docs.forEach(doc => {




                let images = []

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
                    productId: doc._id,
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
})

router.get('/matched/product', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.query.uniqueId;
    let keyword = req.query.keyword;
    let matchProductCollection = db.collection('MATCH_PRODUCT');

    matchProductCollection.aggregate([
        {
            $match: {uniqueId: new objectId(uniqueId), isConfirmed: true}
        },
        {
            $lookup: {
                from : 'PRODUCT',
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
            $match: {'images.productImageType' : 'PRODUCT'}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$product.title'},
                subtitle: {$first: '$product.subtitle'},
                images: {$addToSet: {imageId: '$images._id', productId: '$_id', filename: '$images.filename', productImageType: '$images.productImageType'}},
                price: {$first: '$product.price'},
                currency: {$first: '$product.currency'},
                discountRate: {$first: '$product.discountRate'}
            }
        },
        {
            $unwind: '$images'

        },
        {
            $sort: {'images.imageId': 1}
        },
        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$title'},
                subtitle: {$first: '$subtitle'},
                images: {$first: '$images'},
                price: {$first: '$price'},
                currency: {$first: '$currency'},
                discountRate: {$first: '$discountRate'}
            }
        },
        {
            $project: {
                _id: 1,
                hashTags:1,
                title: 1,
                images:1,
                subtitle: 1,
                price: 1,
                currency: 1,
                discountRate: 1
            }
        },
        {
            $match: {$or: [ {title: {$regex: keyword}},  {subtitle: {$regex: keyword}},  {hashTags: {$regex: keyword} } ]}
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send();
            throw err;
        }

        cursor.toArray((e2, docs) => {
            if(e2){
                throw e2;
            }

            let products = [];

            docs.forEach(doc => {

                let obj = {
                    _id: doc._id,
                    productId: doc._id,
                    hashTags: doc.hashTags,
                    title: doc.title,
                    subtitle: doc.subtitle,
                    images: [doc.images.filename],
                    price: doc.price,
                    currency: doc.currency,
                    discountRate: doc.discountRate

                };

                products.push(obj)

            });

            res.json(products)


        })
    })
});

router.get('/feed', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();
    let keyword = req.query.keyword;
    let keywords = keyword.split(/[\s,"]+/);
    let feedCollection = db.collection('FEED');

    let uniqueIdObj = '';

    if(uniqueId === 'null'){

    }else{
        uniqueIdObj = new objectId(uniqueId)
    }

    let inArray = [];

    keywords.forEach(word => {
        let regex = new RegExp([word].join(''), 'i');
        inArray.push(regex)
    });

    feedCollection.aggregate([
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
                user: {$first: '$user'},
                feedType: {$first: '$feedType'},
                hashTags: {$addToSet: '$hashTags.hashTag'},
                title: {$first: '$title'},
                description: {$first: '$description'},
                productId: {$first: '$productId'},
                images: {$addToSet: '$images.filename'},
                likes: {$first: '$likes'},
                comments: {$first: '$comments'},
                commentComments: {$first: '$commentComments'},
                blockedFeed:{$first: '$blockedFeed'},
                blockFeedUniqueId: {$addToSet: '$blockedFeed.uniqueId'},
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
                feedType: 1,
                user: 1,
                hashTags:1,
                title: 1,
                description: 1,
                productId: 1,
                images:1,
                likeCount: {$size: '$likes'},
                commentCount: {$size: '$comments'},
                commentCommentCount: {$size: '$commentComments'},
                blockFeedUniqueId: 1,
                blockedFeed:1,
                isBlocked: {$cond: [{$in: [new objectId(uniqueId), '$blockFeedUniqueId']}, true, false ]},
                isLiked: {$cond: [{$in: [uniqueIdObj, '$myLikedFeed']}, true, false]},
                isSaved: {$cond: [{$in: [uniqueIdObj, '$savedFeeds']}, true, false]}

            }
        },
        {
            $match: {$or: [{description: {$in : inArray}}, {title: {$in: inArray}}, {hashTags: {$in: inArray}} ]}
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

                let images = [];

                doc.images.forEach(image => {
                    images.push(image.filename)
                });

                let obj =  {
                    feedId: doc._id,
                    uniqueId: doc.uniqueId,
                    feedType: doc.feedType,
                    user: {},
                    title: doc.title,
                    description: doc.description,
                    hashTags: doc.hashTags,
                    images: doc.images,
                    likeCount: doc.likeCount,
                    commentCount: doc.commentCount + doc.commentCommentCount,
                    isLiked: doc.isLiked,
                    isSaved: doc.isSaved
                };

                obj.user.userId = doc.user.userId;
                obj.user.uniqueId = doc.user._id;

                feeds.push(obj)
            });
            console.log(feeds)

            res.json(feeds);
        })
    })
})



router.get('/hashTag', (req, res) => {
    let db = database.getDb();
    let keyword = req.query.keyword;
    let keywords = keyword.split(/[\s,"]+/);
    let hashTagCollection = db.collection('HASH_TAG');

    let inArray = [];

    keywords.forEach(word => {
        let regex = new RegExp([word].join(''), 'i');
        inArray.push(regex)
    })



    hashTagCollection.aggregate([
        {
            $match: { hashTag: {$in: inArray}}
        },
        {
            $lookup: {
                from: 'FEED',
                localField: 'feedId',
                foreignField: '_id',
                as: 'feeds'
            }
        },
        {
            $unwind: '$feeds'
        },
        {
            $lookup: {
                from: 'PRODUCT',
                localField: 'feeds.productId',
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
                localField: 'feeds.productId',
                foreignField: 'productId',
                as: 'productImages'
            }
        },
        {
            $unwind: '$productImages'
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'feeds._id',
                foreignField: 'feedId',
                as: 'feedImages'
            }
        },
        {
            $unwind: '$feedImages'
        },
        {
            $group: {
                _id: '$hashTag',
                feeds: {$addToSet: '$feeds'}
            }

        },
        {
            $project: {
                _id: 1,
                count: {$size: '$feeds'}
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

            let results = []

            docs.forEach(doc => {
                //doc.feedId = doc._id;
                doc.hashTag = doc._id;
                results.push(doc)
            })

            res.json(results)
        })
    })
});

router.get('/user', (req, res) => {
    let uniqueId = req.query.uniqueId;
    let db = database.getDb();
    let userId = req.query.userId;
    let userType = req.query.userType;

    let regex = new RegExp(userId, 'i');

    let userCollection = db.collection('USER');

    console.log(uniqueId, userId)

    let userTypeObj = {};

    if(userType === util.SEARCH_USER_TYPE.ALL){

    }else if(userType === util.SEARCH_USER_TYPE.INFLUENCER){
        userTypeObj = {isInfluencer: true}
    }else if(userType === util.SEARCH_USER_TYPE.SELLER){
        userTypeObj = {isSeller: true}
    }else if(userType === util.SEARCH_USER_TYPE.BUYER){

    }



    userCollection.findOne({_id: new objectId(uniqueId)})
        .then(user => {
            if(user !== null){

                //if(user.isAdmin){
                if(true){

                    userCollection.aggregate([
                        {
                            $facet: {
                                'influencers': [
                                    {
                                        $lookup:{
                                            from:'INFLUENCER_APPLICATION',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'influencerApplication'
                                        }
                                    },
                                    {
                                        $unwind:{
                                            path: '$influencerApplication',
                                            preserveNullAndEmptyArrays: true
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: 'INFLUENCER',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'influencerInfo'
                                        }
                                    },
                                    {
                                        $unwind : {
                                            path: '$influencerInfo',
                                            preserveNullAndEmptyArrays: true
                                        }
                                    }
                                ],

                                'sellers': [
                                    {
                                        $lookup: {
                                            from:'SELLER_APPLICATION',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'sellerApplication'
                                        }
                                    },
                                    {
                                        $unwind : {
                                            path: '$sellerApplication',
                                            preserveNullAndEmptyArrays: true
                                        }
                                    },
                                    {
                                        $lookup: {
                                            from: 'SELLER',
                                            localField: '_id',
                                            foreignField: 'uniqueId',
                                            as: 'sellerInfo'
                                        }
                                    },
                                    {
                                        $unwind : {
                                            path: '$sellerInfo',
                                            preserveNullAndEmptyArrays: true
                                        }
                                    }

                                ]
                            }
                        },
                        {$project: {
                                data: {
                                    $setUnion:['$influencers','$sellers']
                                }
                            }
                        },
                        {$unwind: '$data'},
                        {$replaceRoot: { newRoot: "$data" }},
                        {$match: {$or: [ {firstName: regex}, {lastName: regex} ,{userId: regex}, {fullName: regex}  ]}},
                        // {$match: userTypeObj},
                        {
                            $group: {
                                _id: '$_id',
                                firstName: {$first: '$firstName'},
                                lastName: {$first: '$lastName'},
                                fullName: {$first: '$fullName'},
                                email: {$first: '$email'},
                                userId: {$first: '$userId'},
                                date: {$first: '$date'},
                                isInfluencer: {$first: '$isInfluencer'},
                                instagram: {$first: '$instagram'},
                                youtube: {$first: '$youtube'},
                                blog: {$first: '$blog'},
                                isActive: {$first: '$isActive'},
                                sellerApplication:{$addToSet: '$sellerApplication'},
                                influencerApplication:{$addToSet: '$influencerApplication'},
                                sellerInfo: {$addToSet: '$sellerInfo'},
                                influencerInfo: {$addToSet: '$influencerInfo'}

                            }
                        },
                        {
                            $unwind: {
                                path: '$sellerApplication',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $unwind: {
                                path: '$influencerApplication',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $unwind: {
                                path: '$sellerInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $unwind: {
                                path: '$influencerInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $project: {
                                _id: '$_id',
                                firstName: 1,
                                lastName: 1,
                                fullName: 1,
                                email: 1,
                                userId: 1,
                                date: 1,
                                instagram: 1,
                                youtube: 1,
                                blog: 1,
                                isActive: 1,
                                sellerApplication: 1,
                                influencerApplication: 1,
                                sellerInfo: 1,
                                influencerInfo: 1,
                                isSeller: {$ifNull: ['$sellerInfo', false]},
                                isInfluencer: {$ifNull: ['$influencerInfo', false]}
                            }
                        }

                    ], (err, cursor) => {
                        if(err){
                            res.status(500).send()
                            throw err;
                        }

                        cursor.toArray((e2, docs) => {
                            if(e2){
                                res.status(500).send();
                                throw e2;
                            }

                            let applications = [];

                            docs.forEach(doc => {


                                let application = {
                                    uniqueId: doc._id,
                                    applicationId: '',
                                    firstName: doc.fullName,
                                    lastName: '',
                                    fullName: doc.fullName,
                                    userId: doc.userId,
                                    email: doc.email,
                                    instagram: doc.instagram,
                                    youtube: doc.youtube,
                                    blog: doc.blog,
                                    sellerApplication: {},
                                    influencerApplication: {},
                                    influencerInfo: {},
                                    sellerInfo: {},
                                    date: doc.date,
                                    isActive: doc.isActive,
                                    isSeller: doc.isSeller,
                                    isInfluencer: doc.isInfluencer
                                }

                                if(doc.influencerApplication !== undefined && doc.influencerApplication !== null){
                                    application.influencerApplication = doc.influencerApplication;
                                    application.influencerApplication.applicationId = doc.influencerApplication._id;
                                    application.applicationId = doc.influencerApplication._id
                                }

                                if(doc.sellerApplication !== null && doc.sellerApplication !== undefined){
                                    application.sellerApplication = doc.sellerApplication;
                                    application.sellerApplication.applicationId = doc.sellerApplication._id;
                                    application.applicationId = doc.sellerApplication._id
                                }

                                if(doc.influencerInfo !== null && doc.influencerInfo !== undefined){
                                    application.influencerInfo = doc.influencerInfo;
                                    application.influencerInfo.influencerId = doc.influencerInfo._id

                                }

                                if(doc.sellerInfo !== null && doc.sellerInfo !== undefined){
                                    application.sellerInfo = doc.sellerInfo;
                                    application.sellerInfo.sellerId = doc.sellerInfo._id
                                }

                                applications.push(application)


                                // console.log(application)
                            });




                            res.json(applications)
                        })
                    })
                }else{

                }
            }
        })
        .catch(err => {
            res.status(500).send()

            throw err;
        })
});

module.exports = router;
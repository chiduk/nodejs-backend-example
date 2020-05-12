let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
const util = require('../util/constants');

router.get('/get/notification', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'null' || uniqueId === 'undefined' ||uniqueId === undefined || uniqueId === null){


        res.json([]);

        return
    }

    let db = database.getDb();

    let notificationCollection = db.collection('NOTIFICATION');


    notificationCollection.aggregate([
        {
            $match: {
                ownerUniqueId: new objectId(uniqueId)
            }
        },
        {
            $lookup: {
                from: 'USER',
                localField: 'reviewerUniqueId',
                foreignField: '_id',
                as: 'reviewer'
            }
        },
        {
            $unwind: {
                path: '$reviewer',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'COMMENT_FEED',
                localField: 'feedCommentId',
                foreignField: '_id',
                as: 'feedComments'
            }
        },
        {
            $unwind: {
                path: '$feedComments',
                preserveNullAndEmptyArrays: true

            }
        },
        {
            $lookup: {
                from: 'COMMENT_PRODUCT',
                localField: 'productCommentId',
                foreignField: '_id',
                as: 'productComments'
            }
        },
        {
            $unwind: {
                path: '$productComments',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'feedId',
                foreignField: 'feedId',
                as: 'feedImages'
            }
        },
        {
            $lookup: {
                from: 'IMAGE',
                localField: 'productId',
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
                from: 'PRODUCT',
                localField: 'productId',
                foreignField: '_id',
                as:'product'
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
                from: 'USER',
                localField: 'requesterId',
                foreignField: '_id',
                as:'requester'
            }
        },
        {
            $unwind: {
                path: '$requester',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $group: {
                _id: '$_id',
                threadId: {$first: '$threadId'},
                notificationType: {$first: '$notificationType'},
                matchRequestId: {$first: '$matchRequestId'},
                productId: {$first: '$productId'},
                feedId: {$first: '$feedId'},
                ownerUniqueId: {$first: '$ownerUniqueId'},
                reviewer: {$first: '$reviewer'},
                feedComment: {$first: '$feedComments'},
                feedImages: {$addToSet: '$feedImages.filename'},
                productComment: {$first: '$productComments'},
                productImages: {$push: {type: '$productImages.productImageType', filename: '$productImages.filename'}},
                product: {$first: '$product'},
                requester: {$first: '$requester'}
            }
        },

        {
            $project: {
                threadId: 1,
                notificationType: 1,
                matchRequestId: 1,
                feedId: 1,
                productId: 1,
                ownerUniqueId:1,
                reviewer: 1,
                feedComment:1,
                productComment: 1,
                feedImages: 1,
                productImages: 1,
                product: 1,
                requester: 1
            }
        },
        {
            $unwind: '$feedImages'
        },
        {
            $sort: {_id : -1}
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send();
            throw err;
        }

        let notifications = [];

        cursor.toArray((e2, docs) => {
            if(e2){
                res.status(500).send();
                throw e2;
            }


            docs.forEach(doc => {


                if(doc.notificationType === util.NOTIFICATION_TYPE.FEED_COMMENT){
                    let obj = {
                        notificationType: doc.notificationType ,
                        notificationId: doc._id,
                        feedId: doc.feedId,
                        reviewer: {},
                        feedComment: doc.feedComment,

                        feedImages: doc.feedImages
                    };

                    obj.reviewer.uniqueId = doc.reviewer._id;
                    obj.reviewer.userId = doc.reviewer.userId;

                    obj.feedComment.commentId = doc.feedComment._id;



                    notifications.push(obj)
                }else if(doc.notificationType === util.NOTIFICATION_TYPE.PRODUCT_COMMENT) {
                    let obj = {
                        notificationType: doc.notificationType ,
                        notificationId: doc._id,
                        productId: doc.productId,
                        feedId: doc.feedId,
                        reviewer: {},
                        productComment: doc.productComment,

                        productImages: []
                    };

                    obj.reviewer.uniqueId = doc.reviewer._id;
                    obj.reviewer.userId = doc.reviewer.userId;

                    obj.productComment.commentId = doc.productComment._id;

                    doc.productImages.forEach(image => {
                        if(image.productImageType === undefined){
                            obj.productImages.push(image.filename)
                        }else {
                            if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){
                                obj.productImages.push(image.filename)
                            }
                        }
                    })

                    notifications.push(obj)
                }else if(doc.notificationType === util.NOTIFICATION_TYPE.MATCH_REQUEST){

                    let obj = {
                        threadId: doc.threadId,
                        notificationId: doc._id,
                        notificationType: doc.notificationType ,
                        matchRequestId: doc.matchRequestId,
                        requester: {
                            uniqueId: doc.requester._id,
                            userId: doc.requester.userId
                        },
                        product: {
                            productId: doc.product._id,
                            title: doc.product.title,
                            images: []
                        }
                    };

                    let images = []
                    doc.productImages.forEach(image => {
                        if(image.type === util.PRODUCT_IMAGE_TYPE.PRODUCT){

                            images.push(image.filename)
                        }
                    });

                    obj.product.images = images;

                    notifications.push(obj)

                }else if(doc.notificationType === util.NOTIFICATION_TYPE.MATCH_REQUEST_SENT){
                    let obj = {
                        threadId: doc.threadId,
                        notificationId: doc._id,
                        notificationType: doc.notificationType ,
                        matchRequestId: doc.matchRequestId,

                        product: {
                            productId: doc.product._id,
                            title: doc.product.title,
                            images: []
                        }
                    };

                    let images = []
                    doc.productImages.forEach(image => {
                        if(image.type === util.PRODUCT_IMAGE_TYPE.PRODUCT){

                            images.push(image.filename)
                        }
                    });

                    obj.product.images = images;

                    notifications.push(obj)
                }else if(doc.notificationType === util.NOTIFICATION_TYPE.MATCH_REQUEST_CONFIRM){
                    console.log(doc);

                    let obj = {
                        threadId: doc.threadId,
                        notificationId: doc._id,
                        notificationType: doc.notificationType ,
                        matchRequestId: doc.matchRequestId,
                        requester: {},
                        product: {
                            productId: doc.product._id,
                            title: doc.product.title,
                            images: []
                        }
                    };

                    let images = []
                    doc.productImages.forEach(image => {
                        if(image.type === util.PRODUCT_IMAGE_TYPE.PRODUCT){

                            images.push(image.filename)
                        }
                    });

                    if(doc.requester !== null){
                        obj.requester.userId = doc.requester.userId;
                        obj.requester.uniqueId = doc.requester._id
                    }

                    obj.product.images = images;

                    notifications.push(obj)
                }else if(doc.notificationType === util.NOTIFICATION_TYPE.MATCH_REQUEST_CANCEL){
                    console.log(doc);

                    let obj = {
                        threadId: doc.threadId,
                        notificationId: doc._id,
                        notificationType: doc.notificationType ,
                        matchRequestId: doc.matchRequestId,
                        requester: {},
                        product: {
                            title: doc.product.title,
                            images: []
                        }
                    };

                    let images = []
                    doc.productImages.forEach(image => {
                        if(image.type === util.PRODUCT_IMAGE_TYPE.PRODUCT){

                            images.push(image.filename)
                        }
                    });

                    if(doc.requester !== null){
                        obj.requester.userId = doc.requester.userId;
                        obj.requester.uniqueId = doc.requester._id
                    }

                    obj.product.images = images;

                    notifications.push(obj)
                }
            });

            res.json(notifications)
        })



    })

});

router.post('/reset', (req, res) => {
    let uniqueId = req.body.uniqueId;

    if(uniqueId === 'undefined' || uniqueId === 'null' || uniqueId === undefined || uniqueId === null){
        res.status(200).send();
        return;
    }


    let db = database.getDb();

    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');

    notificationCountCollection.updateOne({uniqueId: new objectId(uniqueId)}, {$set: {count: 0}})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send();

            throw err;
        })
});

router.get('/get/count', (req, res) => {
    let uniqueId = req.query.uniqueId;

    if(uniqueId === 'undefined' || uniqueId === 'null' || uniqueId === undefined || uniqueId === null){
        res.json({count: 0})
        return;
    }

    let db = database.getDb();

    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');

    notificationCountCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(result => {
            if(result !== null){
                res.json({count: result.count})
            }else{
                res.json({count: 0})
            }
        })
        .catch(err => {
            res.status(500).send();
            throw err;
        })

})


module.exports = router;
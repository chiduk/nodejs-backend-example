let express = require('express');
let router = express.Router();
const logger = require('../config/logger');
const database = require('../database');
let objectId = require('mongodb').ObjectID;
const multer = require('multer');
const shortid = require('shortid');
const util = require('../util/constants');
let getUid = require('get-uid');
let sizeOf = require('image-size');
let filepath = require('../config/filepath');

let productImageStorage =  multer.diskStorage({
    destination: function(req, file, cb){




        let filetext = file.originalname.split(':')


        let filename = filetext[0];
        let type = filetext[1];


        let destination = '';
        if(type === 'product'){
            destination = util.FILE_PATH.PRODUCT
        }else if(type === 'description'){
            destination = util.FILE_PATH.PRODUCT_DESC
        }
        cb(null, destination)
    },
    filename: function (req, file, cb) {

        let filetext = file.originalname.split(':')


        let filename = filetext[0]
        let type = filetext[1]


        if(type === 'product'){

        }else if(type === 'description'){

        }

        let extension = filename.split('.').pop()

        if(file.mimetype === 'video/mp4'){
            cb(null, shortid.generate() + '.mp4');
        }else{
            cb(null, shortid.generate() + '.jpg');
        }

    }
});

let productUpload = multer({storage: productImageStorage});

router.post('/update/detail', productUpload.any(), (req, res) => {
    let productId = req.body.productId;
    let uniqueId = req.body.uniqueId;
    let title = req.body.title;
    let price = req.body.price;
    let description = req.body.description;
    let commission = req.body.commission;
    let discountRate = req.body.discountRate;
    let shippingCost = req.body.shippingCost;
    let extraShippingCost = req.body.extraShippingCost;
    let totalInventory = req.body.totalInventory;
    let hashTags = JSON.parse(req.body.hashTags)
    let options = JSON.parse(req.body.options);
    let currency = req.body.currency;
    let prevProductImages = JSON.parse(req.body.prevProductImages);
    let prevProductDescImages = JSON.parse(req.body.prevProductDescImages);

    let db = database.getDb()

    let productCollection = db.collection('PRODUCT');
    let imageCollection = db.collection('IMAGE');
    let productOptionCollection = db.collection('PRODUCT_OPTION');
    let hashTagCollection = db.collection('HASH_TAG');
    let sellerCollection = db.collection('SELLER');

    let images = req.files;


    let basicInfoUpdate = () => {
        return new Promise((resolve, reject) => {
            let obj = {

                title: title,
                price: price,
                description: description,
                commission: commission,
                discountRate: discountRate,
                shippingCost: shippingCost,
                extraShippingCost: extraShippingCost,
                totalInventory: totalInventory,
                currency: currency

            };

            productCollection.updateOne({_id: new objectId(productId)}, {$set: obj})
                .then(result => {
                    return resolve('OK')
                })
                .catch(err => {
                    reject(err);
                    throw err;
                })
        })
    };

    let imageUpdate = () => {
        return new Promise((resolve, reject) => {

            imageCollection.deleteMany({productId: new objectId(productId)})
                .then(result => {


                    prevProductImages.forEach(filename => {
                        let obj = {
                            productId: new objectId(productId),
                            filename: filename,
                            productImageType: util.PRODUCT_IMAGE_TYPE.PRODUCT,
                            date: new Date()
                        }

                        let filepath = util.FILE_PATH.PRODUCT + filename;

                        if(filename.endsWith('.mp4')){

                        }else{
                            obj.dimensions = sizeOf(filepath)
                        }

                        imageCollection.insertOne(obj)
                    });

                    prevProductDescImages.forEach(filename => {
                        let obj = {
                            productId: new objectId(productId),
                            filename: filename,
                            productImageType: util.PRODUCT_IMAGE_TYPE.DESCRIPTION,
                            date: new Date()
                        }

                        let filepath = util.FILE_PATH.PRODUCT_DESC + filename;

                        if(filename.endsWith('.mp4')){

                        }else{
                            obj.dimensions = sizeOf(filepath)
                        }

                        imageCollection.insertOne(obj)
                    })

                    images.forEach(image => {
                        let filetext = image.originalname.split(':');

                        let filename = image.filename;
                        let type = filetext[1];

                        let obj = {
                            productId: new objectId(productId),
                            filename: filename,
                            productImageType: '',
                            date: new Date()
                        }



                        if(type === 'product'){
                            obj.productImageType = util.PRODUCT_IMAGE_TYPE.PRODUCT;

                            let filepath = util.FILE_PATH.PRODUCT + filename;
                            if(filename.endsWith('.mp4')){

                            }else{
                                obj.dimensions = sizeOf(filepath)
                            }
                        }else if(type === 'description'){
                            obj.productImageType = util.PRODUCT_IMAGE_TYPE.DESCRIPTION;


                            let filepath = util.FILE_PATH.PRODUCT_DESC + filename;
                            if(filename.endsWith('.mp4')){

                            }else{
                                obj.dimensions = sizeOf(filepath)
                            }
                        }

                        imageCollection.insertOne(obj)
                    })


                    return resolve('OK')
                })
                .catch(err => {
                    reject(err);
                    throw err;
                })






        })
    };


    let hashTagUpdate = () => {
        return new Promise((resolve, reject) => {
            hashTagCollection.deleteMany({productId: new objectId(productId)})
                .then(result => {
                    hashTags.forEach(hashTag => {
                        let obj = {
                            productId: new objectId(productId),
                            hashTag: hashTag,
                            date: new Date()
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
    };

    let optionUpdate = () => {
        return new Promise((resolve, reject) => {
            productOptionCollection.deleteMany({productId: new objectId(productId)})
                .then(result => {
                    options.forEach(option => {
                        let obj = {
                            productId: new objectId(productId),
                            title: option.name,
                            priceAddition: option.price,
                            inventory: option.inventory,
                            date: new Date()
                        }

                        productOptionCollection.insertOne(obj)
                    })

                    return resolve('OK')
                })
                .catch(err => {
                    reject(err)
                    throw err;
                })

        })
    };


    basicInfoUpdate();
    imageUpdate();
    hashTagUpdate();
    optionUpdate();

    res.status(200).send()



})

router.post('/add', productUpload.any(), (req, res) => {
    let uniqueId = req.body.uniqueId;
    let title = req.body.title;
    let price = req.body.price;
    let description = req.body.description;
    let commission = req.body.commission;
    let discountRate = req.body.discountRate;
    let shippingCost = req.body.shippingCost;
    let extraShippingCost = req.body.extraShippingCost;
    let totalInventory = req.body.totalInventory;
    let hashTags = JSON.parse(req.body.hashTags)
    let options = JSON.parse(req.body.options);
    let currency = req.body.currency;

    let db = database.getDb()

    let productCollection = db.collection('PRODUCT');
    let imageCollection = db.collection('IMAGE');
    let productOptionCollection = db.collection('PRODUCT_OPTION');
    let hashTagCollection = db.collection('HASH_TAG');
    let sellerCollection = db.collection('SELLER');

    let images = req.files;


    sellerCollection.findOne({uniqueId: new objectId(uniqueId)})
        .then(seller => {
            if(seller !== null){


                let productPrice = parseInt(price);
                let productCommission = parseInt(commission);
                let productDiscountRate = parseInt(discountRate);
                let productShippingCost = parseInt(shippingCost);
                let productExtraShippingCost = parseInt(extraShippingCost);
                let productTotalInventory = parseInt(totalInventory);


                if(isNaN(productPrice)){
                    productPrice = 0;
                }

                if(isNaN(productCommission)){
                    productCommission = 0;
                }

                if(isNaN(productDiscountRate)){
                    productDiscountRate = 0
                }

                if(isNaN(productShippingCost)){
                    productShippingCost = 0;
                }

                if(isNaN(productExtraShippingCost)){
                    productExtraShippingCost = 0;
                }

                if(isNaN(productTotalInventory)){
                    productTotalInventory = 0;
                }

                let obj = {
                    productUID: 'P'+getUid(),
                    sellerId: seller._id,
                    title: title,
                    price: productPrice,
                    description: description,
                    commission: productCommission,
                    discountRate: productDiscountRate,
                    shippingCost: productShippingCost,
                    extraShippingCost: productExtraShippingCost,
                    totalInventory: productTotalInventory,
                    currency: currency,
                    date: new Date()
                }

                productCollection.insertOne(obj)
                    .then(result => {
                        let productId = result.insertedId;
                        let date = new Date()


                        options.forEach(option => {
                            let optionPrice = parseInt(option.price);
                            let optionInventory = parseInt(option.inventory);

                            if(isNaN(optionPrice)){
                                optionPrice = 0
                            }

                            if(isNaN(optionInventory)){
                                optionInventory = 0;
                            }

                            let obj = {
                                productId: productId,
                                title: option.name,
                                priceAddition: optionPrice,
                                inventory: optionInventory,
                                date: date
                            }

                            productOptionCollection.insertOne(obj)
                        })

                        hashTags.forEach(hashTag => {
                            let obj = {
                                productId: productId,
                                hashTag: hashTag,
                                date: date
                            }

                            hashTagCollection.insertOne(obj)
                        })

                        images.forEach(image => {


                            let filetext = image.originalname.split(':');

                            let filename = image.filename;
                            let type = filetext[1];

                            let obj = {
                                productId: productId,
                                filename: filename,
                                productImageType: '',
                                date: date
                            }

                            if(type === 'product'){
                                obj.productImageType = util.PRODUCT_IMAGE_TYPE.PRODUCT;

                                let filepath = util.FILE_PATH.PRODUCT + filename;

                                if(filename.endsWith('.mp4')){

                                }else{
                                    obj.dimensions = sizeOf(filepath)
                                }
                            }else if(type === 'description'){
                                obj.productImageType = util.PRODUCT_IMAGE_TYPE.DESCRIPTION;

                                let filepath = util.FILE_PATH.PRODUCT_DESC + filename

                                if(filename.endsWith('.mp4')){

                                }else{
                                    obj.dimensions = sizeOf(filepath)
                                }


                            }

                            imageCollection.insertOne(obj)

                        })


                        res.status(200).send()

                    })
                    .catch(err => {
                        res.status(500).send();
                        throw err;
                    })

            }else{
                res.status(600).send()
            }
        })






});

router.post('/comment/comment/add', (req, res) => {
    let db = database.getDb();
    let productId = req.body.productId;
    let commentId = req.body.commentId;
    let lastCommentCommentId = req.body.lastCommentCommentId;
    let uniqueId = req.body.uniqueId; //reviewer Id
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;

    let reviewerId = uniqueId;

    let commentCommentProductCollection = db.collection('COMMENT_COMMENT_PRODUCT');
    let productCollection = db.collection('PRODUCT');

    let users = {};

    if(mentionUser !== undefined){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0];


            users[name] = new objectId(user[name])

        });
    }

    let obj = {
        uniqueId: new objectId(uniqueId),
        productId: new objectId(productId),
        commentId: new objectId(commentId),
        comment: comment,
        mentionUser: users
    };

    commentCommentProductCollection.insertOne(obj)
        .then(result => {






            if(lastCommentCommentId !== null && lastCommentCommentId !== undefined){
                commentCommentProductCollection.aggregate([
                    {
                        $match: {commentId: new objectId(commentId)}
                    },
                    {
                        $match:
                            {$and: [ { _id: {$gt: new objectId(lastCommentCommentId) }}, {_id: {$lte: result.insertedId}}]}
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

                    let comments = [];
                    cursor.toArray((e2, docs) => {
                        if(e2){
                            throw e2;
                        }

                        docs.forEach(doc => {
                            let obj = {
                                commentCommentId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: {}
                            }
                            obj.user.uniqueId = doc.user._id;
                            obj.user.userId = doc.user.userId;


                            comments.push(obj)
                        })

                        res.json(comments)
                    })
                })
            }else{
                commentCommentProductCollection.aggregate([
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
                        throw err;
                    }

                    cursor.toArray((e2, docs) => {
                        if(e2){
                            throw e2;
                        }

                        let comments = [];
                        docs.forEach( doc => {
                            let obj = {
                                commentCommentForumId: doc._id,
                                comment: doc.comment,
                                mentionUser: doc.mentionUser,
                                user: {}
                            }
                            obj.user.uniqueId = doc.user._id;
                            obj.user.userId = doc.user.userId;

                            comments.push(obj)
                        })

                        res.json(comments)
                    })
                })
            }
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send()
            throw err;
        })
});

router.post('/comment/comment/edit', (req, res) => {
    let db = database.getDb();
    let commentCommentId = req.body.commentCommentId;
    let uniqueId = req.body.uniqueId;
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;
    let users = {}
    mentionUser.forEach(user => {
        let name = Object.keys(user)[0]


        users[name] = new objectId(user[name])

    });

    let commentCommentProductCollection = db.collection('COMMENT_COMMENT_PRODUCT');

    commentCommentProductCollection.updateOne({_id: new objectId(commentCommentId), uniqueId: new objectId(uniqueId)}, {$set: {comment: comment, mentionUser:users}}, {upsert: true})
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/comment/comment/delete', (req, res) => {
    let db = database.getDb();
    let commentCommentId = req.body.commentCommentId;
    let uniqueId = req.body.uniqueId;
    let commentCommentProductCollection = db.collection('COMMENT_COMMENT_PRODUCT');

    commentCommentProductCollection.deleteOne({_id: new objectId(commentCommentId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});


router.post('/comment/add', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId; //reviewer id
    let productId = req.body.productId;
    let feedId = req.body.feedId;
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;
    let productCollection = db.collection('PRODUCT');
    let notificationCollection = db.collection('NOTIFICATION');
    let notificationCountCollection = db.collection('NOTIFICATION_COUNT');

    let reviewerUniqueId = uniqueId;

    let users = {}

    if(mentionUser !== undefined){
        mentionUser.forEach(user => {
            let name = Object.keys(user)[0]


            users[name] = new objectId(user[name])

        })

    }


    let obj = {
        uniqueId: new objectId(uniqueId),
        productId: new objectId(productId),
        feedId: new objectId(feedId),
        comment: comment,
        mentionUser: users
    }

    let commentProductCollection = db.collection('COMMENT_PRODUCT');
    commentProductCollection.insertOne(obj)
        .then(result => {

            let productCommentId = result.insertedId

            productCollection.aggregate([
                {
                    $match: { _id: new objectId(productId) }
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
                        from: 'USER',
                        localField: 'seller.uniqueId',
                        foreignField: '_id',
                        as:'productOwner'
                    }
                },
                {
                    $unwind: '$productOwner'
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

                    let productOwnerUniqueId = '';

                    docs.forEach(doc => {
                        productOwnerUniqueId = doc.productOwner._id
                    })

                    if(productOwnerUniqueId.toString() === reviewerUniqueId){

                    }else{
                        let notiObj = {
                            notificationType: util.NOTIFICATION_TYPE.PRODUCT_COMMENT,
                            productCommentId: productCommentId,
                            productId: new objectId(productId),
                            feedId: new objectId(feedId),
                            ownerUniqueId: productOwnerUniqueId,
                            reviewerUniqueId: new objectId(reviewerUniqueId)
                        }

                        notificationCollection.insertOne(notiObj)
                            .then(r2 => {
                                notificationCountCollection.updateOne({uniqueId: productOwnerUniqueId}, {$inc: {count: 1}},  {upsert: true} )
                            })
                            .catch(err => {
                                throw err;
                            })
                    }

                })
            })

            res.json({commentProductId: result.insertedId})
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/comment/edit', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId;
    let commentProductId = req.body.commentProductId;
    let comment = req.body.comment;
    let mentionUser = req.body.mentionUser;

    let users = {}
    mentionUser.forEach(user => {
        let name = Object.keys(user)[0]


        users[name] = new objectId(user[name])

    });


    let commentProductCollection = db.collection('COMMENT_PRODUCT');

    commentProductCollection.updateOne({_id: new objectId(commentProductId), uniqueId: new objectId(uniqueId)}, {$set: {comment: comment, mentionUser: users}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send()
            throw err;
        })
});

router.post('/comment/delete', (req, res) => {
    let db = database.getDb()

    let uniqueId = req.body.uniqueId;
    let commentProductId = req.body.commentProductId;


    let commentProductCollection = db.collection('COMMENT_PRODUCT');

    commentProductCollection.deleteOne({_id: new objectId(commentProductId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/getComments', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.query.uniqueId;
    let productId = req.query.productId;

    let commentProductCollection = db.collection('COMMENT_PRODUCT');

    commentProductCollection.aggregate([
        {
            $match: {productId: new objectId(productId)}
        }
    ])

});

router.post('/qna/add', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId;
    let productId = req.body.productId;
    let question = req.body.question;
    let mentionUser = req.body.mentionUser;

    let users = {};
    mentionUser.forEach(user => {
        let name = Object.keys(user)[0];


        users[name] = new objectId(user[name])

    });

    let obj = {
        uniqueId: new objectId(uniqueId),
        productId: new objectId(productId),
        question: question,
        mentionUser: users
    }

    let qnaProductCollection = db.collection('QNA_PRODUCT');
    qnaProductCollection.insertOne(obj)
        .then(result => {
            res.json({questionProductId: result.insertedId})
        })
        .catch( err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/qna/edit', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId;
    let questionProductId = req.body.questionProductId;
    let question = req.body.question;

    let qnaProductCollection = db.collection('QNA_PRODUCT');
    qnaProductCollection.updateOne({_id: new objectId(questionProductId), uniqueId: new objectId(uniqueId)}, {$set: {question: question}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err)
            res.status(500).send()
            throw err;
        })
});

router.post('/qna/delete', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId;
    let questionProductId = req.body.questionProductId;


    let qnaProductCollection = db.collection('QNA_PRODUCT');
    qnaProductCollection.deleteOne({_id: new objectId(questionProductId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err)
            res.status(500).send();
            throw err;
        })
});

router.post('/qna/comment/add', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId;
    let questionId = req.body.questionId;
    let answer = req.body.answer;
    let mentionUser = req.body.mentionUser;

    let users = {};
    mentionUser.forEach(user => {
        let name = Object.keys(user)[0];


        users[name] = new objectId(user[name])

    });

    let commentQNAProductCollection = db.collection('COMMENT_QNA_PRODUCT');

    let obj = {
        uniqueId: new objectId(uniqueId),
        questionId : new objectId(questionId),
        answer: answer,
        mentionUser: users
    };

    commentQNAProductCollection.insertOne(obj)
        .then(result => {
            res.json({answerId: result.insertedId})
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/qna/comment/edit', (req, res) => {
    let db = database.getDb()
    let uniqueId = req.body.uniqueId;
    let answerId = req.body.answerId;
    let answer = req.body.answer;

    let commentQNAProductCollection = db.collection('COMMENT_QNA_PRODUCT');

    commentQNAProductCollection.updateOne({_id: new objectId(answerId), uniqueId: new objectId(uniqueId)}, {$set: {answer: answer}}, {upsert: true})
        .then(result => {
            res.status(200).send()
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.post('/qna/comment/delete', (req, res) => {
    let db = database.getDb();
    let uniqueId = req.body.uniqueId;
    let answerId = req.body.questionProductId;


    let commentQNAProductCollection = db.collection('COMMENT_QNA_PRODUCT');

    commentQNAProductCollection.deleteOne({_id: new objectId(answerId), uniqueId: new objectId(uniqueId)})
        .then(result => {
            res.status(200).send();
        })
        .catch(err => {
            logger.error(err);
            res.status(500).send();
            throw err;
        })
});

router.get('/detail', (req, res) => {
    let db = database.getDb();

    let productId = req.query.productId;
    let feedId = req.query.feedId;

    let productCollection = db.collection('PRODUCT');
    let feedCollection = db.collection('FEED');

    feedCollection.aggregate([
        {
            $match: {_id: new objectId(feedId)}
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
                from: 'HASH_TAG',
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
                as: 'feedImages'
            }
        },
        {
            $unwind: '$feedImages'
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
            $lookup: {
                from: 'PRODUCT',
                localField: 'feedProduct.productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
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
            $lookup: {
                from: 'PRODUCT_OPTION',
                localField: 'product._id',
                foreignField: 'productId',
                as: 'options'
            }
        },

        {
            $group: {
                _id: '$_id',
                uniqueId: {$first: '$uniqueId'},
                user: {$first: '$user'},
                title: {$first: '$title'},
                description: {$first: '$description'},
                product: {$first: '$product'},
                productImage: {$addToSet: '$productImages'},
                feedImage: {$addToSet: '$feedImages.filename'},
                options: {$first: '$options'},
                hashTags: {$addToSet: '$hashTags.hashTag'}
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

            let result = {feed:{}, product:{}, options:{}, user: {}}

            docs.forEach(doc => {
                result.feed.feedId = doc._id;
                result.feed.uniqueId = doc.uniqueId;
                result.feed.title = doc.title;
                result.feed.description = doc.description;
                result.feed.image = doc.feedImage;
                result.feed.hashTags = doc.hashTags,
                result.user.uniqueId = doc.user._id;
                result.user.userId = doc.user.userId;

                result.product.productId = doc.product._id;
                result.product.title = doc.product.title;
                result.product.subtitle = doc.product.subtitle;
                result.product.discountRate = doc.product.discountRate;
                result.product.price = doc.product.price;
                result.product.currency = doc.product.currency;
                result.product.shippingCost = doc.product.shippingCost;
                result.product.extraShippingCost = doc.product.extraShippingCost;
                result.product.images = [];
                result.product.descriptionImages= [];
                result.options = doc.options;

                let productImages = [];
                let descriptionImages = [];

                doc.productImage.forEach(image => {
                    if(image.productImageType === undefined || image.productImageType === null){


                        productImages.push(image.filename)
                    }else{
                        if(image.productImageType === util.PRODUCT_IMAGE_TYPE.PRODUCT){


                            productImages.push(image.filename)
                        }else if(image.productImageType === util.PRODUCT_IMAGE_TYPE.DESCRIPTION){


                            descriptionImages.push(image.filename)
                        }


                    }
                })

                result.product.images = productImages;
                result.product.descriptionImages = descriptionImages;


            })



            res.json(result)
        })
    })
})

router.get('/suggested', (req, res) => {
    let db = database.getDb();

    let uniqueId = req.query.uniqueId;
    let feedId = req.query.feedId;
})

router.get('/get/comment', (req, res) => {
    let db = database.getDb();

    let uniqueId = req.query.uniqueId;
    let productId = req.query.productId;

    let commentProductCollection = db.collection('COMMENT_PRODUCT');

    commentProductCollection.aggregate([
        {
            $match: {productId: new objectId(productId)}
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

            let comments = [];

            docs.forEach(doc => {
                let obj = {
                    commentId: doc._id,
                    comment: doc.comment,
                    user: {}
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                comments.push(obj)
            });

            res.json(comments);
        })
    })

});

router.get('/get/comment/comment', (req, res) => {
    let db = database.getDb();

    let uniqueId = req.query.uniqueId;
    let productId = req.query.productId;
    let commentId = req.query.commentId;

    let productCommentCommentCollection = db.collection('COMMENT_COMMENT_PRODUCT');

    productCommentCommentCollection.aggregate([
        {
            $match: {commentId: new objectId(commentId)}
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

            let commentComments = [];

            docs.forEach(doc => {
                let obj = {
                    commentCommentId: doc._id,
                    user: {},
                    comment: doc.comment
                }

                obj.user.uniqueId = doc.user._id;
                obj.user.userId = doc.user.userId;

                commentComments.push(obj)
            });

            res.json(commentComments);
        })
    })

});

module.exports = router;